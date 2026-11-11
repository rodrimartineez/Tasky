import { describe, expect, it } from 'vitest';
import type { Project, Task, TaskyData } from './model';
import { projectSummariesByStatus } from './selectors';

const base = { createdAt: '2026-01-01T00:00:00.000Z', deletedAt: null };

const project = (id: string, status: Project['status'], updatedAt: string, deletedAt: string | null = null): Project => ({
  ...base,
  id,
  name: id,
  description: '',
  status,
  rank: null,
  updatedAt,
  deletedAt,
});

const task = (id: string, projectId: string, status: Task['status'], deletedAt: string | null = null): Task => ({
  ...base,
  id,
  projectId,
  phaseId: null,
  title: id,
  description: '',
  status,
  dueDate: null,
  timeSlot: 'all_day',
  scheduledDays: [],
  repeatWeekly: false,
  rank: 'a0',
  completedAt: null,
  updatedAt: base.createdAt,
  deletedAt,
});

describe('projectSummariesByStatus', () => {
  const data: TaskyData = {
    schemaVersion: 1,
    projects: [
      project('old', 'active', '2026-01-01T00:00:00.000Z'),
      project('new', 'active', '2026-02-01T00:00:00.000Z'),
      project('waiting', 'on_hold', '2026-01-01T00:00:00.000Z'),
      project('gone', 'active', '2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z'),
    ],
    tasks: [
      task('a', 'old', 'todo'),
      task('b', 'old', 'in_progress'),
      task('c', 'old', 'done'),
      task('d', 'old', 'todo', '2026-01-05T00:00:00.000Z'),
    ],
    phases: [],
    ideas: [],
  };

  it('filtra por estado, excluye borrados y ordena por actualización reciente', () => {
    expect(projectSummariesByStatus(data, 'active', '2026-01-01').map((s) => s.project.id)).toEqual(['new', 'old']);
    expect(projectSummariesByStatus(data, 'on_hold', '2026-01-01').map((s) => s.project.id)).toEqual(['waiting']);
  });

  it('cuenta pendientes (todo + en curso) y completadas, ignorando tareas borradas', () => {
    const old = projectSummariesByStatus(data, 'active', '2026-01-01').find((s) => s.project.id === 'old')!;
    expect(old.pending).toBe(2);
    expect(old.completed).toBe(1);
    const fresh = projectSummariesByStatus(data, 'active', '2026-01-01').find((s) => s.project.id === 'new')!;
    expect(fresh.pending).toBe(0);
  });
});
