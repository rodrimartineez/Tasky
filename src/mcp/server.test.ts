import { describe, expect, it } from 'vitest';
import { emptyData } from '../core/data';
import { createProject } from '../core/projects';
import { noRecords, type SyncRecords } from '../core/sync';
import { createTaskyMcpHandler } from './server';
import { createTaskyService } from './service';

function handler() {
  const d = createProject(emptyData(), { name: 'Wynot', description: '' }, 'wynot', '2026-11-01T10:00:00.000Z');
  const state: SyncRecords = { projects: d.projects, projectGroups: [], phases: [], tasks: [], ideas: [], ideaGroups: [] };
  let n = 0;
  const service = createTaskyService(
    {
      load: async () => structuredClone(state),
      async save(r) {
        const upsert = <T extends { id: string }>(list: T[], rows: T[]) => {
          for (const row of rows) {
            const i = list.findIndex((x) => x.id === row.id);
            if (i >= 0) list[i] = row;
            else list.push(row);
          }
        };
        upsert(state.phases, r.phases);
        upsert(state.tasks, r.tasks);
        upsert(state.ideas, r.ideas);
        return noRecords();
      },
    },
    { now: () => new Date().toISOString(), today: () => '2026-11-06', newId: () => `id-${++n}` },
  );
  return { mcp: createTaskyMcpHandler(service), state };
}

/** Petición JSON-RPC como la de un cliente MCP de 2025 (Streamable HTTP sin sesión). */
async function rpc(mcp: ReturnType<typeof createTaskyMcpHandler>, method: string, params: object = {}) {
  const res = await mcp.fetch(
    new Request('https://ejemplo.supabase.co/functions/v1/tasky-mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  const text = await res.text();
  // La respuesta puede llegar como JSON o como evento SSE ("data: {...}").
  const json = text.trim().startsWith('{')
    ? text
    : text
        .split('\n')
        .find((l) => l.startsWith('data: '))!
        .slice(6);
  return { status: res.status, body: JSON.parse(json) };
}

describe('servidor MCP por HTTP', () => {
  it('se presenta con instrucciones y expone las 20 herramientas con sus anotaciones', async () => {
    const { mcp } = handler();
    const init = await rpc(mcp, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'prueba', version: '1' },
    });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe('tasky');
    expect(init.body.result.instructions).toMatch(/Nunca inventes ids/);

    const { body } = await rpc(mcp, 'tools/list');
    const tools = body.result.tools as { name: string; annotations: Record<string, boolean> }[];
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'complete_task',
        'create_project',
        'create_tasks',
        'move_task',
        'update_project',
        'create_idea',
        'create_idea_group',
        'delete_idea_group',
        'get_idea_groups',
        'update_idea_group',
        'create_phase',
        'update_phase',
        'move_phase',
        'delete_phase',
        'create_project_group',
        'update_project_group',
        'move_project_group',
        'delete_project_group',
        'move_project_into_group',
        'create_task',
        'delete_idea',
        'delete_task',
        'get_ideas',
        'get_project',
        'get_project_by_name',
        'get_projects',
        'get_tasks',
        'update_idea',
        'update_task',
      ].sort(),
    );
    const byName = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    expect(byName.get_projects.readOnlyHint).toBe(true);
    expect(byName.create_task.destructiveHint).toBe(false);
    expect(byName.delete_task.destructiveHint).toBe(true);
    expect(byName.delete_idea_group.destructiveHint).toBe(true);
    expect(byName.delete_project_group.destructiveHint).toBe(true);
  });

  it('el escenario del audio: busca Wynot, crea una tarea y una idea', async () => {
    const { mcp, state } = handler();
    const found = await rpc(mcp, 'tools/call', { name: 'get_project_by_name', arguments: { name: 'wynot' } });
    const match = JSON.parse(found.body.result.content[0].text);
    expect(match).toMatchObject({ certain: true, matches: [{ id: 'wynot' }] });

    const task = await rpc(mcp, 'tools/call', {
      name: 'create_task',
      arguments: { project_id: 'wynot', title: 'Implementar un sistema de compresión de fotografías' },
    });
    expect(task.body.result.isError).toBeFalsy();
    await rpc(mcp, 'tools/call', {
      name: 'create_idea',
      arguments: { project_id: 'wynot', title: 'Investigar formatos de almacenamiento de imágenes' },
    });
    expect(state.tasks.map((t) => t.title)).toEqual(['Implementar un sistema de compresión de fotografías']);
    expect(state.ideas.map((i) => i.title)).toEqual(['Investigar formatos de almacenamiento de imágenes']);
  });

  it('rechaza datos inválidos y proyectos inexistentes con un error legible', async () => {
    const { mcp, state } = handler();
    const bad = await rpc(mcp, 'tools/call', { name: 'create_task', arguments: { project_id: 'nope', title: 'X' } });
    expect(bad.body.result.isError).toBe(true);
    expect(bad.body.result.content[0].text).toMatch(/No existe ningún proyecto/);
    const badDate = await rpc(mcp, 'tools/call', {
      name: 'create_task',
      arguments: { project_id: 'wynot', title: 'X', due_date: 'mañana' },
    });
    expect(badDate.body.error ?? badDate.body.result?.isError).toBeTruthy();
    expect(state.tasks).toHaveLength(0);
  });

  it('gestiona fases completas: crear, añadir/mover/modificar tareas, reordenar y eliminar', async () => {
    const { mcp, state } = handler();
    const call = async (name: string, args: object) => {
      const r = await rpc(mcp, 'tools/call', { name, arguments: args });
      expect(r.body.result.isError).toBeFalsy();
      return JSON.parse(r.body.result.content[0].text);
    };
    const a = (await call('create_phase', { project_id: 'wynot', name: 'Diseño' })).created;
    const b = (await call('create_phase', { project_id: 'wynot', name: 'Código' })).created;
    expect((await call('create_phase', { project_id: 'wynot', name: 'diseño' })).already_existed.id).toBe(a.id);

    const made = await call('create_tasks', {
      project_id: 'wynot',
      tasks: [
        { title: 'Boceto', phase_id: a.id },
        { title: 'Suelta' },
      ],
    });
    const [boceto, suelta] = made.created;
    expect(boceto.phase).toBe('Diseño');
    expect(suelta.phase).toBeNull();

    await call('update_task', { task_id: suelta.id, phase_id: b.id, title: 'Implementar' });
    expect((await call('get_project', { project_id: 'wynot' })).phases.map((f: { tasks: unknown[] }) => f.tasks.length)).toEqual([1, 1]);

    await call('update_phase', { phase_id: a.id, name: 'Diseño UI', description: 'Pantallas' });
    await call('move_phase', { phase_id: b.id, position: 1 });
    expect((await call('get_project', { project_id: 'wynot' })).phases.map((f: { name: string }) => f.name)).toEqual(['Código', 'Diseño UI']);

    await call('update_task', { task_id: boceto.id, phase_id: null });
    await call('delete_task', { task_id: suelta.id });
    await call('delete_phase', { phase_id: a.id });
    expect(state.phases.find((f) => f.id === a.id)?.deletedAt).toBeTruthy();
    expect((await call('get_project', { project_id: 'wynot' })).phases.map((f: { name: string }) => f.name)).toEqual(['Código']);
    expect(state.tasks.find((t) => t.id === boceto.id)?.deletedAt).toBeNull();
  });
});
