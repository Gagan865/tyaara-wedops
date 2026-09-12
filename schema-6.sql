-- ============================================================
-- PROMPT 6 — CLIENT SHARING: public quote links, couple intake form, agreement
-- ============================================================
--
-- Client-facing artefacts are reached by an UNGUESSABLE public_token, served by a
-- service-role API route (app/api/public/*). RLS on these tables stays org-member-only —
-- the anon key can never read them directly; only the tokened server route returns
-- sanitised data. Money is integer paise. GST is never computed.
--
-- Idempotent — safe to run more than once.

-- Public share token for a quotation (client PDF view). Unguessable, nullable until shared.
alter table public.quotations add column if not exists public_token text;
create unique index if not exists quotations_public_token_idx on public.quotations(public_token);

do $$ begin create type public.couple_form_status as enum ('pending','submitted'); exception when duplicate_object then null; end $$;
do $$ begin create type public.agreement_status as enum ('draft','sent','accepted'); exception when duplicate_object then null; end $$;

-- Bride/groom intake form — sent to the couple to fill; answers stored as JSON.
create table if not exists public.couple_forms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  quotation_id uuid references public.quotations(id) on delete set null,
  public_token text not null,
  title text not null default 'Wedding details',
  status public.couple_form_status not null default 'pending',
  data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists couple_forms_token_idx on public.couple_forms(public_token);
create index if not exists couple_forms_org_idx on public.couple_forms(org_id);

-- Agreement — reproduces Tyaara's T&C; client e-accepts by typing their name.
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  quotation_id uuid references public.quotations(id) on delete set null,
  public_token text not null,
  client_name text not null,
  client_relation text,                       -- "Bride's Father"
  agreement_date date,
  total_paise bigint not null default 0,
  advance_paise bigint not null default 0,
  balance_paise bigint not null default 0,
  balance_due_text text,                       -- free text: "before the event"
  terms text,                                  -- the 14-clause body (editable)
  status public.agreement_status not null default 'draft',
  accepted_name text,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists agreements_token_idx on public.agreements(public_token);
create index if not exists agreements_org_idx on public.agreements(org_id);

-- ================= RLS (admin app only; public access is via the service-role API) =================
alter table public.couple_forms enable row level security;
alter table public.agreements   enable row level security;

drop policy if exists "couple_forms_all" on public.couple_forms;
create policy "couple_forms_all" on public.couple_forms for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "agreements_all" on public.agreements;
create policy "agreements_all" on public.agreements for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
