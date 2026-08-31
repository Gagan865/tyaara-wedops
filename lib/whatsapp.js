import 'server-only'
import { admin } from '@/lib/supabase/admin'

// Adapter interface: sendWhatsApp({ orgId, projectId, to, toName, template, vars, body, entityType, entityId, flow })
// Providers:
//   'mock'    — writes to whatsapp_messages with status='sent' immediately (dev default)
//   'openwa'  — posts to a self-hosted OpenWA-style HTTP endpoint (org's own number)

export async function sendWhatsApp({ orgId, projectId, to, toName, template, vars, body, entityType, entityId, flow }) {
  if (!projectId || !to || !body) throw new Error('Missing required WA fields')
  const cleanPhone = String(to).replace(/[^0-9+]/g, '')

  // Read org settings
  let provider = 'mock'
  if (orgId) {
    const { data } = await admin.from('whatsapp_settings').select('*').eq('org_id', orgId).maybeSingle()
    if (data) provider = data.provider || 'mock'
  }

  // Daily limit warm-up
  const startOfDay = new Date(); startOfDay.setHours(0,0,0,0)
  const { count } = await admin.from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId).gte('sent_at', startOfDay.toISOString())
  const limitToday = 100
  if ((count || 0) >= limitToday) {
    return { ok: false, error: 'Daily WhatsApp limit reached (100). Warm-up in progress.' }
  }

  let status = 'sent'
  let errorMsg = null

  if (provider === 'openwa') {
    // Real provider path — fire and forget POST. If it errors, mark failed.
    try {
      const { data: s } = await admin.from('whatsapp_settings').select('api_url, api_key').eq('org_id', orgId).maybeSingle()
      if (!s?.api_url) throw new Error('No api_url configured')
      const r = await fetch(s.api_url + '/message/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.api_key || ''}` },
        body: JSON.stringify({ to: cleanPhone, body })
      })
      if (!r.ok) throw new Error('Provider error ' + r.status)
    } catch (e) {
      status = 'failed'; errorMsg = e.message
    }
  }
  // For 'mock' — we just record it as sent.

  const { data: msg, error } = await admin.from('whatsapp_messages').insert({
    project_id: projectId, org_id: orgId,
    to_phone: cleanPhone, to_name: toName || null,
    template, body, vars: vars || {}, status,
    entity_type: entityType || null, entity_id: entityId || null, flow: flow || null
  }).select('*').single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, message: msg, provider, error: errorMsg }
}

// Message templates — pure functions, easy to translate later
export const TEMPLATES = {
  vendor_confirm: ({ vendorName, eventName, date, projectName }) =>
    `Hi ${vendorName}! Just confirming your booking for the ${eventName} of ${projectName} on ${date}. Reply 1 to CONFIRM ✅ or 2 to DECLINE. — Tyaara`,
  rsvp_invite: ({ guestName, eventName, date, projectName }) =>
    `Hello ${guestName}! You're invited to the ${eventName} of ${projectName} on ${date}. Reply YES to accept ❤️, NO if you can't make it, or MAYBE if unsure.`,
  payment_reminder_planner: ({ vendorName, amount, dueDate }) =>
    `Reminder: Balance of ${amount} to ${vendorName} is due on ${dueDate}. Open Tyaara to settle or reschedule.`,
  payment_reminder_vendor: ({ vendorName, amount, dueDate, projectName }) =>
    `Hi ${vendorName}! This is a friendly reminder that the balance of ${amount} for ${projectName} is due on ${dueDate}. Please confirm receipt. — Tyaara`,
  day_of_push: ({ vendorName, eventName, time, offset }) =>
    `${offset} to go for ${eventName}. ${vendorName}, please be ready at ${time}. Reply OK to confirm.`,
  family_query: ({ eventName, date, time }) =>
    `The ${eventName} is on ${date}${time ? ' at ' + time : ''}. See you there! — Tyaara family bot`
}
