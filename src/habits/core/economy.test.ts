import { describe, expect, it } from 'vitest';
import { CHARACTER_BY_ID } from '../../game/content/characters';
import { UPGRADE_BY_ID } from '../../game/content/upgrades';
import { emptyHabitsData } from './data';
import type { RunMode } from '../../game/sim/types';
import { buyUpgrade, economyOf, EconomyError, finishRun, isUnlocked, startRun, unlock } from './economy';
import { createHabit, ensureProfile, evaluateRewards, logHabit } from './habits';
import type { HabitsData, LedgerEntry } from './model';
import { GAME_BUILD, GAME_RELEASE, releaseFor, type GameRelease } from './release';
import { mergeHabitsRemote, noHabitsRecords } from './sync';

/** Las reglas de producción (el modo de pruebas tiene sus propios tests). */
const PROD: GameRelease = { testMode: false, season: 1, startsOn: null };

const T = (n: number) => new Date(Date.UTC(2026, 10, 10, 10, 0, n)).toISOString();
const START = '2026-11-10';

const base = () => ensureProfile(emptyHabitsData(), 'Europe/Madrid', START);
const grant = (data: HabitsData, points: number): HabitsData => {
  const reward: LedgerEntry = {
    id: `reward:test:${data.ledger.length}`,
    kind: 'habit_reward',
    points,
    gold: 0,
    habitId: null,
    period: null,
    details: null,
    createdAt: T(0),
    updatedAt: T(0),
    deletedAt: null,
  };
  return { ...data, ledger: [...data.ledger, reward] };
};
const grantEntry = (id: string): LedgerEntry => ({
  id,
  kind: 'habit_reward',
  points: 0,
  gold: 0,
  habitId: null,
  period: null,
  details: null,
  createdAt: T(0),
  updatedAt: T(0),
  deletedAt: null,
});
const outcome = (gold: number) => ({ gold, time: 600, kills: 100, won: false, xpLevel: 10 });

/** `n` intentos ganados: recompensas de hábitos diarios ya cerradas (1 intento cada una). */
const attempts = (data: HabitsData, n: number, period = START): HabitsData => ({
  ...data,
  ledger: [
    ...data.ledger,
    ...Array.from({ length: n }, (_, i) => ({ ...grantEntry(`reward:a${data.ledger.length + i}:${period}`), period })),
  ],
});
const won = (gold: number) => ({ ...outcome(gold), won: true, time: 1800 });
const play = (d: HabitsData, result: ReturnType<typeof outcome>, mode: RunMode = 'normal', at = 1) => {
  const started = startRun(d, 'wanderer', 'withered_woods', mode, START, T(at), 0, PROD);
  return { ...started, data: finishRun(started.data, started.attempt, result, T(at + 1), PROD) };
};

