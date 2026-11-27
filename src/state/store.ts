import { create } from 'zustand';
import { now, today } from '../core/clock';
import { DataError, emptyData, parseData } from '../core/data';
import { newId } from '../core/ids';
import type { TaskyData } from '../core/model';
import type { FileExport, Storage } from '../core/ports';
import { countRecords, mergeRemote, purgeRecords, type SyncRecords } from '../core/sync';
import { createProject, deleteProject, reorderProject, updateProject, type ProjectInput, type ProjectPatch } from '../core/projects';
import {
  createIdea,
  createIdeaGroup,
  deleteIdea,
  deleteIdeaGroup,
  setIdeaGroup,
  updateIdea,
  updateIdeaGroup,
  type IdeaGroupInput,
  type IdeaInput,
} from '../core/ideas';
import { createPhase, deletePhase, movePhase, setPhaseGroup, updatePhase, type PhaseInput } from '../core/phases';
import {
  createProjectGroup,
  deleteProjectGroup,
  moveProjectGroup,
  updateProjectGroup,
  type ProjectGroupInput,
} from '../core/projectGroups';
import { createTask, deleteTask, moveTask, updateTask, type TaskInput, type TaskPatch } from '../core/tasks';

type Status = 'loading' | 'ready' | 'error';

interface TaskyState {
  status: Status;
  /** Error de carga (bloquea la app) o de guardado (aviso no bloqueante). */
  loadError: string | null;
  saveError: string | null;
  data: TaskyData;

  load(storage: Storage, fileExport?: FileExport): Promise<void>;
  /** Tras un error de carga: aparta el archivo ilegible y carga la copia válida más reciente. Devuelve su nombre o null. */
  restoreLatestBackup(): Promise<string | null>;
  /** Exporta todos los datos a un archivo JSON y devuelve dónde ha quedado. */
  exportData(): Promise<string>;
  /** Sustituye todos los datos por otros ya validados, guardando antes una copia de los actuales. */
  importData(data: TaskyData): Promise<void>;
  /** Incorpora cambios llegados del servidor de sincronización (última escritura gana). */
  applyRemote(records: SyncRecords): void;
  /** Borra los datos de este dispositivo (al cerrar sesión en la web). */
  clearLocalData(): void;
  /** Quita del dispositivo lo que han dejado de compartir conmigo (sin enviar nada al servidor). */
  purge(projectIds: Set<string>, ideaIds: Set<string>): void;
  createProject(input: ProjectInput): string;
  updateProject(id: string, patch: ProjectPatch): void;
  deleteProject(id: string): void;
  /** `orderedIds`: orden de la sección de Inicio tras soltar el proyecto. */
  reorderProject(orderedIds: string[], movedId: string): void;
  /** Crea un grupo e incorpora a él las fases indicadas del proyecto. */
  createProjectGroup(projectId: string, input: ProjectGroupInput, phaseIds: string[]): string;
  updateProjectGroup(id: string, input: ProjectGroupInput): void;
  /** Coloca el grupo entre dos elementos del primer nivel del proyecto (null = extremo). */
  moveProjectGroup(id: string, beforeId: string | null, afterId: string | null): void;
  /** Sus fases no se borran: quedan sin grupo. */
  deleteProjectGroup(id: string): void;
  /** Crea una fase (en `groupId`, o en el primer nivel con null) e incorpora a ella las tareas indicadas del proyecto. */
  createPhase(projectId: string, input: PhaseInput, taskIds: string[], groupId?: string | null): string;
  updatePhase(id: string, input: PhaseInput): void;
  /** Mueve la fase a un grupo (null = al primer nivel del proyecto), al final. */
  setPhaseGroup(id: string, groupId: string | null): void;
  /** Coloca la fase entre dos elementos de su mismo lugar (null = extremo). */
  movePhase(id: string, beforeId: string | null, afterId: string | null): void;
  /** Sus tareas no se borran: quedan sin fase. */
  deletePhase(id: string): void;
  createTask(projectId: string, input: TaskInput): string;
  updateTask(id: string, patch: TaskPatch): void;
  /** Coloca la tarea entre dos vecinas (null = extremo de la lista). */
  moveTask(id: string, beforeId: string | null, afterId: string | null): void;
  deleteTask(id: string): void;
  /** `groupId`: grupo de ideas generales donde crearla (null = suelta). */
  createIdea(projectId: string, input: IdeaInput, groupId?: string | null): string;
  updateIdea(id: string, input: IdeaInput): void;
  deleteIdea(id: string): void;
  /** Mueve una idea general a un grupo (null = suelta). */
  setIdeaGroup(id: string, groupId: string | null): void;
  createIdeaGroup(input: IdeaGroupInput): string;
  updateIdeaGroup(id: string, input: IdeaGroupInput): void;
  /** Sus ideas no se borran: quedan sueltas. */
  deleteIdeaGroup(id: string): void;
}

