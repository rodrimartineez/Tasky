import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import type { TaskyData } from './model';
import { createProject, deleteProject, reorderProject, updateProject } from './projects';
import { findProject, projectSummariesByStatus } from './selectors';

const T0 = '2026-11-05T10:00:00.000Z';
const T1 = '2026-11-05T11:00:00.000Z';

const withProject = (): TaskyData => createProject(emptyData(), { name: '  Tasky  ', description: ' App ' }, 'p1', T0);

describe('createProject', () => {
  it('crea un proyecto activo con texto recortado y marcas temporales', () => {
    const p = withProject().projects[0];
    expect(p).toEqual({
      id: 'p1', name: 'Tasky', description: 'App', status: 'active', rank: 'a0',
      createdAt: T0, updatedAt: T0, deletedAt: null,
    });
  });

  it('rechaza nombres vacíos', () => {
    expect(() => createProject(emptyData(), { name: '   ', description: '' }, 'p1', T0)).toThrow();
  });
});

describe('updateProject', () => {
  it('cambia campos y actualiza updatedAt', () => {
    const p = updateProject(withProject(), 'p1', { name: 'Nuevo', status: 'on_hold' }, T1).projects[0];
    expect(p.name).toBe('Nuevo');
    expect(p.status).toBe('on_hold');
    expect(p.updatedAt).toBe(T1);
    expect(p.createdAt).toBe(T0);
  });

  it('no toca updatedAt si nada cambia', () => {
    const p = updateProject(withProject(), 'p1', { name: 'Tasky', status: 'active' }, T1).projects[0];
    expect(p.updatedAt).toBe(T0);
  });
});

describe('deleteProject', () => {
  it('borra en cascada (lógicamente) tareas e ideas del proyecto', () => {
    const base = withProject();
    const data: TaskyData = {
      ...base,
      tasks: [{ id: 't1', projectId: 'p1', title: 'x', description: '', status: 'todo', dueDate: null, timeSlot: 'all_day', scheduledDays: [], repeatWeekly: false, rank: 'a0', completedAt: null, createdAt: T0, updatedAt: T0, deletedAt: null }],
      ideas: [{ id: 'i1', projectId: 'p1', title: 'y', description: '', createdAt: T0, updatedAt: T0, deletedAt: null }],
    };
    const after = deleteProject(data, 'p1', T1);
    expect(findProject(after, 'p1')).toBeUndefined();
    expect(after.projects[0].deletedAt).toBe(T1);
    expect(after.tasks[0].deletedAt).toBe(T1);
    expect(after.ideas[0].deletedAt).toBe(T1);
  });
});

describe('orden manual de proyectos', () => {
  const order = (d: TaskyData) => projectSummariesByStatus(d, 'active', '2026-11-05').map((s) => s.project.id);

  it('los nuevos aparecen los primeros y los antiguos sin orden van detrás, por actualización', () => {
    let d: TaskyData = {
      ...emptyData(),
      projects: ['viejo1', 'viejo2'].map((id, i) => ({
        id, name: id, description: '', status: 'active' as const, rank: null,
        createdAt: T0, updatedAt: `2026-11-0${i + 1}T00:00:00.000Z`, deletedAt: null,
      })),
    };
    d = createProject(d, { name: 'A', description: '' }, 'a', T0);
    d = createProject(d, { name: 'B', description: '' }, 'b', T0);
    expect(order(d)).toEqual(['b', 'a', 'viejo2', 'viejo1']);
  });

  it('al arrastrar se fija el orden de la sección y después solo cambia el proyecto movido', () => {
    let d = createProject(withProject(), { name: 'Q', description: '' }, 'q', T0);
    d = { ...d, projects: d.projects.map((p) => ({ ...p, rank: null })) };
    d = reorderProject(d, ['p1', 'q'], 'p1', T1);
    expect(order(d)).toEqual(['p1', 'q']);
    expect(d.projects.every((p) => p.rank !== null && p.updatedAt === T1)).toBe(true);

    const T2 = '2026-11-05T12:00:00.000Z';
    const moved = reorderProject(d, ['q', 'p1'], 'q', T2);
    expect(order(moved)).toEqual(['q', 'p1']);
    expect(moved.projects.find((p) => p.id === 'p1')?.updatedAt).toBe(T1);
    expect(moved.projects.find((p) => p.id === 'q')?.updatedAt).toBe(T2);
  });
});
