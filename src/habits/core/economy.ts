import type { LocalDate, Timestamp } from '../../core/model';
import { ARCANA_BY_ID } from '../../game/content/arcana';
import { CHARACTER_BY_ID } from '../../game/content/characters';
import { SKIN_BY_ID } from '../../game/content/skins';
import { STAGE_BY_ID } from '../../game/content/stages';
import { UPGRADE_BY_ID } from '../../game/content/upgrades';
import type { RunMode } from '../../game/sim/types';
import { active, amountIn, amountsOf, isMet, rewardId, targetFor } from './habits';
import type { HabitsData, LedgerEntry } from './model';
import { periodStart } from './periods';
import { GAME_RELEASE, type GameRelease } from './release';

/**
 * Economía del juego: todo se calcula reproduciendo el ledger (HABITS_GUIDE §4). Nunca se guarda un saldo.
 *
 * - Puntos: los dan los hábitos y se gastan en mejoras permanentes.
 * - Oro: lo dan las partidas y se gasta en personajes y escenarios.
 * - Intentos (HABITS_GUIDE §11): se ganan cumpliendo hábitos (+1 por cada diario cumplido, +3 por cada semanal) y no
 *   caducan. Cada partida gasta uno. El nivel solo sube al superar el actual (llegar al minuto 30 en modo normal).
 *
 * Los ids de los asientos son deterministas: dos dispositivos que hacen lo mismo sin conexión generan el mismo
 * asiento, y el servidor solo guarda uno. Un asiento imposible (gastar lo que ya no hay, dos compras del mismo
 * nivel…) se ignora al reproducir y aparece en `rejected`.
 */

export interface RunRecord {
  /** Número de intento (1, 2, 3…), en orden. */
  attempt: number;
  level: number;
  mode: RunMode;
  character: string;
  stage: string;
  /** Arcano de la partida (Fase 10), si llevaba uno. */
  arcana: string | null;
  startedAt: Timestamp;
  /** null = en curso (empezada y sin resultado). */
  /** `won` = nivel superado. */
  result: { gold: number; time: number; kills: number; won: boolean; xpLevel: number } | null;
}

export interface Economy {
  points: number;
  gold: number;
  /** Nivel comprado de cada mejora permanente. */
  upgrades: Record<string, number>;
  /** Contenido desbloqueado con oro (`character:<id>`, `stage:<id>`, `skin:<id>`, `arcana:<id>`). */
  unlocked: Set<string>;
  runs: RunRecord[];
  /** Partida empezada y sin terminar (como mucho una). */
  openRun: RunRecord | null;
  /** Intentos ganados con los hábitos (desde el inicio de la temporada) y gastados. */
  attemptsEarned: number;
  attemptsUsed: number;
  /** Intentos disponibles para jugar ahora. */
  available: number;
  /** Nivel actual: el siguiente al último superado. */
  nextLevel: number;
  /** Último nivel superado (0 = ninguno). */
  passedLevel: number;
  /** Hitos: velocidad ×1,5 y ×2 (nivel 20), modo infinito (30) y modo reflejo (60). */
  unlocks: { speed: boolean; infinite: boolean; mirror: boolean };
  totalPointsEarned: number;
  totalGoldEarned: number;
  bestTime: number;
  rejected: Set<string>;
  /** Modo de pruebas (release.ts): partidas ilimitadas en cualquier nivel, todo disponible y nada se guarda. */
  testMode: boolean;
  /** Asientos de partidas, resultados y desbloqueos de otra temporada (se ignoran). */
  legacy: number;
}

const upgradeId = (upgrade: string, level: number) => `upgrade:${upgrade}:${level}`;
/** Los ids del juego llevan la temporada: `run:s1:5`, `result:s1:5`, `unlock:s1:character:warden`. */
const seasonTag = (release: GameRelease) => `s${release.season}`;
const unlockId = (key: string, release: GameRelease) => `unlock:${seasonTag(release)}:${key}`;
const runId = (attempt: number, release: GameRelease) => `run:${seasonTag(release)}:${attempt}`;
const resultId = (attempt: number, release: GameRelease) => `result:${seasonTag(release)}:${attempt}`;

/** Intentos por cada hábito cumplido. */
export const ATTEMPTS = { daily: 1, weekly: 3 };
/** Niveles que hay que superar para cada hito. */
export const MILESTONES = { speed: 20, infinite: 30, mirror: 60 };

