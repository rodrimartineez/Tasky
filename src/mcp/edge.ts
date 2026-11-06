import { today } from '../core/clock';
import { newId } from '../core/ids';
import { pullRecords, pushRecords, type SupabaseLike } from '../adapters/supabaseRows';
import { createTaskyMcpHandler } from './server';
import { createTaskyService } from './service';

/** Zona horaria del usuario: «hoy» y las tareas vencidas se calculan como en su dispositivo. */
const TIME_ZONE = 'Europe/Madrid';

/**
 * Punto de entrada del servidor MCP en la Edge Function `tasky-mcp` (se empaqueta con `npm run mcp:build`).
 * `supabase` es el cliente con el token OAuth del usuario: todas las lecturas y escrituras pasan por RLS
 * (dueño de la fila + lista blanca), igual que desde la app. Nunca se usa la clave service_role.
 */
export function handleTaskyMcp(request: Request, supabase: SupabaseLike): Promise<Response> {
  const service = createTaskyService(
    {
      load: async () => (await pullRecords(supabase, 0)).records,
      save: (records) => pushRecords(supabase, records),
    },
    {
      now: () => new Date().toISOString(),
      today: () => today(new Date(new Date().toLocaleString('en-US', { timeZone: TIME_ZONE }))),
      newId,
    },
  );
  return createTaskyMcpHandler(service).fetch(request);
}
