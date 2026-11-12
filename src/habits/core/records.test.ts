import { describe, expect, it } from 'vitest';
import { ARCANA } from '../../game/content/arcana';
import { buildRunConfig } from '../../game/content/run';
import { SKINS } from '../../game/content/skins';
import { runGold, runHp } from '../../game/sim/difficulty';
import { emptyHabitsData } from './data';
import { economyOf, EconomyError, finishRun, priceOf, startRun, unlock } from './economy';
import { ensureProfile } from './habits';
import type { HabitsData, LedgerEntry } from './model';
import { ACHIEVEMENTS, achieved, achievementsOf, recordsOf } from './records';
import type { GameRelease } from './release';

const PROD: GameRelease = { testMode: false, season: 1, startsOn: null };
const START = '2026-11-10';
const T = (n: number) => new Date(Date.UTC(2026, 10, 10, 10, 0, n)).toISOString();

const reward = (id: string, points: number, streak: number | null, gold = 0): LedgerEntry => ({
  id,
  kind: 'habit_reward',
  points,
  gold,
  habitId: null,
  period: START,
  details: streak === null ? null : { streak },
  createdAt: T(0),
  updatedAt: T(0),
  deletedAt: null,
});

/** Perfil con `n` recompensas diarias (racha creciente: 1…n), es decir, n intentos. */
function withRewards(n: number): HabitsData {
  const d = ensureProfile(emptyHabitsData(), 'Europe/Madrid', START);
  return { ...d, ledger: Array.from({ length: n }, (_, i) => reward(`reward:h:${i}`, 2, i + 1)) };
}

function play(
  d: HabitsData,
  at: number,
  result: { gold: number; time: number; kills: number; won: boolean; xpLevel: number },
  arcana: string | null = null,
) {
  const started = startRun(d, 'wanderer', 'withered_woods', 'normal', START, T(at), 0, PROD, arcana);
  return finishRun(started.data, started.attempt, result, T(at + 1), PROD);
}

describe('estadísticas y logros (Fase 10)', () => {
  it('suma partidas, récords y rachas desde el ledger', () => {
    let d = withRewards(8);
    d = play(d, 1, { gold: 100, time: 1800, kills: 900, won: true, xpLevel: 40 });
    d = play(d, 3, { gold: 50, time: 600, kills: 300, won: false, xpLevel: 20 });
    const r = recordsOf(economyOf(d, START, PROD), d);
    expect(r.totals).toMatchObject({
      runs: 2,
      wins: 1,
      kills: 1200,
      time: 2400,
      gold: 150,
      bestTime: 1800,
      bestKills: 900,
      bestXpLevel: 40,
    });
    expect(r.characters).toHaveLength(1);
    expect(r.characters[0]).toMatchObject({ id: 'wanderer', runs: 2, wins: 1 });
    expect(r.passedLevel).toBe(1);
    expect(r.habitsMet).toBe(8);
    expect(r.bestStreak).toBe(8);
    const done = achieved(r);
    expect(done.has('streak_7')).toBe(true);
    expect(done.has('streak_30')).toBe(false);
    expect(done.has('level_7')).toBe(false);
  });

  it('los logros tienen ids únicos y los aspectos de logro apuntan a logros que existen', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SKINS.filter((x) => x.achievement)) expect(ids).toContain(s.achievement);
    // Sin datos, ninguno está hecho y el progreso nunca pasa de la meta.
    const empty = recordsOf(economyOf(withRewards(0), START, PROD), withRewards(0));
    expect(achievementsOf(empty).every((a) => !a.done && a.value <= a.def.goal)).toBe(true);
  });

  it('los aspectos de logro no se compran con oro', () => {
    for (const s of SKINS) expect(priceOf(`skin:${s.id}`)).toBe(s.achievement ? Infinity : s.price);
  });
});

describe('arcanos (Fase 10)', () => {
  it('nunca facilitan la partida y siempre pagan más oro', () => {
    const base = buildRunConfig(10, 'wanderer', 'withered_woods', {});
    for (const a of ARCANA) {
      const config = buildRunConfig(10, 'wanderer', 'withered_woods', {}, { arcana: a.id });
      expect(config.arcana).toBe(a.id);
      expect(runHp(config)).toBeGreaterThanOrEqual(runHp(base));
      expect(runGold(config)).toBeGreaterThan(runGold(base));
    }
  });

  it('hay que desbloquearlos con oro y quedan registrados en la partida', () => {
    const d = withRewards(3);
    expect(() => startRun(d, 'wanderer', 'withered_woods', 'normal', START, T(1), 0, PROD, 'blood')).toThrow(EconomyError);
    const rich = { ...d, ledger: [...d.ledger, reward('reward:gold', 0, null)] };
    // Oro de una partida para pagar el arcano.
    let e = play(rich, 1, { gold: 25_000, time: 600, kills: 10, won: false, xpLevel: 5 });
    e = unlock(e, 'arcana:blood', START, T(3), PROD);
    e = play(e, 5, { gold: 10, time: 60, kills: 1, won: false, xpLevel: 1 }, 'blood');
    const eco = economyOf(e, START, PROD);
    expect(eco.gold).toBe(25_000 - 20_000 + 10);
    expect(eco.runs.at(-1)?.arcana).toBe('blood');
  });
});
