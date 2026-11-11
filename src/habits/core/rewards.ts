/**
 * Puntos por hábito cumplido (ANALISIS_ECONOMIA.md §2).
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

/** Puntos fijos por hábito semanal cumplido (mantiene su sistema propio, independiente de las rachas diarias). */
export const WEEKLY_REWARD = 3;
