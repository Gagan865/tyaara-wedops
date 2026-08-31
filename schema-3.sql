-- ============================================================
-- PROMPT 3 ADDITIONS — ORG-LEVEL TRACKERS + GLOBAL NOTES
-- ============================================================
--
-- These tables are deliberately NOT scoped to a single wedding (project_id).
-- The client and venue trackers belong to the ORGANISATION and are shared across
-- every wedding: a venue researched for one wedding must be visible while planning
-- another. They are scoped by org_id only, following the exact precedent set by
-- whatsapp_settings and subscriptions in schema-2.sql (public.is_org_member(oid)).
--
-- general_notes is a step wider still: a single shared scratchpad visible to every
-- signed-in user of the deployment, across organisations (using (true)).
--
-- Money is integer paise (bigint) everywhere, matching every other money column in
-- this app. Never store rupees as a float.
--
-- created_by_name is a denormalised snapshot of the author's display name captured
-- at write time. The profiles table is locked down to profiles_self (a user can read
-- only their own profile row), so a client-side join could not resolve another user's
-- name — and general_notes is cross-org, where exposing profiles would leak names
-- between tenants. Snapshotting the name sidesteps both problems.

-- ---------- CLIENT TRACKER ----------
create table if not exists public.client_tracker (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contacted_date date,
  client_name text not null,
  client_contact text,
  event_date date,
  cuisine_style text,                      -- 'North Indian' | 'South Indian' | 'Both' | 'Other'
  event_flow text,
  services_required text[] not null default '{}',
  overall_budget_paise bigint not null default 0,
  preferred_location text,
  status text not null default 'Enquiry',  -- Enquiry | Quoted | Booked | Lost
  updates text,
  remark text,
  converted_project_id uuid references public.projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_tracker_org_idx on public.client_tracker(org_id);
create index if not exists client_tracker_created_idx on public.client_tracker(org_id, created_at);

-- ---------- VENUE TRACKER ----------
create table if not exists public.venue_tracker (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  venue_name text not null,
  location text,
  location_link text,
  booking_contact text,
  venue_charge_paise bigint not null default 0,
  guest_capacity int,
  no_of_rooms int,
  outside_decorators_allowed boolean,      -- nullable on purpose: null = not known yet
  parking text,
  remark text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists venue_tracker_org_idx on public.venue_tracker(org_id);
create index if not exists venue_tracker_created_idx on public.venue_tracker(org_id, created_at);

-- ---------- GENERAL NOTES (global, shared by every signed-in user) ----------
create table if not exists public.general_notes (
  id uuid primary key default gen_random_uuid(),
  body text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists general_notes_created_idx on public.general_notes(created_at);

-- ================= ENABLE RLS =================
-- CRITICAL: enabling RLS without a matching policy makes a table deny-all. The
-- policies below are what turn these tables back on for the right callers.
alter table public.client_tracker enable row level security;
alter table public.venue_tracker  enable row level security;
alter table public.general_notes  enable row level security;

-- ================= POLICIES =================
-- Trackers: anyone in the organisation can read and write. Same shape as
-- whatsapp_settings_all / subscriptions_all in schema-2.sql.
drop policy if exists "client_tracker_all" on public.client_tracker;
create policy "client_tracker_all" on public.client_tracker for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "venue_tracker_all" on public.venue_tracker;
create policy "venue_tracker_all" on public.venue_tracker for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- General notes: shared with every signed-in user of the deployment, across orgs.
drop policy if exists "general_notes_all" on public.general_notes;
create policy "general_notes_all" on public.general_notes for all to authenticated
  using (true) with check (true);
