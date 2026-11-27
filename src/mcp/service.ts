import { emptyData } from '../core/data';
import {
  createIdea,
  createIdeaGroup,
  deleteIdea,
  deleteIdeaGroup,
  findIdeaGroup,
  GENERAL_IDEAS_ID,
  setIdeaGroup,
  updateIdea,
  updateIdeaGroup,
} from '../core/ideas';
import type {
  Idea,
  IdeaGroup,
  LocalDate,
  Phase,
  Project,
  ProjectGroup,
  ProjectStatus,
  Task,
  TaskStatus,
  TaskyData,
  TimeSlot,
  Timestamp,
} from '../core/model';
import { createPhase, deletePhase, movePhase, setPhaseGroup, updatePhase } from '../core/phases';
import { createProjectGroup, deleteProjectGroup, moveProjectGroup, moveProjectIntoGroup, updateProjectGroup } from '../core/projectGroups';
import { createProject, updateProject } from '../core/projects';
import {
  findPhase,
  findProjectGroup,
  groupIdeas,
  ideaGroups,
  phaseGroup,
  projectGroups,
  projectIdeas,
  projectPhases,
  projectSummariesByStatus,
  projectTasks,
  taskGroup,
} from '../core/selectors';
import { countRecords, pendingChanges, rememberVersions, type ServerVersions, type SyncRecords } from '../core/sync';
import { createTask, deleteTask, looseTasksIn, moveTask, phasesIn, taskOrder, taskPlace, updateTask, type TaskPatch } from '../core/tasks';

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

