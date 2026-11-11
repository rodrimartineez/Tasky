import { describe, expect, it } from 'vitest';
import { UPGRADE_BY_ID } from '../../game/content/upgrades';
import { emptyHabitsData } from './data';
import { buyUpgrade, economyOf, EconomyError, finishRun, isUnlocked, startRun, unlock } from './economy';
import { ensureProfile } from './habits';
import type { HabitsData, LedgerEntry } from './model';
import { mergeHabitsRemote, noHabitsRecords } from './sync';

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
const outcome = (gold: number) => ({ gold, time: 600, kills: 100, won: false, xpLevel: 10 });

describe('partidas diarias', () => {
  it('se recibe una partida al día y se acumulan', () => {
    expect(economyOf(base(), START).available).toBe(1);
    expect(economyOf(base(), '2026-11-13').available).toBe(4);
  });

  it('cada partida que se empieza es el nivel siguiente, con independencia de la fecha', () => {
    let d = base();
    const today = '2026-11-12'; // 3 partidas acumuladas
    for (let level = 1; level <= 3; level++) {
      const started = startRun(d, 'wanderer', 'withered_woods', today, T(level * 2));
      expect(started.level).toBe(level);
      d = finishRun(started.data, started.level, outcome(50), T(level * 2 + 1));
    }
    const eco = economyOf(d, today);
    expect([eco.available, eco.nextLevel, eco.gold]).toEqual([0, 4, 150]);
    expect(() => startRun(d, 'wanderer', 'withered_woods', today, T(9))).toThrow(EconomyError);
  });

  it('no se puede empezar otra con una en curso, ni guardar dos resultados de la misma', () => {
    const { data, level } = startRun(base(), 'wanderer', 'withered_woods', '2026-11-12', T(1));
    expect(() => startRun(data, 'wanderer', 'withered_woods', '2026-11-12', T(2))).toThrow(EconomyError);
    expect(economyOf(data, '2026-11-12').openRun?.level).toBe(1);
    const once = finishRun(data, level, outcome(80), T(3));
    const twice = finishRun(once, level, outcome(999), T(4));
    expect(economyOf(twice, '2026-11-12').gold).toBe(80);
  });

  it('dos dispositivos que juegan el mismo nivel sin conexión cuentan una sola partida y un solo resultado', () => {
    const a = startRun(base(), 'wanderer', 'withered_woods', START, T(1));
    const b = startRun(base(), 'wanderer', 'withered_woods', START, T(5));
    const doneA = finishRun(a.data, 1, outcome(100), T(2));
    const doneB = finishRun(b.data, 1, outcome(300), T(6));
    // El servidor se queda con lo que llegó primero (A); B lo recibe al sincronizar.
    const merged = mergeHabitsRemote(doneB, { ...noHabitsRecords(), ledger: doneA.ledger });
    const eco = economyOf(merged, START);
    expect([eco.runs.length, eco.gold, eco.nextLevel]).toEqual([1, 100, 2]);
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
    const eco = economyOf(d, START);
    expect([eco.upgrades.might, eco.points]).toEqual([2, 0]);
    expect(() => buyUpgrade(d, 'might', START, T(3))).toThrow(EconomyError);
  });

  it('ninguna mejora tiene nivel máximo y los costes siguen siendo finitos', () => {
    for (const u of UPGRADE_BY_ID.values()) {
      expect(Number.isFinite(u.cost(100))).toBe(true);
      expect(u.cost(100)).toBeGreaterThan(u.cost(99));
    }
  });

  it('compras que juntas no se pueden pagar: la segunda se ignora al sincronizar', () => {
    const cost = UPGRADE_BY_ID.get('might')!.cost(1);
    expect(UPGRADE_BY_ID.get('maxHp')!.cost(1)).toBe(cost);
    const funded = grant(base(), cost);
    const a = buyUpgrade(funded, 'might', START, T(1));
    const b = buyUpgrade(funded, 'maxHp', START, T(2));
    const merged = mergeHabitsRemote(a, { ...noHabitsRecords(), ledger: b.ledger });
    const eco = economyOf(merged, START);
    expect(eco.points).toBe(0);
    expect(eco.upgrades).toEqual({ might: 1 });
    expect(eco.rejected.size).toBe(1);
  });

  it('los personajes se desbloquean con oro y el inicial es gratis', () => {
    let d = base();
    expect(isUnlocked(economyOf(d, START), 'character:wanderer')).toBe(true);
    expect(() => unlock(d, 'character:warden', START, T(1))).toThrow(EconomyError);
    const run = startRun(d, 'wanderer', 'withered_woods', START, T(1));
    d = finishRun(run.data, 1, outcome(700), T(2));
    d = unlock(d, 'character:warden', START, T(3));
    const eco = economyOf(d, START);
    expect(isUnlocked(eco, 'character:warden')).toBe(true);
    expect(eco.gold).toBe(100);
    expect(() => startRun(d, 'mystic', 'withered_woods', '2026-11-11', T(4))).toThrow(EconomyError);
  });
});
