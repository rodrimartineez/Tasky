import { describe, expect, it } from 'vitest';
import { COMEBACK, comebackFor } from './comeback';
import { emptyHabitsData } from './data';
import type { RunRecord } from './economy';
import { createHabit, ensureProfile, logHabit } from './habits';
import type { HabitsData } from './model';

const TZ = 'Europe/Madrid';
const START = '2026-11-01';
const day = (n: number) => new Date(Date.UTC(2026, 10, n)).toISOString().slice(0, 10);

let seq = 0;
function withDays(days: number[]): HabitsData {
  let d = ensureProfile(emptyHabitsData(), TZ, START);
  d = createHabit(d, { name: 'Leer', kind: 'build', period: 'daily', unit: '', step: 1, target: 1 }, 'h1', `${START}T08:00:00.000Z`, START);
  for (const n of days) d = logHabit(d, 'h1', 1, `l${++seq}`, `${day(n)}T10:00:00.000Z`, day(n));
  return d;
}
const run = (n: number): RunRecord => ({ level: n, character: 'wanderer', stage: 'withered_woods', startedAt: `${day(n)}T18:00:00.000Z`, result: null });

describe('ayuda de vuelta', () => {
  const back = withDays([1, 2, 3, 4, 5, 26]); // 20 días sin hábitos (6–25) y vuelve el 26

  it('no hay ayuda mientras la pausa sigue, ni con pausas cortas', () => {
    expect(comebackFor(withDays([1, 2, 3]), day(25), [])).toBeNull();
    expect(comebackFor(withDays([1, 2, 3, 14]), day(14), [])).toBeNull(); // 10 días
  });

  it('al volver tras 14 días o más, la ayuda depende de la duración de la pausa', () => {
    const c = comebackFor(back, day(26), [])!;
    expect([c.returnedOn, c.breakDays, c.runsLeft]).toEqual([day(26), 20, 5]);
    expect(c.strength).toBeCloseTo(0.4 + 0.6 * (6 / 46));
    expect(c.xp).toBeLessThan(COMEBACK.xp);
    const long = comebackFor(withDays([1, 80]), day(80), [])!;
    expect([long.strength, long.xp, long.hp]).toEqual([1, COMEBACK.xp, COMEBACK.hp]);
  });

  it('se retira partida a partida y acaba tras 5 partidas o 7 días', () => {
    const full = comebackFor(back, day(26), [])!.strength;
    const afterTwo = comebackFor(back, day(27), [run(1), run(26), run(27)])!; // la del día 1 no cuenta
    expect(afterTwo.runsLeft).toBe(3);
    expect(afterTwo.strength).toBeCloseTo(full * 0.6);
    expect(comebackFor(back, day(28), [26, 26, 27, 27, 28].map(run))).toBeNull();
    expect(comebackFor(back, day(33), [])).toBeNull();
    expect(comebackFor(back, day(32), [])).not.toBeNull();
  });
});
