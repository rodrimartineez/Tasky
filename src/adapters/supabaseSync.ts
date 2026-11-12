import { createClient, type Session } from '@supabase/supabase-js';
import type { SyncBackend, SyncSession } from '../core/ports';
import { fail, pullRecords, pushRecords, TABLES, type SupabaseLike } from './supabaseRows';

const AUTH_KEY = 'tasky-auth';

/** Cliente (y sesión) compartido con la sincronización del modo Hábitos. */
let sharedClient: SupabaseLike | null = null;
export const getSupabaseClient = () => sharedClient;

const toSession = (s: Session | null): SyncSession | null => (s?.user ? { email: s.user.email ?? '' } : null);

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
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (!error) return;
      if (error.status === 400 || /invalid/i.test(error.message)) throw new Error('Email o contraseña incorrectos.');
      if (error.status === 429) throw new Error('Demasiados intentos. Espera unos minutos antes de volver a probar.');
      fail(error);
    },

    async signOut(everywhere = false) {
      // 'local' borra la sesión del dispositivo antes de avisar al servidor: sin red también se cierra aquí.
      // 'global' solo la borra si el servidor ha revocado todas las sesiones.
      const { error } = await client.auth.signOut({ scope: everywhere ? 'global' : 'local' });
      if (error && everywhere) fail(error);
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

    onRemoteChange(listener) {
      // Supabase Realtime: avisos de cambios en las tablas (filtrados por RLS: solo las filas del usuario).
      const channel = client.channel('tasky-changes');
      for (const table of TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => listener());
      channel.subscribe();
      return () => void client.removeChannel(channel);
    },

    pull: (since) => pullRecords(client, since),
    push: (records) => pushRecords(client, records),
  };
}
