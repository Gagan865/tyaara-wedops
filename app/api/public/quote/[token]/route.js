import { NextResponse } from 'next/server'
import { admin } from '@/lib/supabase/admin'

// Public, login-free quote view resolved by an unguessable token. Uses the service-role
// client (RLS would otherwise hide it from an anonymous caller). Returns ONLY client-safe
// fields — never cost_paise or margin.
export async function GET(request, { params }) {
  try {
    const { token } = await params
    if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: q } = await admin.from('quotations')
      .select('id, quote_number, version, client_name, client_contact, venue_name, event_dates, valid_days, terms, created_at, status')
      .eq('public_token', token).maybeSingle()
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [g, l, a] = await Promise.all([
      admin.from('quote_groups').select('id, label, kind, selected_line_id, display_order').eq('quotation_id', q.id).order('display_order'),
      admin.from('quote_lines').select('id, group_id, element, description, bucket, amount_paise, display_order').eq('quotation_id', q.id).order('display_order'),
      admin.from('quote_adders').select('id, label, bucket, amount_paise, display_order').eq('quotation_id', q.id).order('display_order')
    ])
    return NextResponse.json({ quotation: q, groups: g.data || [], lines: l.data || [], adders: a.data || [] })
  } catch (e) {
    console.error('[public/quote] failed:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
