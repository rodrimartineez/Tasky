-- Tasky — esquema de Supabase (Fase 9). Ver TASKY_GUIDE.md §7.5–7.6.
-- Ejecutar una sola vez en el SQL Editor del proyecto. Es idempotente: se puede volver a ejecutar.
--
-- Seguridad:
--   · RLS en todas las tablas. Solo el rol `authenticated` tiene políticas; `anon` no ve ni escribe nada.
--   · Lista blanca: además de ser el dueño de la fila, el usuario debe estar en private.allowed_users.
--   · Sin DELETE: el borrado es lógico (deleted_at). Ni siquiera la cuenta autorizada puede destruir filas.
--   · Última escritura gana también en el servidor: una versión más antigua nunca pisa una más reciente.

-- ── Lista blanca (fuera del esquema público: la API no la expone) ──────────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.allowed_users (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table private.allowed_users enable row level security;
revoke all on private.allowed_users from public, anon, authenticated;

create or replace function private.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.allowed_users where user_id = (select auth.uid()));
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_allowed() to authenticated;

-- ── Orden de cambios del servidor (cursor de sincronización, independiente de los relojes) ────
create sequence if not exists public.tasky_change_seq;

-- ── Tablas (réplica de TaskyData, §6.1) ─────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) > 0),
  description text not null default '',
  status      text not null check (status in ('active', 'on_hold', 'upcoming', 'done')),
  rank        text,
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  deleted_at  timestamptz,
  server_seq  bigint not null default nextval('public.tasky_change_seq')
);

create table if not exists public.tasks (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id   uuid not null,
  title        text not null check (length(title) > 0),
  description  text not null default '',
  status       text not null check (status in ('todo', 'in_progress', 'done')),
  due_date     date,
  time_slot    text not null default 'all_day' check (time_slot in ('morning', 'afternoon', 'evening', 'all_day')),
  scheduled_days date[] not null default '{}',
  repeat_weekly  boolean not null default false,
  rank         text not null,
  completed_at timestamptz,
  created_at   timestamptz not null,
  updated_at   timestamptz not null,
  deleted_at   timestamptz,
  server_seq   bigint not null default nextval('public.tasky_change_seq')
);

create table if not exists public.ideas (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id  uuid not null,
  title       text not null check (length(title) > 0),
  description text not null default '',
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  deleted_at  timestamptz,
  server_seq  bigint not null default nextval('public.tasky_change_seq')
);

-- Columnas añadidas después de la Fase 9 (en bases ya creadas se añaden aquí):
-- orden manual de proyectos y franja horaria de tareas.
alter table public.projects add column if not exists rank text;
alter table public.tasks add column if not exists time_slot text not null default 'all_day'
  check (time_slot in ('morning', 'afternoon', 'evening', 'all_day'));
-- Programación de tareas (días y repetición semanal) y estado «Próximos» de proyectos.
alter table public.tasks add column if not exists scheduled_days date[] not null default '{}';
alter table public.tasks add column if not exists repeat_weekly boolean not null default false;
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check check (status in ('active', 'on_hold', 'upcoming', 'done'));

