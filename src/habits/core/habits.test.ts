import { describe, expect, it } from 'vitest';
import { emptyHabitsData, parseHabitsData } from './data';
import {
  amountIn,
  amountsOf,
  archiveHabit,
  createHabit,
  ensureProfile,
  evaluateRewards,
  history,
  logHabit,
  outlook,
  streaks,
  targetFor,
  updateHabit,
  type HabitInput,
} from './habits';
import type { HabitsData } from './model';
import { dateInZone, periodKey, periodsBetween } from './periods';
import { mergeHabitsRemote, noHabitsRecords, pendingHabitsChanges, rememberHabitsVersions } from './sync';

const pointsBalance = (d: HabitsData) => d.ledger.reduce((sum, e) => sum + e.points, 0);

const TZ = 'Europe/Madrid';
const T0 = '2026-11-02T08:00:00.000Z'; // lunes 2 de noviembre, 09:00 en Madrid

const read: HabitInput = { name: 'Leer', kind: 'build', period: 'daily', unit: 'min', step: 10, target: 30 };
const face: HabitInput = { name: 'Tocarse la cara', kind: 'reduce', period: 'daily', unit: 'veces', step: 1, target: 10 };
const gym: HabitInput = { name: 'Ejercicio', kind: 'build', period: 'weekly', unit: 'veces', step: 1, target: 3 };

let seq = 0;
const id = () => `id-${++seq}`;

function setup(...inputs: HabitInput[]): { data: HabitsData; ids: string[] } {
  let data = ensureProfile(emptyHabitsData(), TZ, '2026-11-02');
  const ids: string[] = [];
  for (const input of inputs) {
    const habitId = id();
    ids.push(habitId);
    data = createHabit(data, input, habitId, T0, '2026-11-02');
  }
  return { data, ids };
}

const log = (data: HabitsData, habitId: string, day: string, times = 1, direction: 1 | -1 = 1) => {
  for (let i = 0; i < times; i++) data = logHabit(data, habitId, direction, id(), `${day}T10:00:00.000Z`, day);
  return data;
};

