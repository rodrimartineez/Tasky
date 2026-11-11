import { UPGRADES } from '../../game/content/upgrades';
import { streakPoints } from '../core/rewards';

/**
 * Modelo de la economía a largo plazo para el estudio de equilibrio (ANALISIS_ECONOMIA.md).
 * No forma parte de la app: lo usan los estudios de balance.study.test.ts.
 *
 * Simula día a día a un usuario con varios hábitos diarios y semanales, sus rachas, los puntos que gana
 * con una fórmula de recompensa y cómo los gasta en mejoras (siempre la más barata de las que quiere).
 */

export type StreakRule = (streak: number) => number;

/** Fórmulas candidatas de puntos por hábito diario cumplido, según la racha (días seguidos, incluido hoy). */
export const STREAK_RULES: Record<string, StreakRule> = {
  plano: () => 1,
  lineal: (s) => s,
  raiz: (s) => Math.max(1, Math.floor(Math.sqrt(s))),
  log2: (s) => 1 + Math.floor(Math.log2(s)),
  /** Hitos (propuesta): +1 punto al alcanzar 3, 7, 14, 30, 60, 100, 180 y 365 días, y +1 cada año más. */
  hitos: (s) => streakPoints(s),
  /** Escalones: 1 · 2 desde 7 días · 3 desde 30 · 4 desde 90 · 5 desde 180 · 6 desde 365 (y +1 cada año más). */
  escalones: (s) => (s >= 365 ? 6 + Math.floor((s - 365) / 365) : s >= 180 ? 5 : s >= 90 ? 4 : s >= 30 ? 3 : s >= 7 ? 2 : 1),
};

export interface Profile {
  name: string;
  dailyHabits: number;
  weeklyHabits: number;
  /** Probabilidad de cumplir cada hábito diario un día dado (puede variar con el tiempo: pausas, regresos). */
  daily(day: number): number;
  /** Probabilidad de cumplir cada hábito semanal una semana dada. */
  weekly(week: number): number;
  /** ¿Juega la partida de ese día? (si no, se acumula). */
  plays(day: number): boolean;
}

/**
 * Los días buenos y malos van en rachas (no son independientes): cada hábito tiene un «estado» que
 * cambia poco a poco. `p` es la media a largo plazo; `stickiness` cuánto se parece un día al anterior.
 */
function makeHabit(rng: () => number) {
  let state = rng();
  return (p: number, stickiness = 0.75) => {
    state = stickiness * state + (1 - stickiness) * rng();
    return (state + rng()) / 2 < p;
  };
}

export function mulberry(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mejoras que el usuario quiere, en orden de preferencia (todas las de combate). */
const WANTED = UPGRADES.map((u) => u.id).filter((id) => !['greed', 'luck', 'pickup', 'growth', 'projSpeed'].includes(id));

export interface DaySnapshot {
  day: number;
  /** Puntos ganados ese día y acumulados. */
  points: number;
  totalPoints: number;
  levels: Record<string, number>;
  /** Partidas jugadas hasta ese día (= nivel de la última). */
  runs: number;
  /** Racha media de los hábitos diarios. */
  avgStreak: number;
}

export const WEEKLY_POINTS = 3;

/** Simula `days` días y devuelve una instantánea de cada día. */
export function simulateEconomy(profile: Profile, rule: StreakRule, days: number, seed = 1): DaySnapshot[] {
  const rng = mulberry(seed);
  const habits = Array.from({ length: profile.dailyHabits }, () => makeHabit(rng));
  const streaks = new Array(profile.dailyHabits).fill(0);
  const levels: Record<string, number> = {};
  let wallet = 0;
  let total = 0;
  let runs = 0;
  const out: DaySnapshot[] = [];

  for (let day = 1; day <= days; day++) {
    let points = 0;
    const p = profile.daily(day);
    for (let h = 0; h < habits.length; h++) {
      if (habits[h](p)) {
        streaks[h] += 1;
        points += rule(streaks[h]);
      } else streaks[h] = 0;
    }
    if (day % 7 === 0) for (let h = 0; h < profile.weeklyHabits; h++) if (rng() < profile.weekly(day / 7)) points += WEEKLY_POINTS;
    wallet += points;
    total += points;

    // Gasta en la mejora deseada más barata mientras pueda.
    for (;;) {
      let best: string | null = null;
      let bestCost = Infinity;
      for (const id of WANTED) {
        const cost = UPGRADES.find((u) => u.id === id)!.cost((levels[id] ?? 0) + 1);
        if (cost < bestCost) {
          bestCost = cost;
          best = id;
        }
      }
      if (!best || bestCost > wallet) break;
      wallet -= bestCost;
      levels[best] = (levels[best] ?? 0) + 1;
    }

    if (profile.plays(day)) runs += 1;
    out.push({
      day,
      points,
      totalPoints: total,
      levels: { ...levels },
      runs,
      avgStreak: streaks.reduce((a, b) => a + b, 0) / streaks.length,
    });
  }
  return out;
}

const always = () => true;
const DAILY = 5;
const WEEKLY = 2;

/** Perfiles de usuario del estudio. */
export const PROFILES: Profile[] = [
  { name: 'Constante (95 %)', dailyHabits: DAILY, weeklyHabits: WEEKLY, daily: () => 0.95, weekly: () => 0.9, plays: always },
  { name: 'Normal (80 %)', dailyHabits: DAILY, weeklyHabits: WEEKLY, daily: () => 0.8, weekly: () => 0.7, plays: always },
  { name: 'Irregular (50 %)', dailyHabits: DAILY, weeklyHabits: WEEKLY, daily: () => 0.5, weekly: () => 0.4, plays: always },
  {
    name: 'Abandona y vuelve',
    dailyHabits: DAILY,
    weeklyHabits: WEEKLY,
    // 80 % los primeros 120 días, nada durante 90 días (pero sigue jugando), y vuelve al 85 %.
    daily: (d) => (d > 120 && d <= 210 ? 0 : 0.85),
    weekly: (w) => (w * 7 > 120 && w * 7 <= 210 ? 0 : 0.7),
    plays: always,
  },
  {
    name: 'Abandona y no juega',
    dailyHabits: DAILY,
    weeklyHabits: WEEKLY,
    // Igual, pero durante la pausa tampoco juega: las partidas se acumulan sin subir de nivel.
    daily: (d) => (d > 120 && d <= 210 ? 0 : 0.85),
    weekly: (w) => (w * 7 > 120 && w * 7 <= 210 ? 0 : 0.7),
    plays: (d) => d <= 120 || d > 210,
  },
];
