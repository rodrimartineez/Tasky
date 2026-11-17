/**
 * Rachas de los hábitos (IDEAS_MEJORAS_JUEGO.md Fase 5b). Los hábitos dan intentos (core/economy.ts); los puntos
 * de habilidad salen de los pasos.
 */

/**
 * Escudo de racha (solo hábitos diarios): se gana uno cada 60 días cumplidos seguidos y se guarda como mucho
 * uno por hábito. Un día fallado con escudo no rompe la racha (aunque no da puntos) y gasta el escudo;
 * el día salvado no cuenta, y para el siguiente hay que volver a cumplir 60 días. Cada 60 días (y no 21) para
 * que proteja frente a un día puntual sin acercar demasiado a quien falla a menudo a quien es constante
 * (ANALISIS_ECONOMIA.md §10).
 */
export const SHIELD_EVERY = 60;

export interface StreakState {
  streak: number;
  shield: boolean;
  /** Días cumplidos acumulados hacia el próximo escudo. */
  charge: number;
}

export const newStreak = (): StreakState => ({ streak: 0, shield: false, charge: 0 });

/** Avanza la racha un periodo cerrado. `shields` = el hábito usa escudos (diarios). */
export function stepStreak(state: StreakState, met: boolean, shields: boolean, every = SHIELD_EVERY): { next: StreakState; shielded: boolean } {
  if (met) {
    const streak = state.streak + 1;
    if (!shields || state.shield) return { next: { ...state, streak }, shielded: false };
    const charge = state.charge + 1;
    const earned = charge >= every;
    return { next: { streak, shield: earned, charge: earned ? 0 : charge }, shielded: false };
  }
  if (shields && state.shield) return { next: { streak: state.streak, shield: false, charge: 0 }, shielded: true };
  return { next: newStreak(), shielded: false };
}
