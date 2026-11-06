import { createClient, type Session } from '@supabase/supabase-js';
import { ideaSchema, projectSchema, taskSchema, type Idea, type Project, type Task } from '../core/model';
import type { SyncBackend, SyncSession } from '../core/ports';
import { noRecords, type SyncRecords } from '../core/sync';

/** Filas tal como están en Postgres (snake_case). Ver supabase/schema.sql. */
type Row = Record<string, unknown> & { id: string; server_seq: number };
type Table = 'projects' | 'tasks' | 'ideas';

const PAGE = 1000;
const AUTH_KEY = 'tasky-auth';
const BATCH = 500;

/** Postgres devuelve "…+00:00" con microsegundos; Tasky usa ISO UTC con milisegundos. */
const ts = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string).toISOString());

const fromRow: { [K in Table]: (r: Row) => SyncRecords[K][number] } = {
  projects: (r) =>
    projectSchema.parse({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      createdAt: ts(r.created_at),
      updatedAt: ts(r.updated_at),
      deletedAt: ts(r.deleted_at),
    }),
  tasks: (r) =>
    taskSchema.parse({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      description: r.description,
      status: r.status,
      dueDate: r.due_date ?? null,
      rank: r.rank,
      completedAt: ts(r.completed_at),
      createdAt: ts(r.created_at),
      updatedAt: ts(r.updated_at),
      deletedAt: ts(r.deleted_at),
    }),
  ideas: (r) =>
    ideaSchema.parse({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      description: r.description,
      createdAt: ts(r.created_at),
      updatedAt: ts(r.updated_at),
      deletedAt: ts(r.deleted_at),
    }),
};

const base = (r: Project | Task | Idea) => ({
  id: r.id,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
  deleted_at: r.deletedAt,
});

const toRow = {
  projects: (p: Project) => ({ ...base(p), name: p.name, description: p.description, status: p.status }),
  tasks: (t: Task) => ({
    ...base(t),
    project_id: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    due_date: t.dueDate,
    rank: t.rank,
    completed_at: t.completedAt,
  }),
  ideas: (i: Idea) => ({ ...base(i), project_id: i.projectId, title: i.title, description: i.description }),
};

const TABLES: Table[] = ['projects', 'tasks', 'ideas'];

/** Errores de red y de servidor con un mensaje comprensible. */
function fail(error: { message: string } | null): never {
  const offline = !navigator.onLine || /fetch|network|load failed/i.test(error?.message ?? '');
  throw new Error(offline ? 'Sin conexión.' : `Error del servidor: ${error?.message ?? 'desconocido'}`);
}

const toSession = (s: Session | null): SyncSession | null => (s?.user ? { email: s.user.email ?? '' } : null);

export function createSupabaseSync(url: string, key: string): SyncBackend {
  const client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_KEY },
  });

  /** Convierte filas a registros validados; una fila inválida se descarta sin romper la sincronización. */
  function collect(table: Table, rows: Row[], into: SyncRecords) {
    for (const row of rows) {
      try {
        (into[table] as unknown[]).push(fromRow[table](row));
      } catch (e) {
        console.error(`Fila de ${table} no válida, se ignora`, row.id, e);
      }
    }
  }

  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (data.session || !error) return toSession(data.session);
      // Sin conexión no se puede renovar un token caducado: la sesión guardada sigue siendo válida
      // para trabajar en local; se renovará al volver la red.
      try {
        const stored = JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null') as Session | null;
        return toSession(stored);
      } catch {
        return null;
      }
    },

    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') listener(toSession(session));
      });
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (!error) return;
      if (error.status === 400 || /invalid/i.test(error.message)) throw new Error('Email o contraseña incorrectos.');
      fail(error);
    },

    async signOut() {
      await client.auth.signOut({ scope: 'local' });
    },

    async pull(since) {
      const records = noRecords();
      let cursor = since;
      for (const table of TABLES) {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await client
            .from(table)
            .select('*')
            .gt('server_seq', since)
            .order('server_seq')
            .range(from, from + PAGE - 1);
          if (error) fail(error);
          const rows = (data ?? []) as Row[];
          collect(table, rows, records);
          for (const r of rows) cursor = Math.max(cursor, Number(r.server_seq));
          if (rows.length < PAGE) break;
        }
      }
      return { records, cursor };
    },

    async push(records) {
      const newerOnServer = noRecords();
      for (const table of TABLES) {
        const list = records[table] as (Project & Task & Idea)[];
        for (let i = 0; i < list.length; i += BATCH) {
          const rows = list.slice(i, i + BATCH).map((r) => toRow[table](r));
          // El trigger del servidor ignora (y no devuelve) las filas más antiguas que las suyas.
          const { data, error } = await client.from(table).upsert(rows, { onConflict: 'id' }).select('id');
          if (error) fail(error);
          const accepted = new Set((data ?? []).map((r) => r.id as string));
          const rejected = rows.map((r) => r.id).filter((id) => !accepted.has(id));
          if (rejected.length === 0) continue;
          const fetched = await client.from(table).select('*').in('id', rejected);
          if (fetched.error) fail(fetched.error);
          collect(table, (fetched.data ?? []) as Row[], newerOnServer);
        }
      }
      return newerOnServer;
    },
  };
}
