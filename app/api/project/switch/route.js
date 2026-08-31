import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'
import { ACTIVE_PROJECT_COOKIE } from '@/lib/active-project'

// Switches the caller's active wedding.
//
// Security-critical: the cookie is user-controlled and the app layout reads data with
// the service-role key (which bypasses RLS), so we MUST confirm the caller actually
// belongs to the target wedding before writing the cookie. A non-member gets 403 and no
// cookie is set. (Even if a cookie were forged directly, the layout re-validates against
// the user's memberships and every browser query runs under RLS — this is defense in depth.)
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let body
  try { body = await request.json() } catch { body = {} }
  const projectId = body?.projectId
  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const { data: membership, error } = await admin
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  if (!membership) return NextResponse.json({ error: 'Not a member of that wedding' }, { status: 403 })

  const res = NextResponse.json({ ok: true, projectId })
  res.cookies.set(ACTIVE_PROJECT_COOKIE, projectId, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // client pages read this to scope their own (RLS-protected) queries
    maxAge: 60 * 60 * 24 * 365
  })
  return res
}
