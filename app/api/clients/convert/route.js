import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'
import { seedProjectStructure } from '@/lib/seed-project'

// Converts a client_tracker enquiry into a real wedding (project) in the SAME org.
//
// Seeds ONLY the structural rows a fresh wedding needs (the 7 functions, 23 categories,
// 3 to-do lists, 16 booking lead times, the caller's membership rows, one activity row).
// It deliberately does NOT copy the demo seed data from /api/onboarding (sample vendors,
// guests, shopping, tables, vehicles, trials, expenses, invoices) — this is a real
// client, not a demo workspace.
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    let body
    try { body = await request.json() } catch { body = {} }
    const clientId = body?.clientId
    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json({ error: 'clientId required' }, { status: 400 })
    }

    // Load the tracker row with the service-role client (bypasses RLS).
    const { data: client, error: cErr } = await admin
      .from('client_tracker').select('*').eq('id', clientId).maybeSingle()
    if (cErr) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // SECURITY: because we read/write with the service-role key, this membership check is
    // the ONLY thing preventing a caller from converting another org's client. Do not skip.
    const { data: member } = await admin
      .from('org_members').select('user_id')
      .eq('org_id', client.org_id).eq('user_id', user.id).maybeSingle()
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (client.converted_project_id) {
      return NextResponse.json({ ok: true, projectId: client.converted_project_id })
    }
    if (!client.event_date) {
      return NextResponse.json({ error: 'This client has no event date — a wedding needs a date.' }, { status: 400 })
    }

    const orgId = client.org_id

    // 1. Project (same org). project_code in the existing 'WD-XXXXXXX' format.
    const projectCode = 'WD-' + Math.random().toString(36).substring(2, 9).toUpperCase()
    const { data: project, error: pErr } = await admin.from('projects').insert({
      org_id: orgId, name: client.client_name, wedding_date: client.event_date,
      project_code: projectCode, created_by: user.id
    }).select('id').single()
    if (pErr) return NextResponse.json({ error: 'project: ' + pErr.message }, { status: 500 })
    const projectId = project.id

    // 2. Structural seed (project_members, 7 events, 23 categories, 3 todo lists,
    //    16 lead times, membership, activity). Shared with the New-wedding action.
    await seedProjectStructure(admin, {
      projectId, orgId, userId: user.id, weddingDate: client.event_date,
      memberName: client.created_by_name || 'You',
      activityVerb: 'converted client to wedding', activityName: client.client_name
    })

    // 3. Mark the tracker row converted + booked.
    const { error: uErr } = await admin.from('client_tracker')
      .update({ converted_project_id: projectId, status: 'Booked', updated_at: new Date().toISOString() })
      .eq('id', clientId)
    if (uErr) return NextResponse.json({ error: 'update tracker: ' + uErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, projectId })
  } catch (e) {
    console.error('[clients/convert] failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
