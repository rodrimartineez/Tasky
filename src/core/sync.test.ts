import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import type { TaskyData } from './model';
import { createProject, deleteProject, updateProject } from './projects';
import { mergeRemote, noRecords, pendingChanges, rememberVersions, type ServerVersions } from './sync';
import { createTask, updateTask } from './tasks';

const T0 = '2026-11-05T10:00:00.000Z';
const T1 = '2026-11-05T11:00:00.000Z';
const T2 = '2026-11-05T12:00:00.000Z';
const NOW = '2026-11-05T13:00:00.000Z';

function setup(): TaskyData {
  const d = createProject(emptyData(), { name: 'P', description: '' }, 'p', T0);
  return createTask(d, 'p', { title: 'A', description: '', dueDate: null }, 'a', T0);
}
const asRemote = (d: TaskyData) => ({ projects: d.projects, phases: d.phases, tasks: d.tasks, ideas: d.ideas });

describe('sincronización', () => {
  it('añade los registros que solo existen en el servidor', () => {
    const merged = mergeRemote(emptyData(), asRemote(setup()), NOW);
    expect(merged.projects.map((p) => p.id)).toEqual(['p']);
    expect(merged.tasks.map((t) => t.id)).toEqual(['a']);
  });

  it('última escritura gana por registro, en ambos sentidos', () => {
    const base = setup();
    const local = updateProject(base, 'p', { name: 'Local' }, T2); // proyecto: local más reciente
    const remote = updateTask(updateProject(base, 'p', { name: 'Remoto' }, T1), 'a', { status: 'done' }, T1); // tarea: remota más reciente
    const merged = mergeRemote(local, asRemote(remote), NOW);
    expect(merged.projects[0].name).toBe('Local');
    expect(merged.tasks[0].status).toBe('done');
  });

  it('en empate se queda la versión del servidor', () => {
    const local = updateProject(setup(), 'p', { name: 'Local' }, T1);
    const remote = updateProject(setup(), 'p', { name: 'Remoto' }, T1);
    expect(mergeRemote(local, asRemote(remote), NOW).projects[0].name).toBe('Remoto');
  });

  it('reaplica la cascada: tarea viva de un proyecto borrado en otro dispositivo', () => {
    const local = createTask(setup(), 'p', { title: 'Nueva', description: '', dueDate: null }, 'b', T1);
    const remote = deleteProject(setup(), 'p', T2);
    const merged = mergeRemote(local, { ...noRecords(), projects: remote.projects }, NOW);
    expect(merged.tasks.every((t) => t.deletedAt !== null)).toBe(true);
    expect(merged.tasks.find((t) => t.id === 'b')?.updatedAt).toBe(NOW);
  });

  it('pendientes: solo lo que el servidor no tiene en su versión actual', () => {
    const versions: ServerVersions = new Map();
    const d = setup();
    expect(pendingChanges(d, versions).tasks).toHaveLength(1);
    rememberVersions(versions, asRemote(d));
    expect(pendingChanges(d, versions)).toEqual(noRecords());
    const edited = updateTask(d, 'a', { title: 'A2' }, T1);
    const pending = pendingChanges(edited, versions);
    expect(pending.tasks.map((t) => t.title)).toEqual(['A2']);
    expect(pending.projects).toEqual([]);
  });
});
