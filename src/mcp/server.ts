import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ToolError, type TaskyService } from './service';

const INSTRUCTIONS = `Tasky es el gestor personal de proyectos, tareas e ideas del usuario. Tasky es la fuente de verdad: consulta siempre antes de actuar.

Reglas:
- Para crear algo necesitas el id real del proyecto: obtenlo con get_project_by_name o get_projects. Nunca inventes proyectos ni ids.
- Si get_project_by_name devuelve certain=false (varias coincidencias, coincidencia parcial o ninguna), pregunta al usuario a qué proyecto se refiere ANTES de crear o modificar nada. Nunca crees elementos en un proyecto dudoso.
- Tarea = algo concreto que hacer. Idea = algo a explorar o recordar más adelante. Si no está claro qué es, pregunta antes de crearlo.
- Títulos breves y accionables en el idioma del usuario (las tareas empiezan por un verbo); la descripción añade el contexto útil que haya dado el usuario. No inventes detalles.
- Para localizar una tarea o idea por su texto, consulta primero get_tasks o get_ideas y usa su id. Si hay varias candidatas, pregunta.
- "Dividir una tarea": crea las nuevas tareas en el mismo proyecto y después elimina la original solo si el usuario lo ha pedido o lo confirma.
- Fechas límite en formato AAAA-MM-DD; el campo today de las respuestas indica la fecha actual del usuario.
- Franja horaria (time_slot): morning = mañana, afternoon = tarde, evening = noche, all_day = día completo (por defecto). Úsala si el usuario dice cuándo hará la tarea.
- Al terminar, confirma en una lista breve qué has creado o cambiado y en qué proyecto.`;

const id = z.string().min(1);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD')
  .nullable();
const taskStatus = z.enum(['todo', 'in_progress', 'done']).describe('todo = pendiente, in_progress = en curso, done = completada');
const timeSlot = z
  .enum(['morning', 'afternoon', 'evening', 'all_day'])
  .describe('Cuándo hacerla: morning = mañana, afternoon = tarde, evening = noche, all_day = día completo');

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
      description: 'Todos los proyectos (activos, en espera y finalizados) con tareas pendientes, ideas, próxima fecha límite y tareas vencidas.',
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
        status: taskStatus.optional(),
      }),
      annotations: WRITE,
    },
    ({ project_id, title, description, due_date, time_slot, status }) =>
      run(() => service.createTask(project_id, { title, description, dueDate: due_date, timeSlot: time_slot, status })),
  );
  server.registerTool(
    'update_task',
    {
      title: 'Modificar tarea',
      description: 'Cambia el título, la descripción, la fecha límite (null para quitarla), la franja horaria o el estado de una tarea.',
      inputSchema: z.object({
        task_id: id,
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        due_date: date.optional(),
        time_slot: timeSlot.optional(),
        status: taskStatus.optional(),
      }),
      annotations: WRITE,
    },
    ({ task_id, title, description, due_date, time_slot, status }) =>
      run(() => service.updateTask(task_id, { title, description, dueDate: due_date, timeSlot: time_slot, status })),
  );
  server.registerTool(
    'complete_task',
    {
      title: 'Completar tarea',
      description: 'Marca una tarea como completada.',
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
      description: 'Ideas de un proyecto, o de todos si no se indica project_id.',
      inputSchema: z.object({ project_id: id.optional() }),
      annotations: READ,
    },
    ({ project_id }) => run(() => service.getIdeas(project_id)),
  );
  server.registerTool(
    'create_idea',
    {
      title: 'Crear idea',
      description: 'Guarda una idea en un proyecto. Requiere el id real del proyecto.',
      inputSchema: z.object({ project_id: id, title: z.string().min(1).max(200), description: z.string().max(2000).optional() }),
      annotations: WRITE,
    },
    ({ project_id, title, description }) => run(() => service.createIdea(project_id, { title, description })),
  );
  server.registerTool(
    'update_idea',
    {
      title: 'Modificar idea',
      description: 'Cambia el título o la descripción de una idea (lo que no se indique se conserva).',
      inputSchema: z.object({ idea_id: id, title: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional() }),
      annotations: WRITE,
    },
    ({ idea_id, title, description }) => run(() => service.updateIdea(idea_id, { title, description })),
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

  return server;
}

/** Manejador HTTP MCP (Streamable HTTP, sin estado): un servidor nuevo por petición. */
export function createTaskyMcpHandler(service: TaskyService) {
  return createMcpHandler(() => createTaskyMcpServer(service), {
    onerror: (error) => console.error('Petición MCP fallida', error),
  });
}
