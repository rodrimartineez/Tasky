import { beforeAll, describe, expect, it } from 'vitest';
import type { Idea, IdeaGroup, Project, Task } from '../core/model';
import type { SyncBackend } from '../core/ports';
import { noRecords, type SyncRecords } from '../core/sync';
import { useTasky } from './store';
import { changePassword, initSync, signOut, syncNow, useSync } from './sync';

type Rec = Project | Task | Idea | IdeaGroup;
type Table = keyof SyncRecords;

/** Servidor en memoria con las mismas reglas que supabase/schema.sql: última escritura gana y número de cambio. */
function fakeServer() {
  let seq = 0;
  const rows: Record<Table, Map<string, { rec: Rec; seq: number }>> = {
    projects: new Map(),
    projectGroups: new Map(),
    phases: new Map(),
    tasks: new Map(),
    ideas: new Map(),
    ideaGroups: new Map(),
  };
  const tables = Object.keys(rows) as Table[];
  let listener: ((s: { email: string; userId: string } | null) => void) | null = null;
  let remote: (() => void) | null = null;
  const offline = { value: false };
  /** Cuenta con contraseña provisional: el servidor no entrega datos hasta que la cambie. */
  const provisional = { value: false, pulls: 0 };

  const write = (table: Table, rec: Rec) => {
    const old = rows[table].get(rec.id);
    if (old && Date.parse(rec.updatedAt) <= Date.parse(old.rec.updatedAt)) return false;
    rows[table].set(rec.id, { rec, seq: ++seq });
    return true;
  };

  const backend: SyncBackend = {
    getSession: async () => null,
    onSessionChange: (l) => {
      listener = l;
      return () => {};
    },
    signIn: async (email) => listener?.({ email, userId: email }),
    signUp: async () => {},
    fetchCollab: async () => ({ profiles: {}, shares: { project: {}, idea: {} }, owners: {}, isAdmin: false, activity: [], seenAt: new Date(0).toISOString() }),
    share: async () => {},
    unshare: async () => {},
    mustChangePassword: async () => provisional.value,
    changePassword: async () => {
      provisional.value = false;
    },
    markNotificationsSeen: async () => {},
    signOut: async () => listener?.(null),
    getAuthorizationRequest: async () => ({ redirectUrl: '' }),
    decideAuthorization: async () => '',
    onRemoteChange(l) {
      remote = l;
      return () => (remote = null);
    },
    async pull(since) {
      if (provisional.value) throw new Error('Sin acceso.');
      provisional.pulls++;
      const records = noRecords();
      let cursor = since;
      for (const t of tables)
        for (const { rec, seq: s } of rows[t].values())
          if (s > since) {
            (records[t] as Rec[]).push(rec);
            cursor = Math.max(cursor, s);
          }
      return { records, cursor };
    },
    async push(records) {
      const newer = noRecords();
      for (const t of tables) for (const rec of records[t] as Rec[]) if (!write(t, rec)) (newer[t] as Rec[]).push(rows[t].get(rec.id)!.rec);
      return newer;
    },
  };
  /** Escritura de otro cliente (p. ej. Claude por MCP) con su aviso de Realtime. */
  const writeAndNotify = (table: Table, rec: Rec) => {
    write(table, rec);
    remote?.();
  };
  return { backend, offline, provisional, write, writeAndNotify, get: (t: Table, id: string) => rows[t].get(id)?.rec };
}

const server = fakeServer();
const T_OLD = '2020-01-01T00:00:00.000Z';
const T_FUTURE = '2999-01-01T00:00:00.000Z';

beforeAll(async () => {
  // Entorno mínimo de navegador para los avisos de visibilidad y conexión.
  const target = { addEventListener() {}, removeEventListener() {} };
  Object.assign(globalThis, { document: { ...target, visibilityState: 'visible' }, window: target });
  const loaded = useTasky.getState().load({ load: async () => null, save: async () => {} });
  await initSync(server.backend, true, loaded);
});

describe('sincronización con el servidor', () => {
  it('sin sesión en la web: bloqueado', () => {
    expect(useSync.getState()).toMatchObject({ status: 'signed_out', requireAuth: true });
  });

  it('al iniciar sesión envía lo local y recibe lo remoto', async () => {
    const localId = useTasky.getState().createProject({ name: 'Local', description: '' });
    server.write('projects', {
      id: 'remoto',
      name: 'Remoto',
      description: '',
      status: 'active',
      rank: null,
      createdAt: T_OLD,
      updatedAt: T_OLD,
      deletedAt: null,
    });
    await server.backend.signIn('yo@ejemplo.com', 'x');
    await syncNow();
    expect(useSync.getState().status).toBe('synced');
    expect(server.get('projects', localId)).toMatchObject({ name: 'Local' });
    expect(
      useTasky
        .getState()
        .data.projects.map((p) => p.name)
        .sort(),
    ).toEqual(['Local', 'Remoto']);
  });

  it('si el servidor tiene una versión más reciente, la local se sustituye', async () => {
    const p = useTasky.getState().data.projects.find((x) => x.name === 'Local')!;
    server.write('projects', { ...p, name: 'Editado en el iPhone', updatedAt: T_FUTURE });
    useTasky.getState().updateProject(p.id, { name: 'Editado en Windows' }); // más antiguo que T_FUTURE
    await syncNow();
    expect(server.get('projects', p.id)).toMatchObject({ name: 'Editado en el iPhone' });
    expect(useTasky.getState().data.projects.find((x) => x.id === p.id)?.name).toBe('Editado en el iPhone');
  });

  it('un cambio hecho por Claude (MCP) llega solo, sin recargar, gracias al aviso de Realtime', async () => {
    const p = useTasky.getState().data.projects.find((x) => x.name === 'Remoto')!;
    server.writeAndNotify('tasks', {
      id: 'desde-claude',
      projectId: p.id,
      phaseId: null,
      groupId: null,
      title: 'Creada por Claude',
      description: '',
      status: 'todo',
      dueDate: null,
      timeSlot: 'evening',
      scheduledDays: [],
      repeatWeekly: false,
      rank: 'a0',
      completedAt: null,
      createdAt: T_FUTURE,
      updatedAt: T_FUTURE,
      deletedAt: null,
    });
    await new Promise((r) => setTimeout(r, 450)); // espera de agrupación de avisos + descarga
    expect(useTasky.getState().data.tasks.find((t) => t.id === 'desde-claude')).toMatchObject({
      title: 'Creada por Claude',
      timeSlot: 'evening',
    });
  });

  it('cerrar sesión en la web borra los datos del dispositivo', async () => {
    await signOut();
    expect(useSync.getState().status).toBe('signed_out');
    expect(useTasky.getState().data.projects).toEqual([]);
  });

  it('con contraseña provisional no se sincroniza ni se entra hasta cambiarla', async () => {
    server.provisional.value = true;
    server.provisional.pulls = 0;
    await server.backend.signIn('nuevo@ejemplo.com', 'provisional');
    await new Promise((r) => setTimeout(r, 20));
    expect(useSync.getState().mustChangePassword).toBe(true);
    await syncNow();
    expect(server.provisional.pulls).toBe(0);

    await changePassword(null, 'mi-propia-clave-9');
    expect(useSync.getState().mustChangePassword).toBe(false);
    await syncNow();
    expect(server.provisional.pulls).toBeGreaterThan(0);
  });
});