describe('periodos', () => {
  it('agrupa las semanas de lunes a domingo', () => {
    expect(periodKey('weekly', '2026-11-08')).toBe('W2026-11-02'); // domingo
    expect(periodKey('weekly', '2026-11-09')).toBe('W2026-11-09'); // lunes
    expect(periodKey('weekly', '2027-01-01')).toBe('W2026-12-28'); // cruza el año
  });

  it('respeta la zona horaria y los cambios de hora', () => {
    // 25 de octubre de 2026: cambio de hora en Madrid (día de 25 h).
    expect(dateInZone(new Date('2026-10-25T22:59:59.000Z'), TZ)).toBe('2026-10-25');
    expect(dateInZone(new Date('2026-10-25T23:00:00.000Z'), TZ)).toBe('2026-10-26');
    // 29 de marzo de 2026: día de 23 h.
    expect(dateInZone(new Date('2026-03-29T21:59:59.000Z'), TZ)).toBe('2026-03-29');
    expect(dateInZone(new Date('2026-03-29T22:00:00.000Z'), TZ)).toBe('2026-03-30');
    expect(periodsBetween('2026-03-28', '2026-03-31')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
  });
});

describe('registro', () => {
  it('suma pasos y deshace sin bajar de cero', () => {
    const { data, ids } = setup(read);
    let d = log(data, ids[0], '2026-11-02', 2);
    expect(amountIn(amountsOf(d), ids[0], '2026-11-02')).toBe(20);
    d = log(d, ids[0], '2026-11-02', 5, -1);
    expect(amountIn(amountsOf(d), ids[0], '2026-11-02')).toBe(0);
    expect(d.logs.reduce((s, l) => s + l.delta, 0)).toBe(0);
  });

  it('suma decimales sin errores de coma flotante', () => {
    const { data, ids } = setup({ ...read, step: 0.1, target: 0.3 });
    const d = log(data, ids[0], '2026-11-02', 3);
    expect(amountIn(amountsOf(d), ids[0], '2026-11-02')).toBe(0.3);
  });

  it('no registra en hábitos archivados', () => {
    const { data, ids } = setup(read);
    const archived = archiveHabit(data, ids[0], true, T0);
    expect(log(archived, ids[0], '2026-11-02').logs).toHaveLength(0);
  });
});

describe('recompensas', () => {
  it('concede 1 punto por diario cumplido y solo al cerrar el día', () => {
    const { data, ids } = setup(read);
    const d = log(data, ids[0], '2026-11-02', 3);
    expect(pointsBalance(evaluateRewards(d, '2026-11-02', T0))).toBe(0); // el día sigue abierto
    expect(pointsBalance(evaluateRewards(d, '2026-11-03', T0))).toBe(1);
  });

  it('no concede nada si no se cumple el objetivo', () => {
    const { data, ids } = setup(read);
    const d = log(data, ids[0], '2026-11-02', 2);
    expect(pointsBalance(evaluateRewards(d, '2026-11-03', T0))).toBe(0);
  });

  it('es idempotente: evaluar varias veces no duplica', () => {
    const { data, ids } = setup(read);
    let d = log(data, ids[0], '2026-11-02', 3);
    d = evaluateRewards(d, '2026-11-03', T0);
    d = evaluateRewards(d, '2026-11-03', T0);
    d = evaluateRewards(d, '2026-11-05', T0);
    expect(d.ledger).toHaveLength(1);
  });

  it('recupera los días en los que no se abrió la app', () => {
    const { data, ids } = setup(read);
    let d = data;
    for (const day of ['2026-11-02', '2026-11-03', '2026-11-05']) d = log(d, ids[0], day, 3);
    expect(pointsBalance(evaluateRewards(d, '2026-11-10', T0))).toBe(3);
  });

  it('hábito de reducción: cumple sin pasarse del límite (llegar justo al límite cuenta)', () => {
    const { data, ids } = setup(face);
    let d = log(data, ids[0], '2026-11-02', 10); // justo el límite
    d = log(d, ids[0], '2026-11-03', 11); // se pasa
    // 4 de noviembre: sin registros → cumplido.
    d = evaluateRewards(d, '2026-11-05', T0);
    expect(d.ledger.map((e) => e.period)).toEqual(['2026-11-02', '2026-11-04']);
  });

  it('semanal: 3 puntos al terminar el domingo, sin parciales', () => {
    const { data, ids } = setup(gym, { ...gym, name: 'Caminar', target: 4 });
    let d = log(data, ids[0], '2026-11-03', 2);
    d = log(d, ids[0], '2026-11-08', 1); // domingo
    d = log(d, ids[1], '2026-11-04', 3); // 3 de 4: nada
    expect(pointsBalance(evaluateRewards(d, '2026-11-08', T0))).toBe(0);
    const closed = evaluateRewards(d, '2026-11-09', T0);
    expect(pointsBalance(closed)).toBe(3);
    expect(closed.ledger[0].id).toBe(`reward:${ids[0]}:W2026-11-02`);
  });

  it('el domingo se cierran a la vez los diarios del domingo y la semana', () => {
    const { data, ids } = setup(read, gym);
    let d = log(data, ids[0], '2026-11-08', 3);
    d = log(d, ids[1], '2026-11-08', 3);
    expect(pointsBalance(evaluateRewards(d, '2026-11-09', T0))).toBe(4);
  });

  it('cambiar el objetivo no reescribe el pasado', () => {
    const { data, ids } = setup(read);
    let d = log(data, ids[0], '2026-11-02', 1); // 10 de 30
    d = updateHabit(d, ids[0], { target: 10 }, '2026-11-03T08:00:00.000Z', '2026-11-03');
    d = log(d, ids[0], '2026-11-03', 1); // 10 de 10
    const habit = d.habits[0];
    expect(targetFor(habit, '2026-11-02')).toBe(30);
    expect(targetFor(habit, '2026-11-03')).toBe(10);
    expect(evaluateRewards(d, '2026-11-04', T0).ledger.map((e) => e.period)).toEqual(['2026-11-03']);
  });

  it('el periodo en que se archiva ya no cuenta, los anteriores sí', () => {
    const { data, ids } = setup(face);
    const d = archiveHabit(data, ids[0], true, '2026-11-04T10:00:00.000Z');
    expect(evaluateRewards(d, '2026-11-10', T0).ledger.map((e) => e.period)).toEqual(['2026-11-02', '2026-11-03']);
  });

  it('dos dispositivos que evalúan lo mismo producen un único asiento al sincronizar', () => {
    const { data, ids } = setup(read);
    const base = log(data, ids[0], '2026-11-02', 3);
    const deviceA = evaluateRewards(base, '2026-11-03', '2026-11-03T07:00:00.000Z');
    const deviceB = evaluateRewards(base, '2026-11-03', '2026-11-03T09:00:00.000Z');
    const records = { ...noHabitsRecords(), ledger: deviceB.ledger };
    const merged = mergeHabitsRemote(deviceA, records);
    expect(merged.ledger).toHaveLength(1);
    expect(pointsBalance(merged)).toBe(1);
  });

  it('registros simultáneos en dos dispositivos se suman', () => {
    const { data, ids } = setup(read);
    const a = log(data, ids[0], '2026-11-02', 2);
    const b = log(data, ids[0], '2026-11-02', 1);
    const merged = mergeHabitsRemote(a, { ...noHabitsRecords(), logs: b.logs });
    expect(amountIn(amountsOf(merged), ids[0], '2026-11-02')).toBe(30);
  });
});

describe('puntos por racha', () => {
  it('un hábito diario da más puntos al pasar los hitos de racha', () => {
    const { data, ids } = setup(read);
    let d = data;
    for (let i = 0; i < 8; i++) d = log(d, ids[0], `2026-11-${String(2 + i).padStart(2, '0')}`, 3);
    d = evaluateRewards(d, '2026-11-10', T0);
    // Días 1–2: 1 punto · días 3–6: 2 (hito de 3) · días 7–8: 3 (hito de 7).
    expect(d.ledger.map((e) => e.points)).toEqual([1, 1, 2, 2, 2, 2, 3, 3]);
    expect(d.ledger[7].details).toEqual({ streak: 8 });
  });

  it('romper la racha vuelve a 1 punto; los semanales siguen dando 3', () => {
    const { data, ids } = setup(read, gym);
    let d = data;
    for (const day of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-06']) d = log(d, ids[0], day, 3);
    d = log(d, ids[1], '2026-11-03', 3);
    d = evaluateRewards(d, '2026-11-09', T0);
    const daily = d.ledger.filter((e) => e.habitId === ids[0]).map((e) => e.points);
    expect(daily).toEqual([1, 1, 2, 1]);
    expect(d.ledger.find((e) => e.habitId === ids[1])?.points).toBe(3);
  });
});

describe('escudo de racha, semanales y límite de diarios (Fase 5b)', () => {
  const days = (from: number, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 10, from + i)).toISOString().slice(0, 10));

  it('21 días cumplidos dan un escudo que salva un día fallado (sin puntos ese día)', () => {
    const { data, ids } = setup(read);
    let d = data;
    const met = [...days(2, 21), ...days(24, 3)]; // falla el 23
    for (const day of met) d = log(d, ids[0], day, 3);
    d = evaluateRewards(d, '2026-11-27', T0);
    const byDay = new Map(d.ledger.map((e) => [e.period, e]));
    expect(byDay.has('2026-11-23')).toBe(false);
    // La racha sigue: el día 24 es el 22.º cumplido.
    expect(byDay.get('2026-11-24')?.details).toEqual({ streak: 22 });
    const results = history(d.habits[0], amountsOf(d), TZ, '2026-11-27');
    expect(results.find((r) => r.key === '2026-11-23')?.shielded).toBe(true);
    expect(streaks(results, 'build', true)).toMatchObject({ current: 24, shield: false, charge: 3 });
  });

  it('sin escudo (menos de 21 días) un fallo rompe la racha, y el escudo se gasta una sola vez', () => {
    const { data, ids } = setup(read);
    let d = data;
    for (const day of [...days(2, 21), ...days(25, 2)]) d = log(d, ids[0], day, 3); // falla 23 y 24
    d = evaluateRewards(d, '2026-11-27', T0);
    expect(d.ledger.find((e) => e.period === '2026-11-25')?.details).toEqual({ streak: 1 });
  });

  it('los semanales suman +1 cada 4 semanas seguidas, hasta 6 puntos', () => {
    const { data, ids } = setup(gym);
    let d = data;
    // 17 semanas seguidas desde el lunes 2 de noviembre.
    for (let w = 0; w < 17; w++) d = log(d, ids[0], new Date(Date.UTC(2026, 10, 2 + 7 * w)).toISOString().slice(0, 10), 3);
    d = evaluateRewards(d, '2027-03-01', T0);
    const points = d.ledger.map((e) => e.points);
    expect(points.slice(0, 5)).toEqual([3, 3, 3, 4, 4]);
    expect(points[16]).toBe(6);
    expect(Math.max(...points)).toBe(6);
  });

  it('a partir del 8.º hábito diario, los más nuevos dan la mitad', () => {
    const inputs = Array.from({ length: 9 }, (_, i) => ({ ...read, name: `Hábito ${i}` }));
    const { data, ids } = setup(...inputs);
    let d = data;
    for (const id of ids) for (const day of days(2, 3)) d = log(d, id, day, 3);
    d = evaluateRewards(d, '2026-11-05', T0);
    const third = (id: string) => d.ledger.find((e) => e.habitId === id && e.period === '2026-11-04')?.points;
    expect(ids.map(third)).toEqual([2, 2, 2, 2, 2, 2, 2, 1, 1]);
  });

  it('muestra lo que dará cada hábito hoy', () => {
    const { data, ids } = setup(read, gym);
    let d = log(data, ids[0], '2026-11-02', 3);
    d = log(d, ids[0], '2026-11-03', 3);
    d = log(d, ids[0], '2026-11-04', 1); // hoy, aún sin cumplir
    const o = outlook(d, '2026-11-04');
    expect(o.perHabit.get(ids[0])).toBe(2); // tercer día seguido: hito de 3
    expect(o.perHabit.get(ids[1])).toBe(3);
    expect([o.secured, o.pending]).toEqual([0, 5]);
    expect(outlook(log(d, ids[0], '2026-11-04', 2), '2026-11-04').secured).toBe(2);
  });
});

