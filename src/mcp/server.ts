import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ToolError, type TaskyService } from './service';

const INSTRUCTIONS = `Tasky es el gestor personal de proyectos, tareas e ideas del usuario. Tasky es la fuente de verdad: consulta siempre antes de actuar. Todo lo que hagas aquí se guarda en Supabase y aparece al momento en la app de Windows, la web y el iPhone.

Reglas:
- Para trabajar en un proyecto necesitas su id real: obtenlo con get_project_by_name o get_projects. Nunca inventes ids.
- Si get_project_by_name devuelve certain=false (varias coincidencias, coincidencia parcial o ninguna), pregunta al usuario a qué proyecto se refiere ANTES de crear o modificar nada.
- Crea un proyecto (create_project) solo cuando el usuario lo pida o acepte, y comprueba antes con get_project_by_name que no existe ya.
- Tarea = algo concreto que hacer. Idea = algo a explorar o recordar más adelante; si no es de ningún proyecto, es una idea general (create_idea sin project_id). Si no está claro qué es, pregunta antes de crearlo.
- Títulos breves y accionables en el idioma del usuario (las tareas empiezan por un verbo); la descripción añade el contexto útil (criterios de terminado, notas). No inventes detalles.
- Para desglosar un proyecto usa create_tasks con todas las tareas en orden de trabajo; el orden de la lista es el orden en Tasky (la primera abierta es «la siguiente»). Usa move_task para reordenar.
- Un proyecto organiza sus tareas en fases (get_project las lista con sus tareas; cada tarea indica su phase). Tienes acceso completo: create_phase / update_phase / move_phase / delete_phase gestionan las fases; para meter una tarea en una fase pasa phase_id en create_task, create_tasks o update_task (phase_id = null la saca de la fase). Eliminar una fase NO borra sus tareas: quedan sueltas. Sin phase_id, las tareas nuevas quedan sin fase.
- Las ideas generales se organizan en grupos (get_idea_groups / create_idea_group / update_idea_group / delete_idea_group). Para crear una idea dentro de un grupo pasa group_id en create_idea; para moverla, group_id en update_idea (null la saca del grupo). Eliminar un grupo NO borra sus ideas: quedan sin grupo. Si el usuario nombra un grupo, búscalo con get_idea_groups antes de crear otro.
- Repetir una creación no duplica: si ya hay una tarea abierta, una idea o un proyecto con el mismo título, se devuelve en already_existed. Ante un error de conexión puedes reintentar con seguridad.
- Estados: todo = pendiente, in_progress = en curso, done = completada. Marca in_progress al empezar una tarea y done (complete_task) SOLO cuando el trabajo esté terminado y verificado (pruebas pasadas, comprobado en la app…). Si no se ha podido verificar, déjala en curso y explica qué falta en su descripción.
- Para localizar una tarea o idea por su texto, consulta primero get_tasks, get_project o get_ideas y usa su id. Si hay varias candidatas, pregunta.
- "Dividir una tarea": crea las nuevas tareas en el mismo proyecto y después elimina la original solo si el usuario lo ha pedido o lo confirma.
- Fechas en formato AAAA-MM-DD; el campo today de las respuestas indica la fecha actual del usuario.
- Programación y fecha límite son independientes: scheduled_days = días en que se hará (uno o varios; repeat_weekly = true para repetir cada semana esos días de la semana); due_date = cuándo debe estar terminada. Usa la programación si el usuario dice cuándo la hará y due_date solo si da un plazo.
- Franja horaria (time_slot): morning = mañana, afternoon = tarde, evening = noche, all_day = día completo (por defecto).
- Estados de proyecto: active = activo, on_hold = en espera, upcoming = próximo (previsto para más adelante), done = finalizado.
- No hay herramienta para borrar proyectos: para retirar uno, cambia su estado a done (finalizado) o on_hold (en espera) con update_project.
- Al terminar, confirma en una lista breve qué has creado o cambiado y en qué proyecto.`;

const id = z.string().min(1);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD');
const date = day.nullable();
/** Programación: cuándo se hará (independiente de la fecha límite due_date). */
const schedule = {
  scheduled_days: z.array(day).max(31).optional().describe('Días en que se hará (AAAA-MM-DD); [] para quitar la programación'),
  repeat_weekly: z.boolean().optional().describe('Repetir cada semana en esos días de la semana'),
};
const taskStatus = z.enum(['todo', 'in_progress', 'done']).describe('todo = pendiente, in_progress = en curso, done = completada');
const projectStatus = z
  .enum(['active', 'on_hold', 'upcoming', 'done'])
  .describe('active = activo, on_hold = en espera, upcoming = próximo (previsto, aún sin empezar), done = finalizado');
