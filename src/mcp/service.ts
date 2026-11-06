import { emptyData } from '../core/data';
import { createIdea, deleteIdea, updateIdea } from '../core/ideas';
import type { Idea, LocalDate, Project, ProjectStatus, Task, TaskStatus, TaskyData, TimeSlot, Timestamp } from '../core/model';
import { createProject, updateProject } from '../core/projects';
import { projectIdeas, projectSummariesByStatus, projectTasks } from '../core/selectors';
import { countRecords, pendingChanges, rememberVersions, type ServerVersions, type SyncRecords } from '../core/sync';
import { createTask, deleteTask, moveTask, updateTask } from '../core/tasks';

/**
 * Operaciones de Tasky para el asistente (servidor MCP). Toda la lógica de negocio es la de core/:
 * aquí solo se carga el estado, se aplica la misma función que usa la app y se guardan los cambios
 * con el mismo cálculo de pendientes que la sincronización.
 */
export interface TaskyRepository {
  /** Todos los registros del usuario (incluidas lápidas). */
  load(): Promise<SyncRecords>;
  /** Guarda cambios; devuelve los registros en los que el servidor ya tenía una versión más reciente. */
  save(records: SyncRecords): Promise<SyncRecords>;
}

export interface ServiceEnv {
  now(): Timestamp;
  today(): LocalDate;
  newId(): string;
}

/** Error con un mensaje pensado para el asistente (se le devuelve tal cual). */
export class ToolError extends Error {}

const STATUS_LABEL = { active: 'activo', on_hold: 'en espera', done: 'finalizado' } as const;

/** Minúsculas, sin acentos ni signos: «Wynot!» y «wynot» coinciden. */
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function nameScore(query: string, name: string): number {
  const q = normalize(query);
  const n = normalize(name);
  if (!q || !n) return 0;
  if (q === n) return 1;
  if (n.includes(q) || q.includes(n)) return 0.8;
  const qWords = new Set(q.split(' '));
  const nWords = n.split(' ');
  const shared = nWords.filter((w) => qWords.has(w)).length;
  return shared === 0 ? 0 : (0.6 * shared) / Math.max(qWords.size, nWords.length);
}

export interface TaskFields {
  title: string;
  description?: string;
  dueDate?: LocalDate | null;
  timeSlot?: TimeSlot;
  status?: TaskStatus;
}