describe('intentos', () => {
  it('sin hábitos cumplidos no hay intentos, y no llegan por pasar los días', () => {
    expect(economyOf(base(), START, PROD).available).toBe(0);
    expect(economyOf(base(), '2026-12-31', PROD).available).toBe(0);
    expect(() => startRun(base(), 'wanderer', 'withered_woods', 'normal', START, T(1), 0, PROD)).toThrow(EconomyError);
  });

  it('los hábitos diarios conceden el intento al cerrar el día', () => {
    let d = createHabit(base(), { name: 'Leer', kind: 'build', period: 'daily', unit: '', step: 1, target: 1 }, 'read', T(0), START);
    d = createHabit(d, { name: 'Azúcar', kind: 'reduce', period: 'daily', unit: '', step: 1, target: 1 }, 'sugar', T(0), START);
    expect(economyOf(d, START, PROD).available).toBe(0);
    d = logHabit(d, 'read', 1, 'l1', T(1), START);
    expect(economyOf(d, START, PROD).available).toBe(0);
    // Al cerrar el día se conceden las recompensas y ambos hábitos suman su intento.
    const next = evaluateRewards(d, '2026-11-11', T(2));
    expect(economyOf(next, '2026-11-11', PROD).available).toBe(2);
  });

  it('cada porción añadida a un hábito semanal da un intento al cerrar el día', () => {
    let d = createHabit(base(), { name: 'Ejercicio', kind: 'build', period: 'weekly', unit: 'veces', step: 1, target: 3 }, 'exercise', T(0), START);
    expect(economyOf(d, START, PROD).available).toBe(0);
    d = logHabit(d, 'exercise', 1, 'l1', T(1), START);
    expect(economyOf(d, START, PROD).available).toBe(0);
    const nextDay = '2026-11-11';
    expect(economyOf(d, nextDay, PROD).available).toBe(1);
    d = logHabit(d, 'exercise', 1, 'l2', '2026-11-11T10:00:00.000Z', nextDay);
    expect(economyOf(d, nextDay, PROD).available).toBe(1);
  });

  it('el cierre semanal conserva los puntos, pero no concede intentos adicionales', () => {
    let d = createHabit(base(), { name: 'Ejercicio', kind: 'build', period: 'weekly', unit: 'veces', step: 1, target: 1 }, 'exercise', T(0), START);
    d = logHabit(d, 'exercise', 1, 'l1', T(1), START);
    const next = evaluateRewards(d, '2026-11-16', T(2));
    const eco = economyOf(next, '2026-11-16', PROD);
    expect(eco.available).toBe(1);
    expect(eco.points).toBe(3);
  });

  it('un hábito semanal de reducir da el intento al cerrar la semana si se cumple', () => {
    const weeklyStart = '2026-11-09';
    let d = ensureProfile({ ...base(), profile: null }, 'UTC', weeklyStart);
    d = createHabit(d, { name: 'Azúcar', kind: 'reduce', period: 'weekly', unit: 'veces', step: 1, target: 1 }, 'sugar', T(0), weeklyStart);
    d = logHabit(d, 'sugar', 1, 'l1', T(1), weeklyStart);
    expect(economyOf(d, weeklyStart, PROD).available).toBe(0);
    const next = evaluateRewards(d, '2026-11-16', T(2));
    const eco = economyOf(next, '2026-11-16', PROD);
    expect(eco.available).toBe(1);
    expect(eco.points).toBe(3);
  });

  it('los intentos no caducan: se acumulan y cada partida gasta uno, gane o pierda', () => {
    let d = attempts(base(), 3);
    expect(economyOf(d, '2027-06-01', PROD).available).toBe(3);
    d = play(d, outcome(10)).data;
    d = play(d, outcome(10), 'normal', 3).data;
    const eco = economyOf(d, '2027-06-01', PROD);
    expect([eco.available, eco.attemptsUsed, eco.gold]).toEqual([1, 2, 20]);
  });
});

describe('niveles', () => {
  it('morir antes del minuto 30 no sube de nivel (pero el oro se queda); superarlo sí', () => {
    let d = attempts(base(), 3);
    d = play(d, outcome(40)).data;
    expect([economyOf(d, START, PROD).nextLevel, economyOf(d, START, PROD).gold]).toEqual([1, 40]);
    const second = play(d, won(60), 'normal', 3);
    expect(second.level).toBe(1);
    const eco = economyOf(second.data, START, PROD);
    expect([eco.nextLevel, eco.passedLevel, eco.gold, eco.available]).toEqual([2, 1, 100, 1]);
  });

  it('el infinito supera el nivel al llegar al 30 y el reflejo no; se desbloquean al superar los niveles 30 y 60', () => {
    let d = attempts(base(), 62);
    expect(() => startRun(d, 'wanderer', 'withered_woods', 'infinite', START, T(1), 0, PROD)).toThrow(EconomyError);
    for (let i = 1; i <= 19; i++) d = play(d, won(0), 'normal', i * 2).data;
    expect(economyOf(d, START, PROD).unlocks).toEqual({ infinite: false, mirror: false });
    d = play(d, won(0), 'normal', 40).data;
    for (let i = 21; i <= 30; i++) d = play(d, won(0), 'normal', i * 2).data;
    expect(economyOf(d, START, PROD).unlocks).toEqual({ infinite: true, mirror: false });
    // El infinito sí supera el nivel al llegar al minuto 30; el reflejo, no.
    d = play(d, won(500), 'infinite', 70).data;
    expect(economyOf(d, START, PROD).nextLevel).toBe(32);
    expect(() => startRun(d, 'wanderer', 'withered_woods', 'mirror', START, T(80), 0, PROD)).toThrow(EconomyError);
  });

  it('no se puede empezar otra con una en curso, ni guardar dos resultados de la misma', () => {
    const { data, attempt } = startRun(attempts(base(), 2), 'wanderer', 'withered_woods', 'normal', START, T(1), 0, PROD);
    expect(() => startRun(data, 'wanderer', 'withered_woods', 'normal', START, T(2), 0, PROD)).toThrow(EconomyError);
    expect(economyOf(data, START, PROD).openRun?.attempt).toBe(1);
    const once = finishRun(data, attempt, outcome(80), T(3), PROD);
    const twice = finishRun(once, attempt, outcome(999), T(4), PROD);
    expect(economyOf(twice, START, PROD).gold).toBe(80);
  });

  it('dos dispositivos que juegan el mismo intento sin conexión cuentan una sola partida y un solo resultado', () => {
    const funded = attempts(base(), 2);
    const a = startRun(funded, 'wanderer', 'withered_woods', 'normal', START, T(1), 0, PROD);
    const b = startRun(funded, 'wanderer', 'withered_woods', 'normal', START, T(5), 0, PROD);
    const doneA = finishRun(a.data, 1, won(100), T(2), PROD);
    const doneB = finishRun(b.data, 1, outcome(300), T(6), PROD);
    // El servidor se queda con lo que llegó primero (A); B lo recibe al sincronizar.
    const merged = mergeHabitsRemote(doneB, { ...noHabitsRecords(), ledger: doneA.ledger });
    const eco = economyOf(merged, START, PROD);
    expect([eco.runs.length, eco.gold, eco.nextLevel, eco.available]).toEqual([1, 100, 2, 1]);
  });
});

