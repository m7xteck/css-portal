-- ============================================================
--  CSS Portal — release 1 schema
--  Accounts (profiles linked to Supabase Auth), sites, rota
--  patterns, one-off shifts and an admin audit log.
--
--  Access model
--    * admin  — can read every profile and shift, and edit rotas.
--    * staff  — can read only their own profile and their own shifts.
--    * Profiles are created only by the server using the service
--      role key (never from the browser), so nobody can self-assign
--      the admin role.
-- ============================================================

create extension if not exists citext with schema extensions;

-- ------------------------------------------------------------
--  Types
-- ------------------------------------------------------------
create type public.app_role as enum ('admin', 'staff');

-- ------------------------------------------------------------
--  Sites (clinical sites / PCNs staff are rostered to)
-- ------------------------------------------------------------
create table public.sites (
  id          bigint generated always as identity primary key,
  site_key    text not null unique check (site_key ~ '^[a-z0-9-]{1,40}$'),
  name        text not null unique check (length(name) between 1 and 120),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
--  Profiles (one per Supabase Auth user)
-- ------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        extensions.citext not null unique,
  full_name    text not null check (length(full_name) between 1 and 120),
  role         public.app_role not null default 'staff',
  job_title    text check (job_title is null or length(job_title) <= 80),
  site_id      bigint references public.sites (id) on delete set null,
  active       boolean not null default true,
  invited_by   uuid references public.profiles (id) on delete set null,
  invited_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Staff accounts must use an NHSmail address.
  constraint staff_must_use_nhs_net
    check (role <> 'staff' or email::text ~* '^[a-z0-9._%+''-]+@nhs\.net$')
);

-- ------------------------------------------------------------
--  Recurring weekly shifts
-- ------------------------------------------------------------
create table public.rota_patterns (
  id          bigint generated always as identity primary key,
  staff_id    uuid not null references public.profiles (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 5),   -- 1=Mon .. 5=Fri
  site_id     bigint not null references public.sites (id) on delete restrict,
  start_time  time not null,
  end_time    time not null,
  lunch_mins  smallint not null default 0 check (lunch_mins between 0 and 240),
  note        text check (note is null or length(note) <= 200),
  start_date  date not null default current_date,
  end_date    date,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint rota_patterns_times check (end_time > start_time),
  constraint rota_patterns_dates check (end_date is null or end_date >= start_date)
);
create index rota_patterns_staff_idx on public.rota_patterns (staff_id);

-- ------------------------------------------------------------
--  One-off / overtime shifts
-- ------------------------------------------------------------
create table public.one_off_shifts (
  id          bigint generated always as identity primary key,
  staff_id    uuid not null references public.profiles (id) on delete cascade,
  shift_date  date not null,
  site_id     bigint not null references public.sites (id) on delete restrict,
  start_time  time not null,
  end_time    time not null,
  lunch_mins  smallint not null default 0 check (lunch_mins between 0 and 240),
  note        text check (note is null or length(note) <= 200),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint one_off_shifts_times check (end_time > start_time)
);
create index one_off_shifts_staff_date_idx on public.one_off_shifts (staff_id, shift_date);

-- ------------------------------------------------------------
--  Audit log (written by the server with the service role)
-- ------------------------------------------------------------
create table public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null,
  resource     text not null,
  resource_id  text,
  details      jsonb,
  created_at   timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- ------------------------------------------------------------
--  updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch       before update on public.profiles       for each row execute function public.touch_updated_at();
create trigger rota_patterns_touch  before update on public.rota_patterns  for each row execute function public.touch_updated_at();
create trigger one_off_shifts_touch before update on public.one_off_shifts for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
--  Role helper used by RLS policies.
--  SECURITY DEFINER so it can read profiles without recursing
--  through the profiles policies.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.active
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active
  );
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_active_user() to authenticated, service_role;

-- Shifts may only be assigned to active staff accounts.
create or replace function public.assert_shift_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.staff_id and p.role = 'staff' and p.active
  ) then
    raise exception 'Shifts can only be assigned to active staff accounts'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger rota_patterns_assignee  before insert or update of staff_id on public.rota_patterns  for each row execute function public.assert_shift_assignee();
create trigger one_off_shifts_assignee before insert or update of staff_id on public.one_off_shifts for each row execute function public.assert_shift_assignee();

-- ------------------------------------------------------------
--  Row level security
-- ------------------------------------------------------------
alter table public.sites          enable row level security;
alter table public.profiles       enable row level security;
alter table public.rota_patterns  enable row level security;
alter table public.one_off_shifts enable row level security;
alter table public.audit_log      enable row level security;

-- Lock down default grants: anon gets nothing; authenticated gets
-- only what each policy below allows.
revoke all on all tables in schema public from anon, authenticated;

grant select                         on public.sites          to authenticated;
grant select, update                 on public.profiles       to authenticated;
grant select, insert, update, delete on public.rota_patterns  to authenticated;
grant select, insert, update, delete on public.one_off_shifts to authenticated;
grant select                         on public.audit_log      to authenticated;

-- Sites: any active signed-in user can read; changes via SQL / service role only.
create policy sites_read on public.sites
  for select to authenticated
  using ((select public.is_active_user()));

-- Profiles: users read their own row; admins read all.
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_read_admin on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

-- Only admins may update profiles (staff cannot change their own role,
-- site or active flag). Inserts happen through the service role only.
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Rota patterns
create policy rota_patterns_read on public.rota_patterns
  for select to authenticated
  using (
    (staff_id = (select auth.uid()) and (select public.is_active_user()))
    or (select public.is_admin())
  );
create policy rota_patterns_insert_admin on public.rota_patterns
  for insert to authenticated with check ((select public.is_admin()));
create policy rota_patterns_update_admin on public.rota_patterns
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy rota_patterns_delete_admin on public.rota_patterns
  for delete to authenticated using ((select public.is_admin()));

-- One-off shifts
create policy one_off_shifts_read on public.one_off_shifts
  for select to authenticated
  using (
    (staff_id = (select auth.uid()) and (select public.is_active_user()))
    or (select public.is_admin())
  );
create policy one_off_shifts_insert_admin on public.one_off_shifts
  for insert to authenticated with check ((select public.is_admin()));
create policy one_off_shifts_update_admin on public.one_off_shifts
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy one_off_shifts_delete_admin on public.one_off_shifts
  for delete to authenticated using ((select public.is_admin()));

-- Audit log: admins can read; writes via service role only.
create policy audit_log_read_admin on public.audit_log
  for select to authenticated
  using ((select public.is_admin()));

-- Column-level guard: even admins cannot change a profile's id or email
-- through the API (email changes must go through Supabase Auth).
revoke update on public.profiles from authenticated;
grant update (full_name, role, job_title, site_id, active) on public.profiles to authenticated;

-- Stop future tables in public being exposed automatically.
alter default privileges in schema public revoke all on tables from anon, authenticated;
