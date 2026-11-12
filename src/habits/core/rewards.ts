/**
 * Puntos por hábito cumplido (ANALISIS_ECONOMIA.md §2, IDEAS_MEJORAS_JUEGO.md Fase 5b).
 *
 * Diarios: crecen con la racha por hitos, como una curva logarítmica pero con números fáciles de recordar.
 * Mantener un hábito siempre vale más, pero sin dispararse, y una racha rota se recupera deprisa
 * (en 2 semanas ya vuelve a dar 4 puntos).
 */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

/** Puntos por cumplir un hábito diario con una racha de `streak` días (incluido el de hoy). */
export function streakPoints(streak: number): number {
  let points = 1;
  for (const m of STREAK_MILESTONES) if (streak >= m) points += 1;
  if (streak >= 730) points += Math.floor((streak - 365) / 365);
  return points;
}

/** Siguiente hito de racha (pasados los fijos, cada aniversario suma uno). */
export function nextMilestone(streak: number): { days: number; points: number } {
  const next = STREAK_MILESTONES.find((m) => m > streak) ?? (Math.floor(streak / 365) + 1) * 365;
  return { days: next, points: streakPoints(next) };
}

/** Mejora de recompensas «Constancia» (definida con las demás mejoras en game/content/upgrades.ts). */
export { BOUNTY, BOUNTY_MAX, bountyDaily, bountyWeekly } from '../../game/content/upgrades';

/** Puntos base por hábito semanal cumplido (sistema propio, independiente de las rachas diarias). */
export const WEEKLY_REWARD = 3;
/** Semanales: +1 punto por cada 4 semanas seguidas cumplidas, hasta +3 (como mucho 6 puntos por semana). */
export const WEEKLY_STREAK_STEP = 4;
export const WEEKLY_STREAK_MAX_BONUS = 3;

export const weeklyPoints = (streak: number) => WEEKLY_REWARD + Math.min(WEEKLY_STREAK_MAX_BONUS, Math.floor(streak / WEEKLY_STREAK_STEP));

/**
 * Límite contra hábitos inflados: los primeros 7 hábitos diarios (por antigüedad) dan sus puntos completos;
 * a partir del 8.º, la mitad (redondeando hacia arriba).
 */
export const DAILY_FULL_LIMIT = 7;
export const withDailyLimit = (points: number, rank: number) => (rank < DAILY_FULL_LIMIT ? points : Math.ceil(points / 2));

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
