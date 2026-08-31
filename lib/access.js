// Role-based page access, keyed on the role the admin assigns each person on the Team
// page (memberships.role). One policy, used in two places:
//   * middleware.js  — hard enforcement: a restricted member typing /financials is bounced.
//   * the sidebar    — hides the links a restricted member is not allowed to open.
//
// Tiers:
//   FULL       Admin, Wedding Planner  → every page (Admin = the owner; Wedding Planner
//              is the planner running the event).
//   RESTRICTED everyone else (Bride, Groom, Parents, Photographer, Videographer,
//              Decorator, Caterer, Makeup Artist, DJ, Volunteer, Family Member) → only the
//              operational pages below. Financials, Budget, Vendors, Analytics, Invoices,
//              Reports and the rest stay hidden.

export const FULL_ACCESS_ROLES = ['Admin', 'Wedding Planner']

// The only app pages a restricted member may open. /about is company info — harmless to
// everyone — so it's included here rather than gated.
export const RESTRICTED_ALLOWED = ['/tasks', '/bookings', '/shopping', '/guests', '/timeline', '/transportation', '/about']

// Where a restricted member lands (and is bounced to) — the app default /dashboard shows
// budget/financial summaries, so it is not theirs to see.
export const RESTRICTED_HOME = '/tasks'

// Auth/setup flows any signed-in user may reach regardless of role, so gating never traps
// someone mid-onboarding or causes a redirect loop.
export const ALWAYS_ALLOWED = ['/onboarding', '/join']

export function isFullAccess(role) {
  return FULL_ACCESS_ROLES.includes(role)
}

function matches(prefixes, pathname) {
  return prefixes.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// May a member with `role` open `pathname`?
export function canAccessPath(role, pathname) {
  if (isFullAccess(role)) return true
  if (matches(ALWAYS_ALLOWED, pathname)) return true
  return matches(RESTRICTED_ALLOWED, pathname)
}

// True when a path is openable by ANY signed-in member — no role lookup needed. Lets the
// middleware skip its DB round-trip on the common operational pages.
export function isUniversallyAllowed(pathname) {
  return matches(ALWAYS_ALLOWED, pathname) || matches(RESTRICTED_ALLOWED, pathname)
}

// Resolves a user's effective access role. `db` is any Supabase client that can read
// org_members and memberships for this user (the middleware's cookie client or the
// service-role admin client both work).
//
// Org owners/admins always get FULL access. Otherwise we use the Team-assigned membership
// role for the active wedding (falling back to their oldest membership). A user with no
// membership row defaults to the restricted tier — deny by default.
export async function resolveAccessRole(db, userId, activeProjectId) {
  const { data: mems } = await db
    .from('memberships').select('role, project_id, created_at')
    .eq('user_id', userId).order('created_at', { ascending: true })

  const active = activeProjectId ? (mems || []).find(m => m.project_id === activeProjectId) : null
  const membershipRole = (active || (mems || [])[0])?.role || null
  if (membershipRole && isFullAccess(membershipRole)) return membershipRole

  // Not full-access by membership — an org owner/admin still gets full access even if their
  // per-project membership role says otherwise.
  const { data: om } = await db
    .from('org_members').select('role').eq('user_id', userId)
  if ((om || []).some(m => ['owner', 'admin'].includes(m.role))) return 'Admin'

  return membershipRole || 'Family Member'
}
