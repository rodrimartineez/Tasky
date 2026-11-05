import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import type { TaskyData } from './model';
import { createProject, deleteProject, updateProject } from './projects';
import { findProject } from './selectors';

const T0 = '2026-11-05T10:00:00.000Z';
const T1 = '2026-11-05T11:00:00.000Z';

const withProject = (): TaskyData => createProject(emptyData(), { name: '  Tasky  ', description: ' App ' }, 'p1', T0);

describe('createProject', () => {
  it('crea un proyecto activo con texto recortado y marcas temporales', () => {
    const p = withProject().projects[0];
    expect(p).toEqual({
      id: 'p1', name: 'Tasky', description: 'App', status: 'active',
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
      tasks: [{ id: 't1', projectId: 'p1', title: 'x', description: '', status: 'todo', dueDate: null, rank: 'a0', completedAt: null, createdAt: T0, updatedAt: T0, deletedAt: null }],
      ideas: [{ id: 'i1', projectId: 'p1', title: 'y', description: '', createdAt: T0, updatedAt: T0, deletedAt: null }],
    };
    const after = deleteProject(data, 'p1', T1);
    expect(findProject(after, 'p1')).toBeUndefined();
    expect(after.projects[0].deletedAt).toBe(T1);
    expect(after.tasks[0].deletedAt).toBe(T1);
    expect(after.ideas[0].deletedAt).toBe(T1);
  });
});
