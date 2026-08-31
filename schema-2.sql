-- ============================================================
-- WedOps Schema — PROMPT 2 additions
-- Append after prompt 1. Idempotent.
-- ============================================================

-- ================= COLUMN ADDITIONS (idempotent) =================
alter table public.guests add column if not exists phone text;
alter table public.guests add column if not exists whatsapp text;
alter table public.memberships add column if not exists email text;

-- ================= EXTRA ENUMS =================
do $$ begin create type invoice_state as enum ('draft','awaiting_review','unpaid','paid'); exception when duplicate_object then null; end $$;
do $$ begin create type wa_status as enum ('queued','sent','delivered','failed','read'); exception when duplicate_object then null; end $$;
do $$ begin create type wa_provider as enum ('mock','openwa'); exception when duplicate_object then null; end $$;

-- ================= SPATIAL: TABLES / SEATING =================
create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  layout_id uuid,
  name text not null,
  capacity int not null default 10,
  shape text not null default 'round',
  x float default 0,
  y float default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tables_project_idx on public.tables(project_id);

create table if not exists public.table_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  seat_no int,
  created_at timestamptz not null default now(),
  unique (guest_id, table_id)
);
create index if not exists table_assignments_project_idx on public.table_assignments(project_id);

create table if not exists public.floor_layouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  name text not null,
  background_url text,
  data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ================= TRANSPORTATION =================
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  type text default 'car',
  seats int not null default 4,
  driver_name text,
  driver_phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- ================= TRIALS / FITTINGS =================
create table if not exists public.trials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  membership_id uuid references public.memberships(id) on delete set null,
  name text not null,
  date date not null,
  time text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

-- ================= INVOICES =================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  invoice_number text not null,
  amount_paise bigint not null default 0,
  tax_paise bigint not null default 0,
  discount_paise bigint not null default 0,
  total_paise bigint not null default 0,
  state invoice_state not null default 'draft',
  issue_date date default current_date,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ================= WHATSAPP =================
create table if not exists public.whatsapp_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  provider wa_provider not null default 'mock',
  connected_number text,
  api_url text,
  api_key text,
  daily_limit int not null default 100,
  warmup_stage int default 1,
  connected_at timestamptz
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  to_phone text not null,
  to_name text,
  template text not null,
  body text not null,
  vars jsonb default '{}'::jsonb,
  status wa_status not null default 'queued',
  reply text,
  replied_at timestamptz,
  entity_type text,
  entity_id uuid,
  flow text,
  sent_at timestamptz default now(),
  created_at timestamptz not null default now()
);
create index if not exists wa_msgs_project_idx on public.whatsapp_messages(project_id);

-- ================= BILLING / SUBSCRIPTIONS =================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan text not null default 'starter',
  status text not null default 'active',
  razorpay_order_id text,
  razorpay_payment_id text,
  amount_paise bigint default 0,
  period text default 'monthly',
  active_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure organizations has plan default
alter table public.organizations alter column plan set default 'starter';

-- ================= RLS on new tables =================
alter table public.tables enable row level security;
alter table public.table_assignments enable row level security;
alter table public.floor_layouts enable row level security;
alter table public.vehicles enable row level security;
alter table public.trials enable row level security;
alter table public.invoices enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_settings enable row level security;
alter table public.subscriptions enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'tables','table_assignments','floor_layouts','vehicles','trials','invoices','whatsapp_messages'
  ]) loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_project_member(project_id)) with check (public.is_project_member(project_id))',
      t || '_all', t
    );
  end loop;
end $$;

drop policy if exists "whatsapp_settings_all" on public.whatsapp_settings;
create policy "whatsapp_settings_all" on public.whatsapp_settings for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "subscriptions_all" on public.subscriptions;
create policy "subscriptions_all" on public.subscriptions for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ================= UPDATED SEED FUNCTION =================
-- Now seeds tables, vehicles, trials, invoices, whatsapp settings for the demo.
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
  wed_event_id uuid;