describe('mejoras y desbloqueos', () => {
  it('las mejoras cuestan cada vez más y gastan puntos', () => {
    const might = UPGRADE_BY_ID.get('might')!;
    const [cost1, cost2] = [might.cost(1), might.cost(2)];
    expect(cost2).toBeGreaterThan(cost1);
    let d = grant(base(), cost1 + cost2);
    d = buyUpgrade(d, 'might', START, T(1));
    d = buyUpgrade(d, 'might', START, T(2));
    const eco = economyOf(d, START, PROD);
    expect([eco.upgrades.might, eco.points]).toEqual([2, 0]);
    expect(() => buyUpgrade(d, 'might', START, T(3))).toThrow(EconomyError);
  });

  it('las mejoras de combate no tienen nivel máximo y los costes siguen siendo finitos', () => {
    for (const u of UPGRADE_BY_ID.values()) {
      if (u.maxLevel) continue;
      expect(Number.isFinite(u.cost(100))).toBe(true);
      expect(u.cost(100)).toBeGreaterThan(u.cost(99));
    }
  });

  it('Constancia cuesta 21 / 75 / 200 / 450 y no pasa del nivel 4', () => {
    const bounty = UPGRADE_BY_ID.get('bounty')!;
    expect([1, 2, 3, 4].map((n) => bounty.cost(n))).toEqual([21, 75, 200, 450]);
    let d = grant(base(), 21 + 75 + 200 + 450 + 1000);
    for (let i = 1; i <= 4; i++) d = buyUpgrade(d, 'bounty', START, T(i));
    expect(economyOf(d, START, PROD).upgrades.bounty).toBe(4);
    expect(() => buyUpgrade(d, 'bounty', START, T(5))).toThrow(EconomyError);
    expect(economyOf(d, START, PROD).points).toBe(1000);
  });

  it('compras que juntas no se pueden pagar: la segunda se ignora al sincronizar', () => {
    const cost = UPGRADE_BY_ID.get('might')!.cost(1);
    expect(UPGRADE_BY_ID.get('maxHp')!.cost(1)).toBe(cost);
    const funded = grant(base(), cost);
    const a = buyUpgrade(funded, 'might', START, T(1));
    const b = buyUpgrade(funded, 'maxHp', START, T(2));
    const merged = mergeHabitsRemote(a, { ...noHabitsRecords(), ledger: b.ledger });
    const eco = economyOf(merged, START, PROD);
    expect(eco.points).toBe(0);
    expect(eco.upgrades).toEqual({ might: 1 });
    expect(eco.rejected.size).toBe(1);
  });

  it('los personajes se desbloquean con oro y el inicial es gratis', () => {
    let d = attempts(base(), 2);
    expect(isUnlocked(economyOf(d, START, PROD), 'character:wanderer')).toBe(true);
    expect(() => unlock(d, 'character:warden', START, T(1), PROD)).toThrow(EconomyError);
    const run = startRun(d, 'wanderer', 'withered_woods', 'normal', START, T(1), 0, PROD);
    d = finishRun(run.data, 1, outcome(700), T(2), PROD);
    d = unlock(d, 'character:warden', START, T(3), PROD);
    const eco = economyOf(d, START, PROD);
    expect(isUnlocked(eco, 'character:warden')).toBe(true);
    expect(eco.gold).toBe(700 - CHARACTER_BY_ID.get('warden')!.price);
    expect(() => startRun(d, 'mystic', 'withered_woods', 'normal', '2026-11-11', T(4), 0, PROD)).toThrow(EconomyError);
  });
});

