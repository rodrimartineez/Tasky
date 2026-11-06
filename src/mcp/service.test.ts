import { describe, expect, it } from 'vitest';
import { createProject, deleteProject } from '../core/projects';
import { emptyData } from '../core/data';
import { noRecords, type SyncRecords } from '../core/sync';
import { createTaskyService, ToolError, type TaskyRepository } from './service';

/** Repositorio en memoria con la regla del servidor: una versión más antigua no sustituye a la guardada. */
function memoryRepo(initial: SyncRecords) {
  const state: SyncRecords = structuredClone(initial);
  const saves: SyncRecords[] = [];
  const repo: TaskyRepository = {
    load: async () => structuredClone(state),
    async save(records) {
      saves.push(records);
      const newer = noRecords();
      for (const table of ['projects', 'tasks', 'ideas'] as const) {
        const list = state[table] as { id: string; updatedAt: string }[];
        for (const rec of records[table] as { id: string; updatedAt: string }[]) {
          const i = list.findIndex((r) => r.id === rec.id);
          if (i === -1) list.push(rec);
          else if (rec.updatedAt > list[i].updatedAt) list[i] = rec;
          else (newer[table] as unknown[]).push(list[i]);
        }
      }
      return newer;
    },
  };
  return { repo, state, saves };
}

const T0 = '2026-11-01T10:00:00.000Z';
let tick = 0;
let ids = 0;
const env = {
  now: () => `2026-11-06T10:00:${String(++tick % 60).padStart(2, '0')}.000Z`,
  today: () => '2026-11-06',
  newId: () => `id-${++ids}`,
};

function setup() {
  let d = createProject(emptyData(), { name: 'Wynot', description: 'App de fotos' }, 'wynot', T0);
  d = createProject(d, { name: 'Deep Lake', description: '' }, 'deep', T0);
  d = createProject(d, { name: 'Borrado', description: '' }, 'gone', T0);
  d = deleteProject(d, 'gone', T0);
  const mem = memoryRepo({ projects: d.projects, tasks: d.tasks, ideas: d.ideas });
  return { ...mem, service: createTaskyService(mem.repo, env) };
}

describe('servicio MCP', () => {
  it('lista proyectos vivos con sus contadores', async () => {
    const { service } = setup();
    const { projects } = await service.getProjects();
    expect(projects.map((p) => p.name).sort()).toEqual(['Deep Lake', 'Wynot']);
    expect(projects[0]).toMatchObject({ status: 'activo', pending_tasks: 0, ideas: 0 });
  });

  it('busca por nombre sin distinguir mayúsculas ni acentos, y avisa si no está seguro', async () => {
    const { service } = setup();
    expect(await service.getProjectByName('wynot')).toMatchObject({ certain: true, matches: [{ id: 'wynot', score: 1 }] });
    expect((await service.getProjectByName('deep')).matches[0]).toMatchObject({ id: 'deep' });
    const none = await service.getProjectByName('Proyecto inexistente');
    expect(none).toMatchObject({ certain: false, matches: [] });
    expect(none.all_projects?.sort()).toEqual(['Deep Lake', 'Wynot']);
    expect((await service.getProjectByName('Borrado')).matches).toEqual([]);
  });

  it('crea tareas e ideas con la lógica de core y guarda solo lo nuevo', async () => {
    const { service, state, saves } = setup();
    const { created } = await service.createTask('wynot', { title: '  Implementar compresión de fotos ', description: 'Reducir peso' });
    expect(created).toMatchObject({ project: 'Wynot', title: 'Implementar compresión de fotos', status: 'todo', due_date: null, time_slot: 'all_day' });
    await service.createIdea('wynot', { title: 'Investigar formatos de imagen' });
    expect(state.tasks).toHaveLength(1);
    expect(state.ideas).toHaveLength(1);
    expect(saves.map((s) => s.tasks.length + s.ideas.length + s.projects.length)).toEqual([1, 1]);
  });

  it('nunca crea en un proyecto inexistente o borrado', async () => {
    const { service, state } = setup();
    await expect(service.createTask('inventado', { title: 'X' })).rejects.toBeInstanceOf(ToolError);
    await expect(service.createIdea('gone', { title: 'X' })).rejects.toThrow(/No existe ningún proyecto/);
    await expect(service.createTask('wynot', { title: '   ' })).rejects.toThrow(/obligatorio/);
    expect(state.tasks).toHaveLength(0);
  });

  it('actualiza, completa y elimina tareas (borrado lógico)', async () => {
    const { service, state } = setup();
    const a = (await service.createTask('wynot', { title: 'A' })).created.id;
    const b = (await service.createTask('wynot', { title: 'B', dueDate: '2026-11-10' })).created.id;
    await service.updateTask(a, { title: 'A2', dueDate: '2026-11-01', timeSlot: 'afternoon' });
    expect((await service.getTasks('wynot', 'open')).tasks[0]).toMatchObject({ title: 'A2', time_slot: 'afternoon' });
    expect((await service.getProjects()).projects.find((p) => p.id === 'wynot')).toMatchObject({ pending_tasks: 2, overdue_tasks: 1, next_due_date: '2026-11-01', next_task: 'A2' });

    const done = await service.completeTask(a);
    expect(done.updated).toMatchObject({ status: 'done' });
    expect(done.updated.completed_at).not.toBeNull();
    expect((await service.getTasks('wynot', 'open')).tasks.map((t) => t.title)).toEqual(['B']);
    expect((await service.getTasks(undefined, 'all')).tasks.map((t) => t.title)).toEqual(['B', 'A2']);

    await service.deleteTask(b);
    expect(state.tasks.find((t) => t.id === b)?.deletedAt).not.toBeNull();
    await expect(service.updateTask(b, { title: 'Z' })).rejects.toThrow(/No existe ninguna tarea/);
  });

  it('edita y elimina ideas conservando lo que no se cambia', async () => {
    const { service } = setup();
    const id = (await service.createIdea('deep', { title: 'Idea', description: 'Detalle' })).created.id;
    expect((await service.updateIdea(id, { title: 'Idea mejor' })).updated).toMatchObject({ title: 'Idea mejor', description: 'Detalle' });
    expect((await service.getIdeas('deep')).ideas).toHaveLength(1);
    await service.deleteIdea(id);
    expect((await service.getIdeas(undefined)).ideas).toHaveLength(0);
  });

  it('si otro dispositivo cambió lo mismo a la vez, avisa en vez de pisarlo', async () => {
    const { service, repo } = setup();
    const id = (await service.createTask('wynot', { title: 'A' })).created.id;
    const original = repo.save;
    repo.save = async (records) => {
      await original(records);
      return { ...noRecords(), tasks: records.tasks };
    };
    await expect(service.updateTask(id, { title: 'B' })).rejects.toThrow(/Otro dispositivo/);
  });
});