begin
  new_code := 'WD-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 7));

  insert into projects(org_id, name, wedding_date, project_code, created_by)
  values (p_org_id, p_project_name, p_wedding_date, new_code, p_user_id)
  returning id into new_project_id;

  insert into project_members(project_id, user_id, role) values (new_project_id, p_user_id, 'owner') on conflict do nothing;

  insert into events(project_id, org_id, name, slug, icon, color_gradient, event_date, display_order) values
    (new_project_id, p_org_id, 'Engagement',       'engagement',       '💍', 'from-rose-400 to-pink-600',      p_wedding_date - 90, 1),
    (new_project_id, p_org_id, 'Haldi',            'haldi',            '🌼', 'from-yellow-400 to-amber-500',   p_wedding_date - 2,  2),
    (new_project_id, p_org_id, 'Mehendi',          'mehendi',          '🌿', 'from-emerald-400 to-green-600',  p_wedding_date - 2,  3),
    (new_project_id, p_org_id, 'Sangeet',          'sangeet',          '🎵', 'from-fuchsia-400 to-purple-600', p_wedding_date - 1,  4),
    (new_project_id, p_org_id, 'Cocktail Party',   'cocktail-party',   '🍸', 'from-sky-400 to-indigo-600',     p_wedding_date - 1,  5),
    (new_project_id, p_org_id, 'Wedding Ceremony', 'wedding-ceremony', '🕉️', 'from-red-500 to-rose-700',       p_wedding_date,      6),
    (new_project_id, p_org_id, 'Reception',        'reception',        '✨', 'from-violet-400 to-purple-700',  p_wedding_date + 1,  7);

  select id into wed_event_id from events where project_id = new_project_id and slug = 'wedding-ceremony';

  foreach c in array cat_names loop
    insert into categories(project_id, org_id, name, kind, display_order) values (new_project_id, p_org_id, c, 'all', i);
    i := i + 1;
  end loop;

  insert into todo_lists(project_id, org_id, name, display_order) values
    (new_project_id, p_org_id, 'Pre-Event', 1),
    (new_project_id, p_org_id, 'Event Day', 2),
    (new_project_id, p_org_id, 'Post-Event Checklist', 3);

  insert into booking_lead_times(project_id, org_id, category_id, lead_days)
  select new_project_id, p_org_id, cat.id, lt.days
  from (values
    ('Venue', 270), ('Food', 240), ('Photography', 180), ('Videography', 180),
    ('Decoration', 150), ('Clothing/Tailor', 120), ('Jewelry', 120), ('Invitations', 120),
    ('Makeup', 90), ('Mehendi', 90), ('DJ/Sound', 90), ('Lighting', 90),
    ('Flowers', 60), ('Transport', 60), ('Accommodation', 60), ('Miscellaneous', 60)
  ) as lt(name, days)
  join categories cat on cat.project_id = new_project_id and cat.name = lt.name;

  insert into memberships(project_id, org_id, user_id, name, role, is_you)
  values (new_project_id, p_org_id, p_user_id, coalesce(p_user_display_name, 'You'), 'Admin', true);

  insert into tasks(project_id, org_id, title, description, priority, status, due_date, estimated_hours) values
    (new_project_id, p_org_id, 'Sign venue contract',      'Finalize and sign venue booking',            'Medium', 'Not Started', p_wedding_date - 59, 4),
    (new_project_id, p_org_id, 'Confirm photography team', 'Confirm photography and videography team',   'Medium', 'Not Started', p_wedding_date - 42, 4),
    (new_project_id, p_org_id, 'Menu tasting',             'Menu tasting with caterer',                  'Medium', 'Not Started', p_wedding_date - 22, 4),
    (new_project_id, p_org_id, 'Send invitations',         'Send out wedding invitations',               'Medium', 'Not Started', p_wedding_date - 14, 4);

  insert into vendors(project_id, org_id, name, category_id, phone, contact_name, quoted_paise, advance_paise, balance_paise, tax_paise, status, balance_due_date, rating)
  select new_project_id, p_org_id, v.name, cat.id, v.phone, v.contact_name,
         v.quoted::bigint, v.advance::bigint, v.quoted::bigint - v.advance::bigint, (v.quoted::bigint * 18)/100, v.status::vendor_status, v.due_date, v.rating
  from (values
    ('Royal Palace Banquets',  'Venue',         '+919812345678', 'Rajesh Kumar', 132000000, 40000000, 'confirmed', p_wedding_date - 30, 5),
    ('Sharma Caterers',         'Food',          '+919876543210', 'Anil Sharma',   80000000, 20000000, 'confirmed', p_wedding_date - 20, 4),
    ('Frames of Love Studio',   'Photography',   '+919911223344', 'Priya Mehra',   35000000, 10000000, 'pending',   p_wedding_date - 15, 5),
    ('Bloom & Bright Decor',    'Decoration',    '+919933112255', 'Manoj Singh',   45000000, 15000000, 'pending',   p_wedding_date - 10, null),
    ('Glam Studio by Neha',     'Makeup',        '+919922334455', 'Neha Kapoor',   18000000,  5000000, 'pending',   p_wedding_date - 7,  4),
    ('Beats & Bass DJ',         'DJ/Sound',      '+919944556677', 'Vikram',        12000000,  3000000, 'pending',   p_wedding_date - 5,  4)
  ) as v(name, cat_name, phone, contact_name, quoted, advance, status, due_date, rating)
  join categories cat on cat.project_id = new_project_id and cat.name = v.cat_name;

  insert into shopping_items(project_id, org_id, category_id, name, quantity, store, budget_paise, actual_price_paise, purchased)
  select new_project_id, p_org_id, cat.id, s.name, s.qty, s.store, s.budget, s.actual, s.done
  from (values
    ('Bridal Lehenga',    'Clothing/Tailor', 1, 'Manish Malhotra',  15000000, 14200000, true),
    ('Groom Sherwani',    'Clothing/Tailor', 1, 'Sabyasachi',       12000000,  0,        false),
    ('Return Gift Boxes', 'Return Gifts',   250, 'Ferns N Petals',   5000000,   0,        false),
    ('Wedding Card Set',  'Invitations',    300, 'Regalia Cards',    2500000,  2500000,  true)
  ) as s(name, cat_name, qty, store, budget, actual, done)
  join categories cat on cat.project_id = new_project_id and cat.name = s.cat_name;

  insert into guests(project_id, org_id, name, "group", side, rsvp, is_vip, meal) values
    (new_project_id, p_org_id, 'Sharma Family',    'Family',  'Both',  'Coming',     false, 'Veg'),
    (new_project_id, p_org_id, 'Verma Family',     'Family',  'Groom', 'Pending',    false, 'Non-Veg'),
    (new_project_id, p_org_id, 'Kapoor Family',    'Family',  'Bride', 'Coming',     false, 'Veg'),
    (new_project_id, p_org_id, 'Rahul & Priya',    'Friends', 'Both',  'Coming',     false, 'Veg'),
    (new_project_id, p_org_id, 'Mr. & Mrs. Iyer',  'VIP',     'Both',  'Coming',     true,  'Veg'),
    (new_project_id, p_org_id, 'Anjali & Karan',   'Friends', 'Groom', 'Maybe',      false, 'Veg'),
    (new_project_id, p_org_id, 'Uncle Suresh',     'Family',  'Bride', 'Coming',     false, 'Veg'),
    (new_project_id, p_org_id, 'Colleague team',   'Friends', 'Groom', 'Not coming', false, 'Non-Veg');

  insert into guest_invitations(guest_id, event_id, invited)
  select g.id, e.id, true
  from guests g
  join events e on e.project_id = g.project_id
  where g.project_id = new_project_id and e.slug in ('wedding-ceremony','reception','sangeet');

  -- Sample tables, trials, expenses, invoices, vehicles, whatsapp settings
  insert into tables(project_id, org_id, event_id, name, capacity, shape)
  select new_project_id, p_org_id, wed_event_id, x.name, x.cap, x.shape
  from (values
    ('Table 1 — VIPs',    10, 'round'),
    ('Table 2 — Family',  12, 'round'),
    ('Table 3 — Friends', 10, 'round'),
    ('Table 4 — Kids',     8, 'round')
  ) as x(name, cap, shape);

  insert into vehicles(project_id, org_id, name, type, seats, driver_name, driver_phone) values
    (new_project_id, p_org_id, 'Innova Crysta',   'car', 7, 'Ramesh',  '+919812340001'),
    (new_project_id, p_org_id, 'Toyota Fortuner', 'car', 5, 'Prakash', '+919812340002'),
    (new_project_id, p_org_id, 'Mini Bus — 26 seater', 'bus', 26, 'Kishan', '+919812340003');

  insert into trials(project_id, org_id, vendor_id, name, date, time, location)
  select new_project_id, p_org_id, v.id, x.name, x.date, x.time, x.location
  from vendors v, (values
    ('Sherwani first fitting', (p_wedding_date - 30)::date, '11:00', 'Sabyasachi Store'),
    ('Bridal lehenga trial',   (p_wedding_date - 45)::date, '15:00', 'Manish Malhotra Studio'),
    ('Makeup trial',           (p_wedding_date - 20)::date, '10:00', 'Glam Studio')
  ) as x(name, date, time, location)
  where v.project_id = new_project_id
  limit 3;

  insert into expenses(project_id, org_id, event_id, vendor_id, category_id, description, amount_paise, date, type)
  select new_project_id, p_org_id, wed_event_id, v.id, v.category_id,
         'Advance to ' || v.name, v.advance_paise, current_date - (random()*20)::int, 'advance'
  from vendors v where v.project_id = new_project_id and v.advance_paise > 0;

  insert into invoices(project_id, org_id, vendor_id, invoice_number, amount_paise, tax_paise, total_paise, state, issue_date, due_date)
  select new_project_id, p_org_id, v.id,
         'INV-' || to_char(now(), 'YYMM') || '-' || substr(md5(random()::text),1,4),
         v.quoted_paise, v.tax_paise, v.quoted_paise + coalesce(v.tax_paise,0),
         (case when v.status = 'confirmed' then 'unpaid' else 'draft' end)::invoice_state,
         current_date - 15, v.balance_due_date
  from vendors v where v.project_id = new_project_id;

  insert into whatsapp_settings(org_id, provider, connected_number, daily_limit)
  values (p_org_id, 'mock', '+919999999999', 100)
  on conflict (org_id) do nothing;

  insert into activity(project_id, org_id, verb, entity_type, entity_name)
  values (new_project_id, p_org_id, 'created project', 'project', p_project_name);

  return new_project_id;
end;
$$;

grant execute on function public.create_project_with_seed(uuid, uuid, text, date, text) to authenticated, service_role;

-- Done prompt-2 additions.