/**
 * Intentos ganados con los hábitos desde `firstDay`:
 * - Un intento por cada periodo cumplido ya cerrado (su recompensa está en el ledger): diario +1, semanal +3.
 * - Y, al momento, uno por cada hábito diario de construir cumplido hoy. Los de reducir se confirman al cerrar el
 *   día (hasta entonces aún se pueden pasar del límite).
 * Al cerrarse el día, el de hoy pasa a contarse por su recompensa (mismo hábito y día): nunca se cuenta dos veces.
 */
function attemptsEarned(data: HabitsData, today: LocalDate, firstDay: LocalDate | null): number {
  if (!firstDay) return 0;
  let total = 0;
  const rewarded = new Set<string>();
  for (const e of data.ledger) {
    if (e.kind !== 'habit_reward' || !e.period || e.deletedAt) continue;
    rewarded.add(e.id);
    if (periodStart(e.period) < firstDay) continue;
    total += e.period.startsWith('W') ? ATTEMPTS.weekly : ATTEMPTS.daily;
  }
  if (today >= firstDay) {
    const amounts = amountsOf(data);
    for (const habit of data.habits) {
      if (!active(habit) || habit.period !== 'daily' || habit.kind !== 'build' || rewarded.has(rewardId(habit.id, today))) continue;
      if (isMet(habit.kind, amountIn(amounts, habit.id, today), targetFor(habit, today))) total += ATTEMPTS.daily;
    }
  }
  return total;
}

