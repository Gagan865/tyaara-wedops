import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'

// Admin sets a new password for a teammate that has a login, then hands it over — no email
// round-trip needed. Service-role client is used, so the org-admin check is the authorisation.
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    let body
    try { body = await request.json() } catch { body = {} }
    const membershipId = body?.membershipId
    const password = body?.password || ''
    if (!membershipId) return NextResponse.json({ error: 'membershipId required' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    const { data: membership } = await admin
      .from('memberships').select('org_id, user_id').eq('id', membershipId).maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (!membership.user_id) return NextResponse.json({ error: 'This member has no login' }, { status: 400 })

    // Only an org owner/admin may reset passwords.
    const { data: callerOrg } = await admin
      .from('org_members').select('role').eq('org_id', membership.org_id).eq('user_id', user.id).maybeSingle()
    if (!callerOrg || !['owner', 'admin'].includes(callerOrg.role)) {
      return NextResponse.json({ error: 'Only an admin can reset passwords' }, { status: 403 })
    }

    // Don't let one admin reset the owner's password — only the owner themselves may.
    const { data: targetOrg } = await admin
      .from('org_members').select('role').eq('org_id', membership.org_id).eq('user_id', membership.user_id).maybeSingle()
    if (targetOrg?.role === 'owner' && membership.user_id !== user.id) {
      return NextResponse.json({ error: 'The owner’s password can only be reset by the owner' }, { status: 403 })
    }

    const { error } = await admin.auth.admin.updateUserById(membership.user_id, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[team/reset-password] failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
