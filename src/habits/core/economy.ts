import type { LocalDate, Timestamp } from '../../core/model';
import { CHARACTER_BY_ID } from '../../game/content/characters';
import { STAGE_BY_ID } from '../../game/content/stages';
import { UPGRADE_BY_ID } from '../../game/content/upgrades';
import type { HabitsData, LedgerEntry } from './model';
import { daysBetween } from './periods';
import { GAME_RELEASE, type GameRelease } from './release';

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
  /** Modo de pruebas (release.ts): partidas ilimitadas de nivel 1, todo disponible y nada se guarda. */
  testMode: boolean;
  /** Asientos de partidas, resultados y desbloqueos de otra temporada (se ignoran). */
  legacy: number;
}

const upgradeId = (upgrade: string, level: number) => `upgrade:${upgrade}:${level}`;
/** Los ids del juego llevan la temporada: `run:s1:5`, `result:s1:5`, `unlock:s1:character:warden`. */
const seasonTag = (release: GameRelease) => `s${release.season}`;
const unlockId = (key: string, release: GameRelease) => `unlock:${seasonTag(release)}:${key}`;
const runId = (level: number, release: GameRelease) => `run:${seasonTag(release)}:${level}`;
const resultId = (level: number, release: GameRelease) => `result:${seasonTag(release)}:${level}`;

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

export function priceOf(key: string): number {
  const [kind, id] = key.split(':');
  const price = kind === 'character' ? CHARACTER_BY_ID.get(id)?.price : kind === 'stage' ? STAGE_BY_ID.get(id)?.price : undefined;
  return price ?? Infinity;
}

const order = (a: LedgerEntry, b: LedgerEntry) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

export function economyOf(data: HabitsData, today: LocalDate, release: GameRelease = GAME_RELEASE): Economy {
  const firstDay = data.profile && release.startsOn && release.startsOn > data.profile.startedOn ? release.startsOn : data.profile?.startedOn;
  const eco: Economy = {
    points: 0,
    gold: 0,
    upgrades: {},
    unlocked: new Set(),
    runs: [],
    openRun: null,
    granted: firstDay ? Math.max(0, daysBetween(firstDay, today) + 1) : 0,
    available: 0,
    nextLevel: 1,
    totalPointsEarned: 0,
    totalGoldEarned: 0,
    bestTime: 0,
    rejected: new Set(),
    testMode: release.testMode,
    legacy: 0,
  };
  const byLevel = new Map<number, RunRecord>();
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
        if ((eco.upgrades[upgrade] ?? 0) !== level - 1 || cost > eco.points || cost <= 0) reject(e);
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
        const level = Number(rest);
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
        const rest = own(e);
        if (rest === null) break;
        const run = byLevel.get(Number(rest));
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
  if (release.testMode) {
    eco.available = Infinity;
    eco.nextLevel = 1;
    eco.openRun = null;
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
  const cost = def.cost(level);
  if (cost > eco.points) throw new EconomyError('No tienes puntos suficientes.');
  return append(data, entry(upgradeId(upgrade, level), 'upgrade', now, { points: -cost }));
}

/** Desbloquea un personaje o escenario (`character:<id>` / `stage:<id>`) con oro. */
export function unlock(data: HabitsData, key: string, today: LocalDate, now: Timestamp, release: GameRelease = GAME_RELEASE): HabitsData {
  const eco = economyOf(data, today, release);
  if (isUnlocked(eco, key)) return data;
  const price = priceOf(key);
  if (!Number.isFinite(price)) throw new EconomyError('Contenido desconocido.');
  if (price > eco.gold) throw new EconomyError('No tienes oro suficiente.');
  return append(data, entry(unlockId(key, release), 'unlock', now, { gold: -price }));
}

/** Empieza la siguiente partida (consume una partida disponible). Devuelve su nivel. */
export function startRun(
  data: HabitsData,
  character: string,
  stage: string,
  today: LocalDate,
  now: Timestamp,
  /** Ayuda de vuelta aplicada (0 = ninguna), para el historial. */
  comeback = 0,
  release: GameRelease = GAME_RELEASE,
): { data: HabitsData; level: number } {
  // Las partidas de prueba no se guardan: no pasan por aquí.
  if (release.testMode) throw new EconomyError('En el modo de pruebas las partidas no se registran.');
  const eco = economyOf(data, today, release);
  if (eco.openRun) throw new EconomyError('Ya hay una partida en curso.');
  if (eco.available <= 0) throw new EconomyError('No te quedan partidas: mañana a las 00:00 recibirás otra.');
  if (!isUnlocked(eco, `character:${character}`) || !isUnlocked(eco, `stage:${stage}`)) throw new EconomyError('Ese contenido aún está bloqueado.');
  const level = eco.nextLevel;
  const details: Record<string, string | number> = { character, stage };
  if (comeback > 0) details.comeback = Math.round(comeback * 100) / 100;
  return { data: append(data, entry(runId(level, release), 'run_start', now, { details })), level };
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
export function finishRun(data: HabitsData, level: number, outcome: RunOutcome, now: Timestamp, release: GameRelease = GAME_RELEASE): HabitsData {
  if (release.testMode || data.ledger.some((e) => e.id === resultId(level, release))) return data;
  return append(
    data,
    entry(resultId(level, release), 'run_result', now, {
      gold: Math.max(0, Math.floor(outcome.gold)),
      details: { time: Math.round(outcome.time), kills: outcome.kills, won: outcome.won, xpLevel: outcome.xpLevel },
    }),
  );
}
