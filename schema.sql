-- ============================================================
-- WedOps Schema — prompt 1 of 2 (Indian wedding-planning SaaS)
-- Multi-tenant, RLS-enforced, all money in paise (bigint)
-- Idempotent: safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

-- ================= ENUMS =================
do $$ begin create type org_type as enum ('couple','planner_solo','planner_agency'); exception when duplicate_object then null; end $$;
do $$ begin create type org_plan as enum ('starter','professional','enterprise'); exception when duplicate_object then null; end $$;
do $$ begin create type membership_role as enum ('Family Member','Bride','Groom','Parents','Wedding Planner','Photographer','Videographer','Decorator','Caterer','Makeup Artist','DJ','Volunteer','Admin'); exception when duplicate_object then null; end $$;
do $$ begin create type category_kind as enum ('task','shopping','expense','booking','all'); exception when duplicate_object then null; end $$;
do $$ begin create type task_priority as enum ('Critical','High','Medium','Low'); exception when duplicate_object then null; end $$;
do $$ begin create type task_status as enum ('Not Started','In Progress','Waiting','Blocked','Completed','Cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type vendor_status as enum ('pending','confirmed','overdue'); exception when duplicate_object then null; end $$;
do $$ begin create type booking_status as enum ('confirmed','pending','overdue'); exception when duplicate_object then null; end $$;
do $$ begin create type guest_group as enum ('Family','Friends','VIP','Other'); exception when duplicate_object then null; end $$;
do $$ begin create type guest_side as enum ('Both','Groom','Bride'); exception when duplicate_object then null; end $$;
do $$ begin create type guest_rsvp as enum ('Coming','Pending','Maybe','Not coming'); exception when duplicate_object then null; end $$;
do $$ begin create type expense_type as enum ('advance','purchase','vendor_payment','expense'); exception when duplicate_object then null; end $$;
do $$ begin create type notification_category as enum ('assignment','deadline','booking','budget'); exception when duplicate_object then null; end $$;

-- ================= TABLES =================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type org_type not null default 'couple',
  branding_logo_url text,
  branding_color text default '#0F4C3A',
  custom_domain text,
  plan org_plan not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  name text,
  phone text,
  avatar_initials text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  wedding_date date not null,
  project_code text unique not null,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_org_idx on public.projects(org_id);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members(user_id);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text,
  role membership_role not null default 'Family Member',
  skills text,
  availability text,
  is_you boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memberships_project_idx on public.memberships(project_id);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  slug text not null,
  icon text,
  color_gradient text,
  event_date date,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);
create index if not exists events_project_idx on public.events(project_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  kind category_kind not null default 'all',
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);
create index if not exists categories_project_idx on public.categories(project_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  title text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  priority task_priority not null default 'Medium',
  status task_status not null default 'Not Started',
  due_date date,
  estimated_hours int default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_project_idx on public.tasks(project_id);
create index if not exists tasks_event_idx on public.tasks(event_id);

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  primary key (task_id, membership_id)
);

