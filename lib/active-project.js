// Active-wedding selection for the multi-wedding switcher.
//
// The chosen wedding is stored in a `wedops_active_project` cookie. It is intentionally
// NOT httpOnly so client pages can read it to scope their own queries. This is safe:
// every browser query runs under Supabase row-level security, so filtering by a wedding
// the user does not belong to simply returns no rows — a forged cookie cannot reach
// another tenant's data. The server layout additionally validates the cookie against the
// user's real memberships before trusting it (see app/(app)/layout.js).

export const ACTIVE_PROJECT_COOKIE = 'wedops_active_project'

export function getActiveProjectId() {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)wedops_active_project=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

// Builds the standard "which wedding am I on" lookup used by every page. When the
// active-wedding cookie is set it pins the result to that wedding; otherwise it falls
// back deterministically to the user's oldest membership, so every page agrees with the
// layout even before a choice has been made. Callers append their own
// .limit(1)/.maybeSingle() and consume the row exactly as before.
export function activeProjectQuery(supabase, select) {
  const id = getActiveProjectId()
  let q = supabase.from('project_members').select(select).order('created_at', { ascending: true })
  if (id) q = q.eq('project_id', id)
  return q
}