describe('modo de pruebas y temporadas', () => {
  const TEST: GameRelease = { testMode: true, season: 1, startsOn: null };

  it('en pruebas: partidas ilimitadas de nivel 1, todo disponible y nada se registra', () => {
    const eco = economyOf(base(), START, TEST);
    expect([eco.available, eco.nextLevel]).toEqual([Infinity, 1]);
    expect(isUnlocked(eco, 'character:warden') && isUnlocked(eco, 'stage:ash_wastes')).toBe(true);
    expect(() => startRun(base(), 'wanderer', 'withered_woods', 'normal', START, T(1), 0, TEST)).toThrow(EconomyError);
    expect(finishRun(base(), 1, outcome(500), T(2), TEST).ledger).toHaveLength(0);
  });

  it('las mejoras con puntos de hábitos funcionan igual en pruebas y en producción', () => {
    const d = buyUpgrade(grant(base(), 100), 'might', START, T(1));
    expect(economyOf(d, START, TEST).upgrades).toEqual(economyOf(d, START, PROD).upgrades);
  });

  it('al pasar a producción se ignoran partidas, oro y desbloqueos de otra temporada, pero no los puntos', () => {
    let d = attempts(grant(base(), 50), 2);
    const run = startRun(d, 'wanderer', 'withered_woods', 'normal', START, T(1), 0, PROD);
    d = finishRun(run.data, 1, outcome(900), T(2), PROD);
    d = unlock(d, 'character:warden', START, T(3), PROD);
    const next: GameRelease = { testMode: false, season: 2, startsOn: '2026-12-01' };
    const eco = economyOf(d, '2026-12-03', next);
    // Los intentos ganados antes de la temporada tampoco cuentan.
    expect([eco.runs.length, eco.gold, eco.nextLevel, eco.available, eco.points, eco.legacy]).toEqual([0, 0, 1, 0, 50, 3]);
    expect(isUnlocked(eco, 'character:warden')).toBe(false);
  });

  it('alternar entre pruebas y progresión normal no crea, duplica ni pierde nada', () => {
    let d = attempts(grant(base(), 40), 3);
    d = buyUpgrade(d, 'might', START, T(1));
    const run = startRun(d, 'wanderer', 'withered_woods', 'normal', START, T(2), 0, PROD);
    d = finishRun(run.data, 1, outcome(5_000), T(3), PROD);
    d = unlock(d, 'character:warden', START, T(4), PROD);
    const before = d.ledger.length;
    const real = economyOf(d, '2026-11-12', PROD);

    // En pruebas: todo disponible y nada de lo que se haga se guarda…
    const test = economyOf(d, '2026-11-12', TEST);
    expect(test.points).toBe(real.points);
    expect(test.upgrades).toEqual(real.upgrades);
    expect(unlock(d, 'character:mystic', START, T(5), TEST).ledger).toHaveLength(before);
    expect(finishRun(d, 2, outcome(9_999), T(6), TEST).ledger).toHaveLength(before);

    // …y al volver, la progresión real sigue exactamente donde estaba.
    const back = economyOf(d, '2026-11-12', PROD);
    expect([back.gold, back.runs.length, back.nextLevel, back.available, back.points]).toEqual([
      real.gold,
      real.runs.length,
      real.nextLevel,
      real.available,
      real.points,
    ]);
    expect(isUnlocked(back, 'character:warden')).toBe(true);
    expect(isUnlocked(back, 'character:mystic')).toBe(false);
    expect([...back.unlocked]).toEqual([...real.unlocked]);
  });

  it('releaseFor: la progresión normal es la de la temporada de la versión y el núcleo usa la normal por defecto', () => {
    expect(releaseFor(false)).toEqual({ ...GAME_RELEASE, testMode: false });
    expect(releaseFor(true).testMode).toBe(GAME_BUILD.devTools);
    expect(GAME_RELEASE.testMode).toBe(false);
  });

  it('los asientos anteriores a las temporadas (run:1, result:1) se ignoran', () => {
    const old: LedgerEntry = { ...grantEntry('run:1'), kind: 'run_start' };
    const eco = economyOf({ ...base(), ledger: [old] }, START, PROD);
    expect([eco.runs.length, eco.legacy]).toEqual([0, 1]);
  });
});
