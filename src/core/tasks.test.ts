import { describe, expect, it } from 'vitest';
import { emptyData, parseData } from './data';
import { addDays, daysBetween, dueState } from './dueDates';
import type { TaskyData } from './model';
import { createProject } from './projects';
import { projectSummariesByStatus, projectTasks, todayTasks } from './selectors';
import { createTask, deleteTask, moveTask, updateTask } from './tasks';

const T0 = '2026-11-05T10:00:00.000Z';
const T1 = '2026-11-05T11:00:00.000Z';
const TODAY = '2026-11-05';

function setup(): TaskyData {
  let d = createProject(emptyData(), { name: 'P', description: '' }, 'p', T0);
  for (const id of ['a', 'b', 'c']) d = createTask(d, 'p', { title: id.toUpperCase(), description: '', dueDate: null }, id, T0);
  return d;
}
const openIds = (d: TaskyData) => projectTasks(d, 'p').open.map((t) => t.id);

describe('tareas', () => {
  it('se crean al final de la secuencia, pendientes y con título recortado', () => {
    const d = setup();
    expect(openIds(d)).toEqual(['a', 'b', 'c']);
    expect(d.tasks[0]).toMatchObject({ status: 'todo', completedAt: null, title: 'A' });
    expect(() => createTask(d, 'p', { title: ' ', description: '', dueDate: null }, 'x', T0)).toThrow();
  });

  it('moveTask solo cambia el rank de la tarea movida', () => {
    const d = setup();
    const moved = moveTask(d, 'c', null, 'a', T1);
    expect(openIds(moved)).toEqual(['c', 'a', 'b']);
    expect(moved.tasks.filter((t) => t.updatedAt === T1).map((t) => t.id)).toEqual(['c']);
    expect(openIds(moveTask(d, 'a', 'b', 'c', T1))).toEqual(['b', 'a', 'c']);
    expect(openIds(moveTask(d, 'a', 'c', null, T1))).toEqual(['b', 'c', 'a']);
  });

  it('completar fija completedAt, reabrir la limpia y vuelve a su lugar', () => {
    let d = updateTask(setup(), 'b', { status: 'done' }, T1);
    expect(projectTasks(d, 'p').done.map((t) => t.id)).toEqual(['b']);
    expect(d.tasks.find((t) => t.id === 'b')?.completedAt).toBe(T1);
    d = updateTask(d, 'b', { status: 'in_progress' }, T1);
    expect(d.tasks.find((t) => t.id === 'b')?.completedAt).toBeNull();
    expect(openIds(d)).toEqual(['a', 'b', 'c']);
  });

  it('no toca updatedAt si nada cambia y permite quitar la fecha límite', () => {
    let d = updateTask(setup(), 'a', { title: 'A', status: 'todo' }, T1);
    expect(d.tasks[0].updatedAt).toBe(T0);
    d = updateTask(d, 'a', { dueDate: '2026-11-10' }, T1);
    expect(d.tasks[0].dueDate).toBe('2026-11-10');
    expect(updateTask(d, 'a', { dueDate: null }, T1).tasks[0].dueDate).toBeNull();
  });

  it('deleteTask es un borrado lógico', () => {
    const d = deleteTask(setup(), 'a', T1);
    expect(openIds(d)).toEqual(['b', 'c']);
    expect(d.tasks[0].deletedAt).toBe(T1);
  });
});

describe('fechas límite', () => {
  it('clasifica por días de calendario', () => {
    expect(dueState('2026-11-04', TODAY)).toBe('overdue');
    expect(dueState(TODAY, TODAY)).toBe('today');
    expect(dueState('2026-11-06', TODAY)).toBe('tomorrow');
    expect(dueState('2026-11-12', TODAY)).toBe('soon');
    expect(dueState('2026-11-13', TODAY)).toBe('later');
    expect(daysBetween('2026-10-25', '2026-10-26')).toBe(1); // cambio de horario en Europa
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('el resumen del proyecto incluye la próxima fecha y las vencidas (ignorando completadas)', () => {
    let d = setup();
    d = updateTask(d, 'a', { dueDate: '2026-11-01' }, T1);
    d = updateTask(d, 'b', { dueDate: '2026-11-03', status: 'done' }, T1);
    d = updateTask(d, 'c', { dueDate: '2026-11-20' }, T1);
    const [s] = projectSummariesByStatus(d, 'active', TODAY);
    expect(s).toMatchObject({ pending: 2, completed: 1, overdue: 1, nextDue: '2026-11-01' });
  });
});

describe('franja horaria y vistas de la pantalla principal', () => {
  it('por defecto es «Día completo», se puede elegir al crear y se conserva al editar', () => {
    let d = setup();
    expect(d.tasks[0].timeSlot).toBe('all_day');
    d = createTask(d, 'p', { title: 'D', description: '', dueDate: TODAY, timeSlot: 'evening' }, 'd', T0);
    d = updateTask(d, 'd', { title: 'D2' }, T1);
    expect(d.tasks.find((t) => t.id === 'd')).toMatchObject({ title: 'D2', timeSlot: 'evening', updatedAt: T1 });
    const changed = updateTask(d, 'a', { timeSlot: 'morning' }, T1);
    expect(changed.tasks[0]).toMatchObject({ timeSlot: 'morning', updatedAt: T1 });
  });

  it('los datos guardados antes de existir la franja pasan a «Día completo»', () => {
    const legacy: Record<string, unknown> = { ...setup().tasks[0] };
    delete legacy.timeSlot;
    const parsed = parseData({ ...emptyData(), tasks: [legacy] }, T1);
    expect(parsed.tasks[0].timeSlot).toBe('all_day');
  });

  it('la siguiente tarea es la primera no completada según el orden manual', () => {
    let d = setup();
    d = moveTask(d, 'c', null, 'a', T1);
    d = updateTask(d, 'c', { status: 'done' }, T1);
    expect(projectSummariesByStatus(d, 'active', TODAY)[0].nextTask?.id).toBe('a');
    for (const id of ['a', 'b']) d = updateTask(d, id, { status: 'done' }, T1);
    expect(projectSummariesByStatus(d, 'active', TODAY)[0].nextTask).toBeNull();
  });

  it('hoy: solo tareas abiertas con fecha de hoy, agrupadas por franja en orden', () => {
    let d = setup();
    d = createProject(d, { name: 'Otro', description: '' }, 'q', T0);
    d = createTask(d, 'q', { title: 'Noche', description: '', dueDate: TODAY, timeSlot: 'evening' }, 'n', T0);
    d = updateTask(d, 'a', { dueDate: TODAY, timeSlot: 'morning' }, T1);
    d = updateTask(d, 'b', { dueDate: TODAY, status: 'in_progress' }, T1);
    d = updateTask(d, 'c', { dueDate: TODAY, timeSlot: 'morning', status: 'done' }, T1);
    d = createTask(d, 'q', { title: 'Mañana', description: '', dueDate: addDays(TODAY, 1) }, 'm', T0);
    const groups = todayTasks(d, TODAY);
    expect(groups.map((g) => [g.slot, g.items.map((i) => i.task.id)])).toEqual([
      ['morning', ['a']],
      ['evening', ['n']],
      ['all_day', ['b']],
    ]);
    expect(groups[1].items[0].project.name).toBe('Otro');
  });
});
