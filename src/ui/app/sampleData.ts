import type { Project, ProjectStatus, Task, TaskyData } from '../../core/model';

// Datos de ejemplo para la Fase 2 (diseño). Se sustituyen por el store persistente en la Fase 3.

const T = '2026-11-01T10:00:00.000Z';

function project(id: string, name: string, description: string, status: ProjectStatus, updatedAt: string): Project {
  return { id, name, description, status, createdAt: T, updatedAt, deletedAt: null };
}

function tasks(projectId: string, pending: number, done: number): Task[] {
  return Array.from({ length: pending + done }, (_, i) => ({
    id: `${projectId}-t${i}`,
    projectId,
    title: `Tarea ${i + 1}`,
    description: '',
    status: i < done ? 'done' : 'todo',
    rank: `a${i}`,
    completedAt: i < done ? T : null,
    createdAt: T,
    updatedAt: T,
    deletedAt: null,
  }));
}

export const sampleData: TaskyData = {
  schemaVersion: 1,
  projects: [
    project('p1', 'Tasky', 'Gestor personal de proyectos, tareas e ideas. Escritorio primero, móvil y sync más adelante.', 'active', '2026-11-05T09:00:00.000Z'),
    project('p2', 'Portfolio personal', 'Rediseño completo con casos de estudio y blog técnico.', 'active', '2026-11-04T09:00:00.000Z'),
    project('p3', 'Mudanza', '', 'active', '2026-11-03T09:00:00.000Z'),
    project('p4', 'App de recetas', 'Planificador semanal de comidas con lista de la compra automática.', 'on_hold', '2026-10-20T09:00:00.000Z'),
    project('p5', 'Curso de Rust', 'Terminar el libro oficial y hacer un proyecto pequeño.', 'on_hold', '2026-10-12T09:00:00.000Z'),
    project('p6', 'Web del club de pádel', 'Reservas de pistas y ranking de jugadores.', 'done', '2026-09-28T09:00:00.000Z'),
  ],
  tasks: [...tasks('p1', 9, 4), ...tasks('p2', 5, 7), ...tasks('p3', 3, 0), ...tasks('p4', 6, 0), ...tasks('p6', 0, 14)],
  ideas: [],
};
