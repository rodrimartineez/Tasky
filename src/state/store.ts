import { create } from 'zustand';
import { now } from '../core/clock';
import { DataError, emptyData, parseData } from '../core/data';
import { newId } from '../core/ids';
import type { TaskyData } from '../core/model';
import type { Storage } from '../core/ports';
import { createProject, deleteProject, updateProject, type ProjectInput, type ProjectPatch } from '../core/projects';
import { createIdea, deleteIdea, updateIdea, type IdeaInput } from '../core/ideas';
import { createTask, deleteTask, moveTask, updateTask, type TaskInput, type TaskPatch } from '../core/tasks';

type Status = 'loading' | 'ready' | 'error';

interface TaskyState {
  status: Status;
  /** Error de carga (bloquea la app) o de guardado (aviso no bloqueante). */
  loadError: string | null;
  saveError: string | null;
  data: TaskyData;

  load(storage: Storage): Promise<void>;
  createProject(input: ProjectInput): string;
  updateProject(id: string, patch: ProjectPatch): void;
  deleteProject(id: string): void;
  createTask(projectId: string, input: TaskInput): string;
  updateTask(id: string, patch: TaskPatch): void;
  /** Coloca la tarea entre dos vecinas (null = extremo de la lista). */
  moveTask(id: string, beforeId: string | null, afterId: string | null): void;
  deleteTask(id: string): void;
  createIdea(projectId: string, input: IdeaInput): string;
  updateIdea(id: string, input: IdeaInput): void;
  deleteIdea(id: string): void;
}

let storage: Storage | null = null;
let saving: Promise<void> | null = null;
let queued: TaskyData | null = null;

/** Guarda inmediatamente; si ya hay una escritura en curso, solo encola la versión más reciente. */
function persist(data: TaskyData) {
  queued = data;
  if (saving || !storage) return;
  const target = storage;
  saving = (async () => {
    try {
      while (queued) {
        const next = queued;
        queued = null;
        await target.save(next);
      }
      useTasky.setState({ saveError: null });
    } catch (e) {
      console.error(e);
      useTasky.setState({ saveError: 'No se pudieron guardar los últimos cambios.' });
    } finally {
      saving = null;
    }
  })();
}

export const useTasky = create<TaskyState>()((set, get) => {
  /** Aplica un cambio puro de core/ y lo persiste. */
  const commit = (change: (data: TaskyData) => TaskyData) => {
    if (get().status !== 'ready') return;
    const data = change(get().data);
    set({ data });
    persist(data);
  };

  return {
    status: 'loading',
    loadError: null,
    saveError: null,
    data: emptyData(),

    async load(s) {
      storage = s;
      try {
        set({ status: 'ready', data: parseData(await s.load(), now()) });
      } catch (e) {
        console.error(e);
        // Sin estado 'ready' no se guarda nada: el archivo existente nunca se sobrescribe.
        set({
          status: 'error',
          loadError: e instanceof DataError ? e.message : 'No se pudieron leer los datos de Tasky.',
        });
      }
    },

    createProject(input) {
      const id = newId();
      commit((d) => createProject(d, input, id, now()));
      return id;
    },
    updateProject: (id, patch) => commit((d) => updateProject(d, id, patch, now())),
    deleteProject: (id) => commit((d) => deleteProject(d, id, now())),

    createTask(projectId, input) {
      const id = newId();
      commit((d) => createTask(d, projectId, input, id, now()));
      return id;
    },
    updateTask: (id, patch) => commit((d) => updateTask(d, id, patch, now())),
    moveTask: (id, beforeId, afterId) => commit((d) => moveTask(d, id, beforeId, afterId, now())),
    deleteTask: (id) => commit((d) => deleteTask(d, id, now())),

    createIdea(projectId, input) {
      const id = newId();
      commit((d) => createIdea(d, projectId, input, id, now()));
      return id;
    },
    updateIdea: (id, input) => commit((d) => updateIdea(d, id, input, now())),
    deleteIdea: (id) => commit((d) => deleteIdea(d, id, now())),
  };
});
