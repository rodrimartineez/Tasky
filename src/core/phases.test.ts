import { describe, expect, it } from 'vitest';
import { emptyData, parseData } from './data';
import type { TaskyData } from './model';
import { createPhase, deletePhase, movePhase, updatePhase } from './phases';
import { createProject, deleteProject } from './projects';
import { projectOutline, projectSummariesByStatus, projectTasks, phaseTasks } from './selectors';
import { mergeRemote } from './sync';
import { createTask, moveTask, updateTask } from './tasks';

const T0 = '2026-11-05T10:00:00.000Z';
const T1 = '2026-11-05T11:00:00.000Z';

const input = (title: string, phaseId?: string | null) => ({ title, description: '', dueDate: null, phaseId });

/** Proyecto con tareas sueltas a, b, c. */
function setup(): TaskyData {
  let d = createProject(emptyData(), { name: 'P', description: '' }, 'p', T0);
  for (const id of ['a', 'b', 'c']) d = createTask(d, 'p', input(id.toUpperCase()), id, T0);
  return d;
}
/** Primer nivel abierto: ids de fases y tareas sueltas, en orden. */
const outline = (d: TaskyData) => projectOutline(d, 'p').entries.map((e) => (e.kind === 'phase' ? e.phase.id : e.task.id));
const inPhase = (d: TaskyData, id: string) => phaseTasks(d, id).open.map((t) => t.id);

describe('fases', () => {
  it('los datos anteriores a las fases cargan igual: sin fases y tareas sueltas', () => {
    const old = JSON.parse(JSON.stringify(setup())) as Record<string, unknown>;
    delete old.phases;
    for (const t of old.tasks as Record<string, unknown>[]) delete t.phaseId;
    const d = parseData(old, T0);
    expect(d.phases).toEqual([]);
    expect(d.tasks.every((t) => t.phaseId === null)).toBe(true);
    expect(outline(d)).toEqual(['a', 'b', 'c']);
  });

  it('una fase nueva sin tareas va al final; con tareas, ocupa el lugar de la primera y las incorpora en orden', () => {
    expect(outline(createPhase(setup(), 'p', { name: ' F ', description: '' }, 'f', T1))).toEqual(['a', 'b', 'c', 'f']);
    const d = createPhase(setup(), 'p', { name: 'F', description: 'd' }, 'f', T1, ['c', 'b']);
    expect(outline(d)).toEqual(['a', 'f']);
    expect(inPhase(d, 'f')).toEqual(['b', 'c']);
    expect(d.phases[0]).toMatchObject({ name: 'F', description: 'd', projectId: 'p' });
    expect(() => createPhase(d, 'p', { name: ' ', description: '' }, 'x', T1)).toThrow();
  });

  it('se crean tareas dentro de una fase, al final de ella', () => {
    let d = createPhase(setup(), 'p', { name: 'F', description: '' }, 'f', T1, ['a']);
    d = createTask(d, 'p', input('D', 'f'), 'd', T1);
    d = createTask(d, 'p', input('E'), 'e', T1);
    expect(inPhase(d, 'f')).toEqual(['a', 'd']);
    expect(outline(d)).toEqual(['f', 'b', 'c', 'e']);
    expect(() => createTask(d, 'p', input('X', 'otra'), 'x', T1)).toThrow();
  });

  it('el orden del proyecto y «la siguiente tarea» siguen fases y tareas sueltas intercaladas', () => {
    let d = createPhase(setup(), 'p', { name: 'F', description: '' }, 'f', T1, ['c']);
    d = movePhase(d, 'f', null, 'a', T1);
    expect(outline(d)).toEqual(['f', 'a', 'b']);
    expect(projectTasks(d, 'p').open.map((t) => t.id)).toEqual(['c', 'a', 'b']);
    expect(projectSummariesByStatus(d, 'active', '2026-11-05')[0].nextTask?.id).toBe('c');
    // Una tarea suelta se coloca entre fases y tareas.
    d = moveTask(d, 'b', null, 'f', T1);
    expect(outline(d)).toEqual(['b', 'f', 'a']);
  });

  it('cambiar la fase de una tarea la lleva al final de su nuevo lugar', () => {
    let d = createPhase(setup(), 'p', { name: 'F', description: '' }, 'f', T1, ['a', 'b']);
    d = updateTask(d, 'a', { phaseId: null }, T1);
    expect(outline(d)).toEqual(['f', 'c', 'a']);
    d = updateTask(d, 'c', { phaseId: 'f' }, T1);
    expect(inPhase(d, 'f')).toEqual(['b', 'c']);
  });

  it('se edita solo si algo cambia', () => {
    const d = createPhase(setup(), 'p', { name: 'F', description: '' }, 'f', T0);
    expect(updatePhase(d, 'f', { name: 'F', description: '' }, T1)).toEqual(d);
    expect(updatePhase(d, 'f', { name: 'G', description: 'x' }, T1).phases[0]).toMatchObject({
      name: 'G',
      description: 'x',
      updatedAt: T1,
    });
  });

  it('al borrar una fase sus tareas quedan sueltas en su lugar, sin borrarse', () => {
    let d = createPhase(setup(), 'p', { name: 'F', description: '' }, 'f', T1, ['b', 'c']);
    d = createTask(d, 'p', input('D'), 'd', T1);
    d = updateTask(d, 'c', { status: 'done' }, T1);
    d = deletePhase(d, 'f', T1);
    expect(d.phases[0].deletedAt).toBe(T1);
    expect(outline(d)).toEqual(['a', 'b', 'd']);
    expect(d.tasks.filter((t) => !t.deletedAt)).toHaveLength(4);
    expect(d.tasks.every((t) => t.phaseId === null)).toBe(true);
    expect(projectOutline(d, 'p').done.map((t) => t.id)).toEqual(['c']);
  });

  it('una tarea cuya fase se borró en otro dispositivo cuenta como suelta', () => {
    const d = createPhase(setup(), 'p', { name: 'F', description: '' }, 'f', T0, ['a']);
    const remote = { projects: [], phases: [{ ...d.phases[0], deletedAt: T1, updatedAt: T1 }], tasks: [], ideas: [] };
    const merged = mergeRemote(d, remote, T1);
    expect(merged.tasks.find((t) => t.id === 'a')?.phaseId).toBe('f');
    expect(outline(merged)).toContain('a');
  });

  it('borrar el proyecto borra sus fases', () => {
    const d = deleteProject(createPhase(setup(), 'p', { name: 'F', description: '' }, 'f', T0), 'p', T1);
    expect(d.phases[0].deletedAt).toBe(T1);
  });
});
