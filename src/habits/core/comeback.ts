import type { LocalDate } from '../../core/model';
import type { RunRecord } from './economy';
import { amountsOf, history, live } from './habits';
import type { HabitsData } from './model';
import { addDays, dateInZone, daysBetween, periodEnd, periodStart } from './periods';

/**
 * Ayuda de vuelta (IDEAS_MEJORAS_JUEGO.md, C4). Premia *volver* a los hábitos, no dejarlos:
 *
 * - Hace falta una pausa de al menos 14 días seguidos sin cumplir ningún hábito, y que después se vuelva a
 *   cumplir alguno. Mientras la pausa sigue no hay ayuda (no es una ventaja permanente por no cumplir).
 * - Es gradual: su fuerza crece con la duración de la pausa (40 % a los 14 días, 100 % a los 60) y se retira
 *   partida a partida (5 partidas: 100 %, 80 %, 60 %, 40 %, 20 %).
 * - Es temporal: acaba tras esas 5 partidas o 7 días después de la vuelta.
 * - Solo actúa dentro de la partida (experiencia y vida). Nunca da puntos, oro ni mejoras.
 */
export const COMEBACK = {
  /** Días seguidos sin cumplir ningún hábito para que cuente como pausa. */
  after: 14,
  /** Duración de la pausa con la que la ayuda llega al máximo. */
  fullAt: 60,
  minStrength: 0.4,
  runs: 5,
  days: 7,
  /** Efecto máximo: +30 % de experiencia y +20 % de vida. */
  xp: 0.3,
  hp: 0.2,
};

export interface Comeback {
  /** Día en que se volvió a cumplir un hábito. */
  returnedOn: LocalDate;
  /** Días que duró la pausa. */
  breakDays: number;
  /** Fuerza para la próxima partida (0–1, ya aplicada la retirada gradual). */
  strength: number;
  /** Partidas que aún tendrán ayuda (incluida la próxima). */
  runsLeft: number;
  xp: number;
  hp: number;
}

/** Días en que se cumplió algún hábito (un semanal cumplido cuenta todos los días de su semana). */
function activeDays(data: HabitsData, timeZone: string, today: LocalDate): Set<LocalDate> {
  const amounts = amountsOf(data);
  const days = new Set<LocalDate>();
  for (const habit of data.habits.filter(live)) {
    for (const r of history(habit, amounts, timeZone, today)) {
      // Un periodo abierto solo cuenta si ya se cumplió de verdad (en reducción aún puede pasarse).
      if (!r.met || (!r.closed && habit.kind === 'reduce')) continue;
      if (habit.period === 'daily') days.add(r.key);
      else for (let d = periodStart(r.key); d <= periodEnd(r.key) && d <= today; d = addDays(d, 1)) days.add(d);
    }
  }
  return days;
}

export function comebackFor(data: HabitsData, today: LocalDate, runs: RunRecord[]): Comeback | null {
  if (!data.profile) return null;
  const { timeZone, startedOn } = data.profile;
  const active = activeDays(data, timeZone, today);

  // Última vuelta: un día activo precedido de una pausa larga (que empiece después de algún día activo).
  let seenActive = false;
  let gap = 0;
  let found: { returnedOn: LocalDate; breakDays: number } | null = null;
  for (let d = startedOn; d <= today; d = addDays(d, 1)) {
    if (!active.has(d)) {
      gap += 1;
      continue;
    }
    if (seenActive && gap >= COMEBACK.after) found = { returnedOn: d, breakDays: gap };
    seenActive = true;
    gap = 0;
  }
  if (!found || daysBetween(found.returnedOn, today) >= COMEBACK.days) return null;

  const used = runs.filter((r) => dateInZone(new Date(r.startedAt), timeZone) >= found.returnedOn).length;
  const runsLeft = COMEBACK.runs - used;
  if (runsLeft <= 0) return null;
  const growth = Math.min(1, (found.breakDays - COMEBACK.after) / (COMEBACK.fullAt - COMEBACK.after));
  const strength = (COMEBACK.minStrength + (1 - COMEBACK.minStrength) * growth) * (runsLeft / COMEBACK.runs);
  return { ...found, strength, runsLeft, xp: COMEBACK.xp * strength, hp: COMEBACK.hp * strength };
}