-- ── Trigger: última escritura gana + nuevo número de cambio en cada escritura ──────────────────
create or replace function public.tasky_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- Versión igual o más antigua que la guardada: se ignora (la fila no se modifica).
    if new.updated_at <= old.updated_at then
      return null;
    end if;
    new.user_id := old.user_id;  -- el dueño de una fila no cambia nunca
    new.created_at := old.created_at;
  end if;
  new.server_seq := nextval('public.tasky_change_seq');
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['projects', 'tasks', 'ideas'] loop
    execute format('drop trigger if exists tasky_before_write on public.%I', t);
    execute format('create trigger tasky_before_write before insert or update on public.%I
                    for each row execute function public.tasky_before_write()', t);
    execute format('create index if not exists %I on public.%I (user_id, server_seq)', t || '_user_seq_idx', t);

    -- RLS: solo el dueño de la fila y solo si está en la lista blanca.
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);

    execute format('drop policy if exists tasky_select on public.%I', t);
    execute format('drop policy if exists tasky_insert on public.%I', t);
    execute format('drop policy if exists tasky_update on public.%I', t);
    execute format('create policy tasky_select on public.%I for select to authenticated
                    using (user_id = (select auth.uid()) and (select private.is_allowed()))', t);
    execute format('create policy tasky_insert on public.%I for insert to authenticated
                    with check (user_id = (select auth.uid()) and (select private.is_allowed()))', t);
    execute format('create policy tasky_update on public.%I for update to authenticated
                    using (user_id = (select auth.uid()) and (select private.is_allowed()))
                    with check (user_id = (select auth.uid()) and (select private.is_allowed()))', t);
  end loop;
end;
$$;

grant usage on sequence public.tasky_change_seq to authenticated;
revoke all on sequence public.tasky_change_seq from anon;

-- ── Autorizar la cuenta (ejecutar después de crear el usuario en Authentication → Users) ────────
-- insert into private.allowed_users (user_id)
--   select id from auth.users where email = 'TU-EMAIL@ejemplo.com'
--   on conflict do nothing;

-- ── Realtime: avisos de cambios para que las apps descarguen al momento (también los de Claude por MCP) ──
-- Los avisos respetan RLS: cada cliente solo recibe los de sus propias filas, y solo si está en la lista blanca.
do $$
declare t text;
begin
  foreach t in array array['projects', 'tasks', 'ideas'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ══ Modo Hábitos (HABITS_GUIDE.md §4 y §6) ═════════════════════════════════════════════════════
-- Tablas independientes de las de Proyectos (el servidor MCP no las usa). Mismas reglas: RLS + lista blanca,
-- sin DELETE, cursor server_seq y avisos por Realtime.
--   · habit_profile y habits: última escritura gana (mismo trigger que projects/tasks/ideas).
--   · habit_logs y habit_ledger: inmutables. Solo INSERT (ni siquiera UPDATE): un asiento repetido
--     (mismo id determinista, p. ej. 'reward:<hábito>:<periodo>') se ignora, así nunca cuenta dos veces.

create table if not exists public.habit_profile (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  time_zone   text not null check (length(time_zone) > 0),
  started_on  date not null,
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  deleted_at  timestamptz,
  server_seq  bigint not null default nextval('public.tasky_change_seq')
);

create table if not exists public.habits (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) > 0),
  kind        text not null check (kind in ('build', 'reduce')),
  period      text not null check (period in ('daily', 'weekly')),
  unit        text not null default '',
  step        numeric not null check (step > 0),
  targets     jsonb not null,
  archived_at timestamptz,
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  deleted_at  timestamptz,
  server_seq  bigint not null default nextval('public.tasky_change_seq')
);

create table if not exists public.habit_logs (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id    uuid not null,
  period      text not null check (period ~ '^W?\d{4}-\d{2}-\d{2}$'),
  delta       numeric not null,
  created_at  timestamptz not null,
  server_seq  bigint not null default nextval('public.tasky_change_seq')
);

create table if not exists public.habit_ledger (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('habit_reward')),
  points      integer not null default 0,
  gold        integer not null default 0,
  habit_id    uuid,
  period      text,
  created_at  timestamptz not null,
  server_seq  bigint not null default nextval('public.tasky_change_seq')
);

do $$
declare t text;
begin
  foreach t in array array['habit_profile', 'habits', 'habit_logs', 'habit_ledger'] loop
    -- El trigger asigna server_seq en cada escritura (y en las tablas LWW ignora versiones antiguas).
    execute format('drop trigger if exists tasky_before_write on public.%I', t);
    execute format('create trigger tasky_before_write before insert or update on public.%I
                    for each row execute function public.tasky_before_write()', t);
    execute format('create index if not exists %I on public.%I (user_id, server_seq)', t || '_user_seq_idx', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists tasky_select on public.%I', t);
    execute format('drop policy if exists tasky_insert on public.%I', t);
    execute format('drop policy if exists tasky_update on public.%I', t);
    execute format('create policy tasky_select on public.%I for select to authenticated
                    using (user_id = (select auth.uid()) and (select private.is_allowed()))', t);
    execute format('create policy tasky_insert on public.%I for insert to authenticated
                    with check (user_id = (select auth.uid()) and (select private.is_allowed()))', t);

    if t in ('habit_profile', 'habits') then
      execute format('grant select, insert, update on public.%I to authenticated', t);
      execute format('create policy tasky_update on public.%I for update to authenticated
                      using (user_id = (select auth.uid()) and (select private.is_allowed()))
                      with check (user_id = (select auth.uid()) and (select private.is_allowed()))', t);
    else
      execute format('grant select, insert on public.%I to authenticated', t);
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
