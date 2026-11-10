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
  now: () => new Date(Date.UTC(2026, 10, 6, 10) + ++tick * 1000).toISOString(),
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
    const a = (await service.createTask('wynot', { title: 'A' })).created!.id;
    const b = (await service.createTask('wynot', { title: 'B', dueDate: '2026-11-10' })).created!.id;
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
    const id = (await service.createIdea('deep', { title: 'Idea', description: 'Detalle' })).created!.id;
    expect((await service.updateIdea(id, { title: 'Idea mejor' })).updated).toMatchObject({ title: 'Idea mejor', description: 'Detalle' });
    expect((await service.getIdeas('deep')).ideas).toHaveLength(1);
    await service.deleteIdea(id);
    expect((await service.getIdeas(undefined)).ideas).toHaveLength(0);
  });

  it('si otro dispositivo cambió lo mismo a la vez, avisa en vez de pisarlo', async () => {
    const { service, repo } = setup();
    const id = (await service.createTask('wynot', { title: 'A' })).created!.id;
    const original = repo.save;
    repo.save = async (records) => {
      await original(records);
      return { ...noRecords(), tasks: records.tasks };
    };
    await expect(service.updateTask(id, { title: 'B' })).rejects.toThrow(/Otro dispositivo/);
  });
});

describe('gestión de proyectos de principio a fin (Claude Code)', () => {
  it('crea un proyecto y repetir la creación no lo duplica', async () => {
    const { service, state } = setup();
    const first = await service.createProject({ name: 'Wynot Web', description: 'PWA' });
    expect(first.created).toMatchObject({ name: 'Wynot Web', status: 'activo', pending_tasks: 0 });
    const again = await service.createProject({ name: '  wynot web ' });
    expect(again.already_existed?.id).toBe(first.created!.id);
    expect(state.projects.filter((p) => p.name === 'Wynot Web')).toHaveLength(1);
    expect((await service.createProject({ name: 'Más tarde', status: 'on_hold' })).created).toMatchObject({ status: 'en espera' });
  });

  it('modifica nombre y estado, y no permite dos proyectos con el mismo nombre', async () => {
    const { service } = setup();
    expect((await service.updateProject('deep', { status: 'done' })).updated).toMatchObject({ status: 'finalizado' });
    expect((await service.updateProject('deep', { name: 'Deep Lake 2' })).updated).toMatchObject({ name: 'Deep Lake 2' });
    await expect(service.updateProject('deep', { name: 'WYNOT' })).rejects.toThrow(/Ya existe otro proyecto/);
    await expect(service.updateProject('gone', { status: 'active' })).rejects.toThrow(/No existe ningún proyecto/);
  });

  it('desglosa un proyecto en varias tareas en una sola escritura, en orden y sin duplicar', async () => {
    const { service, saves } = setup();
    const { created: project } = await service.createProject({ name: 'Nuevo' });
    const pid = project!.id;
    const before = saves.length;
    const plan = [
      { title: 'Preparar entorno', status: 'in_progress' as const },
      { title: 'Diseñar datos', description: 'Hecho cuando haya esquema', dueDate: '2026-11-07', timeSlot: 'morning' as const },
      { title: 'Implementar API' },
      { title: 'diseñar datos' }, // repetida dentro del mismo lote
    ];
    const first = await service.createTasks(pid, plan);
    expect(saves.length - before).toBe(1);
    expect(first.created.map((t) => t.title)).toEqual(['Preparar entorno', 'Diseñar datos', 'Implementar API']);
    expect(first.created[0]).toMatchObject({ status: 'in_progress' });
    expect(first.created[1]).toMatchObject({ due_date: '2026-11-07', time_slot: 'morning', description: 'Hecho cuando haya esquema' });
    expect(first.already_existed.map((t) => t.title)).toEqual(['Diseñar datos']);

    const retry = await service.createTasks(pid, plan);
    expect(retry.created).toHaveLength(0);
    expect((await service.getTasks(pid, 'open')).tasks.map((t) => t.title)).toEqual(['Preparar entorno', 'Diseñar datos', 'Implementar API']);
    expect((await service.getProjects()).projects.find((p) => p.id === pid)).toMatchObject({ next_task: 'Preparar entorno', pending_tasks: 3 });
  });

  it('una tarea completada no impide crear otra con el mismo título', async () => {
    const { service } = setup();
    const a = (await service.createTask('wynot', { title: 'Revisar' })).created!.id;
    expect((await service.createTask('wynot', { title: 'revisar' })).already_existed?.id).toBe(a);
    await service.completeTask(a);
    expect((await service.createTask('wynot', { title: 'Revisar' })).created).toBeDefined();
  });

  it('reordena tareas abiertas y actualiza la siguiente tarea del proyecto', async () => {
    const { service } = setup();
    const { created } = await service.createTasks('wynot', [{ title: 'A' }, { title: 'B' }, { title: 'C' }]);
    const c = created[2].id;
    expect((await service.moveTask(c, 1)).open_tasks).toEqual(['C', 'A', 'B']);
    expect((await service.moveTask(c, 99)).open_tasks).toEqual(['A', 'B', 'C']);
    expect((await service.getProjects()).projects.find((p) => p.id === 'wynot')).toMatchObject({ next_task: 'A' });
    await service.completeTask(created[0].id);
    await expect(service.moveTask(created[0].id, 1)).rejects.toThrow(/completadas no tienen orden/);
  });

  it('las ideas tampoco se duplican al repetir la creación', async () => {
    const { service, state } = setup();
    const first = await service.createIdea('wynot', { title: 'Modo offline' });
    expect((await service.createIdea('wynot', { title: 'modo OFFLINE' })).already_existed?.id).toBe(first.created!.id);
    expect(state.ideas).toHaveLength(1);
  });
});

describe('programación y estado «próximo»', () => {
  it('crea y modifica la programación de una tarea, independiente de la fecha límite', async () => {
    const { service } = setup();
    const { created } = await service.createTask('wynot', { title: 'Gimnasio', scheduledDays: ['2026-11-11', '2026-11-09'], repeatWeekly: true });
    expect(created).toMatchObject({ scheduled_days: ['2026-11-09', '2026-11-11'], repeat_weekly: true, due_date: null });
    const { updated } = await service.updateTask(created!.id, { dueDate: '2026-11-30' });
    expect(updated).toMatchObject({ scheduled_days: ['2026-11-09', '2026-11-11'], repeat_weekly: true, due_date: '2026-11-30' });
    expect((await service.updateTask(created!.id, { scheduledDays: [] })).updated).toMatchObject({ scheduled_days: [], repeat_weekly: false });
  });

  it('acepta el estado próximo en proyectos', async () => {
    const { service } = setup();
    expect((await service.createProject({ name: 'Más adelante', status: 'upcoming' })).created).toMatchObject({ status: 'próximo' });
    expect((await service.getProjects()).projects.find((p) => p.name === 'Más adelante')).toMatchObject({ status: 'próximo' });
  });
});
