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
  status      text not null check (status in ('active', 'on_hold', 'done')),
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