describe('rachas', () => {
  it('cuenta la racha actual y la mejor', () => {
    const { data, ids } = setup(read);
    let d = data;
    for (const day of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-06', '2026-11-07']) d = log(d, ids[0], day, 3);
    const results = history(d.habits[0], amountsOf(d), TZ, '2026-11-08');
    // Hoy (8) aún sin registrar: no rompe la racha.
    expect(streaks(results, 'build')).toMatchObject({ current: 2, best: 3 });
    const withToday = log(d, ids[0], '2026-11-08', 3);
    expect(streaks(history(withToday.habits[0], amountsOf(withToday), TZ, '2026-11-08'), 'build').current).toBe(3);
  });

  it('en reducción el día en curso solo cuenta al cerrarse', () => {
    const { data } = setup(face);
    const results = history(data.habits[0], amountsOf(data), TZ, '2026-11-04');
    expect(streaks(results, 'reduce')).toMatchObject({ current: 2, best: 2 });
  });
});

describe('datos y sincronización', () => {
  it('valida y conserva el documento', () => {
    const { data, ids } = setup(read);
    const d = evaluateRewards(log(data, ids[0], '2026-11-02', 3), '2026-11-03', T0);
    expect(parseHabitsData(JSON.parse(JSON.stringify(d)), T0)).toEqual(d);
    expect(() => parseHabitsData({ schemaVersion: 99 }, T0)).toThrow();
  });

  it('detecta lo pendiente de enviar', () => {
    const { data, ids } = setup(read);
    const d = log(data, ids[0], '2026-11-02');
    const versions = new Map<string, string>();
    const pending = pendingHabitsChanges(d, versions);
    expect([pending.profile.length, pending.habits.length, pending.logs.length]).toEqual([1, 1, 1]);
    rememberHabitsVersions(versions, pending);
    const after = pendingHabitsChanges(d, versions);
    expect(after.habits.length + after.logs.length + after.profile.length).toBe(0);
  });
});
