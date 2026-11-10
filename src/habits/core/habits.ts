import type { LocalDate, Timestamp } from '../../core/model';
import { PROFILE_ID, type Habit, type HabitKind, type HabitPeriod, type HabitsData, type LedgerEntry } from './model';
import { dateInZone, isClosed, periodKey, periodStart, periodsBetween, previousPeriod, type PeriodKey } from './periods';

/** Puntos por periodo cumplido (HABITS_GUIDE §3.4): sin parciales. */
export const REWARD_POINTS: Record<HabitPeriod, number> = { daily: 1, weekly: 3 };

/** Evita restos de coma flotante al sumar pasos como 0,25. */
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export const live = (h: Habit) => h.deletedAt === null;
export const active = (h: Habit) => h.deletedAt === null && h.archivedAt === null;

// ── Perfil ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Marca de un perfil creado automáticamente: más antigua que cualquier cambio real, así un dispositivo nuevo
 * nunca pisa (última escritura gana) el perfil que ya existe en el servidor.
 */
const DEFAULT_PROFILE_STAMP = '2000-01-01T00:00:00.000Z';

/** Crea el perfil la primera vez (zona horaria del dispositivo, día de inicio). No cambia uno existente. */
export function ensureProfile(data: HabitsData, timeZone: string, today: LocalDate): HabitsData {
  if (data.profile) return data;
  const stamp = DEFAULT_PROFILE_STAMP;
  return { ...data, profile: { id: PROFILE_ID, timeZone, startedOn: today, createdAt: stamp, updatedAt: stamp, deletedAt: null } };
}

// ── Hábitos ─────────────────────────────────────────────────────────────────────────────────────

export interface HabitInput {
  name: string;
  kind: HabitKind;
  period: HabitPeriod;
  unit: string;
  step: number;
  target: number;
}

/** Al editar no se cambian el tipo ni la periodicidad (cambiarían el significado del historial). */
export type HabitPatch = Partial<Pick<HabitInput, 'name' | 'unit' | 'step' | 'target'>>;

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

