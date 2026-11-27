import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import type { TaskyData } from './model';
import { createPhase, deletePhase, setPhaseGroup } from './phases';
import { createProjectGroup, deleteProjectGroup, moveProjectGroup, moveProjectIntoGroup, updateProjectGroup } from './projectGroups';
import { createProject, deleteProject } from './projects';
import { outlineOf, projectOutline, projectPhases, projectSummariesByStatus, projectTasks } from './selectors';
import { mergeRemote, noRecords } from './sync';
import { createTask, updateTask } from './tasks';

const T0 = '2026-11-05T10:00:00.000Z';
const T1 = '2026-11-05T11:00:00.000Z';

const task = (title: string, phaseId: string | null = null) => ({ title, description: '', dueDate: null, phaseId });
const named = (name: string) => ({ name, description: '' });

/** «Universidad»: tarea suelta «x», grupo «mat» con fases «m1» (tarea a) y «m2» (tarea b), fase sin grupo «libre» (tarea c). */
function setup(): TaskyData {
  let d = createProject(emptyData(), named('Universidad'), 'p', T0);
  d = createTask(d, 'p', task('X'), 'x', T0);
  d = createProjectGroup(d, 'p', named('Matemáticas'), 'mat', T0);
  d = createPhase(d, 'p', named('Tema 1'), 'm1', T0, [], 'mat');
  d = createPhase(d, 'p', named('Tema 2'), 'm2', T0, [], 'mat');
  d = createPhase(d, 'p', named('Libre'), 'libre', T0);
  d = createTask(d, 'p', task('A', 'm1'), 'a', T0);
  d = createTask(d, 'p', task('B', 'm2'), 'b', T0);
  d = createTask(d, 'p', task('C', 'libre'), 'c', T0);
  return d;
}

const outline = (d: TaskyData) =>
  projectOutline(d, 'p').entries.map((e) => (e.kind === 'phase' ? e.phase.id : e.kind === 'group' ? e.group.id : e.task.id));
const groupItems = (d: TaskyData, id: string) =>
  outlineOf(d, 'p', id).entries.map((e) => (e.kind === 'phase' ? e.phase.id : e.kind === 'group' ? e.group.id : e.task.id));
const groupPhases = groupItems;

