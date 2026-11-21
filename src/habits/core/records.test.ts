import { describe, expect, it } from 'vitest';
import { ARCANA } from '../../game/content/arcana';
import { buildRunConfig } from '../../game/content/run';
import { SKINS } from '../../game/content/skins';
import { emptyHabitsData } from './data';
import { economyOf, EconomyError, finishRun, priceOf, startRun } from './economy';
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
  arcana: string[] = [],
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

describe('arcanas y darkanas', () => {
  it('cada carta tiene su propio logro de hábitos, y los de juego no desbloquean cartas', () => {
    const achievements = ARCANA.map((a) => a.achievement);
    expect(new Set(achievements).size).toBe(ARCANA.length);
    for (const id of achievements) expect(ACHIEVEMENTS.find((a) => a.id === id)?.group, id).toBe('habits');
  });

  it('se configuran en la partida (hasta dos) y no se compran', () => {
    for (const a of ARCANA) {
      expect(buildRunConfig(10, 'wanderer', 'withered_woods', {}, { arcana: [a.id] }).arcana).toEqual([a.id]);
      expect(priceOf(`arcana:${a.id}`)).toBe(Infinity);
    }
    const config = buildRunConfig(10, 'wanderer', 'withered_woods', {}, { arcana: ['chaos', 'tragic', 'waltz'] });
    expect(config.arcana).toEqual(['chaos', 'tragic']);
  });

  it('solo se pueden llevar si se ha cumplido su logro y quedan registradas en la partida', () => {
    const d = withRewards(8); // racha de 8: logro «Racha de 7» (Caos en la noche oscura)
    expect(() => startRun(d, 'wanderer', 'withered_woods', 'normal', START, T(1), 0, PROD, ['waltz'])).toThrow(EconomyError);
    expect(() => startRun(d, 'wanderer', 'withered_woods', 'normal', START, T(1), 0, PROD, ['chaos', 'chaos'])).toThrow(EconomyError);
    const e = play(d, 1, { gold: 10, time: 60, kills: 1, won: false, xpLevel: 1 }, ['chaos']);
    expect(economyOf(e, START, PROD).runs.at(-1)?.arcana).toEqual(['chaos']);
  });
});
