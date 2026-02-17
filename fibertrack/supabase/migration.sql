-- ============================================================
-- FiberTrack Pro — Supabase Migration
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- ─── Tables ────────────────────────────────────────────────

create table if not exists public.tasks (
  id             text primary key,
  name           text not null,
  phase          text not null,
  start_week     integer not null check (start_week >= 1),
  duration_weeks integer not null check (duration_weeks >= 1),
  resources      jsonb not null default '[]'::jsonb,
  segments       text not null default '',
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.permits (
  id             text primary key,
  type           text not null,
  segment        text not null default '',
  submitted_week integer not null check (submitted_week >= 1),
  approved_week  integer,
  status         text not null default 'Pending'
                   check (status in ('Pending', 'In Review', 'Approved', 'Denied')),
  authority      text not null default '',
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─── Auto-update updated_at ────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

drop trigger if exists permits_updated_at on public.permits;
create trigger permits_updated_at
  before update on public.permits
  for each row execute procedure public.set_updated_at();

-- ─── Row-Level Security ────────────────────────────────────
-- For now: open read/write (suitable for internal team tools).
-- Swap to auth-based policies when you add Supabase Auth.

alter table public.tasks enable row level security;
alter table public.permits enable row level security;

drop policy if exists "Allow all on tasks" on public.tasks;
create policy "Allow all on tasks" on public.tasks
  for all using (true) with check (true);

drop policy if exists "Allow all on permits" on public.permits;
create policy "Allow all on permits" on public.permits
  for all using (true) with check (true);

-- ─── Seed Data ─────────────────────────────────────────────

insert into public.tasks (id, name, phase, start_week, duration_weeks, resources, segments, notes) values
  ('t1',  'Route Survey & As-builts',      'Survey & Design',      1,  3, '["r1","r6"]',     'Segments 1–5', ''),
  ('t2',  'Engineering & Design',           'Survey & Design',      2,  4, '["r6"]',          'All',          ''),
  ('t3',  'ROW & Municipal Permits',        'Permitting',           4,  6, '["r2","r6"]',     'All',          ''),
  ('t4',  'Traffic Control Plan',           'Permitting',           5,  2, '["r2"]',          'Segments 2–4', ''),
  ('t5',  'Equipment Mobilization',         'Mobilization',         9,  1, '["r7","r8"]',     'All',          ''),
  ('t6',  'Crew Onboarding & Safety',       'Mobilization',         9,  1, '["r6"]',          'All',          ''),
  ('t7',  'Trenching – Seg 1–2',            'Civil / Trenching',    10, 4, '["r3","r7"]',     'Seg 1–2',      ''),
  ('t8',  'Trenching – Seg 3–4',            'Civil / Trenching',    13, 4, '["r3","r7"]',     'Seg 3–4',      ''),
  ('t9',  'Trenching – Seg 5',              'Civil / Trenching',    17, 2, '["r3","r7"]',     'Seg 5',        ''),
  ('t10', 'Conduit Install – Seg 1–2',      'Conduit Installation', 11, 4, '["r4"]',          'Seg 1–2',      ''),
  ('t11', 'Conduit Install – Seg 3–4',      'Conduit Installation', 14, 4, '["r4"]',          'Seg 3–4',      ''),
  ('t12', 'Conduit Install – Seg 5',        'Conduit Installation', 18, 2, '["r4"]',          'Seg 5',        ''),
  ('t13', 'Fiber Pull – Seg 1–2',           'Fiber Pulling',        15, 3, '["r8"]',          'Seg 1–2',      ''),
  ('t14', 'Fiber Pull – Seg 3–5',           'Fiber Pulling',        18, 3, '["r8"]',          'Seg 3–5',      ''),
  ('t15', 'Splicing & OTDR Testing',        'Splicing & Testing',   20, 4, '["r5"]',          'All',          ''),
  ('t16', 'Documentation & Redlines',       'Closeout',             23, 2, '["r6"]',          'All',          ''),
  ('t17', 'Final Inspection & Acceptance',  'Closeout',             25, 1, '["r6","r2"]',     'All',          '')
on conflict (id) do nothing;

insert into public.permits (id, type, segment, submitted_week, approved_week, status, authority, notes) values
  ('p1', 'ROW Permit',        'All',      4, 8,    'Approved',  'City DOT',          ''),
  ('p2', 'Traffic Control',   'Seg 2–4',  5, 9,    'Approved',  'City Traffic Eng.', ''),
  ('p3', 'Environmental',     'Seg 3',    3, null,  'Pending',   'State EPA',         ''),
  ('p4', 'Utility Crossing',  'Seg 1',    4, 7,    'Approved',  'Gas Utility',       ''),
  ('p5', 'Municipal Approval','All',      4, null,  'In Review', 'City Council',      '')
on conflict (id) do nothing;