describe('grupos de proyecto', () => {
  it('el primer nivel muestra el grupo (no sus fases) y el grupo sus fases en orden', () => {
    const d = setup();
    expect(outline(d)).toEqual(['x', 'mat', 'libre']);
    expect(groupPhases(d, 'mat')).toEqual(['m1', 'm2']);
    const group = projectOutline(d, 'p').entries.find((e) => e.kind === 'group');
    expect(group).toMatchObject({ phases: 2, open: 2, done: 0 });
  });

  it('el orden de trabajo recorre grupo → fase → tarea', () => {
    const d = setup();
    expect(projectTasks(d, 'p').open.map((t) => t.id)).toEqual(['x', 'a', 'b', 'c']);
    expect(projectPhases(d, 'p').map((f) => f.id)).toEqual(['m1', 'm2', 'libre']);
    expect(projectSummariesByStatus(d, 'active', '2026-11-05')[0].nextTask?.id).toBe('x');
  });

  it('crear un grupo con fases existentes las mete en él, en el lugar de la primera', () => {
    let d = createProject(emptyData(), named('P'), 'p', T0);
    d = createPhase(d, 'p', named('Uno'), 'f1', T0);
    d = createTask(d, 'p', task('Suelta'), 't', T0);
    d = createPhase(d, 'p', named('Dos'), 'f2', T0);
    d = createProjectGroup(d, 'p', named('G'), 'g', T1, ['f2', 'f1']);
    expect(outline(d)).toEqual(['g', 't']);
    expect(groupPhases(d, 'g')).toEqual(['f1', 'f2']);
  });

  it('mover una fase de grupo la lleva al final de su nuevo lugar', () => {
    let d = setPhaseGroup(setup(), 'libre', 'mat', T1);
    expect(groupPhases(d, 'mat')).toEqual(['m1', 'm2', 'libre']);
    expect(outline(d)).toEqual(['x', 'mat']);
    d = setPhaseGroup(d, 'm1', null, T1);
    expect(outline(d)).toEqual(['x', 'mat', 'm1']);
    expect(() => setPhaseGroup(d, 'm1', 'otro', T1)).toThrow();
  });

  it('una fase nueva en un grupo de otro proyecto no se permite', () => {
    let d = setup();
    d = createProject(d, named('Otro'), 'q', T0);
    expect(() => createPhase(d, 'q', named('F'), 'f', T0, [], 'mat')).toThrow();
  });

  it('reordenar grupos y editar su nombre', () => {
    let d = moveProjectGroup(setup(), 'mat', 'libre', null, T1);
    expect(outline(d)).toEqual(['x', 'libre', 'mat']);
    d = updateProjectGroup(d, 'mat', { name: '  Álgebra ', description: '' }, T1);
    expect(d.projectGroups[0]).toMatchObject({ name: 'Álgebra', updatedAt: T1 });
  });

  it('eliminar un grupo deja sus fases en su lugar, sin borrar nada', () => {
    const d = deleteProjectGroup(setup(), 'mat', T1);
    expect(outline(d)).toEqual(['x', 'm1', 'm2', 'libre']);
    expect(d.phases.every((f) => !f.deletedAt)).toBe(true);
    expect(projectTasks(d, 'p').open.map((t) => t.id)).toEqual(['x', 'a', 'b', 'c']);
  });

  it('eliminar una fase de un grupo deja sus tareas sueltas dentro del grupo, en su lugar', () => {
    const d = deletePhase(setup(), 'm1', T1);
    expect(outline(d)).toEqual(['x', 'mat', 'libre']);
    expect(groupItems(d, 'mat')).toEqual(['a', 'm2']);
  });

  it('un grupo puede tener tareas sueltas, intercaladas con sus fases', () => {
    let d = createTask(setup(), 'p', { ...task('Suelta'), groupId: 'mat' }, 's', T1);
    expect(groupItems(d, 'mat')).toEqual(['m1', 'm2', 's']);
    expect(outline(d)).toEqual(['x', 'mat', 'libre']);
    expect(projectTasks(d, 'p').open.map((t) => t.id)).toEqual(['x', 'a', 'b', 's', 'c']);
    // Sacar una tarea de su fase la deja suelta en el grupo de esa fase.
    d = updateTask(d, 'a', { phaseId: null }, T1);
    expect(groupItems(d, 'mat')).toEqual(['m1', 'm2', 's', 'a']);
    // Y moverla al primer nivel.
    d = updateTask(d, 'a', { groupId: null }, T1);
    expect(outline(d)).toEqual(['x', 'mat', 'libre', 'a']);
    // Al borrar el grupo, sus tareas sueltas también pasan al primer nivel.
    d = deleteProjectGroup(d, 'mat', T1);
    expect(outline(d)).toEqual(['x', 'm1', 'm2', 's', 'libre', 'a']);
  });

  it('convertir un proyecto en grupo de otro mueve todo tal cual y borra el original', () => {
    let d = setup();
    d = createProject(d, named('AW'), 'aw', T0);
    d = createTask(d, 'aw', task('Suelta'), 'aw-s', T0);
    d = createPhase(d, 'aw', named('Fase AW'), 'aw-f', T0);
    d = createTask(d, 'aw', task('Hecha', 'aw-f'), 'aw-h', T0);
    d = updateTask(d, 'aw-h', { status: 'done' }, T0);
    const before = d.tasks.find((t) => t.id === 'aw-h')!;
    d = moveProjectIntoGroup(d, 'aw', 'p', 'g-aw', T1);
    expect(d.projects.find((p) => p.id === 'aw')?.deletedAt).toBe(T1);
    expect(outline(d)).toEqual(['x', 'mat', 'libre', 'g-aw']);
    expect(d.projectGroups.find((g) => g.id === 'g-aw')).toMatchObject({ name: 'AW', projectId: 'p' });
    expect(groupItems(d, 'g-aw')).toEqual(['aw-s']);
    expect(outlineOf(d, 'p', 'g-aw').doneContainers.map((e) => e.kind === 'phase' && e.phase.id)).toEqual(['aw-f']);
    const after = d.tasks.find((t) => t.id === 'aw-h')!;
    expect(after).toEqual({ ...before, projectId: 'p', updatedAt: T1 });
    expect(d.tasks.every((t) => !t.deletedAt)).toBe(true);
    expect(() => moveProjectIntoGroup(d, 'p', 'p', 'g2', T1)).toThrow();
  });

  it('un grupo con todas sus tareas hechas sigue activo (no se completa)', () => {
    let d = updateTask(setup(), 'a', { status: 'done' }, T1);
    d = updateTask(d, 'b', { status: 'done' }, T1);
    const { entries, doneContainers } = projectOutline(d, 'p');
    expect(entries.some((e) => e.kind === 'group')).toBe(true);
    expect(doneContainers.some((e) => (e as { kind: string }).kind === 'group')).toBe(false);
  });

  it('si el grupo se borra en otro dispositivo sus fases cuentan como sin grupo', () => {
    const d = setup();
    const remote = { ...noRecords(), projectGroups: [{ ...d.projectGroups[0], deletedAt: T1, updatedAt: T1 }] };
    expect(outline(mergeRemote(d, remote, T1))).toContain('m1');
  });

  it('borrar el proyecto borra también sus grupos', () => {
    const d = deleteProject(setup(), 'p', T1);
    expect(d.projectGroups.every((g) => g.deletedAt === T1)).toBe(true);
  });
});
