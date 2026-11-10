import { getSupabaseClient } from '../adapters/supabaseSync';
import { createHabitsStorage } from './adapters/storage';
import { createSupabaseHabits } from './adapters/supabaseHabits';
import { initHabits } from './state/store';
import { initHabitsSync } from './state/sync';

/**
 * Arranque del modo Hábitos (datos y sincronización; la interfaz se carga al entrar en el modo).
 * Se llama después de createPlatform(), que crea el cliente de Supabase compartido.
 */
export function startHabits() {
  const loaded = initHabits(createHabitsStorage());
  const client = getSupabaseClient();
  initHabitsSync(client ? createSupabaseHabits(client) : null, loaded);
}