const timeSlot = z
  .enum(['morning', 'afternoon', 'evening', 'all_day'])
  .describe('Cuándo hacerla: morning = mañana, afternoon = tarde, evening = noche, all_day = día completo');

const phaseRef = id.describe('Id de una fase del mismo proyecto (get_project las lista)');

const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DELETE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;

/** Respuesta en JSON compacto; los ToolError vuelven al asistente como error legible. */
async function run(fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  } catch (e) {
    if (e instanceof ToolError) return { isError: true, content: [{ type: 'text' as const, text: e.message }] };
    // Fallos de red o de Supabase (supabaseRows.fail): nada a medias que deshacer, se puede reintentar.
    if (e instanceof Error && /^(Sin conexión|Error del servidor)/.test(e.message)) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `${e.message} Reintenta la operación: repetirla no duplica nada.` }],
      };
    }
    console.error(e);
    return { isError: true, content: [{ type: 'text' as const, text: 'Error interno de Tasky. Inténtalo de nuevo.' }] };
  }
}

export function createTaskyMcpServer(service: TaskyService): McpServer {
  const server = new McpServer({ name: 'tasky', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  // ── Proyectos ──
  server.registerTool(
    'get_projects',
    {
      title: 'Listar proyectos',
      description:
        'Todos los proyectos (activos, en espera y finalizados) con tareas pendientes, ideas, próxima fecha límite y tareas vencidas.',
      inputSchema: z.object({}),
      annotations: READ,
    },
    () => run(() => service.getProjects()),
  );
  server.registerTool(
    'get_project',
    {
      title: 'Ver proyecto',
      description: 'Detalle de un proyecto: sus tareas abiertas (en su orden), completadas e ideas.',
      inputSchema: z.object({ project_id: id }),
      annotations: READ,
    },
    ({ project_id }) => run(() => service.getProject(project_id)),
  );
  server.registerTool(
    'get_project_by_name',
    {
      title: 'Buscar proyecto por nombre',
      description:
        'Busca un proyecto por su nombre (sin distinguir mayúsculas ni acentos). Devuelve coincidencias con su puntuación y certain=true solo si hay una coincidencia inequívoca; si certain=false, pregunta al usuario.',
      inputSchema: z.object({ name: z.string().min(1) }),
      annotations: READ,
    },
    ({ name }) => run(() => service.getProjectByName(name)),
  );

  server.registerTool(
    'create_project',
    {
      title: 'Crear proyecto',
      description:
        'Crea un proyecto nuevo (activo por defecto). Úsala solo si el usuario lo pide. Si ya existe uno con ese nombre, lo devuelve en already_existed sin duplicarlo.',
      inputSchema: z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
        status: projectStatus.optional(),
      }),
      annotations: WRITE,
    },
    ({ name, description, status }) => run(() => service.createProject({ name, description, status })),
  );
  server.registerTool(
    'update_project',
    {
      title: 'Modificar proyecto',
      description:
        'Cambia el nombre, la descripción o el estado (activo, en espera, próximo, finalizado) de un proyecto. Lo que no se indique se conserva.',
      inputSchema: z.object({
        project_id: id,
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(2000).optional(),
        status: projectStatus.optional(),
      }),
      annotations: WRITE,
    },
    ({ project_id, name, description, status }) => run(() => service.updateProject(project_id, { name, description, status })),
  );

  // ── Fases ──
  server.registerTool(
    'create_phase',
    {
      title: 'Crear fase',
      description:
        'Crea una fase al final de un proyecto. Opcionalmente incorpora tareas ya existentes del proyecto (task_ids). Para crear tareas nuevas dentro de ella usa create_task/create_tasks con phase_id. Si ya existe una fase con ese nombre, la devuelve en already_existed.',
      inputSchema: z.object({
        project_id: id,
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
        task_ids: z.array(id).max(100).optional().describe('Tareas existentes del proyecto que pasan a la fase'),
      }),
      annotations: WRITE,
    },
    ({ project_id, name, description, task_ids }) => run(() => service.createPhase(project_id, { name, description, taskIds: task_ids })),
  );
  server.registerTool(
    'update_phase',
    {
      title: 'Modificar fase',
      description: 'Cambia el nombre o la descripción de una fase (lo que no se indique se conserva).',
      inputSchema: z.object({ phase_id: id, name: z.string().min(1).max(120).optional(), description: z.string().max(2000).optional() }),
      annotations: WRITE,
    },
    ({ phase_id, name, description }) => run(() => service.updatePhase(phase_id, { name, description })),
  );
  server.registerTool(
    'move_phase',
    {
      title: 'Reordenar fase',
      description: 'Mueve una fase a otra posición entre las fases del proyecto (1 = la primera). Sus tareas se mueven con ella.',
      inputSchema: z.object({ phase_id: id, position: z.number().int().min(1) }),
      annotations: WRITE,
    },
    ({ phase_id, position }) => run(() => service.movePhase(phase_id, position)),
  );
  server.registerTool(
    'delete_phase',
    {
      title: 'Eliminar fase',
      description:
        'Elimina una fase. Sus tareas NO se borran: quedan sueltas en el proyecto (para borrarlas usa delete_task). Confirma con el usuario antes de usarla salvo que lo haya pedido explícitamente.',
      inputSchema: z.object({ phase_id: id }),
      annotations: DELETE,
    },
    ({ phase_id }) => run(() => service.deletePhase(phase_id)),
  );

  // ── Tareas ──
  server.registerTool(
    'get_tasks',
    {
      title: 'Listar tareas',
      description: 'Tareas de un proyecto, o de todos si no se indica project_id. Por defecto solo las pendientes (abiertas).',
      inputSchema: z.object({
        project_id: id.optional(),
        which: z.enum(['open', 'done', 'all']).default('open').describe('open = pendientes y en curso, done = completadas, all = todas'),
      }),
      annotations: READ,
    },
    ({ project_id, which }) => run(() => service.getTasks(project_id, which)),
  );
  server.registerTool(
    'create_task',
    {
      title: 'Crear tarea',
      description: 'Crea una tarea al final de la lista del proyecto. Requiere el id real del proyecto.',
      inputSchema: z.object({
        project_id: id,
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        due_date: date.optional(),
        time_slot: timeSlot.optional(),
        ...schedule,
        status: taskStatus.optional(),
        phase_id: phaseRef.optional(),
      }),
      annotations: WRITE,
    },
    ({ project_id, due_date, time_slot, scheduled_days, repeat_weekly, phase_id, ...rest }) =>
      run(() =>
        service.createTask(project_id, {
          ...rest,
          phaseId: phase_id,
          dueDate: due_date,
          timeSlot: time_slot,
          scheduledDays: scheduled_days,
          repeatWeekly: repeat_weekly,
        }),
      ),
  );
  server.registerTool(
    'create_tasks',
    {
      title: 'Crear varias tareas',
      description:
        'Crea varias tareas de un proyecto en una sola operación, al final de su lista y en el orden dado (útil para desglosar un proyecto). Las que ya existan abiertas con el mismo título no se duplican.',
      inputSchema: z.object({
        project_id: id,
        tasks: z
          .array(
            z.object({
              title: z.string().min(1).max(200),
              description: z.string().max(2000).optional(),
              due_date: date.optional(),
              time_slot: timeSlot.optional(),
              ...schedule,
              status: taskStatus.optional(),
              phase_id: phaseRef.optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
      annotations: WRITE,
    },
    ({ project_id, tasks }) =>
      run(() =>
        service.createTasks(
          project_id,
          tasks.map(({ due_date, time_slot, scheduled_days, repeat_weekly, phase_id, ...rest }) => ({
            ...rest,
            phaseId: phase_id,
            dueDate: due_date,
            timeSlot: time_slot,
            scheduledDays: scheduled_days,
            repeatWeekly: repeat_weekly,
          })),
        ),
      ),
  );
  server.registerTool(
    'move_task',
    {
      title: 'Reordenar tarea',
      description:
        'Mueve una tarea abierta a otra posición del orden de trabajo de su proyecto (1 = la primera, la «siguiente»). Si está en una fase, la posición es dentro de esa fase; si no, entre las tareas sin fase.',
      inputSchema: z.object({ task_id: id, position: z.number().int().min(1) }),
      annotations: WRITE,
    },
    ({ task_id, position }) => run(() => service.moveTask(task_id, position)),
  );
  server.registerTool(
    'update_task',
    {
      title: 'Modificar tarea',
      description:
        'Cambia el título, la descripción, la fecha límite (null para quitarla), la programación (días y repetición semanal), la franja horaria, el estado o la fase (phase_id) de una tarea.',
      inputSchema: z.object({
        task_id: id,
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        due_date: date.optional(),
        time_slot: timeSlot.optional(),
        ...schedule,
        status: taskStatus.optional(),
        phase_id: phaseRef.nullable().optional().describe('Id de la fase a la que moverla (al final de ella); null para sacarla de su fase'),
      }),
      annotations: WRITE,
    },
    ({ task_id, due_date, time_slot, scheduled_days, repeat_weekly, phase_id, ...rest }) =>
      run(() =>
        service.updateTask(task_id, {
          ...rest,
          phaseId: phase_id,
          dueDate: due_date,
          timeSlot: time_slot,
          scheduledDays: scheduled_days,
          repeatWeekly: repeat_weekly,
        }),
      ),
  );
  server.registerTool(
    'complete_task',
    {
      title: 'Completar tarea',
      description:
        'Marca una tarea como completada. Úsala solo cuando el trabajo esté terminado y verificado; si falta comprobar algo, déjala en curso (in_progress).',
      inputSchema: z.object({ task_id: id }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ task_id }) => run(() => service.completeTask(task_id)),
  );
  server.registerTool(
    'delete_task',
    {
      title: 'Eliminar tarea',
      description: 'Elimina una tarea. Confirma con el usuario antes de usarla salvo que lo haya pedido explícitamente.',
      inputSchema: z.object({ task_id: id }),
      annotations: DELETE,
    },
    ({ task_id }) => run(() => service.deleteTask(task_id)),
  );

  // ── Ideas ──
  server.registerTool(
    'get_ideas',
    {
      title: 'Listar ideas',
      description:
        'Ideas de un proyecto (project_id), de un grupo de ideas generales (group_id), solo las ideas generales sin proyecto (general = true, de todos los grupos y sueltas), o todas (proyectos y generales) si no se indica nada. Cada idea general indica su group.',
      inputSchema: z.object({ project_id: id.optional(), group_id: id.optional(), general: z.boolean().optional() }),
      annotations: READ,
    },
    ({ project_id, group_id, general }) => run(() => service.getIdeas(project_id, general, group_id)),
  );
  server.registerTool(
    'create_idea',
    {
      title: 'Crear idea',
      description:
        'Guarda una idea en un proyecto (con su id real) o, sin project_id, como idea general para futuros proyectos u otras cosas que no pertenecen a ninguno. Con group_id (solo ideas generales), la crea dentro de ese grupo.',
      inputSchema: z.object({
        project_id: id.optional(),
        group_id: id.optional(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
      }),
      annotations: WRITE,
    },
    ({ project_id, group_id, title, description }) => run(() => service.createIdea(project_id, { title, description }, group_id)),
  );
  server.registerTool(
    'update_idea',
    {
      title: 'Modificar idea',
      description:
        'Cambia el título o la descripción de una idea (lo que no se indique se conserva). En ideas generales, group_id la mueve a ese grupo y group_id = null la deja sin grupo.',
      inputSchema: z.object({
        idea_id: id,
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        group_id: id.nullable().optional(),
      }),
      annotations: WRITE,
    },
    ({ idea_id, title, description, group_id }) => run(() => service.updateIdea(idea_id, { title, description, groupId: group_id })),
  );
  server.registerTool(
    'delete_idea',
    {
      title: 'Eliminar idea',
      description: 'Elimina una idea. Confirma con el usuario antes de usarla salvo que lo haya pedido explícitamente.',
      inputSchema: z.object({ idea_id: id }),
      annotations: DELETE,
    },
    ({ idea_id }) => run(() => service.deleteIdea(idea_id)),
  );

  // ── Grupos de ideas generales ──
  server.registerTool(
    'get_idea_groups',
    {
      title: 'Listar grupos de ideas',
      description:
        'Grupos en los que se organizan las ideas generales (en su orden), con cuántas ideas tiene cada uno y cuántas hay sin grupo.',
      inputSchema: z.object({}),
      annotations: READ,
    },
    () => run(() => service.getIdeaGroups()),
  );
  server.registerTool(
    'create_idea_group',
    {
      title: 'Crear grupo de ideas',
      description:
        'Crea un grupo para organizar ideas generales (va al final). Si ya existe uno con ese nombre, lo devuelve en already_existed.',
      inputSchema: z.object({ name: z.string().min(1).max(120), description: z.string().max(1000).optional() }),
      annotations: WRITE,
    },
    ({ name, description }) => run(() => service.createIdeaGroup({ name, description })),
  );
  server.registerTool(
    'update_idea_group',
    {
      title: 'Modificar grupo de ideas',
      description: 'Cambia el nombre o la descripción de un grupo de ideas (lo que no se indique se conserva).',
      inputSchema: z.object({ group_id: id, name: z.string().min(1).max(120).optional(), description: z.string().max(1000).optional() }),
      annotations: WRITE,
    },
    ({ group_id, name, description }) => run(() => service.updateIdeaGroup(group_id, { name, description })),
  );
  server.registerTool(
    'delete_idea_group',
    {
      title: 'Eliminar grupo de ideas',
      description:
        'Elimina un grupo de ideas. Sus ideas NO se borran: quedan sin grupo. Confirma con el usuario antes de usarla salvo que lo haya pedido explícitamente.',
      inputSchema: z.object({ group_id: id }),
      annotations: DELETE,
    },
    ({ group_id }) => run(() => service.deleteIdeaGroup(group_id)),
  );

  return server;
}

/** Manejador HTTP MCP (Streamable HTTP, sin estado): un servidor nuevo por petición. */
export function createTaskyMcpHandler(service: TaskyService) {
  return createMcpHandler(() => createTaskyMcpServer(service), {
    onerror: (error) => console.error('Petición MCP fallida', error),
  });
}