export function createTaskyService(repo: TaskyRepository, env: ServiceEnv) {
  const toData = (r: SyncRecords): TaskyData => ({ ...emptyData(), ...r });

  /** Carga, aplica un cambio de core/ y guarda solo lo que ha cambiado. */
  async function mutate(change: (data: TaskyData) => TaskyData): Promise<TaskyData> {
    const loaded = await repo.load();
    const versions: ServerVersions = new Map();
    rememberVersions(versions, loaded);
    let next: TaskyData;
    try {
      next = change(toData(loaded));
    } catch (e) {
      throw new ToolError(e instanceof Error ? e.message : String(e));
    }
    const pending = pendingChanges(next, versions);
    if (countRecords(pending) > 0 && countRecords(await repo.save(pending)) > 0) {
      throw new ToolError('Otro dispositivo modificó este elemento al mismo tiempo. Vuelve a consultarlo e inténtalo de nuevo.');
    }
    return next;
  }

  const load = async () => toData(await repo.load());

  function requireProject(data: TaskyData, id: string): Project {
    const project = data.projects.find((p) => p.id === id && !p.deletedAt);
    if (!project) throw new ToolError(`No existe ningún proyecto con id «${id}». Usa get_projects o get_project_by_name.`);
    return project;
  }
  function requireTask(data: TaskyData, id: string): Task {
    const task = data.tasks.find((t) => t.id === id && !t.deletedAt);
    if (!task) throw new ToolError(`No existe ninguna tarea con id «${id}». Usa get_tasks.`);
    return task;
  }
  function requireIdea(data: TaskyData, id: string): Idea {
    const idea = data.ideas.find((i) => i.id === id && !i.deletedAt);
    if (!idea) throw new ToolError(`No existe ninguna idea con id «${id}». Usa get_ideas.`);
    return idea;
  }

  // ── Idempotencia: repetir una creación (p. ej. un reintento tras un corte) no duplica nada ──
  const sameText = (a: string, b: string) => normalize(a) === normalize(b);
  const liveProjectNamed = (d: TaskyData, name: string) => d.projects.find((p) => !p.deletedAt && sameText(p.name, name));
  const openTaskTitled = (d: TaskyData, projectId: string, title: string) =>
    d.tasks.find((t) => t.projectId === projectId && !t.deletedAt && t.status !== 'done' && sameText(t.title, title));
  const ideaTitled = (d: TaskyData, projectId: string, title: string) =>
    d.ideas.find((i) => i.projectId === projectId && !i.deletedAt && sameText(i.title, title));

  /** Crea una tarea con la misma función que la app y, si se pide, le pone ya su estado. */
  function addTask(d: TaskyData, projectId: string, input: TaskFields, id: string): TaskyData {
    const fields = { title: input.title, description: input.description ?? '', dueDate: input.dueDate ?? null, timeSlot: input.timeSlot };
    const created = createTask(d, projectId, fields, id, env.now());
    return input.status && input.status !== 'todo' ? updateTask(created, id, { status: input.status }, env.now()) : created;
  }

  const projectName = (data: TaskyData, id: string) => data.projects.find((p) => p.id === id)?.name ?? '';

  const taskView = (data: TaskyData, t: Task) => ({
    id: t.id,
    project_id: t.projectId,
    project: projectName(data, t.projectId),
    title: t.title,
    description: t.description,
    status: t.status,
    due_date: t.dueDate,
    time_slot: t.timeSlot,
    completed_at: t.completedAt,
  });

  const ideaView = (data: TaskyData, i: Idea) => ({
    id: i.id,
    project_id: i.projectId,
    project: projectName(data, i.projectId),
    title: i.title,
    description: i.description,
    created_at: i.createdAt,
  });

  function projectViews(data: TaskyData) {
    const today = env.today();
    return (['active', 'on_hold', 'done'] as const).flatMap((status) =>
      projectSummariesByStatus(data, status, today).map((s) => ({
        id: s.project.id,
        name: s.project.name,
        status: STATUS_LABEL[status],
        description: s.project.description,
        pending_tasks: s.pending,
        completed_tasks: s.completed,
        ideas: projectIdeas(data, s.project.id).length,
        next_due_date: s.nextDue,
        next_task: s.nextTask?.title ?? null,
        overdue_tasks: s.overdue,
      })),
    );
  }

  /** Tareas en el orden de la app: abiertas por su orden manual, completadas de la más reciente a la más antigua. */
  function tasksOf(data: TaskyData, projectId: string, which: 'open' | 'done' | 'all') {
    const { open, done } = projectTasks(data, projectId);
    const list = which === 'open' ? open : which === 'done' ? done : [...open, ...done];
    return list.map((t) => taskView(data, t));
  }

  return {
    async getProjects() {
      return { projects: projectViews(await load()), today: env.today() };
    },

    async getProject(projectId: string) {
      const data = await load();
      const project = requireProject(data, projectId);
      return {
        project: projectViews(data).find((p) => p.id === project.id),
        open_tasks: tasksOf(data, project.id, 'open'),
        completed_tasks: tasksOf(data, project.id, 'done'),
        ideas: projectIdeas(data, project.id).map((i) => ideaView(data, i)),
      };
    },

    async getProjectByName(name: string) {
      const views = projectViews(await load());
      const matches = views
        .map((p) => ({ id: p.id, name: p.name, status: p.status, score: Math.round(nameScore(name, p.name) * 100) / 100 }))
        .filter((m) => m.score >= 0.3)
        .sort((a, b) => b.score - a.score);
      const exact = matches.length > 0 && matches[0].score === 1 && (matches.length === 1 || matches[1].score < 1);
      return {
        matches,
        certain: exact || (matches.length === 1 && matches[0].score >= 0.8),
        all_projects: matches.length === 0 ? views.map((p) => p.name) : undefined,
      };
    },

    /** Crea un proyecto (activo salvo que se indique otro estado). Si ya hay uno con ese nombre, lo devuelve sin duplicarlo. */
    async createProject(input: { name: string; description?: string; status?: ProjectStatus }) {
      const id = env.newId();
      let existing: Project | undefined;
      const data = await mutate((d) => {
        existing = liveProjectNamed(d, input.name);
        if (existing) return d;
        const created = createProject(d, { name: input.name, description: input.description ?? '' }, id, env.now());
        return input.status && input.status !== 'active' ? updateProject(created, id, { status: input.status }, env.now()) : created;
      });
      const view = (projectId: string) => projectViews(data).find((p) => p.id === projectId);
      return existing
        ? { already_existed: view(existing.id), note: 'Ya existía un proyecto con ese nombre; no se ha creado otro.' }
        : { created: view(id) };
    },

    async updateProject(projectId: string, patch: { name?: string; description?: string; status?: ProjectStatus }) {
      const data = await mutate((d) => {
        requireProject(d, projectId);
        if (patch.name !== undefined) {
          const clash = liveProjectNamed(d, patch.name);
          if (clash && clash.id !== projectId) throw new ToolError(`Ya existe otro proyecto llamado «${clash.name}».`);
        }
        return updateProject(d, projectId, patch, env.now());
      });
      return { updated: projectViews(data).find((p) => p.id === projectId) };
    },

    async getTasks(projectId: string | undefined, which: 'open' | 'done' | 'all') {
      const data = await load();
      if (projectId) return { tasks: tasksOf(data, requireProject(data, projectId).id, which), today: env.today() };
      const projects = data.projects.filter((p) => !p.deletedAt);
      return { tasks: projects.flatMap((p) => tasksOf(data, p.id, which)), today: env.today() };
    },

    /**
     * Crea varias tareas al final del proyecto, en el orden dado y en una sola escritura.
     * Las que ya existen abiertas con el mismo título no se duplican: se devuelven en already_existed.
     */
    async createTasks(projectId: string, inputs: TaskFields[]) {
      const results: { id: string; existed: boolean }[] = [];
      const data = await mutate((d) => {
        requireProject(d, projectId);
        results.length = 0;
        let next = d;
        for (const input of inputs) {
          const existing = openTaskTitled(next, projectId, input.title);
          if (existing) {
            results.push({ id: existing.id, existed: true });
            continue;
          }
          const id = env.newId();
          next = addTask(next, projectId, input, id);
          results.push({ id, existed: false });
        }
        return next;
      });
      const views = (existed: boolean) => results.filter((r) => r.existed === existed).map((r) => taskView(data, requireTask(data, r.id)));
      return { created: views(false), already_existed: views(true) };
    },

    async createTask(projectId: string, input: TaskFields) {
      const { created, already_existed } = await this.createTasks(projectId, [input]);
      return created.length > 0
        ? { created: created[0] }
        : { already_existed: already_existed[0], note: 'Ya había una tarea abierta con ese título en el proyecto; no se ha duplicado.' };
    },

    /** Cambia el orden de trabajo: position 1 = la primera de las tareas abiertas del proyecto. */
    async moveTask(taskId: string, position: number) {
      const data = await mutate((d) => {
        const task = requireTask(d, taskId);
        if (task.status === 'done') throw new ToolError('Las tareas completadas no tienen orden; reábrela antes si quieres moverla.');
        const open = projectTasks(d, task.projectId).open;
        const others = open.filter((t) => t.id !== taskId);
        const index = Math.min(Math.max(Math.round(position) - 1, 0), others.length);
        if (open.findIndex((t) => t.id === taskId) === index) return d;
        return moveTask(d, taskId, others[index - 1]?.id ?? null, others[index]?.id ?? null, env.now());
      });
      const task = requireTask(data, taskId);
      return { moved: taskView(data, task), open_tasks: tasksOf(data, task.projectId, 'open').map((t) => t.title) };
    },

    async updateTask(
      taskId: string,
      patch: { title?: string; description?: string; dueDate?: LocalDate | null; timeSlot?: TimeSlot; status?: TaskStatus },
    ) {
      const data = await mutate((d) => {
        requireTask(d, taskId);
        return updateTask(d, taskId, patch, env.now());
      });
      return { updated: taskView(data, requireTask(data, taskId)) };
    },

    async completeTask(taskId: string) {
      return this.updateTask(taskId, { status: 'done' });
    },

    async deleteTask(taskId: string) {
      let deleted: Task | undefined;
      const data = await mutate((d) => {
        deleted = requireTask(d, taskId);
        return deleteTask(d, taskId, env.now());
      });
      return { deleted: taskView(data, deleted!) };
    },

    async getIdeas(projectId: string | undefined) {
      const data = await load();
      const ids = projectId ? [requireProject(data, projectId).id] : data.projects.filter((p) => !p.deletedAt).map((p) => p.id);
      return { ideas: ids.flatMap((id) => projectIdeas(data, id).map((i) => ideaView(data, i))) };
    },

    /** Si el proyecto ya tiene una idea con ese título, la devuelve sin duplicarla. */
    async createIdea(projectId: string, input: { title: string; description?: string }) {
      const id = env.newId();
      let existing: Idea | undefined;
      const data = await mutate((d) => {
        requireProject(d, projectId);
        existing = ideaTitled(d, projectId, input.title);
        return existing ? d : createIdea(d, projectId, { title: input.title, description: input.description ?? '' }, id, env.now());
      });
      return existing
        ? { already_existed: ideaView(data, existing), note: 'Ya había una idea con ese título en el proyecto; no se ha duplicado.' }
        : { created: ideaView(data, requireIdea(data, id)) };
    },

    async updateIdea(ideaId: string, patch: { title?: string; description?: string }) {
      const data = await mutate((d) => {
        const idea = requireIdea(d, ideaId);
        return updateIdea(d, ideaId, { title: patch.title ?? idea.title, description: patch.description ?? idea.description }, env.now());
      });
      return { updated: ideaView(data, requireIdea(data, ideaId)) };
    },

    async deleteIdea(ideaId: string) {
      let deleted: Idea | undefined;
      const data = await mutate((d) => {
        deleted = requireIdea(d, ideaId);
        return deleteIdea(d, ideaId, env.now());
      });
      return { deleted: ideaView(data, deleted!) };
    },
  };
}

export type TaskyService = ReturnType<typeof createTaskyService>;