let storage: Storage | null = null;
let fileExport: FileExport | null = null;
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

    async load(s, exporter) {
      storage = s;
      fileExport = exporter ?? null;
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

    async restoreLatestBackup() {
      if (!storage?.listBackups) return null;
      for (const backup of await storage.listBackups()) {
        let data: TaskyData;
        try {
          data = parseData(backup.raw, now());
        } catch {
          continue;
        }
        await storage.quarantine?.();
        set({ status: 'ready', loadError: null, data });
        persist(data);
        return backup.name;
      }
      return null;
    },

    async exportData() {
      if (!fileExport) throw new Error('Exportar no está disponible en esta plataforma.');
      return fileExport.exportText(`tasky-copia-${today()}.json`, JSON.stringify(get().data, null, 2));
    },

    async importData(data) {
      if (get().status !== 'ready') return;
      await storage?.snapshot?.('antes-de-importar');
      set({ data });
      persist(data);
    },

    applyRemote(records) {
      if (countRecords(records) > 0) commit((d) => mergeRemote(d, records, now()));
    },

    clearLocalData: () => commit(() => emptyData()),

    purge(projectIds, ideaIds) {
      if (purgeRecords(get().data, projectIds, ideaIds) !== get().data) commit((d) => purgeRecords(d, projectIds, ideaIds));
    },

    createProject(input) {
      const id = newId();
      commit((d) => createProject(d, input, id, now()));
      return id;
    },
    updateProject: (id, patch) => commit((d) => updateProject(d, id, patch, now())),
    deleteProject: (id) => commit((d) => deleteProject(d, id, now())),
    reorderProject: (orderedIds, movedId) => commit((d) => reorderProject(d, orderedIds, movedId, now())),

    createProjectGroup(projectId, input, phaseIds) {
      const id = newId();
      commit((d) => createProjectGroup(d, projectId, input, id, now(), phaseIds));
      return id;
    },
    updateProjectGroup: (id, input) => commit((d) => updateProjectGroup(d, id, input, now())),
    moveProjectGroup: (id, beforeId, afterId) => commit((d) => moveProjectGroup(d, id, beforeId, afterId, now())),
    deleteProjectGroup: (id) => commit((d) => deleteProjectGroup(d, id, now())),

    createPhase(projectId, input, taskIds, groupId = null) {
      const id = newId();
      commit((d) => createPhase(d, projectId, input, id, now(), taskIds, groupId));
      return id;
    },
    updatePhase: (id, input) => commit((d) => updatePhase(d, id, input, now())),
    setPhaseGroup: (id, groupId) => commit((d) => setPhaseGroup(d, id, groupId, now())),
    movePhase: (id, beforeId, afterId) => commit((d) => movePhase(d, id, beforeId, afterId, now())),
    deletePhase: (id) => commit((d) => deletePhase(d, id, now())),

    createTask(projectId, input) {
      const id = newId();
      commit((d) => createTask(d, projectId, input, id, now()));
      return id;
    },
    updateTask: (id, patch) => commit((d) => updateTask(d, id, patch, now())),
    moveTask: (id, beforeId, afterId) => commit((d) => moveTask(d, id, beforeId, afterId, now())),
    deleteTask: (id) => commit((d) => deleteTask(d, id, now())),

    createIdea(projectId, input, groupId = null) {
      const id = newId();
      commit((d) => createIdea(d, projectId, input, id, now(), groupId));
      return id;
    },
    updateIdea: (id, input) => commit((d) => updateIdea(d, id, input, now())),
    deleteIdea: (id) => commit((d) => deleteIdea(d, id, now())),
    setIdeaGroup: (id, groupId) => commit((d) => setIdeaGroup(d, id, groupId, now())),

    createIdeaGroup(input) {
      const id = newId();
      commit((d) => createIdeaGroup(d, input, id, now()));
      return id;
    },
    updateIdeaGroup: (id, input) => commit((d) => updateIdeaGroup(d, id, input, now())),
    deleteIdeaGroup: (id) => commit((d) => deleteIdeaGroup(d, id, now())),
  };
});
