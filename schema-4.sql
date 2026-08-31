-- ============================================================
-- PROMPT 4 — PER-ROLE VISIBILITY FOR THE BUSINESS TRACKERS
-- ============================================================
--
-- New rule for client_tracker, venue_tracker and general_notes:
--   * an ORG ADMIN (org_members.role in 'owner','admin') sees and edits EVERY row in
--     the organisation — the global view.
--   * an EMPLOYEE (any other member, e.g. role 'member') sees and edits ONLY the rows
--     they created (created_by = auth.uid()). Employees can no longer read, edit or
--     delete each other's clients, venues or notes.
--
-- This is enforced in the database via RLS so it is real isolation, not just a UI filter:
-- the browser client uses the anon key under the caller's JWT, so these policies are what
-- actually scope every read and write.
--
-- Idempotent — safe to run more than once.

-- ---------- admin check ----------
-- Mirrors is_org_member but additionally requires an admin-level role. security definer +
-- pinned search_path, exactly like is_org_member / is_project_member in schema.sql.
create or replace function public.is_org_admin(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.org_members om
    where om.org_id = oid
      and om.user_id = (select auth.uid())
      and om.role in ('owner', 'admin')
  )
$$;
revoke all on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- ---------- general_notes gains an org ----------
-- It was global (using(true)); per-role scoping needs to know which org the note belongs
-- to. New notes are stamped with the author's org by the app.
alter table public.general_notes add column if not exists org_id uuid references public.organizations(id) on delete cascade;
create index if not exists general_notes_org_idx on public.general_notes(org_id);

-- ================= POLICIES =================
-- Admin OR owner-of-the-row, within the caller's org. Same predicate on using (read/
-- update/delete visibility) and with check (insert/update writes) so an employee can
-- only ever create rows attributed to themselves.

drop policy if exists "client_tracker_all" on public.client_tracker;
create policy "client_tracker_all" on public.client_tracker for all to authenticated
  using (public.is_org_member(org_id) and (public.is_org_admin(org_id) or created_by = (select auth.uid())))
  with check (public.is_org_member(org_id) and (public.is_org_admin(org_id) or created_by = (select auth.uid())));

drop policy if exists "venue_tracker_all" on public.venue_tracker;
create policy "venue_tracker_all" on public.venue_tracker for all to authenticated
  using (public.is_org_member(org_id) and (public.is_org_admin(org_id) or created_by = (select auth.uid())))
  with check (public.is_org_member(org_id) and (public.is_org_admin(org_id) or created_by = (select auth.uid())));

drop policy if exists "general_notes_all" on public.general_notes;
create policy "general_notes_all" on public.general_notes for all to authenticated
  using (public.is_org_member(org_id) and (public.is_org_admin(org_id) or created_by = (select auth.uid())))
  with check (public.is_org_member(org_id) and (public.is_org_admin(org_id) or created_by = (select auth.uid())));