function validNumber(n: number, what: string) {
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${what} debe ser un número mayor que cero.`);
  return round(n);
}

export function createHabit(data: HabitsData, input: HabitInput, id: string, now: Timestamp, today: LocalDate): HabitsData {
  const name = clean(input.name);
  if (!name) throw new Error('El hábito necesita un nombre.');
  const habit: Habit = {
    id,
    name,
    kind: input.kind,
    period: input.period,
    unit: clean(input.unit),
    step: validNumber(input.step, 'El incremento'),
    targets: [{ since: periodStart(periodKey(input.period, today)), value: validNumber(input.target, 'El objetivo') }],
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  return { ...data, habits: [...data.habits, habit] };
}

function changeHabit(data: HabitsData, id: string, change: (h: Habit) => Habit): HabitsData {
  let changed = false;
  const habits = data.habits.map((h) => {
    if (h.id !== id || !live(h)) return h;
    const next = change(h);
    if (next !== h) changed = true;
    return next;
  });
  return changed ? { ...data, habits } : data;
}

export function updateHabit(data: HabitsData, id: string, patch: HabitPatch, now: Timestamp, today: LocalDate): HabitsData {
  return changeHabit(data, id, (h) => {
    const name = patch.name === undefined ? h.name : clean(patch.name);
    if (!name) throw new Error('El hábito necesita un nombre.');
    const unit = patch.unit === undefined ? h.unit : clean(patch.unit);
    const step = patch.step === undefined ? h.step : validNumber(patch.step, 'El incremento');
    let targets = h.targets;
    if (patch.target !== undefined) {
      const value = validNumber(patch.target, 'El objetivo');
      // El nuevo objetivo vale desde el periodo actual; los periodos anteriores conservan el suyo.
      const since = periodStart(periodKey(h.period, today));
      const last = targets[targets.length - 1];
      if (last.value !== value) {
        targets = last.since >= since ? [...targets.slice(0, -1), { since: last.since, value }] : [...targets, { since, value }];
      }
    }
    if (name === h.name && unit === h.unit && step === h.step && targets === h.targets) return h;
    return { ...h, name, unit, step, targets, updatedAt: now };
  });
}

export const archiveHabit = (data: HabitsData, id: string, archived: boolean, now: Timestamp) =>
  changeHabit(data, id, (h) => ((h.archivedAt !== null) === archived ? h : { ...h, archivedAt: archived ? now : null, updatedAt: now }));

/** Borrado lógico. Las recompensas ya ganadas se conservan. */
export const deleteHabit = (data: HabitsData, id: string, now: Timestamp) =>
  changeHabit(data, id, (h) => ({ ...h, deletedAt: now, updatedAt: now }));

// ── Registro de actividad ───────────────────────────────────────────────────────────────────────

/** Cantidad registrada por hábito y periodo. */
export type Amounts = Map<string, number>;
const amountKey = (habitId: string, key: PeriodKey) => `${habitId}|${key}`;

export function amountsOf(data: HabitsData): Amounts {
  const amounts: Amounts = new Map();
  for (const log of data.logs) {
    const k = amountKey(log.habitId, log.period);
    amounts.set(k, round((amounts.get(k) ?? 0) + log.delta));
  }
  return amounts;
}

export const amountIn = (amounts: Amounts, habitId: string, key: PeriodKey) => Math.max(0, amounts.get(amountKey(habitId, key)) ?? 0);

/**
 * Registra actividad en el periodo actual (solo se puede registrar en el periodo en curso).
 * `direction` −1 deshace un paso, sin bajar nunca de cero.
 */
export function logHabit(
  data: HabitsData,
  habitId: string,
  direction: 1 | -1,
  id: string,
  now: Timestamp,
  today: LocalDate,
): HabitsData {
  const habit = data.habits.find((h) => h.id === habitId);
  if (!habit || !active(habit)) return data;
  const key = periodKey(habit.period, today);
  const current = amountIn(amountsOf(data), habitId, key);
  const delta = direction === 1 ? habit.step : -Math.min(habit.step, current);
  if (delta === 0) return data;
  return { ...data, logs: [...data.logs, { id, habitId, period: key, delta, createdAt: now, updatedAt: now, deletedAt: null }] };
}

// ── Cumplimiento ────────────────────────────────────────────────────────────────────────────────

/** Objetivo (o límite) vigente en un periodo. */
export function targetFor(habit: Habit, key: PeriodKey): number {
  const start = periodStart(key);
  let value = habit.targets[0].value;
  for (const t of habit.targets) if (t.since <= start) value = t.value;
  return value;
}

/** Positivo: llegar al objetivo. Reducción: no pasar del límite (llegar justo al límite cuenta como cumplido). */
export const isMet = (kind: HabitKind, amount: number, target: number) => (kind === 'build' ? amount >= target : amount <= target);

/** Primer periodo del hábito y último en el que cuenta (null = sigue activo). */
function lifespan(habit: Habit, timeZone: string): { first: PeriodKey; lastDay: LocalDate | null } {
  const first = periodKey(habit.period, dateInZone(new Date(habit.createdAt), timeZone));
  // Archivado o borrado: el periodo en el que ocurrió ya no cuenta (se dejó a medias).
  const end = habit.deletedAt ?? habit.archivedAt;
  return { first, lastDay: end ? dateInZone(new Date(end), timeZone) : null };
}

/** Periodos cerrados en los que el hábito existía completo, del más antiguo al más reciente. */
function closedPeriods(habit: Habit, timeZone: string, today: LocalDate): PeriodKey[] {
  const { first, lastDay } = lifespan(habit, timeZone);
  const last = previousPeriod(periodKey(habit.period, lastDay && lastDay < today ? lastDay : today));
  return periodsBetween(first, last).filter((k) => isClosed(k, today));
}

export const rewardId = (habitId: string, key: PeriodKey) => `reward:${habitId}:${key}`;

/**
 * Cierre de periodos: concede las recompensas de todos los periodos cerrados y cumplidos que aún no la tienen.
 * Es determinista y se puede ejecutar en cualquier momento y dispositivo (al abrir la app, a medianoche…):
 * el id de cada recompensa es fijo, así que nunca se concede dos veces. Una recompensa concedida es definitiva.
 */
export function evaluateRewards(data: HabitsData, today: LocalDate, now: Timestamp): HabitsData {
  if (!data.profile) return data;
  const { timeZone } = data.profile;
  const granted = new Set(data.ledger.map((e) => e.id));
  const amounts = amountsOf(data);
  const rewards: LedgerEntry[] = [];
  for (const habit of data.habits) {
    // También los archivados o borrados: sus periodos anteriores a ese momento siguen contando.
    for (const key of closedPeriods(habit, timeZone, today)) {
      const id = rewardId(habit.id, key);
      if (granted.has(id) || !isMet(habit.kind, amountIn(amounts, habit.id, key), targetFor(habit, key))) continue;
      rewards.push({
        id,
        kind: 'habit_reward',
        points: REWARD_POINTS[habit.period],
        gold: 0,
        habitId: habit.id,
        period: key,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
  }
  return rewards.length === 0 ? data : { ...data, ledger: [...data.ledger, ...rewards] };
}

export const pointsBalance = (data: HabitsData) => data.ledger.reduce((sum, e) => sum + e.points, 0);

// ── Rachas e historial ──────────────────────────────────────────────────────────────────────────

export interface PeriodResult {
  key: PeriodKey;
  amount: number;
  target: number;
  met: boolean;
  /** false = periodo en curso (aún puede cambiar). */
  closed: boolean;
}

/** Historial completo del hábito, del periodo más antiguo al actual. */
export function history(habit: Habit, amounts: Amounts, timeZone: string, today: LocalDate): PeriodResult[] {
  const { first, lastDay } = lifespan(habit, timeZone);
  const last = periodKey(habit.period, lastDay && lastDay < today ? lastDay : today);
  return periodsBetween(first, last).map((key) => {
    const amount = amountIn(amounts, habit.id, key);
    const target = targetFor(habit, key);
    return { key, amount, target, met: isMet(habit.kind, amount, target), closed: isClosed(key, today) };
  });
}

/**
 * Racha actual: periodos cumplidos seguidos hasta hoy. El periodo en curso suma si ya está cumplido
 * (en reducción solo cuenta al cerrarse, porque aún puede pasarse) y nunca la rompe mientras sigue abierto.
 */
export function streaks(results: PeriodResult[], kind: HabitKind): { current: number; best: number } {
  let best = 0;
  let run = 0;
  for (const r of results) {
    const counts = r.met && (r.closed || kind === 'build');
    if (counts) run += 1;
    else if (r.closed) run = 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}
