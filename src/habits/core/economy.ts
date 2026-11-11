import type { LocalDate, Timestamp } from '../../core/model';
import { CHARACTER_BY_ID } from '../../game/content/characters';
import { STAGE_BY_ID } from '../../game/content/stages';
import { UPGRADE_BY_ID } from '../../game/content/upgrades';
import type { HabitsData, LedgerEntry } from './model';
import { daysBetween } from './periods';

/**
 * Economía del juego: todo se calcula reproduciendo el ledger (HABITS_GUIDE §4). Nunca se guarda un saldo.
 *
 * - Puntos: los dan los hábitos y se gastan en mejoras permanentes.
 * - Oro: lo dan las partidas y se gasta en personajes y escenarios.
 * - Partidas: una nueva cada día desde `profile.startedOn` (se acumulan). La n-ésima partida que se empieza es
 *   el nivel n, sea cual sea la fecha; terminarla (ganando o muriendo) da paso al nivel siguiente.
 *
 * Los ids de los asientos son deterministas: dos dispositivos que hacen lo mismo sin conexión generan el mismo
 * asiento, y el servidor solo guarda uno. Un asiento imposible (gastar lo que ya no hay, dos compras del mismo
 * nivel…) se ignora al reproducir y aparece en `rejected`.
 */

export interface RunRecord {
  level: number;
  character: string;
  stage: string;
  startedAt: Timestamp;
  /** null = en curso (empezada y sin resultado). */
  result: { gold: number; time: number; kills: number; won: boolean; xpLevel: number } | null;
}

export interface Economy {
  points: number;
  gold: number;
  /** Nivel comprado de cada mejora permanente. */
  upgrades: Record<string, number>;
  /** Personajes y escenarios desbloqueados (`character:<id>`, `stage:<id>`). */
  unlocked: Set<string>;
  runs: RunRecord[];
  /** Partida empezada y sin terminar (como mucho una). */
  openRun: RunRecord | null;
  /** Partidas recibidas hasta hoy (una por día desde el inicio). */
  granted: number;
  /** Partidas disponibles para jugar ahora. */
  available: number;
  /** Nivel de la próxima partida. */
  nextLevel: number;
  totalPointsEarned: number;
  totalGoldEarned: number;
  bestTime: number;
  rejected: Set<string>;
}

const upgradeId = (upgrade: string, level: number) => `upgrade:${upgrade}:${level}`;
const unlockId = (key: string) => `unlock:${key}`;
const runId = (level: number) => `run:${level}`;
const resultId = (level: number) => `result:${level}`;

/** Lo que es gratis no hace falta desbloquearlo. */
export function isFree(key: string): boolean {
  const [kind, id] = key.split(':');
  if (kind === 'character') return (CHARACTER_BY_ID.get(id)?.price ?? Infinity) === 0;
  if (kind === 'stage') return (STAGE_BY_ID.get(id)?.price ?? Infinity) === 0;
  return false;
}

export function priceOf(key: string): number {
  const [kind, id] = key.split(':');
  const price = kind === 'character' ? CHARACTER_BY_ID.get(id)?.price : kind === 'stage' ? STAGE_BY_ID.get(id)?.price : undefined;
  return price ?? Infinity;
}

const order = (a: LedgerEntry, b: LedgerEntry) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

