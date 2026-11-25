// Prueba la lógica de la Edge Function `tasky-password` con un Supabase simulado en memoria (sin Deno ni red).
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface User {
  id: string;
  email: string;
  password: string;
  pending: boolean;
}
const db = { users: [] as User[], sessions: new Map<string, string>(), counter: 0 };
const newSession = (userId: string) => {
  const token = `jwt-${++db.counter}`;
  db.sessions.set(token, userId);
  return token;
};
const userOf = (token: string) => db.users.find((u) => u.id === db.sessions.get(token));

vi.mock('npm:@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => ({ data: { user: userOf(token) ?? null } }),
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const u = db.users.find((x) => x.email === email && x.password === password);
        if (!u) return { error: new Error('invalid') };
        newSession(u.id);
        return { error: null };
      },
      admin: {
        updateUserById: async (id: string, { password }: { password: string }) => {
          db.users.find((u) => u.id === id)!.password = password;
          return { error: null };
        },
        signOut: async (token: string, scope: string) => {
          expect(scope).toBe('others');
          const keep = db.sessions.get(token);
          for (const [t, id] of db.sessions) if (id === keep && t !== token) db.sessions.delete(t);
          return { error: null };
        },
      },
    },
    rpc: async (name: string, { p_user }: { p_user: string }) => {
      const u = db.users.find((x) => x.id === p_user)!;
      if (name === 'tasky_password_pending') return { data: u.pending, error: null };
      u.pending = false;
      return { data: null, error: null };
    },
  }),
}));

let handler: (req: Request) => Promise<Response>;
beforeEach(async () => {
  vi.stubGlobal('Deno', { serve: (h: typeof handler) => (handler = h), env: { get: () => 'x' } });
  vi.resetModules();
  await import('./index');
  db.users = [
    { id: 'ana', email: 'ana@users.tasky.app', password: 'clave-actual-1', pending: false },
    { id: 'bea', email: 'bea@users.tasky.app', password: 'otra-clave-bea', pending: false },
    { id: 'nuevo', email: 'nuevo@users.tasky.app', password: 'provisional-1', pending: true },
  ];
  db.sessions = new Map();
});

const call = (token: string | null, body: unknown) =>
  handler(
    new Request('http://x/tasky-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: 'pub', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
  );
const pass = (id: string) => db.users.find((u) => u.id === id)!.password;

describe('tasky-password', () => {
  it('sin sesión válida no cambia nada', async () => {
    expect((await call(null, { current_password: 'clave-actual-1', new_password: 'nueva-clave-12' })).status).toBe(401);
    expect((await call('jwt-falso', { new_password: 'nueva-clave-12' })).status).toBe(401);
    expect(pass('ana')).toBe('clave-actual-1');
  });

  it('el cambio manual exige la contraseña actual correcta', async () => {
    const t = newSession('ana');
    for (const current_password of [undefined, '', 'incorrecta-123']) {
      const res = await call(t, { current_password, new_password: 'nueva-clave-12' });
      expect(res.status).toBe(403);
    }
    expect(pass('ana')).toBe('clave-actual-1');
  });

  it('con la actual correcta cambia la contraseña y cierra las demás sesiones (no la actual)', async () => {
    const t = newSession('ana');
    const otra = newSession('ana');
    const ajena = newSession('bea');
    const res = await call(t, { current_password: 'clave-actual-1', new_password: 'nueva-clave-12' });
    expect(res.status).toBe(200);
    expect(pass('ana')).toBe('nueva-clave-12');
    expect(db.sessions.has(t)).toBe(true);
    expect(db.sessions.has(otra)).toBe(false);
    expect(db.sessions.has(ajena)).toBe(true);
  });

  it('no se puede cambiar la contraseña de otra cuenta, aunque se indique su usuario', async () => {
    const t = newSession('ana');
    const res = await call(t, {
      username: 'bea',
      user_id: 'bea',
      email: 'bea@users.tasky.app',
      current_password: 'otra-clave-bea',
      new_password: 'hackeada-1234',
    });
    expect(res.status).toBe(403); // «actual» se comprueba contra la cuenta del token (ana), no contra bea
    expect(pass('bea')).toBe('otra-clave-bea');
    expect(pass('ana')).toBe('clave-actual-1');
  });

  it('un usuario con contraseña provisional puede fijar la suya sin la actual, una sola vez', async () => {
    const t = newSession('nuevo');
    expect((await call(t, { new_password: 'provisional-1' })).status).toBe(400); // no puede repetir la provisional
    expect(db.users[2].pending).toBe(true);
    expect((await call(t, { new_password: 'mi-propia-clave-9' })).status).toBe(200);
    expect(pass('nuevo')).toBe('mi-propia-clave-9');
    expect(db.users[2].pending).toBe(false);
    // Ya no es provisional: otro cambio sin la actual se rechaza.
    expect((await call(t, { new_password: 'otra-mas-1234' })).status).toBe(403);
  });

  it('la contraseña nueva debe tener 10-72 caracteres', async () => {
    const t = newSession('ana');
    expect((await call(t, { current_password: 'clave-actual-1', new_password: 'corta' })).status).toBe(400);
    expect((await call(t, { current_password: 'clave-actual-1', new_password: 'x'.repeat(73) })).status).toBe(400);
    expect(pass('ana')).toBe('clave-actual-1');
  });
});
