import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'
import { ACTIVE_PROJECT_COOKIE } from '@/lib/active-project'
import { MEMBERSHIP_ROLES } from '@/lib/constants'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Admin provisions a teammate in one step: creates their login (email + password, already
// confirmed so they can sign in immediately), attaches them to the current wedding, and
// sets their Team role. The admin then hands over the credentials — no invite email needed.
//
// Security: uses the service-role client, so the org-admin check below is the only thing
// authorising the caller. Only an org owner/admin may create teammates.
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    let body
    try { body = await request.json() } catch { body = {} }
    const name = (body?.name || '').trim()
    const email = (body?.email || '').trim().toLowerCase()
    const password = body?.password || ''
    const role = MEMBERSHIP_ROLES.includes(body?.role) ? body.role : 'Family Member'
    const phone = (body?.phone || '').trim() || null
    const skills = (body?.skills || '').trim() || null
    const availability = (body?.availability || '').trim() || null

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    // Resolve the wedding to add them to — the caller's active wedding, else their oldest.
    const cookieStore = await cookies()
    const activeId = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value || null
    let project = null
    if (activeId) {
      const { data } = await admin.from('project_members')
        .select('projects(id, org_id)').eq('user_id', user.id).eq('project_id', activeId).maybeSingle()
      project = data?.projects || null
    }
    if (!project) {
      const { data } = await admin.from('project_members')
        .select('created_at, projects(id, org_id)').eq('user_id', user.id)
        .order('created_at', { ascending: true }).limit(1).maybeSingle()
      project = data?.projects || null
    }
    if (!project) return NextResponse.json({ error: 'No wedding to add the teammate to' }, { status: 400 })
    const projectId = project.id
    const orgId = project.org_id

    // Only an org owner/admin may provision teammates.
    const { data: callerOrg } = await admin.from('org_members')
      .select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle()
    if (!callerOrg || !['owner', 'admin'].includes(callerOrg.role)) {
      return NextResponse.json({ error: 'Only an admin can add teammates' }, { status: 403 })
    }

    // Create the login. email_confirm skips the confirmation email so they can log in now.
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name }
    })
    if (cErr) {
      const msg = /already|exists|registered/i.test(cErr.message) ? 'A user with this email already exists' : cErr.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const newUserId = created.user.id

    // Profile.
    await admin.from('profiles').upsert({
      id: newUserId, org_id: orgId, name, avatar_initials: name.substring(0, 2).toUpperCase()
    })

    // Org + project membership. An 'Admin' teammate is a co-admin (org role 'admin' → sees
    // all org trackers); everyone else is a regular member (sees only their own tracker rows).
    const orgRole = role === 'Admin' ? 'admin' : 'member'
    await admin.from('org_members').upsert({ org_id: orgId, user_id: newUserId, role: orgRole }, { onConflict: 'org_id,user_id' })
    await admin.from('project_members').upsert({ project_id: projectId, user_id: newUserId, role: 'member' }, { onConflict: 'project_id,user_id' })

    // Team display row WITH user_id — this is what maps the login to a role for page access.
    const { error: mErr } = await admin.from('memberships').insert({
      project_id: projectId, org_id: orgId, user_id: newUserId,
      name, role, phone, skills, availability, is_you: false
    })
    if (mErr) return NextResponse.json({ error: 'membership: ' + mErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, email })
  } catch (e) {
    console.error('[team/create-user] failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
