import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'

// Fully removes a teammate that has a login (memberships.user_id set). Deleting the Team
// row alone — the old behaviour — left the auth account, org_members and project_members in
// place, so the person could still sign in AND their email stayed taken (createUser then
// failed with "already exists"). This route deprovisions properly:
//   * always: drop their Team row + project_members for THIS wedding
//   * if they belong to no other wedding in this org: drop their org_members here
//   * if they belong to no wedding anywhere: delete their profile + auth login (frees email)
//
// Display-only members (no user_id) are deleted client-side; this route is for real logins.
// Service-role client is used, so the org-admin check is the authorisation.
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    let body
    try { body = await request.json() } catch { body = {} }
    const membershipId = body?.membershipId
    if (!membershipId) return NextResponse.json({ error: 'membershipId required' }, { status: 400 })

    const { data: membership } = await admin
      .from('memberships').select('id, project_id, org_id, user_id').eq('id', membershipId).maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const { project_id: projectId, org_id: orgId, user_id: targetUserId } = membership

    // Only an org owner/admin may remove teammates.
    const { data: callerOrg } = await admin
      .from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle()
    if (!callerOrg || !['owner', 'admin'].includes(callerOrg.role)) {
      return NextResponse.json({ error: 'Only an admin can remove teammates' }, { status: 403 })
    }

    if (targetUserId && targetUserId === user.id) {
      return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })
    }

    // Never remove the org owner.
    if (targetUserId) {
      const { data: targetOrg } = await admin
        .from('org_members').select('role').eq('org_id', orgId).eq('user_id', targetUserId).maybeSingle()
      if (targetOrg?.role === 'owner') {
        return NextResponse.json({ error: 'The owner cannot be removed' }, { status: 400 })
      }
    }

    // Work out what else the target belongs to BEFORE we delete this wedding's link.
    let remainingAnywhere = 0
    let remainingInOrg = 0
    if (targetUserId) {
      const { data: pmAll } = await admin
        .from('project_members').select('project_id, projects(org_id)').eq('user_id', targetUserId)
      const remaining = (pmAll || []).filter(r => r.project_id !== projectId)
      remainingAnywhere = remaining.length
      remainingInOrg = remaining.filter(r => r.projects?.org_id === orgId).length
    }

    // Always: drop the Team row + this wedding's membership.
    await admin.from('memberships').delete().eq('id', membershipId)
    if (targetUserId) {
      await admin.from('project_members').delete().eq('project_id', projectId).eq('user_id', targetUserId)

      if (remainingInOrg === 0) {
        await admin.from('org_members').delete().eq('org_id', orgId).eq('user_id', targetUserId)
      }
      if (remainingAnywhere === 0) {
        // No weddings left anywhere — free the email by deleting the login and profile.
        await admin.from('profiles').delete().eq('id', targetUserId)
        const { error: delErr } = await admin.auth.admin.deleteUser(targetUserId)
        if (delErr) console.error('[team/remove] deleteUser failed:', delErr)
      }
    }

    return NextResponse.json({ ok: true, deletedLogin: Boolean(targetUserId) && remainingAnywhere === 0 })
  } catch (e) {
    console.error('[team/remove] failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
