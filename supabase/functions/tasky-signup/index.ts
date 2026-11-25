// Alta de cuentas de Tasky (Supabase Edge Function): usuario + contraseña, sin email real. Solo la usa el
// administrador (private.admins) desde la app. Crea la cuenta con la API de administración (el registro público de
// Supabase sigue desactivado), le asigna el email interno `<usuario>@users.tasky.app` y la autoriza con
// `public.tasky_register`. Se despliega con --no-verify-jwt: el token del administrador se comprueba aquí (claves ES256).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Solo el administrador (private.admins) puede crear cuentas: se comprueba su token con el servidor de Auth.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const caller = token ? await admin.auth.getUser(token) : null;
  const callerId = caller?.data.user?.id;
  if (!callerId) return json({ error: 'Inicia sesión con la cuenta de administrador.' }, 401);
  const isAdmin = await admin.rpc('tasky_user_is_admin', { p_user: callerId });
  if (isAdmin.error || isAdmin.data !== true) return json({ error: 'Solo el administrador puede crear cuentas.' }, 403);

  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Petición no válida.' }, 400);
  }
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return json({ error: 'El usuario debe tener de 3 a 20 caracteres: letras sin tilde, números o guion bajo.' }, 400);
  }
  if (password.length < 8 || password.length > 72) return json({ error: 'La contraseña debe tener entre 8 y 72 caracteres.' }, 400);

  const taken = await admin.from('profiles').select('user_id').eq('username', username).maybeSingle();
  if (taken.data) return json({ error: 'Ese nombre de usuario ya está en uso.' }, 409);

  const created = await admin.auth.admin.createUser({
    email: `${username}@users.tasky.app`,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    const exists = /already|registered|exists/i.test(created.error?.message ?? '');
    return json({ error: exists ? 'Ese nombre de usuario ya está en uso.' : 'No se pudo crear la cuenta.' }, exists ? 409 : 500);
  }

  const registered = await admin.rpc('tasky_register', { p_user: created.data.user.id, p_username: username });
  if (registered.error) {
    await admin.auth.admin.deleteUser(created.data.user.id); // no deja cuentas a medias
    const dup = registered.error.code === '23505';
    return json({ error: dup ? 'Ese nombre de usuario ya está en uso.' : 'No se pudo crear la cuenta.' }, dup ? 409 : 500);
  }
  return json({ ok: true });
});