export function economyOf(data: HabitsData, today: LocalDate): Economy {
  const eco: Economy = {
    points: 0,
    gold: 0,
    upgrades: {},
    unlocked: new Set(),
    runs: [],
    openRun: null,
    granted: data.profile ? Math.max(0, daysBetween(data.profile.startedOn, today) + 1) : 0,
    available: 0,
    nextLevel: 1,
    totalPointsEarned: 0,
    totalGoldEarned: 0,
    bestTime: 0,
    rejected: new Set(),
  };
  const byLevel = new Map<number, RunRecord>();
  const reject = (e: LedgerEntry) => eco.rejected.add(e.id);

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
        if ((eco.upgrades[upgrade] ?? 0) !== level - 1 || cost > eco.points || cost <= 0) reject(e);
        else {
          eco.points -= cost;
          eco.upgrades[upgrade] = level;
        }
        break;
      }

      case 'unlock': {
        const key = e.id.slice('unlock:'.length);
        const cost = -e.gold;
        if (eco.unlocked.has(key) || cost > eco.gold || cost < 0) reject(e);
        else {
          eco.gold -= cost;
          eco.unlocked.add(key);
        }
        break;
      }

      case 'run_start': {
        const level = Number(e.id.slice('run:'.length));
        if (level !== byLevel.size + 1) {
          reject(e);
          break;
        }
        const run: RunRecord = {
          level,
          character: String(e.details?.character ?? 'wanderer'),
          stage: String(e.details?.stage ?? 'withered_woods'),
          startedAt: e.createdAt,
          result: null,
        };
        byLevel.set(level, run);
        eco.runs.push(run);
        break;
      }

      case 'run_result': {
        const run = byLevel.get(Number(e.id.slice('result:'.length)));
        if (!run || run.result || e.gold < 0) {
          reject(e);
          break;
        }
        const d = e.details ?? {};
        run.result = { gold: e.gold, time: Number(d.time ?? 0), kills: Number(d.kills ?? 0), won: d.won === true, xpLevel: Number(d.xpLevel ?? 0) };
        eco.gold += e.gold;
        eco.totalGoldEarned += e.gold;
        eco.bestTime = Math.max(eco.bestTime, run.result.time);
        break;
      }
    }
  }

  eco.openRun = eco.runs.find((r) => r.result === null) ?? null;
  eco.available = Math.max(0, eco.granted - eco.runs.length);
  eco.nextLevel = eco.runs.length + 1;
  return eco;
}

export const isUnlocked = (eco: Economy, key: string) => isFree(key) || eco.unlocked.has(key);

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
  const cost = def.cost(level);
  if (cost > eco.points) throw new EconomyError('No tienes puntos suficientes.');
  return append(data, entry(upgradeId(upgrade, level), 'upgrade', now, { points: -cost }));
}

/** Desbloquea un personaje o escenario (`character:<id>` / `stage:<id>`) con oro. */
export function unlock(data: HabitsData, key: string, today: LocalDate, now: Timestamp): HabitsData {
  const eco = economyOf(data, today);
  if (isUnlocked(eco, key)) return data;
  const price = priceOf(key);
  if (!Number.isFinite(price)) throw new EconomyError('Contenido desconocido.');
  if (price > eco.gold) throw new EconomyError('No tienes oro suficiente.');
  return append(data, entry(unlockId(key), 'unlock', now, { gold: -price }));
}

/** Empieza la siguiente partida (consume una partida disponible). Devuelve su nivel. */
export function startRun(data: HabitsData, character: string, stage: string, today: LocalDate, now: Timestamp): { data: HabitsData; level: number } {
  const eco = economyOf(data, today);
  if (eco.openRun) throw new EconomyError('Ya hay una partida en curso.');
  if (eco.available <= 0) throw new EconomyError('No te quedan partidas: mañana a las 00:00 recibirás otra.');
  if (!isUnlocked(eco, `character:${character}`) || !isUnlocked(eco, `stage:${stage}`)) throw new EconomyError('Ese contenido aún está bloqueado.');
  const level = eco.nextLevel;
  return { data: append(data, entry(runId(level), 'run_start', now, { details: { character, stage } })), level };
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

/** Registra el resultado de la partida en curso (una sola vez por nivel). */
export function finishRun(data: HabitsData, level: number, outcome: RunOutcome, now: Timestamp): HabitsData {
  if (data.ledger.some((e) => e.id === resultId(level))) return data;
  return append(
    data,
    entry(resultId(level), 'run_result', now, {
      gold: Math.max(0, Math.floor(outcome.gold)),
      details: { time: Math.round(outcome.time), kills: outcome.kills, won: outcome.won, xpLevel: outcome.xpLevel },
    }),
  );
}
