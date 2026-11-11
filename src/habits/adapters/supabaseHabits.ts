import type { SupabaseLike } from '../../adapters/supabaseRows';
import { fail } from '../../adapters/supabaseRows';
import { habitLogSchema, habitSchema, habitsProfileSchema, ledgerEntrySchema, PROFILE_ID } from '../core/model';
import type { HabitsSyncBackend } from '../core/ports';
import { HABITS_TABLES, noHabitsRecords, type HabitsRecords, type HabitsTable } from '../core/sync';

/** Tablas de Supabase del modo Hábitos (supabase/schema.sql, sección «Modo Hábitos»). */
const TABLE: Record<HabitsTable, string> = {
  profile: 'habit_profile',
  habits: 'habits',
  logs: 'habit_logs',
  ledger: 'habit_ledger',
};
/** Registros y asientos son inmutables: en el servidor solo se insertan (los repetidos se ignoran). */
const IMMUTABLE = new Set<HabitsTable>(['logs', 'ledger']);
const PAGE = 1000;
const BATCH = 500;

type Row = Record<string, unknown> & { server_seq: number };

const ts = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string).toISOString());

const fromRow: { [K in HabitsTable]: (r: Row) => HabitsRecords[K][number] } = {
  profile: (r) =>
    habitsProfileSchema.parse({
      id: PROFILE_ID,
      timeZone: r.time_zone,
      startedOn: r.started_on,
      character: r.character ?? 'wanderer',
      stage: r.stage ?? 'withered_woods',
      createdAt: ts(r.created_at),
      updatedAt: ts(r.updated_at),
      deletedAt: null,
    }),
  habits: (r) =>
    habitSchema.parse({
      id: r.id,
      name: r.name,
      kind: r.kind,
      period: r.period,
      unit: r.unit,
      step: Number(r.step),
      targets: r.targets,
      archivedAt: ts(r.archived_at),
      createdAt: ts(r.created_at),
      updatedAt: ts(r.updated_at),
      deletedAt: ts(r.deleted_at),
    }),
  logs: (r) =>
    habitLogSchema.parse({
      id: r.id,
      habitId: r.habit_id,
      period: r.period,
      delta: Number(r.delta),
      createdAt: ts(r.created_at),
      updatedAt: ts(r.created_at),
      deletedAt: null,
    }),
  ledger: (r) =>
    ledgerEntrySchema.parse({
      id: r.id,
      kind: r.kind,
      points: Number(r.points),
      gold: Number(r.gold),
      habitId: r.habit_id ?? null,
      period: r.period ?? null,
      details: r.details ?? null,
      createdAt: ts(r.created_at),
      updatedAt: ts(r.created_at),
      deletedAt: null,
    }),
};

const toRow: { [K in HabitsTable]: (r: HabitsRecords[K][number]) => Record<string, unknown> } = {
  profile: (p) => ({ time_zone: p.timeZone, started_on: p.startedOn, character: p.character, stage: p.stage, created_at: p.createdAt, updated_at: p.updatedAt }),
  habits: (h) => ({
    id: h.id,
    name: h.name,
    kind: h.kind,
    period: h.period,
    unit: h.unit,
    step: h.step,
    targets: h.targets,
    archived_at: h.archivedAt,
    created_at: h.createdAt,
    updated_at: h.updatedAt,
    deleted_at: h.deletedAt,
  }),
  logs: (l) => ({ id: l.id, habit_id: l.habitId, period: l.period, delta: l.delta, created_at: l.createdAt }),
  ledger: (e) => ({
    id: e.id,
    kind: e.kind,
    points: e.points,
    gold: e.gold,
    habit_id: e.habitId,
    period: e.period,
    details: e.details,
    created_at: e.createdAt,
  }),
};

/** La clave del perfil en el servidor es el usuario (un perfil por cuenta). */
const keyColumn = (table: HabitsTable) => (table === 'profile' ? 'user_id' : 'id');

function collect<K extends HabitsTable>(table: K, rows: Row[], into: HabitsRecords) {
  for (const row of rows) {
    try {
      (into[table] as unknown[]).push(fromRow[table](row));
    } catch (e) {
      console.error(`Fila de ${TABLE[table]} no válida, se ignora`, e);
    }
  }
}

export function createSupabaseHabits(client: SupabaseLike): HabitsSyncBackend {
  return {
    onRemoteChange(listener) {
      const channel = client.channel('tasky-habits-changes');
      for (const table of HABITS_TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table: TABLE[table] }, () => listener());
      channel.subscribe();
      return () => void client.removeChannel(channel);
    },

    async pull(since) {
      const records = noHabitsRecords();
      let cursor = since;
      for (const table of HABITS_TABLES) {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await client
            .from(TABLE[table])
            .select('*')
            .gt('server_seq', since)
            .order('server_seq')
            .range(from, from + PAGE - 1);
          if (error) fail(error);
          const rows = (data ?? []) as Row[];
          collect(table, rows, records);
          for (const r of rows) cursor = Math.max(cursor, Number(r.server_seq));
          if (rows.length < PAGE) break;
        }
      }
      return { records, cursor };
    },

    async push(records) {
      const fromServer = noHabitsRecords();
      for (const table of HABITS_TABLES) {
        const list = records[table] as never[];
        for (let i = 0; i < list.length; i += BATCH) {
          const batch = list.slice(i, i + BATCH);
          const rows = batch.map((r) => toRow[table](r));
          const key = keyColumn(table);
          // LWW: el trigger ignora (y no devuelve) las filas más antiguas que las del servidor.
          // Inmutables: los ids que ya existían no se insertan ni se devuelven.
          const { data, error } = await client
            .from(TABLE[table])
            .upsert(rows, { onConflict: key, ignoreDuplicates: IMMUTABLE.has(table) })
            .select(key);
          if (error) fail(error);
          if ((data ?? []).length === rows.length) continue;
          if (table === 'profile') {
            const fetched = await client.from(TABLE.profile).select('*');
            if (fetched.error) fail(fetched.error);
            collect('profile', (fetched.data ?? []) as Row[], fromServer);
            continue;
          }
          const accepted = new Set((data ?? []).map((r) => (r as Record<string, string>)[key]));
          const rejected = rows.map((r) => r.id as string).filter((id) => !accepted.has(id));
          const fetched = await client.from(TABLE[table]).select('*').in('id', rejected);
          if (fetched.error) fail(fetched.error);
          collect(table, (fetched.data ?? []) as Row[], fromServer);
        }
      }
      return fromServer;
    },
  };
}
