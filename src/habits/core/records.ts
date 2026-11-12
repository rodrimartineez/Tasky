import { CHARACTER_BY_ID } from '../../game/content/characters';
import { STAGE_BY_ID } from '../../game/content/stages';
import type { Economy, RunRecord } from './economy';
import type { HabitsData } from './model';

/**
 * Estadísticas, récords y logros (Fase 10, propuestas E2 y C2). Todo se deduce del ledger ya reproducido
 * (`economyOf`) y de las recompensas de hábitos: no se guarda nada nuevo, así que funciona igual en todos los
 * dispositivos y con los datos que ya existen. Los logros nunca dan puntos, intentos ni poder: algunos regalan un
 * aspecto (content/skins.ts).
 */

export interface Totals {
  runs: number;
  wins: number;
  kills: number;
  /** Segundos jugados. */
  time: number;
  gold: number;
  bestTime: number;
  bestKills: number;
  bestXpLevel: number;
}

export interface GroupStats extends Totals {
  id: string;
  name: string;
}

export interface Records {
  totals: Totals;
  characters: GroupStats[];
  stages: GroupStats[];
  /** Último nivel superado. */
  passedLevel: number;
  /** Hábitos: recompensas cobradas (periodos cumplidos) y mejor racha diaria. */
  habitsMet: number;
  bestStreak: number;
  pointsEarned: number;
  upgradesBought: number;
}

const empty = (): Totals => ({ runs: 0, wins: 0, kills: 0, time: 0, gold: 0, bestTime: 0, bestKills: 0, bestXpLevel: 0 });

function add(t: Totals, run: RunRecord) {
  const r = run.result;
  t.runs += 1;
  if (!r) return;
  if (r.won) t.wins += 1;
  t.kills += r.kills;
  t.time += r.time;
  t.gold += r.gold;
  t.bestTime = Math.max(t.bestTime, r.time);
  t.bestKills = Math.max(t.bestKills, r.kills);
  t.bestXpLevel = Math.max(t.bestXpLevel, r.xpLevel);
}

function grouped(runs: RunRecord[], key: (r: RunRecord) => string, name: (id: string) => string): GroupStats[] {
  const map = new Map<string, Totals>();
  for (const run of runs) {
    const id = key(run);
    if (!map.has(id)) map.set(id, empty());
    add(map.get(id) as Totals, run);
  }
  return [...map.entries()]
    .map(([id, t]) => ({ id, name: name(id), ...t }))
    .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name));
}

export function recordsOf(eco: Economy, data: HabitsData): Records {
  const totals = empty();
  for (const run of eco.runs) add(totals, run);
  let habitsMet = 0;
  let bestStreak = 0;
  for (const e of data.ledger) {
    if (e.kind !== 'habit_reward' || e.deletedAt) continue;
    habitsMet += 1;
    const streak = Number(e.details?.streak ?? (e.period?.startsWith('W') ? 0 : 1));
    if (Number.isFinite(streak)) bestStreak = Math.max(bestStreak, streak);
  }
  return {
    totals,
    characters: grouped(
      eco.runs,
      (r) => r.character,
      (id) => CHARACTER_BY_ID.get(id)?.name ?? id,
    ),
    stages: grouped(
      eco.runs,
      (r) => r.stage,
      (id) => STAGE_BY_ID.get(id)?.name ?? id,
    ),
    passedLevel: eco.passedLevel,
    habitsMet,
    bestStreak,
    pointsEarned: eco.totalPointsEarned,
    upgradesBought: Object.values(eco.upgrades).reduce((s, n) => s + n, 0),
  };
}

export interface AchievementDef {
  id: string;
  name: string;
  text: string;
  /** Hábitos o juego (para agruparlos en pantalla). */
  group: 'habits' | 'game';
  goal: number;
  value: (r: Records) => number;
}

const tiers = (
  prefix: string,
  group: AchievementDef['group'],
  goals: number[],
  name: (n: number) => string,
  text: (n: number) => string,
  value: (r: Records) => number,
): AchievementDef[] => goals.map((goal) => ({ id: `${prefix}_${goal}`, name: name(goal), text: text(goal), group, goal, value }));

const n = (x: number) => x.toLocaleString('es-ES');

export const ACHIEVEMENTS: AchievementDef[] = [
  ...tiers(
    'streak',
    'habits',
    [7, 30, 100, 365],
    (g) => `Racha de ${g}`,
    (g) => `Llega a una racha de ${g} días en un hábito diario.`,
    (r) => r.bestStreak,
  ),
  ...tiers(
    'met',
    'habits',
    [50, 250, 1000],
    (g) => `${n(g)} cumplidos`,
    (g) => `Cumple hábitos ${n(g)} veces (días o semanas).`,
    (r) => r.habitsMet,
  ),
  ...tiers(
    'points',
    'habits',
    [100, 1000, 10000],
    (g) => `${n(g)} puntos`,
    (g) => `Gana ${n(g)} puntos de hábito en total.`,
    (r) => r.pointsEarned,
  ),
  ...tiers(
    'level',
    'game',
    [7, 30, 60, 100],
    (g) => `Nivel ${g}`,
    (g) => `Supera el nivel ${g}.`,
    (r) => r.passedLevel,
  ),
  ...tiers(
    'kills',
    'game',
    [10000, 100000, 1000000],
    (g) => `${n(g)} bajas`,
    (g) => `Derrota a ${n(g)} enemigos en total.`,
    (r) => r.totals.kills,
  ),
  ...tiers(
    'runs',
    'game',
    [10, 100, 500],
    (g) => `${n(g)} partidas`,
    (g) => `Juega ${n(g)} partidas.`,
    (r) => r.totals.runs,
  ),
  {
    id: 'collector',
    name: 'Coleccionista',
    text: 'Juega una partida con 5 personajes distintos.',
    group: 'game',
    goal: 5,
    value: (r) => r.characters.length,
  },
  {
    id: 'explorer',
    name: 'Explorador',
    text: 'Juega en los 5 escenarios.',
    group: 'game',
    goal: 5,
    value: (r) => r.stages.length,
  },
];

export interface AchievementState {
  def: AchievementDef;
  value: number;
  done: boolean;
}

export const achievementsOf = (r: Records): AchievementState[] =>
  ACHIEVEMENTS.map((def) => {
    const value = Math.min(def.goal, def.value(r));
    return { def, value, done: value >= def.goal };
  });

export const achieved = (r: Records) =>
  new Set(
    achievementsOf(r)
      .filter((a) => a.done)
      .map((a) => a.def.id),
  );
