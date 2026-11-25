// Cambio de contraseña de Tasky (Supabase Edge Function). Solo la propia cuenta, siempre con su sesión:
//   · Cambio normal: exige la contraseña actual (se comprueba con Supabase Auth).
//   · Cuenta con contraseña provisional (private.password_pending): basta una sesión válida de esa cuenta; la nueva no puede
//     ser igual a la provisional.
// Nunca recibe un usuario como parámetro: la cuenta es la del token. Tras el cambio se revocan las demás sesiones.
// Se despliega con --no-verify-jwt: el token se comprueba aquí con el servidor de Auth.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const options = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const caller = token ? await admin.auth.getUser(token) : null;
  const user = caller?.data.user;
  if (!user?.id || !user.email) return json({ error: 'Inicia sesión para cambiar la contraseña.' }, 401);

  let body: { current_password?: unknown; new_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Petición no válida.' }, 400);
  }
  const current = typeof body.current_password === 'string' ? body.current_password : '';
  const next = typeof body.new_password === 'string' ? body.new_password : '';
  if (next.length < 10 || next.length > 72) return json({ error: 'La contraseña debe tener entre 10 y 72 caracteres.' }, 400);

  // Cliente solo para comprobar contraseñas (con la clave pública que envía la app; no guarda sesión).
  const verifier = createClient(url, req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY')!, options);
  const matches = async (password: string) =>
    !(await verifier.auth.signInWithPassword({ email: user.email!, password })).error;

  const pending = await admin.rpc('tasky_password_pending', { p_user: user.id });
  if (pending.error) return json({ error: 'No se pudo cambiar la contraseña.' }, 500);

  if (pending.data !== true) {
    if (!current || !(await matches(current))) return json({ error: 'La contraseña actual no es correcta.' }, 403);
    if (current === next) return json({ error: 'La nueva contraseña debe ser distinta de la actual.' }, 400);
  } else if (await matches(next)) {
    return json({ error: 'Elige una contraseña distinta de la provisional.' }, 400);
  }

  const updated = await admin.auth.admin.updateUserById(user.id, { password: next });
  if (updated.error) return json({ error: 'No se pudo cambiar la contraseña.' }, 500);
  const cleared = await admin.rpc('tasky_clear_password_pending', { p_user: user.id });
  if (cleared.error) return json({ error: 'No se pudo cambiar la contraseña.' }, 500);
  // Sesiones anteriores (otros dispositivos, asistentes y la de comprobación de arriba): se cierran; esta se mantiene.
  await admin.auth.admin.signOut(token, 'others');
  return json({ ok: true });
});