const STATUS_LABEL = { active: 'activo', on_hold: 'en espera', upcoming: 'próximo', done: 'finalizado' } as const;

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
  scheduledDays?: LocalDate[];
  repeatWeekly?: boolean;
  status?: TaskStatus;
  /** Fase del mismo proyecto; sin indicar, queda suelta. */
  phaseId?: string | null;
  /** Sin fase: grupo del mismo proyecto donde queda suelta (null = primer nivel). */
  groupId?: string | null;
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
  function requireGroup(data: TaskyData, id: string): IdeaGroup {
    const group = findIdeaGroup(data, id);
    if (!group) throw new ToolError(`No existe ningún grupo de ideas con id «${id}». Usa get_idea_groups.`);
    return group;
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
    const fields = {
      title: input.title,
      description: input.description ?? '',
      dueDate: input.dueDate ?? null,
      timeSlot: input.timeSlot,
      scheduledDays: input.scheduledDays,
      repeatWeekly: input.repeatWeekly,
      phaseId: input.phaseId,
      groupId: input.groupId,
    };
    const created = createTask(d, projectId, fields, id, env.now());
    return input.status && input.status !== 'todo' ? updateTask(created, id, { status: input.status }, env.now()) : created;
  }

  const projectName = (data: TaskyData, id: string) => data.projects.find((p) => p.id === id)?.name ?? '';
  function requirePhase(data: TaskyData, id: string): Phase {
    const phase = findPhase(data, id);
    if (!phase) throw new ToolError(`No existe ninguna fase con id «${id}». Usa get_project para ver las fases del proyecto.`);
    return phase;
  }
  /** Fase con ese nombre en el mismo lugar (el grupo indicado o, con null, el primer nivel del proyecto). */
  const phaseNamed = (d: TaskyData, projectId: string, groupId: string | null, name: string) =>
    phasesIn(d, projectId, groupId).find((f) => sameText(f.name, name));
  function requireProjectGroup(data: TaskyData, id: string): ProjectGroup {
    const group = findProjectGroup(data, id);
    if (!group) {
      throw new ToolError(`No existe ningún grupo de proyecto con id «${id}». Usa get_project para ver los grupos del proyecto.`);
    }
    return group;
  }
  const projectGroupNamed = (d: TaskyData, projectId: string, name: string) =>
    projectGroups(d, projectId).find((g) => sameText(g.name, name));

  const phaseName = (data: TaskyData, id: string | null) => (id ? (findPhase(data, id)?.name ?? null) : null);

  const taskView = (data: TaskyData, t: Task) => ({
    id: t.id,
    project_id: t.projectId,
    project: projectName(data, t.projectId),
    phase: phaseName(data, t.phaseId),
    project_group_id: taskGroup(data, t)?.id ?? null,
    group: taskGroup(data, t)?.name ?? null,
    title: t.title,
    description: t.description,
    status: t.status,
    due_date: t.dueDate,
    time_slot: t.timeSlot,
    scheduled_days: t.scheduledDays,
    repeat_weekly: t.repeatWeekly,
    completed_at: t.completedAt,
  });

  const ideaView = (data: TaskyData, i: Idea) => {
    const group = i.projectId === GENERAL_IDEAS_ID && i.groupId ? findIdeaGroup(data, i.groupId) : undefined;
    return {
      id: i.id,
      project_id: i.projectId === GENERAL_IDEAS_ID ? null : i.projectId,
      project: i.projectId === GENERAL_IDEAS_ID ? 'Ideas generales (sin proyecto)' : projectName(data, i.projectId),
      group_id: group?.id ?? null,
      group: group?.name ?? null,
      title: i.title,
      description: i.description,
      created_at: i.createdAt,
    };
  };
  const groupView = (data: TaskyData, g: IdeaGroup) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    ideas: groupIdeas(data, g.id).length,
  });
  const phaseView = (data: TaskyData, f: Phase) => ({
    id: f.id,
    project_id: f.projectId,
    project_group_id: phaseGroup(data, f)?.id ?? null,
    project_group: phaseGroup(data, f)?.name ?? null,
    name: f.name,
    description: f.description,
    tasks: data.tasks
      .filter((t) => t.phaseId === f.id && !t.deletedAt)
      .sort(taskOrder(data))
      .map((t) => ({ id: t.id, title: t.title, status: t.status })),
  });

  const projectGroupView = (data: TaskyData, g: ProjectGroup) => ({
    id: g.id,
    project_id: g.projectId,
    name: g.name,
    description: g.description,
    phases: phasesIn(data, g.projectId, g.id).map((f) => ({ id: f.id, name: f.name })),
    loose_tasks: looseTasksIn(data, g.projectId, g.id)
      .sort(taskOrder(data))
      .map((t) => ({ id: t.id, title: t.title, status: t.status })),
  });

  function projectViews(data: TaskyData) {
    const today = env.today();
    return (['active', 'on_hold', 'upcoming', 'done'] as const).flatMap((status) =>
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
      const data = await load();
      return {
        projects: projectViews(data),
        general_ideas: projectIdeas(data, GENERAL_IDEAS_ID).length,
        idea_groups: ideaGroups(data).map((g) => groupView(data, g)),
        today: env.today(),
      };
    },

    async getProject(projectId: string) {
      const data = await load();
      const project = requireProject(data, projectId);
      return {
        project: projectViews(data).find((p) => p.id === project.id),
        project_groups: projectGroups(data, project.id).map((g) => projectGroupView(data, g)),
        phases: projectPhases(data, project.id).map((f) => phaseView(data, f)),
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
        return createProject(d, { name: input.name, description: input.description ?? '', status: input.status }, id, env.now());
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

    // ── Grupos de proyecto (Proyecto → Grupo → Fase → Tarea) ──

    /**
     * Crea un grupo en el primer nivel del proyecto e incorpora, si se indican, fases ya existentes del mismo proyecto.
     * Si ya hay un grupo con ese nombre, lo devuelve sin duplicarlo.
     */
    async createProjectGroup(projectId: string, input: { name: string; description?: string; phaseIds?: string[] }) {
      const id = env.newId();
      let existing: ProjectGroup | undefined;
      const data = await mutate((d) => {
        requireProject(d, projectId);
        existing = projectGroupNamed(d, projectId, input.name);
        if (existing) return d;
        for (const phaseId of input.phaseIds ?? []) {
          if (requirePhase(d, phaseId).projectId !== projectId) throw new ToolError(`La fase «${phaseId}» no es de este proyecto.`);
        }
        return createProjectGroup(d, projectId, { name: input.name, description: input.description ?? '' }, id, env.now(), input.phaseIds);
      });
      return existing
        ? { already_existed: projectGroupView(data, existing), note: 'Ya existía un grupo con ese nombre en el proyecto; no se ha creado otro.' }
        : { created: projectGroupView(data, requireProjectGroup(data, id)) };
    },

    async updateProjectGroup(groupId: string, patch: { name?: string; description?: string }) {
      const data = await mutate((d) => {
        const group = requireProjectGroup(d, groupId);
        if (patch.name !== undefined) {
          const clash = projectGroupNamed(d, group.projectId, patch.name);
          if (clash && clash.id !== groupId) throw new ToolError(`Ya existe otro grupo llamado «${clash.name}» en el proyecto.`);
        }
        return updateProjectGroup(
          d,
          groupId,
          { name: patch.name ?? group.name, description: patch.description ?? group.description },
          env.now(),
        );
      });
      return { updated: projectGroupView(data, requireProjectGroup(data, groupId)) };
    },

    /** Mueve el grupo a otra posición entre los grupos del proyecto (1 = el primero). */
    async moveProjectGroup(groupId: string, position: number) {
      const data = await mutate((d) => {
        const group = requireProjectGroup(d, groupId);
        const groups = projectGroups(d, group.projectId);
        const others = groups.filter((g) => g.id !== groupId);
        const index = Math.min(Math.max(Math.round(position) - 1, 0), others.length);
        if (groups.findIndex((g) => g.id === groupId) === index) return d;
        return moveProjectGroup(d, groupId, others[index - 1]?.id ?? null, others[index]?.id ?? null, env.now());
      });
      const group = requireProjectGroup(data, groupId);
      return { moved: projectGroupView(data, group), project_groups: projectGroups(data, group.projectId).map((g) => g.name) };
    },

    /**
     * Convierte un proyecto en un grupo de otro: todo su contenido (fases, tareas también completadas e ideas) pasa tal
     * cual al grupo nuevo, con los mismos ids, estados y fechas; después se elimina el proyecto de origen, ya vacío.
     */
    async moveProjectIntoGroup(sourceId: string, targetId: string) {
      const id = env.newId();
      let counts = { phases: 0, tasks: 0, completed_tasks: 0, ideas: 0 };
      const data = await mutate((d) => {
        const source = requireProject(d, sourceId);
        requireProject(d, targetId);
        const live = (r: { projectId: string; deletedAt: string | null }) => r.projectId === source.id && !r.deletedAt;
        const tasks = d.tasks.filter(live);
        counts = {
          phases: d.phases.filter(live).length,
          tasks: tasks.length,
          completed_tasks: tasks.filter((t) => t.status === 'done').length,
          ideas: d.ideas.filter(live).length,
        };
        return moveProjectIntoGroup(d, sourceId, targetId, id, env.now());
      });
      return {
        created_group: projectGroupView(data, requireProjectGroup(data, id)),
        moved: counts,
        note: 'El proyecto de origen se ha eliminado; todo su contenido está ahora en el grupo.',
      };
    },

    /** Elimina el grupo; sus fases y tareas NO se borran: quedan en el primer nivel del proyecto. */
    async deleteProjectGroup(groupId: string) {
      let deleted: ReturnType<typeof projectGroupView> | undefined;
      await mutate((d) => {
        deleted = projectGroupView(d, requireProjectGroup(d, groupId));
        return deleteProjectGroup(d, groupId, env.now());
      });
      return { deleted, note: 'Sus fases y tareas no se han eliminado: han quedado en el proyecto, sin grupo.' };
    },

    // ── Fases ──

    /**
     * Crea una fase (al final del proyecto o, con groupId, al final de ese grupo) e incorpora, si se indican, tareas ya
     * existentes del mismo proyecto. Si ya hay una fase con ese nombre en el mismo lugar, la devuelve sin duplicarla.
     */
    async createPhase(projectId: string, input: { name: string; description?: string; taskIds?: string[]; groupId?: string }) {
      const id = env.newId();
      let existing: Phase | undefined;
      const data = await mutate((d) => {
        requireProject(d, projectId);
        const groupId = input.groupId ? requireProjectGroup(d, input.groupId).id : null;
        if (groupId && findProjectGroup(d, groupId)!.projectId !== projectId) throw new ToolError('El grupo no es de este proyecto.');
        existing = phaseNamed(d, projectId, groupId, input.name);
        if (existing) return d;
        for (const taskId of input.taskIds ?? []) {
          if (requireTask(d, taskId).projectId !== projectId) throw new ToolError(`La tarea «${taskId}» no es de este proyecto.`);
        }
        return createPhase(d, projectId, { name: input.name, description: input.description ?? '' }, id, env.now(), input.taskIds, groupId);
      });
      return existing
        ? { already_existed: phaseView(data, existing), note: 'Ya existía una fase con ese nombre en el mismo lugar; no se ha creado otra.' }
        : { created: phaseView(data, requirePhase(data, id)) };
    },

    /** `groupId`: mueve la fase a ese grupo del proyecto (al final); null la saca al primer nivel. */
    async updatePhase(phaseId: string, patch: { name?: string; description?: string; groupId?: string | null }) {
      const data = await mutate((d) => {
        const phase = requirePhase(d, phaseId);
        const groupId =
          patch.groupId === undefined ? (phaseGroup(d, phase)?.id ?? null) : patch.groupId && requireProjectGroup(d, patch.groupId).id;
        if (patch.name !== undefined) {
          const clash = phaseNamed(d, phase.projectId, groupId, patch.name);
          if (clash && clash.id !== phaseId) throw new ToolError(`Ya existe otra fase llamada «${clash.name}» en el mismo lugar.`);
        }
        const next = updatePhase(d, phaseId, { name: patch.name ?? phase.name, description: patch.description ?? phase.description }, env.now());
        return patch.groupId === undefined ? next : setPhaseGroup(next, phaseId, groupId, env.now());
      });
      return { updated: phaseView(data, requirePhase(data, phaseId)) };
    },

    /** Mueve la fase a otra posición entre las fases de su mismo lugar (su grupo o las fases sin grupo; 1 = la primera). */
    async movePhase(phaseId: string, position: number) {
      const data = await mutate((d) => {
        const phase = requirePhase(d, phaseId);
        const phases = phasesIn(d, phase.projectId, phaseGroup(d, phase)?.id ?? null);
        const others = phases.filter((f) => f.id !== phaseId);
        const index = Math.min(Math.max(Math.round(position) - 1, 0), others.length);
        if (phases.findIndex((f) => f.id === phaseId) === index) return d;
        return movePhase(d, phaseId, others[index - 1]?.id ?? null, others[index]?.id ?? null, env.now());
      });
      const phase = requirePhase(data, phaseId);
      return { moved: phaseView(data, phase), phases: phasesIn(data, phase.projectId, phaseGroup(data, phase)?.id ?? null).map((f) => f.name) };
    },

    /** Elimina la fase; sus tareas NO se borran: quedan sueltas en el proyecto. */
    async deletePhase(phaseId: string) {
      let deleted: ReturnType<typeof phaseView> | undefined;
      await mutate((d) => {
        deleted = phaseView(d, requirePhase(d, phaseId));
        return deletePhase(d, phaseId, env.now());
      });
      return { deleted, note: 'Sus tareas no se han eliminado: han quedado sueltas en el proyecto.' };
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

    /**
     * Cambia el orden de trabajo: position 1 = la primera de las tareas abiertas de su mismo lugar
     * (su fase o, si no tiene, las sueltas de su grupo o del primer nivel). No la cambia de lugar.
     */
    async moveTask(taskId: string, position: number) {
      const data = await mutate((d) => {
        const task = requireTask(d, taskId);
        if (task.status === 'done') throw new ToolError('Las tareas completadas no tienen orden; reábrela antes si quieres moverla.');
        const place = (t: Task) => {
          const p = taskPlace(d, t);
          return p.phaseId ?? `g:${p.groupId}`;
        };
        const open = projectTasks(d, task.projectId).open.filter((t) => place(t) === place(task));
        const others = open.filter((t) => t.id !== taskId);
        const index = Math.min(Math.max(Math.round(position) - 1, 0), others.length);
        if (open.findIndex((t) => t.id === taskId) === index) return d;
        return moveTask(d, taskId, others[index - 1]?.id ?? null, others[index]?.id ?? null, env.now());
      });
      const task = requireTask(data, taskId);
      return { moved: taskView(data, task), open_tasks: tasksOf(data, task.projectId, 'open').map((t) => t.title) };
    },

    async updateTask(taskId: string, patch: TaskPatch) {
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

    /**
     * Con project_id, las de ese proyecto; con group_id, las de ese grupo de ideas generales; con `general`, solo las
     * generales (de todos los grupos y sueltas); sin nada, todas (proyectos y generales).
     */
    async getIdeas(projectId: string | undefined, general = false, groupId?: string) {
      const data = await load();
      if (groupId) return { ideas: groupIdeas(data, requireGroup(data, groupId).id).map((i) => ideaView(data, i)) };
      const ids = general
        ? [GENERAL_IDEAS_ID]
        : projectId
          ? [requireProject(data, projectId).id]
          : [...data.projects.filter((p) => !p.deletedAt).map((p) => p.id), GENERAL_IDEAS_ID];
      return { ideas: ids.flatMap((id) => projectIdeas(data, id).map((i) => ideaView(data, i))) };
    },

    /**
     * Sin proyecto es una idea general (con group_id, dentro de ese grupo). Si ya existe una con ese título en el mismo
     * sitio, la devuelve sin duplicarla.
     */
    async createIdea(projectId: string | undefined, input: { title: string; description?: string }, groupId?: string) {
      if (projectId && groupId) throw new ToolError('Los grupos son solo para ideas generales: indica project_id o group_id, no ambos.');
      const id = env.newId();
      let existing: Idea | undefined;
      const data = await mutate((d) => {
        const target = projectId ? requireProject(d, projectId).id : GENERAL_IDEAS_ID;
        const group = groupId ? requireGroup(d, groupId).id : null;
        existing = ideaTitled(d, target, input.title);
        return existing ? d : createIdea(d, target, { title: input.title, description: input.description ?? '' }, id, env.now(), group);
      });
      return existing
        ? { already_existed: ideaView(data, existing), note: 'Ya había una idea con ese título en el mismo sitio; no se ha duplicado.' }
        : { created: ideaView(data, requireIdea(data, id)) };
    },

    /** `groupId`: mueve una idea general a ese grupo (null = la saca del grupo). */
    async updateIdea(ideaId: string, patch: { title?: string; description?: string; groupId?: string | null }) {
      const data = await mutate((d) => {
        const idea = requireIdea(d, ideaId);
        let next = updateIdea(
          d,
          ideaId,
          { title: patch.title ?? idea.title, description: patch.description ?? idea.description },
          env.now(),
        );
        if (patch.groupId !== undefined) {
          if (idea.projectId !== GENERAL_IDEAS_ID) throw new ToolError('Solo las ideas generales (sin proyecto) pueden ir en un grupo.');
          next = setIdeaGroup(next, ideaId, patch.groupId === null ? null : requireGroup(next, patch.groupId).id, env.now());
        }
        return next;
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

    // ── Grupos de ideas generales ──

    async getIdeaGroups() {
      const data = await load();
      return { groups: ideaGroups(data).map((g) => groupView(data, g)), ungrouped_ideas: groupIdeas(data, null).length };
    },

    /** Si ya existe un grupo con ese nombre, lo devuelve sin duplicarlo. */
    async createIdeaGroup(input: { name: string; description?: string }) {
      const id = env.newId();
      let existing: IdeaGroup | undefined;
      const data = await mutate((d) => {
        existing = ideaGroups(d).find((g) => sameText(g.name, input.name));
        return existing ? d : createIdeaGroup(d, { name: input.name, description: input.description ?? '' }, id, env.now());
      });
      return existing
        ? { already_existed: groupView(data, existing), note: 'Ya había un grupo con ese nombre; no se ha duplicado.' }
        : { created: groupView(data, requireGroup(data, id)) };
    },

    async updateIdeaGroup(groupId: string, patch: { name?: string; description?: string }) {
      const data = await mutate((d) => {
        const group = requireGroup(d, groupId);
        return updateIdeaGroup(
          d,
          groupId,
          { name: patch.name ?? group.name, description: patch.description ?? group.description },
          env.now(),
        );
      });
      return { updated: groupView(data, requireGroup(data, groupId)) };
    },

    /** Sus ideas no se borran: quedan sin grupo. */
    async deleteIdeaGroup(groupId: string) {
      let deleted: IdeaGroup | undefined;
      let moved = 0;
      await mutate((d) => {
        deleted = requireGroup(d, groupId);
        moved = groupIdeas(d, groupId).length;
        return deleteIdeaGroup(d, groupId, env.now());
      });
      return { deleted: { id: deleted!.id, name: deleted!.name }, ideas_left_ungrouped: moved };
    },
  };
}

export type TaskyService = ReturnType<typeof createTaskyService>;
