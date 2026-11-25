import { createClient, type Session } from '@supabase/supabase-js';
import { usernameToEmail, type ActivityItem, type ActivityKind, type CollabSnapshot } from '../core/collab';
import type { SyncBackend, SyncSession } from '../core/ports';
import { fail, pullRecords, pushRecords, TABLES, type SupabaseLike } from './supabaseRows';

const AUTH_KEY = 'tasky-auth';

/** Cliente (y sesión) compartido con la sincronización del modo Hábitos. */
let sharedClient: SupabaseLike | null = null;
export const getSupabaseClient = () => sharedClient;

const toSession = (s: Session | null): SyncSession | null => (s?.user ? { userId: s.user.id, email: s.user.email ?? '' } : null);

/** Quien entra con un nombre de usuario (sin @) usa su email interno. */
const loginEmail = (login: string) => (login.includes('@') ? login.trim() : usernameToEmail(login));

const iso = (v: unknown) => new Date(v as string).toISOString();

export function createSupabaseSync(url: string, key: string): SyncBackend {
  const client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_KEY },
  });
  sharedClient = client;

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
      const { error } = await client.auth.signInWithPassword({ email: loginEmail(email), password });
      if (!error) return;
      if (error.status === 400 || /invalid/i.test(error.message)) throw new Error('Usuario o contraseña incorrectos.');
      if (error.status === 429) throw new Error('Demasiados intentos. Espera unos minutos antes de volver a probar.');
      fail(error);
    },

    async signOut() {
      // 'local' borra la sesión del dispositivo antes de avisar al servidor: sin red también se cierra aquí.
      await client.auth.signOut({ scope: 'local' });
    },

    async getAuthorizationRequest(id) {
      const { data, error } = await client.auth.oauth.getAuthorizationDetails(id);
      if (error || !data) fail(error);
      if (!('authorization_id' in data)) return { redirectUrl: data.redirect_url };
      return { clientName: data.client.name, redirectUri: data.redirect_uri, scope: data.scope, email: data.user.email };
    },

    async decideAuthorization(id, approve) {
      const options = { skipBrowserRedirect: true };
      const { data, error } = approve
        ? await client.auth.oauth.approveAuthorization(id, options)
        : await client.auth.oauth.denyAuthorization(id, options);
      if (error || !data) fail(error);
      return data.redirect_url;
    },

    async signUp(username, password) {
      const { error } = await client.functions.invoke('tasky-signup', { body: { username, password } });
      if (!error) return;
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
      if (detail?.error) throw new Error(detail.error);
      fail(error);
    },

    async mustChangePassword() {
      const { data, error } = await client.rpc('tasky_must_change_password');
      if (error) fail(error);
      return data === true;
    },

    async changePassword(current, next) {
      const { error } = await client.functions.invoke('tasky-password', { body: { current_password: current, new_password: next } });
      if (!error) return;
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
      if (detail?.error) throw new Error(detail.error);
      if (detail?.code === 'NOT_FOUND') throw new Error('El servidor aún no tiene activado el cambio de contraseña.');
      fail(error);
    },

    async fetchCollab(): Promise<CollabSnapshot> {
      const [profiles, shares, activity, admin] = await Promise.all([
        client.from('profiles').select('user_id, username, notifications_seen_at'),
        client.rpc('get_shares'),
        client.from('activity').select('*').order('id', { ascending: false }).limit(50),
        client.rpc('tasky_is_admin'),
      ]);
      for (const r of [profiles, shares, activity, admin]) if (r.error) fail(r.error);
      const me = (await client.auth.getSession()).data.session?.user.id;
      const names: CollabSnapshot['profiles'] = {};
      let seenAt = new Date(0).toISOString();
      for (const p of profiles.data ?? []) {
        names[p.user_id as string] = p.username as string;
        if (p.user_id === me) seenAt = iso(p.notifications_seen_at);
      }
      const people: CollabSnapshot['shares'] = { project: {}, idea: {} };
      const owners: CollabSnapshot['owners'] = {};
      type ShareRow = { kind: 'project' | 'idea'; item_id: string; user_id: string; is_owner: boolean };
      for (const s of (shares.data ?? []) as ShareRow[]) {
        if (s.is_owner) owners[s.item_id] = s.user_id;
        const list = (people[s.kind][s.item_id] ??= []);
        if (!list.includes(s.user_id)) list.push(s.user_id);
      }
      const items: ActivityItem[] = (activity.data ?? []).map((a) => ({
        id: Number(a.id),
        actorId: a.actor_id as string,
        kind: a.kind as ActivityKind,
        subject: a.subject as string,
        context: a.context as string,
        projectId: (a.project_id as string | null) ?? null,
        ideaId: (a.idea_id as string | null) ?? null,
        targetUserId: (a.target_user_id as string | null) ?? null,
        createdAt: iso(a.created_at),
      }));
      // El creador va el primero en la lista de participantes.
      for (const kind of ['project', 'idea'] as const)
        for (const [id, list] of Object.entries(people[kind])) list.sort((a, b) => Number(b === owners[id]) - Number(a === owners[id]));
      return { profiles: names, shares: people, owners, activity: items, seenAt, isAdmin: admin.data === true };
    },

    async share(kind, id, username) {
      const { error } = await client.rpc(kind === 'project' ? 'share_project' : 'share_idea', {
        [kind === 'project' ? 'p_project' : 'p_idea']: id,
        p_username: username,
      });
      if (!error) return;
      if (['P0002', '22023', '42501'].includes(error.code)) throw new Error(error.message);
      fail(error);
    },

    async unshare(kind, id, userId) {
      const { error } = await client.rpc(kind === 'project' ? 'unshare_project' : 'unshare_idea', {
        [kind === 'project' ? 'p_project' : 'p_idea']: id,
        p_user: userId,
      });
      if (!error) return;
      if (error.code === '42501') throw new Error(error.message);
      fail(error);
    },

    async markNotificationsSeen() {
      const { error } = await client.rpc('mark_notifications_seen');
      if (error) fail(error);
    },

    onRemoteChange(listener) {
      // Supabase Realtime: avisos de cambios en las tablas (filtrados por RLS: solo las filas del usuario).
      const channel = client.channel('tasky-changes');
      for (const table of [...TABLES, 'activity']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => listener());
      channel.subscribe();
      return () => void client.removeChannel(channel);
    },

    pull: (since) => pullRecords(client, since),
    push: (records) => pushRecords(client, records),
  };
}
