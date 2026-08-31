import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'

// Inbound WhatsApp reply handler.
//
// This endpoint mutates business state (confirms bookings, sets guest RSVPs) using the
// service-role key, so it must never be callable by an anonymous third party.
// Two callers are allowed:
//   1. The WhatsApp provider's webhook — authenticated with a shared secret in
//      `x-webhook-secret`, compared in constant time against WHATSAPP_WEBHOOK_SECRET.
//   2. A signed-in member of the project the message belongs to — used by the in-app
//      "simulate reply" tool in the messaging page.
function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { messageId, reply } = payload || {}
  if (!messageId || typeof messageId !== 'string') {
    return NextResponse.json({ error: 'messageId required' }, { status: 400 })
  }
  // Reply text is echoed into a notification body, so bound its length.
  if (reply != null && (typeof reply !== 'string' || reply.length > 2000)) {
    return NextResponse.json({ error: 'reply must be a string under 2000 characters' }, { status: 400 })
  }

  const secret = process.env.WHATSAPP_WEBHOOK_SECRET
  const providedSecret = request.headers.get('x-webhook-secret')
  const isWebhook = Boolean(secret && providedSecret && constantTimeEqual(providedSecret, secret))

  const { data: msg } = await admin
    .from('whatsapp_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle()
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  // Not a trusted webhook call: require an authenticated member of this message's project.
  if (!isWebhook) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: membership } = await admin
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)
      .eq('project_id', msg.project_id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date().toISOString()
  await admin
    .from('whatsapp_messages')
    .update({ reply, replied_at: now, status: 'read' })
    .eq('id', messageId)

  const rNorm = (reply || '').trim().toLowerCase()
  let effect = null

  if (msg.template === 'vendor_confirm' && msg.entity_type === 'booking') {
    if (['1', 'yes', 'y', 'confirm', 'confirmed'].some(k => rNorm.startsWith(k))) {
      await admin.from('bookings').update({ status: 'confirmed' })
        .eq('id', msg.entity_id).eq('project_id', msg.project_id)
      effect = 'booking confirmed'
    } else if (['2', 'no', 'n', 'decline', 'declined'].some(k => rNorm.startsWith(k))) {
      await admin.from('bookings').update({ status: 'pending' })
        .eq('id', msg.entity_id).eq('project_id', msg.project_id)
      effect = 'booking declined'
    }
  } else if (msg.template === 'rsvp_invite' && msg.entity_type === 'guest') {
    let rsvp = null
    // Check the longer tokens first: a bare 'y'/'n' prefix would otherwise
    // swallow 'yes'/'no' before the more specific branches are reached.
    if (rNorm.startsWith('yes') || rNorm === 'y' || rNorm === '1') rsvp = 'Coming'
    else if (rNorm.startsWith('no') || rNorm === 'n' || rNorm === '2') rsvp = 'Not coming'
    else if (rNorm.startsWith('maybe') || rNorm === '3') rsvp = 'Maybe'
    if (rsvp) {
      await admin.from('guests').update({ rsvp })
        .eq('id', msg.entity_id).eq('project_id', msg.project_id)
      effect = `RSVP set to ${rsvp}`
    }
  }

  await admin.from('notifications').insert({
    project_id: msg.project_id,
    org_id: msg.org_id,
    category: 'assignment',
    title: 'WhatsApp reply received',
    body: `${msg.to_name || msg.to_phone}: "${reply}"${effect ? ' — ' + effect : ''}`,
    entity_type: msg.entity_type,
    entity_id: msg.entity_id
  })

  return NextResponse.json({ ok: true, effect })
}