create table if not exists public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.todo_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.todo_lists(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  text text not null,
  priority task_priority default 'Medium',
  owner_membership_id uuid references public.memberships(id) on delete set null,
  due_date date,
  done boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  quantity int not null default 1,
  store text,
  budget_paise bigint not null default 0,
  actual_price_paise bigint not null default 0,
  assigned_membership_id uuid references public.memberships(id) on delete set null,
  purchased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  phone text,
  contact_name text,
  gst_number text,
  quoted_paise bigint default 0,
  tax_paise bigint default 0,
  discount_paise bigint default 0,
  deposit_paise bigint default 0,
  advance_paise bigint default 0,
  balance_paise bigint default 0,
  status vendor_status not null default 'pending',
  balance_due_date date,
  rating int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  status booking_status not null default 'pending',
  ideal_book_by date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  "group" guest_group not null default 'Family',
  side guest_side not null default 'Both',
  rsvp guest_rsvp not null default 'Pending',
  is_vip boolean not null default false,
  meal text,
  invited_via text,
  vehicle_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guests_project_idx on public.guests(project_id);

create table if not exists public.guest_invitations (
  guest_id uuid not null references public.guests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  invited boolean not null default false,
  primary key (guest_id, event_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount_paise bigint not null default 0,
  date date not null default current_date,
  type expense_type not null default 'expense',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_lead_times (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  lead_days int not null,
  unique (project_id, category_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  category notification_category not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_membership_id uuid references public.memberships(id) on delete set null,
  verb text not null,
  entity_type text,
  entity_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.event_notes (
  event_id uuid primary key references public.events(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  body text default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.event_inspo (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- ================= RLS HELPERS =================
create or replace function public.is_project_member(pid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = pid and pm.user_id = (select auth.uid())
  )
$$;

create or replace function public.is_org_member(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.org_members om
    where om.org_id = oid and om.user_id = (select auth.uid())
  )
$$;

revoke all on function public.is_project_member(uuid) from public;
grant execute on function public.is_project_member(uuid) to authenticated;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

-- ================= ENABLE RLS =================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.org_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.memberships enable row level security;
alter table public.events enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.todo_lists enable row level security;
alter table public.todo_items enable row level security;
alter table public.shopping_items enable row level security;
alter table public.vendors enable row level security;
alter table public.bookings enable row level security;
alter table public.guests enable row level security;
alter table public.guest_invitations enable row level security;
alter table public.expenses enable row level security;
alter table public.booking_lead_times enable row level security;
alter table public.notifications enable row level security;
alter table public.activity enable row level security;
alter table public.event_notes enable row level security;
alter table public.event_inspo enable row level security;

-- ================= POLICIES =================
-- Organizations
drop policy if exists "org_select" on public.organizations;
create policy "org_select" on public.organizations for select to authenticated using (public.is_org_member(id));
drop policy if exists "org_insert" on public.organizations;
create policy "org_insert" on public.organizations for insert to authenticated with check (true);
drop policy if exists "org_update" on public.organizations;
create policy "org_update" on public.organizations for update to authenticated using (public.is_org_member(id));

-- Profiles
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Org members
drop policy if exists "org_members_read" on public.org_members;
create policy "org_members_read" on public.org_members for select to authenticated using (user_id = (select auth.uid()) or public.is_org_member(org_id));
drop policy if exists "org_members_insert" on public.org_members;
create policy "org_members_insert" on public.org_members for insert to authenticated with check (user_id = (select auth.uid()));

-- Projects
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects for select to authenticated using (public.is_project_member(id) or public.is_org_member(org_id));
drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects for update to authenticated using (public.is_project_member(id) or public.is_org_member(org_id));
drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete" on public.projects for delete to authenticated using (public.is_org_member(org_id));

-- Project members
drop policy if exists "project_members_read" on public.project_members;
create policy "project_members_read" on public.project_members for select to authenticated using (user_id = (select auth.uid()) or public.is_project_member(project_id));
drop policy if exists "project_members_insert" on public.project_members;
create policy "project_members_insert" on public.project_members for insert to authenticated with check (user_id = (select auth.uid()) or public.is_project_member(project_id));

-- Project-scoped tables: generic "member can do anything within their project"
do $$
declare t text;
begin
  for t in select unnest(array[
    'memberships','events','categories','tasks','todo_lists','todo_items',
    'shopping_items','vendors','bookings','guests','expenses','booking_lead_times',
    'notifications','activity','event_notes','event_inspo'
  ]) loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_project_member(project_id)) with check (public.is_project_member(project_id))',
      t || '_all', t
    );
  end loop;
end $$;

-- Task assignees and guest invitations (no direct project_id) — via parent
drop policy if exists "task_assignees_all" on public.task_assignees;
create policy "task_assignees_all" on public.task_assignees for all to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id)));

drop policy if exists "guest_invitations_all" on public.guest_invitations;
create policy "guest_invitations_all" on public.guest_invitations for all to authenticated
  using (exists (select 1 from public.guests g where g.id = guest_id and public.is_project_member(g.project_id)))
  with check (exists (select 1 from public.guests g where g.id = guest_id and public.is_project_member(g.project_id)));

-- ================= SEED FUNCTION =================
create or replace function public.create_project_with_seed(
  p_org_id uuid,
  p_user_id uuid,
  p_project_name text,
  p_wedding_date date,
  p_user_display_name text default 'You'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_project_id uuid;
  new_code text;
  cat_names text[] := array[
    'Venue','Food','Photography','Videography','Decoration','Clothing/Tailor',
    'Jewelry','Invitations','Makeup','Mehendi','DJ/Sound','Lighting','Flowers',
    'Transport','Accommodation','Stage','Furniture','Electronics','Return Gifts',
    'Guests','Bookings','Gifts','Miscellaneous'
  ];
  c text;
  i int := 1;
begin
  new_code := 'WD-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 7));

  insert into projects(org_id, name, wedding_date, project_code, created_by)
  values (p_org_id, p_project_name, p_wedding_date, new_code, p_user_id)
  returning id into new_project_id;

  insert into project_members(project_id, user_id, role) values (new_project_id, p_user_id, 'owner')
  on conflict do nothing;

  -- 7 events
  insert into events(project_id, org_id, name, slug, icon, color_gradient, event_date, display_order) values
    (new_project_id, p_org_id, 'Engagement',       'engagement',       '💍', 'from-rose-400 to-pink-600',      p_wedding_date - 90, 1),
    (new_project_id, p_org_id, 'Haldi',            'haldi',            '🌼', 'from-yellow-400 to-amber-500',   p_wedding_date - 2,  2),
    (new_project_id, p_org_id, 'Mehendi',          'mehendi',          '🌿', 'from-emerald-400 to-green-600',  p_wedding_date - 2,  3),
    (new_project_id, p_org_id, 'Sangeet',          'sangeet',          '🎵', 'from-fuchsia-400 to-purple-600', p_wedding_date - 1,  4),
    (new_project_id, p_org_id, 'Cocktail Party',   'cocktail-party',   '🍸', 'from-sky-400 to-indigo-600',     p_wedding_date - 1,  5),
    (new_project_id, p_org_id, 'Wedding Ceremony', 'wedding-ceremony', '🕉️', 'from-red-500 to-rose-700',       p_wedding_date,      6),
    (new_project_id, p_org_id, 'Reception',        'reception',        '✨', 'from-violet-400 to-purple-700',  p_wedding_date + 1,  7);

  -- categories
  foreach c in array cat_names loop
    insert into categories(project_id, org_id, name, kind, display_order) values (new_project_id, p_org_id, c, 'all', i);
    i := i + 1;
  end loop;

  -- todo lists
  insert into todo_lists(project_id, org_id, name, display_order) values
    (new_project_id, p_org_id, 'Pre-Event', 1),
    (new_project_id, p_org_id, 'Event Day', 2),
    (new_project_id, p_org_id, 'Post-Event Checklist', 3);

  -- 16 lead times
  insert into booking_lead_times(project_id, org_id, category_id, lead_days)
  select new_project_id, p_org_id, cat.id, lt.days
  from (values
    ('Venue', 270), ('Food', 240), ('Photography', 180), ('Videography', 180),
    ('Decoration', 150), ('Clothing/Tailor', 120), ('Jewelry', 120), ('Invitations', 120),
    ('Makeup', 90), ('Mehendi', 90), ('DJ/Sound', 90), ('Lighting', 90),
    ('Flowers', 60), ('Transport', 60), ('Accommodation', 60), ('Miscellaneous', 60)
  ) as lt(name, days)
  join categories cat on cat.project_id = new_project_id and cat.name = lt.name;

  -- seed "you" as a membership
  insert into memberships(project_id, org_id, user_id, name, role, is_you)
  values (new_project_id, p_org_id, p_user_id, coalesce(p_user_display_name, 'You'), 'Admin', true);

  -- 4 seed tasks (relative to wedding date so they always look real)
  insert into tasks(project_id, org_id, title, description, priority, status, due_date, estimated_hours) values
    (new_project_id, p_org_id, 'Sign venue contract',      'Finalize and sign venue booking',            'Medium', 'Not Started', p_wedding_date - 59, 4),
    (new_project_id, p_org_id, 'Confirm photography team', 'Confirm photography and videography team',   'Medium', 'Not Started', p_wedding_date - 42, 4),
    (new_project_id, p_org_id, 'Menu tasting',             'Menu tasting with caterer',                  'Medium', 'Not Started', p_wedding_date - 22, 4),
    (new_project_id, p_org_id, 'Send invitations',         'Send out wedding invitations',               'Medium', 'Not Started', p_wedding_date - 14, 4);

  -- a few demo vendors and shopping items and guests, wired with real FKs
  insert into vendors(project_id, org_id, name, category_id, phone, contact_name, quoted_paise, advance_paise, balance_paise, status, balance_due_date, rating)
  select new_project_id, p_org_id, v.name, cat.id, v.phone, v.contact_name,
         v.quoted::bigint, v.advance::bigint, v.quoted::bigint - v.advance::bigint, v.status::vendor_status, v.due_date, v.rating
  from (values
    ('Royal Palace Banquets',  'Venue',         '+919812345678', 'Rajesh Kumar', 132000000, 40000000, 'confirmed', p_wedding_date - 30, 5),
    ('Sharma Caterers',         'Food',          '+919876543210', 'Anil Sharma',   80000000, 20000000, 'confirmed', p_wedding_date - 20, 4),
    ('Frames of Love Studio',   'Photography',   '+919911223344', 'Priya Mehra',   35000000, 10000000, 'pending',   p_wedding_date - 15, 5),
    ('Bloom & Bright Decor',    'Decoration',    '+919933112255', 'Manoj Singh',   45000000, 15000000, 'pending',   p_wedding_date - 10, null)
  ) as v(name, cat_name, phone, contact_name, quoted, advance, status, due_date, rating)
  join categories cat on cat.project_id = new_project_id and cat.name = v.cat_name;

  insert into shopping_items(project_id, org_id, category_id, name, quantity, store, budget_paise, actual_price_paise, purchased)
  select new_project_id, p_org_id, cat.id, s.name, s.qty, s.store, s.budget, s.actual, s.done
  from (values
    ('Bridal Lehenga',    'Clothing/Tailor', 1, 'Manish Malhotra',  15000000, 14200000, true),
    ('Groom Sherwani',    'Clothing/Tailor', 1, 'Sabyasachi',       12000000,  0,        false),
    ('Return Gift Boxes', 'Return Gifts',   250, 'Ferns N Petals',   5000000,   0,        false)
  ) as s(name, cat_name, qty, store, budget, actual, done)
  join categories cat on cat.project_id = new_project_id and cat.name = s.cat_name;

  insert into guests(project_id, org_id, name, "group", side, rsvp, is_vip, meal) values
    (new_project_id, p_org_id, 'Sharma Family',   'Family',  'Both',  'Coming',  false, 'Veg'),
    (new_project_id, p_org_id, 'Verma Family',    'Family',  'Groom', 'Pending', false, 'Non-Veg'),
    (new_project_id, p_org_id, 'Kapoor Family',   'Family',  'Bride', 'Coming',  false, 'Veg'),
    (new_project_id, p_org_id, 'Rahul & Priya',   'Friends', 'Both',  'Coming',  false, 'Veg'),
    (new_project_id, p_org_id, 'Mr. & Mrs. Iyer', 'VIP',     'Both',  'Coming',  true,  'Veg');

  -- Invite everyone to Wedding Ceremony and Reception by default
  insert into guest_invitations(guest_id, event_id, invited)
  select g.id, e.id, true
  from guests g
  join events e on e.project_id = g.project_id
  where g.project_id = new_project_id and e.slug in ('wedding-ceremony','reception');

  -- Activity trail
  insert into activity(project_id, org_id, verb, entity_type, entity_name)
  values (new_project_id, p_org_id, 'created project', 'project', p_project_name);

  return new_project_id;
end;
$$;

revoke all on function public.create_project_with_seed(uuid, uuid, text, date, text) from public;
grant execute on function public.create_project_with_seed(uuid, uuid, text, date, text) to authenticated, service_role;

-- ================= AUTO-CREATE PROFILE ON SIGNUP =================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, name, avatar_initials)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), upper(substring(coalesce(new.raw_user_meta_data->>'name', new.email) from 1 for 2)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

-- Done.
