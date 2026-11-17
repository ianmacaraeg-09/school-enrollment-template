-- ===========================================================================
-- School Enrollment Template — Supabase / Postgres schema
-- Matches src/core/storage/supabaseRepository.ts. Run once per client project
-- in the Supabase SQL editor. Review the RLS section before going live.
--
-- Design: each record table keeps the full app object in `data jsonb` (so new
-- custom fields never need a migration) plus a few typed columns for filtering
-- and integrity. Use a dedicated schema if sharing a project (see docs/BACKEND.md).
-- ===========================================================================

create table if not exists enroll_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('admin', 'registrar', 'cashier')),
  created_at timestamptz not null default now()
);

create table if not exists enroll_settings (
  id text primary key default 'default',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists enroll_sections (
  id text primary key,
  school_year_id text not null,
  grade_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists enroll_applications (
  id text primary key,
  status text not null,
  school_year_id text not null,
  grade_id text not null,
  section_id text references enroll_sections(id) on delete set null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists enroll_applications_status_idx on enroll_applications (status);
create index if not exists enroll_applications_grade_idx on enroll_applications (school_year_id, grade_id);

create table if not exists enroll_payments (
  id text primary key,
  application_id text not null references enroll_applications(id) on delete cascade,
  voided boolean not null default false,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists enroll_payments_app_idx on enroll_payments (application_id);

create table if not exists enroll_counters (
  name text primary key,
  value integer not null default 0
);
insert into enroll_counters (name) values ('application'), ('student'), ('receipt') on conflict do nothing;

-- Race-safe numbering (two cashiers can never get the same receipt number).
create or replace function enroll_next_counter(counter_name text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update enroll_counters set value = value + 1 where name = counter_name returning value into n;
  if n is null then raise exception 'unknown counter %', counter_name; end if;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
create or replace function enroll_role() returns text
language sql stable security definer set search_path = public as $$
  select role from enroll_profiles where user_id = auth.uid()
$$;

alter table enroll_profiles     enable row level security;
alter table enroll_settings     enable row level security;
alter table enroll_sections     enable row level security;
alter table enroll_applications enable row level security;
alter table enroll_payments     enable row level security;
alter table enroll_counters     enable row level security; -- no policies: only the function above touches it

create policy "own profile" on enroll_profiles for select using (user_id = auth.uid());
create policy "admin manages profiles" on enroll_profiles for all using (enroll_role() = 'admin') with check (enroll_role() = 'admin');

create policy "staff read settings" on enroll_settings for select using (enroll_role() is not null);
create policy "admin writes settings" on enroll_settings for all using (enroll_role() = 'admin') with check (enroll_role() = 'admin');

create policy "staff read sections" on enroll_sections for select using (enroll_role() is not null);
create policy "admin/registrar write sections" on enroll_sections for all
  using (enroll_role() in ('admin', 'registrar')) with check (enroll_role() in ('admin', 'registrar'));

create policy "staff read applications" on enroll_applications for select using (enroll_role() is not null);
create policy "admin/registrar write applications" on enroll_applications for all
  using (enroll_role() in ('admin', 'registrar')) with check (enroll_role() in ('admin', 'registrar'));

create policy "staff read payments" on enroll_payments for select using (enroll_role() is not null);
create policy "admin/cashier write payments" on enroll_payments for all
  using (enroll_role() in ('admin', 'cashier')) with check (enroll_role() in ('admin', 'cashier'));
-- NOTE: the app also restricts *what* each role may change (permissions in settings).
-- For stricter guarantees, enforce the same rules here (e.g. trigger forbidding cashiers from un-voiding).

-- ---------------------------------------------------------------------------
-- Public (anonymous) pages: /apply and /track must NOT read tables directly.
-- They go through these two narrow functions instead.
-- ---------------------------------------------------------------------------
-- 1) Submit an online application. The app builds `payload` (an Application object);
--    the server assigns the id, number, status and source so clients cannot forge them.
create or replace function enroll_submit_application(payload jsonb, number_format text default 'APP-{YYYY}-{SEQ:4}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare n integer; app_id text := 'app_' || replace(gen_random_uuid()::text, '-', ''); app_no text; rec jsonb;
begin
  n := enroll_next_counter('application');
  app_no := replace(replace(number_format, '{YYYY}', to_char(now(), 'YYYY')), '{SEQ:4}', lpad(n::text, 4, '0'));
  rec := payload || jsonb_build_object('id', app_id, 'applicationNo', app_no, 'status', 'applied', 'source', 'online',
          'studentNo', '', 'sectionId', '', 'docs', '{}'::jsonb, 'discountIds', '[]'::jsonb,
          'history', jsonb_build_array(jsonb_build_object('id', 'h_' || app_id, 'at', now(), 'by', 'Online applicant', 'kind', 'system', 'text', 'Application submitted')),
          'createdAt', now(), 'updatedAt', now());
  insert into enroll_applications (id, status, school_year_id, grade_id, data)
    values (app_id, 'applied', rec->>'schoolYearId', rec->>'gradeId', rec);
  return jsonb_build_object('applicationNo', app_no);
end $$;
grant execute on function enroll_submit_application(jsonb, text) to anon, authenticated;

-- 2) Track an application: needs the reference number AND birth date; returns only safe fields.
create or replace function enroll_track(app_no text, birth_date text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('applicationNo', data->>'applicationNo', 'firstName', data->>'firstName', 'lastName', data->>'lastName',
         'gradeId', data->>'gradeId', 'status', status, 'docs', data->'docs', 'studentType', data->>'studentType', 'createdAt', data->>'createdAt')
  from enroll_applications
  where lower(data->>'applicationNo') = lower(app_no) and data->>'birthDate' = birth_date
  limit 1
$$;
grant execute on function enroll_track(text, text) to anon, authenticated;
-- Add rate limiting (Supabase Edge Function or a CAPTCHA) in front of both before production.
