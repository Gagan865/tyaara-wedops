import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'
import { sendWhatsApp, TEMPLATES } from '@/lib/whatsapp'
import { formatINR, formatDate, toIsoDate } from '@/lib/format'

// Run one of the 5 automation flows on demand.
// body: { flow: 'vendor_confirm'|'rsvp_invite'|'payment_reminder'|'day_of_push'|'family_query', ... }
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { flow, ...args } = payload || {}
  const { data: pm } = await admin.from('project_members').select('project_id, projects(org_id, name, wedding_date)').eq('user_id', user.id).limit(1).maybeSingle()
  if (!pm?.projects?.org_id) return NextResponse.json({ error: 'No project' }, { status: 400 })
  const projectId = pm.project_id, orgId = pm.projects.org_id

  const results = []

  if (flow === 'vendor_confirm') {
    // Send confirm message to each vendor whose bookings are 'pending' OR to a specific vendor list
    let vendors = []
    if (args.vendorIds?.length) {
      const { data } = await admin.from('vendors').select('id,name,phone').eq('project_id', projectId).in('id', args.vendorIds)
      vendors = data || []
    } else {
      const { data } = await admin.from('vendors').select('id,name,phone').eq('project_id', projectId).eq('status', 'pending')
      vendors = data || []
    }
    for (const v of vendors) {
      if (!v.phone) continue
      const body = TEMPLATES.vendor_confirm({ vendorName: v.name, eventName: 'wedding', date: formatDate(pm.projects?.wedding_date), projectName: pm.projects?.name })
      const r = await sendWhatsApp({ orgId, projectId, to: v.phone, toName: v.name, template: 'vendor_confirm', body, entityType: 'vendor', entityId: v.id, flow: 'vendor_confirm' })
      results.push({ vendor: v.name, ...r })
    }
  } else if (flow === 'rsvp_invite') {
    const eventId = args.eventId
    const { data: guests } = await admin.from('guests').select('id,name,phone').eq('project_id', projectId)
    // Scope the event lookup to this project so another tenant's event id cannot be read.
    const { data: ev } = eventId
      ? await admin.from('events').select('id,name,event_date').eq('id', eventId).eq('project_id', projectId).maybeSingle()
      : { data: null }
    for (const g of (guests || [])) {
      // Previously hardcoded to a demo number, which sent every guest's invite to the
      // same phone. Skip guests with no number instead of misdelivering.
      if (!g.phone) {
        results.push({ guest: g.name, ok: false, error: 'No phone number on file' })
        continue
      }
      const body = TEMPLATES.rsvp_invite({ guestName: g.name, eventName: ev?.name || 'the wedding', date: formatDate(ev?.event_date || pm.projects.wedding_date), projectName: pm.projects.name })
      const r = await sendWhatsApp({ orgId, projectId, to: g.phone, toName: g.name, template: 'rsvp_invite', body, entityType: 'guest', entityId: g.id, flow: 'rsvp_invite' })
      results.push({ guest: g.name, ...r })
    }
  } else if (flow === 'payment_reminder') {
    const daysAhead = args.daysAhead || 7
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + daysAhead)
    const { data: vendors } = await admin.from('vendors').select('id,name,phone,balance_paise,balance_due_date').eq('project_id', projectId).gt('balance_paise', 0).lte('balance_due_date', toIsoDate(cutoff))
    for (const v of (vendors || [])) {
      if (!v.phone) continue
      const body = TEMPLATES.payment_reminder_vendor({ vendorName: v.name, amount: formatINR(v.balance_paise), dueDate: formatDate(v.balance_due_date), projectName: pm.projects?.name })
      const r = await sendWhatsApp({ orgId, projectId, to: v.phone, toName: v.name, template: 'payment_reminder_vendor', body, entityType: 'vendor', entityId: v.id, flow: 'payment_reminder' })
      results.push({ vendor: v.name, ...r })
    }
  } else if (flow === 'day_of_push') {
    const { data: vendors } = await admin.from('vendors').select('id,name,phone').eq('project_id', projectId).eq('status', 'confirmed')
    for (const v of (vendors || [])) {
      if (!v.phone) continue
      const body = TEMPLATES.day_of_push({ vendorName: v.name, eventName: 'the Wedding', time: '10:00 AM', offset: '24 hours' })
      const r = await sendWhatsApp({ orgId, projectId, to: v.phone, toName: v.name, template: 'day_of_push', body, entityType: 'vendor', entityId: v.id, flow: 'day_of_push' })
      results.push({ vendor: v.name, ...r })
    }
  } else {
    return NextResponse.json({ error: 'Unknown flow' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, count: results.length, results })
}
