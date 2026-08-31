import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'
import { ACTIVE_PROJECT_COOKIE } from '@/lib/active-project'
import { seedProjectStructure } from '@/lib/seed-project'

// Creates an additional wedding inside the caller's EXISTING organisation and makes it
// active. This is the "New wedding" path for an existing user — onboarding only ever
// creates a brand-new org, and convert only creates one from a client_tracker row, so
// neither could add a plain second wedding to the current workspace.
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    let body
    try { body = await request.json() } catch { body = {} }
    const name = (body?.name || '').trim()
    const weddingDate = body?.weddingDate
    if (!name) return NextResponse.json({ error: 'A wedding name is required' }, { status: 400 })
    if (!weddingDate) return NextResponse.json({ error: 'A wedding date is required' }, { status: 400 })

    // Resolve the org to create in: prefer the active wedding's org (the workspace the
    // user is looking at), otherwise their oldest org membership. Either way it is an org
    // the caller actually belongs to.
    let orgId = null
    const cookieStore = await cookies()
    const activeId = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value
    if (activeId) {
      const { data: activeMember } = await admin
        .from('project_members')
        .select('projects(org_id)')
        .eq('user_id', user.id).eq('project_id', activeId).maybeSingle()
      orgId = activeMember?.projects?.org_id || null
    }
    if (!orgId) {
      const { data: om } = await admin
        .from('org_members').select('org_id')
        .eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
      orgId = om?.org_id || null
    }
    if (!orgId) return NextResponse.json({ error: 'No organisation found for this account' }, { status: 400 })

    // Author's display name (for the memberships row).
    const { data: prof } = await admin.from('profiles').select('name').eq('id', user.id).maybeSingle()
    const memberName = prof?.name || user.email?.split('@')[0] || 'You'

    // Project.
    const projectCode = 'WD-' + Math.random().toString(36).substring(2, 9).toUpperCase()
    const { data: project, error: pErr } = await admin.from('projects').insert({
      org_id: orgId, name, wedding_date: weddingDate, project_code: projectCode, created_by: user.id
    }).select('id').single()
    if (pErr) return NextResponse.json({ error: 'project: ' + pErr.message }, { status: 500 })
    const projectId = project.id

    // Structural seed.
    await seedProjectStructure(admin, {
      projectId, orgId, userId: user.id, weddingDate,
      memberName, activityVerb: 'created project', activityName: name
    })

    // Make the new wedding active so the app switches straight to it.
    const res = NextResponse.json({ ok: true, projectId, projectCode })
    res.cookies.set(ACTIVE_PROJECT_COOKIE, projectId, {
      path: '/', sameSite: 'lax', httpOnly: false, maxAge: 60 * 60 * 24 * 365
    })
    return res
  } catch (e) {
    console.error('[project/create] failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
