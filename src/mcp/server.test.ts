import { describe, expect, it } from 'vitest';
import { emptyData } from '../core/data';
import { createProject } from '../core/projects';
import { noRecords, type SyncRecords } from '../core/sync';
import { createTaskyMcpHandler } from './server';
import { createTaskyService } from './service';

function handler() {
  const d = createProject(emptyData(), { name: 'Wynot', description: '' }, 'wynot', '2026-11-01T10:00:00.000Z');
  const state: SyncRecords = { projects: d.projects, tasks: [], ideas: [] };
  let n = 0;
  const service = createTaskyService(
    {
      load: async () => structuredClone(state),
      async save(r) {
        state.tasks.push(...r.tasks);
        state.ideas.push(...r.ideas);
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
  const json = text.trim().startsWith('{') ? text : text.split('\n').find((l) => l.startsWith('data: '))!.slice(6);
  return { status: res.status, body: JSON.parse(json) };
}

describe('servidor MCP por HTTP', () => {
  it('se presenta con instrucciones y expone las 12 herramientas con sus anotaciones', async () => {
    const { mcp } = handler();
    const init = await rpc(mcp, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'prueba', version: '1' },
    });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe('tasky');
    expect(init.body.result.instructions).toMatch(/Nunca inventes proyectos/);

    const { body } = await rpc(mcp, 'tools/list');
    const tools = body.result.tools as { name: string; annotations: Record<string, boolean> }[];
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'complete_task',
        'create_idea',
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
});