/** Resto del id tras `<tipo>:<temporada>:`, o null si es de otra temporada (o anterior a las temporadas). */
function inSeason(id: string, release: GameRelease): string | null {
  const prefix = `${id.slice(0, id.indexOf(':'))}:${seasonTag(release)}:`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

/** Lo que es gratis no hace falta desbloquearlo. */
export function isFree(key: string): boolean {
  const [kind, id] = key.split(':');
  if (kind === 'character') return (CHARACTER_BY_ID.get(id)?.price ?? Infinity) === 0;
  if (kind === 'stage') return (STAGE_BY_ID.get(id)?.price ?? Infinity) === 0;
  return false;
}

/** Precio en oro de lo que se desbloquea: `character:`, `stage:`, `skin:` (aspectos) y `arcana:` (arcanos). */
export function priceOf(key: string): number {
  const [kind, id] = key.split(':');
  const price =
    kind === 'character'
      ? CHARACTER_BY_ID.get(id)?.price
      : kind === 'stage'
        ? STAGE_BY_ID.get(id)?.price
        : kind === 'arcana'
          ? ARCANA_BY_ID.get(id)?.price
          : kind === 'skin'
            ? SKIN_BY_ID.get(id)?.price || undefined
            : undefined;
  return price ?? Infinity;
}

const order = (a: LedgerEntry, b: LedgerEntry) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

export function economyOf(data: HabitsData, today: LocalDate, release: GameRelease = GAME_RELEASE): Economy {
  const firstDay =
    data.profile && release.startsOn && release.startsOn > data.profile.startedOn ? release.startsOn : data.profile?.startedOn;
  const eco: Economy = {
    points: 0,
    gold: 0,
    upgrades: {},
    unlocked: new Set(),
    runs: [],
    openRun: null,
    attemptsEarned: attemptsEarned(data, today, firstDay ?? null),
    attemptsUsed: 0,
    available: 0,
    nextLevel: 1,
    passedLevel: 0,
    unlocks: { speed: false, infinite: false, mirror: false },
    totalPointsEarned: 0,
    totalGoldEarned: 0,
    bestTime: 0,
    rejected: new Set(),
    testMode: release.testMode,
    legacy: 0,
  };
  const byAttempt = new Map<number, RunRecord>();
  const reject = (e: LedgerEntry) => eco.rejected.add(e.id);
  /** Id dentro de la temporada (sin el prefijo), o null si el asiento es de otra y se ignora. */
  const own = (e: LedgerEntry) => {
    const rest = inSeason(e.id, release);
    if (rest === null) eco.legacy += 1;
    return rest;
  };

  for (const e of [...data.ledger].sort(order)) {
    switch (e.kind) {
      case 'habit_reward':
        eco.points += e.points;
        eco.totalPointsEarned += e.points;
        break;

      case 'upgrade': {
        const [, upgrade, levelText] = e.id.split(':');
        const level = Number(levelText);
        const cost = -e.points;
        const max = UPGRADE_BY_ID.get(upgrade)?.maxLevel ?? Infinity;
        if ((eco.upgrades[upgrade] ?? 0) !== level - 1 || level > max || cost > eco.points || cost <= 0) reject(e);
        else {
          eco.points -= cost;
          eco.upgrades[upgrade] = level;
        }
        break;
      }

      case 'unlock': {
        const key = own(e);
        if (key === null) break;
        const cost = -e.gold;
        if (eco.unlocked.has(key) || cost > eco.gold || cost < 0) reject(e);
        else {
          eco.gold -= cost;
          eco.unlocked.add(key);
        }
        break;
      }

      case 'run_start': {
        const rest = own(e);
        if (rest === null) break;
        const attempt = Number(rest);
        // Los intentos van en orden; el nivel de la partida es el actual en ese momento (no se puede saltar).
        const level = Number(e.details?.level ?? eco.passedLevel + 1);
        if (attempt !== byAttempt.size + 1 || level !== eco.passedLevel + 1) {
          reject(e);
          break;
        }
        const mode = e.details?.mode === 'infinite' || e.details?.mode === 'mirror' ? e.details.mode : 'normal';
        const run: RunRecord = {
          attempt,
          level,
          mode,
          character: String(e.details?.character ?? 'wanderer'),
          stage: String(e.details?.stage ?? 'withered_woods'),
          arcana: typeof e.details?.arcana === 'string' ? e.details.arcana : null,
          startedAt: e.createdAt,
          result: null,
        };
        byAttempt.set(attempt, run);
        eco.runs.push(run);
        break;
      }

      case 'run_result': {
        const rest = own(e);
        if (rest === null) break;
        const run = byAttempt.get(Number(rest));
        if (!run || run.result || e.gold < 0) {
          reject(e);
          break;
        }
        const d = e.details ?? {};
        // Solo una partida normal del nivel actual puede superarlo.
        const won = d.won === true && run.mode === 'normal' && run.level === eco.passedLevel + 1;
        run.result = { gold: e.gold, time: Number(d.time ?? 0), kills: Number(d.kills ?? 0), won, xpLevel: Number(d.xpLevel ?? 0) };
        if (won) eco.passedLevel = run.level;
        eco.gold += e.gold;
        eco.totalGoldEarned += e.gold;
        eco.bestTime = Math.max(eco.bestTime, run.result.time);
        break;
      }
    }
  }

  eco.openRun = eco.runs.find((r) => r.result === null) ?? null;
  eco.attemptsUsed = eco.runs.length;
  eco.available = Math.max(0, eco.attemptsEarned - eco.attemptsUsed);
  eco.nextLevel = eco.passedLevel + 1;
  eco.unlocks = {
    speed: eco.passedLevel >= MILESTONES.speed,
    infinite: eco.passedLevel >= MILESTONES.infinite,
    mirror: eco.passedLevel >= MILESTONES.mirror,
  };
  if (release.testMode) {
    eco.available = Infinity;
    eco.openRun = null;
    eco.unlocks = { speed: true, infinite: true, mirror: true };
  }
  return eco;
}

export const isUnlocked = (eco: Economy, key: string) => eco.testMode || isFree(key) || eco.unlocked.has(key);

const entry = (id: string, kind: LedgerEntry['kind'], now: Timestamp, extra: Partial<LedgerEntry>): LedgerEntry => ({
  id,
  kind,
  points: 0,
  gold: 0,
  habitId: null,
  period: null,
  details: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...extra,
});

const append = (data: HabitsData, e: LedgerEntry): HabitsData => ({ ...data, ledger: [...data.ledger, e] });

export class EconomyError extends Error {}

/** Compra el siguiente nivel de una mejora permanente con puntos de hábitos. */
export function buyUpgrade(data: HabitsData, upgrade: string, today: LocalDate, now: Timestamp): HabitsData {
  const def = UPGRADE_BY_ID.get(upgrade);
  if (!def) throw new EconomyError('Mejora desconocida.');
  const eco = economyOf(data, today);
  const level = (eco.upgrades[upgrade] ?? 0) + 1;
  if (level > (def.maxLevel ?? Infinity)) throw new EconomyError('Esta mejora ya está al máximo.');
  const cost = def.cost(level);
  if (cost > eco.points) throw new EconomyError('No tienes puntos suficientes.');
  return append(data, entry(upgradeId(upgrade, level), 'upgrade', now, { points: -cost }));
}

/** Desbloquea con oro un personaje, escenario, aspecto o arcano (ver `priceOf`). */
export function unlock(data: HabitsData, key: string, today: LocalDate, now: Timestamp, release: GameRelease = GAME_RELEASE): HabitsData {
  const eco = economyOf(data, today, release);
  if (isUnlocked(eco, key)) return data;
  const price = priceOf(key);
  if (!Number.isFinite(price)) throw new EconomyError('Contenido desconocido.');
  if (price > eco.gold) throw new EconomyError('No tienes oro suficiente.');
  return append(data, entry(unlockId(key, release), 'unlock', now, { gold: -price }));
}

/** ¿Está disponible esa modalidad? */
export const modeUnlocked = (eco: Economy, mode: RunMode) =>
  mode === 'normal' || (mode === 'infinite' ? eco.unlocks.infinite : eco.unlocks.mirror);

/** Empieza una partida en el nivel actual (gasta un intento). Devuelve su número de intento y su nivel. */
export function startRun(
  data: HabitsData,
  character: string,
  stage: string,
  mode: RunMode,
  today: LocalDate,
  now: Timestamp,
  /** Ayuda de vuelta aplicada (0 = ninguna), para el historial. */
  comeback = 0,
  release: GameRelease = GAME_RELEASE,
  /** Arcano elegido para esta partida (B3), o null. */
  arcana: string | null = null,
): { data: HabitsData; attempt: number; level: number } {
  // Las partidas de prueba no se guardan: no pasan por aquí.
  if (release.testMode) throw new EconomyError('En el modo de pruebas las partidas no se registran.');
  const eco = economyOf(data, today, release);
  if (eco.openRun) throw new EconomyError('Ya hay una partida en curso.');
  if (eco.available <= 0) throw new EconomyError('No te quedan intentos: cumple hábitos para conseguir más.');
  if (!modeUnlocked(eco, mode)) throw new EconomyError('Esa modalidad aún está bloqueada.');
  if (!isUnlocked(eco, `character:${character}`) || !isUnlocked(eco, `stage:${stage}`))
    throw new EconomyError('Ese contenido aún está bloqueado.');
  if (arcana && !isUnlocked(eco, `arcana:${arcana}`)) throw new EconomyError('Ese arcano aún está bloqueado.');
  const attempt = eco.attemptsUsed + 1;
  const level = eco.nextLevel;
  const details: Record<string, string | number> = { character, stage, level, mode };
  if (comeback > 0) details.comeback = Math.round(comeback * 100) / 100;
  if (arcana) details.arcana = arcana;
  return { data: append(data, entry(runId(attempt, release), 'run_start', now, { details })), attempt, level };
}

export interface RunOutcome {
  gold: number;
  time: number;
  kills: number;
  won: boolean;
  xpLevel: number;
}

/** Personaje y escenario elegidos para la próxima partida (se sincronizan con el perfil). */
export function setLoadout(data: HabitsData, character: string, stage: string, now: Timestamp): HabitsData {
  if (!data.profile || (data.profile.character === character && data.profile.stage === stage)) return data;
  return { ...data, profile: { ...data.profile, character, stage, updatedAt: now } };
}

/** Registra el resultado de una partida (una sola vez por intento). El oro se conserva aunque no se supere el nivel. */
export function finishRun(
  data: HabitsData,
  attempt: number,
  outcome: RunOutcome,
  now: Timestamp,
  release: GameRelease = GAME_RELEASE,
): HabitsData {
  if (release.testMode || data.ledger.some((e) => e.id === resultId(attempt, release))) return data;
  return append(
    data,
    entry(resultId(attempt, release), 'run_result', now, {
      gold: Math.max(0, Math.floor(outcome.gold)),
      details: { time: Math.round(outcome.time), kills: outcome.kills, won: outcome.won, xpLevel: outcome.xpLevel },
    }),
  );
}
