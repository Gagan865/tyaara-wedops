-- ============================================================
-- PROMPT 5 — QUOTATION BUILDER (org-scoped)
-- ============================================================
--
-- A quotation exists before a wedding does, so these tables are scoped by org_id only,
-- following the whatsapp_settings / subscriptions precedent and using is_org_member(oid).
-- Money is integer paise (bigint) throughout. GST is NEVER computed — all amounts are
-- GST-inclusive and the total is a plain sum.
--
-- Idempotent — safe to run more than once.

do $$ begin create type public.quote_bucket as enum ('decor','lighting','furniture','sounds','sfx_other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.quote_status as enum ('draft','sent','accepted','expired','superseded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.quote_group_kind as enum ('items','options'); exception when duplicate_object then null; end $$;

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  quote_number text not null,
  version int not null default 1,
  client_name text not null,
  client_contact text,
  venue_name text,
  event_dates text,
  status public.quote_status not null default 'draft',
  valid_days int not null default 14,
  terms text,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, quote_number, version)
);

create table if not exists public.quote_groups (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  kind public.quote_group_kind not null default 'items',
  event_id uuid references public.events(id) on delete set null,
  selected_line_id uuid,
  display_order int not null default 0
);

create table if not exists public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  group_id uuid not null references public.quote_groups(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  element text not null,
  description text,
  bucket public.quote_bucket not null default 'decor',
  amount_paise bigint not null default 0,   -- what the CLIENT pays
  cost_paise bigint,                         -- INTERNAL ONLY: what it costs us (nullable)
  display_order int not null default 0
);

create table if not exists public.quote_adders (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  bucket public.quote_bucket,                -- null = its own summary row (Labour, Transportation)
  amount_paise bigint not null default 0,
  cost_paise bigint,
  display_order int not null default 0
);

-- Indexes on org_id and quotation_id.
create index if not exists quotations_org_idx     on public.quotations(org_id);
create index if not exists quote_groups_org_idx   on public.quote_groups(org_id);
create index if not exists quote_groups_quote_idx on public.quote_groups(quotation_id);
create index if not exists quote_lines_org_idx     on public.quote_lines(org_id);
create index if not exists quote_lines_quote_idx   on public.quote_lines(quotation_id);
create index if not exists quote_adders_org_idx     on public.quote_adders(org_id);
create index if not exists quote_adders_quote_idx   on public.quote_adders(quotation_id);

-- ================= RLS =================
-- CRITICAL: RLS on with no policy = deny-all. Each table gets a matching org-member policy.
alter table public.quotations   enable row level security;
alter table public.quote_groups enable row level security;
alter table public.quote_lines  enable row level security;
alter table public.quote_adders enable row level security;

drop policy if exists "quotations_all" on public.quotations;
create policy "quotations_all" on public.quotations for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "quote_groups_all" on public.quote_groups;
create policy "quote_groups_all" on public.quote_groups for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "quote_lines_all" on public.quote_lines;
create policy "quote_lines_all" on public.quote_lines for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "quote_adders_all" on public.quote_adders;
create policy "quote_adders_all" on public.quote_adders for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
