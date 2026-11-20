import { useMemo } from 'react';
import { amountIn, compareHabits, amountsOf, history, streaks, targetFor, type PeriodResult } from '../core/habits';
import { ATTEMPTS } from '../core/economy';
import type { Habit } from '../core/model';
import { daysBetween, deviceTimeZone, periodEnd, periodKey } from '../core/periods';
import { useHabits } from '../state/store';

export interface HabitView {
  habit: Habit;
  amount: number;
  target: number;
  met: boolean;
  /** Reducción: lo que queda del límite (nunca negativo). */
  remaining: number;
  /** Reducción: cuánto se ha pasado del límite. */
  over: number;
  /** 0–1: positivo = progreso hacia el objetivo; reducción = parte del límite que queda. */
  fill: number;
  streak: number;
  best: number;
  /** Diarios: escudo de racha guardado y días cumplidos hacia el siguiente. */
  shield: boolean;
  charge: number;
  /** Intentos que dará cumplirlo en el periodo actual. */
  reward: number;
  results: PeriodResult[];
  /** Días que faltan para cerrar el periodo (0 = se cierra hoy a medianoche). */
  daysLeft: number;
}

/** Estado de todos los hábitos para la fecha actual (memorizado mientras no cambien los datos ni el día). */
export function useHabitViews(): HabitView[] {
  const data = useHabits((s) => s.data);
  const today = useHabits((s) => s.today);
  return useMemo(() => {
    const amounts = amountsOf(data);
    const timeZone = data.profile?.timeZone ?? deviceTimeZone();
    return data.habits
      .filter((h) => h.deletedAt === null)
      .sort(compareHabits)
      .map((habit) => {
        const key = periodKey(habit.period, today);
        const amount = amountIn(amounts, habit.id, key);
        const target = targetFor(habit, key);
        const results = history(habit, amounts, timeZone, today);
        const { current, best, shield, charge } = streaks(results, habit.kind, habit.period === 'daily');
        const build = habit.kind === 'build';
        return {
          habit,
          amount,
          target,
          met: build ? amount >= target : amount <= target,
          remaining: Math.max(0, round(target - amount)),
          over: Math.max(0, round(amount - target)),
          fill: build ? Math.min(1, amount / target) : Math.max(0, 1 - amount / target),
          streak: current,
          best,
          shield,
          charge,
          // Intentos al cerrar el periodo cumplido (los semanales positivos dan uno por porción, ver economy.ts).
          reward: habit.period === 'daily' || habit.kind === 'reduce' ? ATTEMPTS.daily : 0,
          results,
          daysLeft: daysBetween(today, periodEnd(key)),
        };
      });
  }, [data, today]);
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
export const formatAmount = (n: number) => numberFormat.format(n);

export const withUnit = (n: number, unit: string) => (unit ? `${formatAmount(n)} ${unit}` : formatAmount(n));
