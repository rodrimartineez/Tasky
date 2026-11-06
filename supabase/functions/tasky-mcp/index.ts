// Servidor MCP remoto de Tasky (Supabase Edge Function). Ver TASKY_GUIDE.md §7.7.
//
// 1. withOAuthProtectedResource: publica los metadatos OAuth (RFC 9728) para que Claude descubra
//    que el servidor de autorización es Supabase Auth, y añade WWW-Authenticate a los 401.
// 2. withSupabase({ auth: 'user' }): verifica el token del usuario (ES256, JWKS del proyecto) y crea
//    un cliente con ese token, de modo que RLS (dueño + lista blanca) se aplica a todo.
// 3. handleTaskyMcp: la lógica de Tasky (src/mcp/), empaquetada en dist/tasky.js por `npm run mcp:build`.
//
// Se despliega con --no-verify-jwt: la verificación la hace withSupabase, y la petición de
// descubrimiento llega sin token.
import { pipeline } from 'npm:@supabase/middleware@1.0.0';
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1.9.2';
import { handleTaskyMcp } from './dist/tasky.js';

export default {
  fetch: pipeline([withOAuthProtectedResource(), withSupabase({ auth: 'user' })], (req, { supabase }) =>
    handleTaskyMcp(req, supabase),
  ),
};
