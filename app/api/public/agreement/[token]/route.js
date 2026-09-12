import { NextResponse } from 'next/server'
import { admin } from '@/lib/supabase/admin'

// Public agreement, resolved by token. GET returns it; POST records the client's
// e-acceptance (typed name). Service-role — no login required.
export async function GET(request, { params }) {
  try {
    const { token } = await params
    if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data } = await admin.from('agreements')
      .select('id, client_name, client_relation, agreement_date, total_paise, advance_paise, balance_paise, balance_due_text, terms, status, accepted_name, accepted_at, created_at')
      .eq('public_token', token).maybeSingle()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ agreement: data })
  } catch (e) {
    console.error('[public/agreement GET] failed:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const { token } = await params
    let body
    try { body = await request.json() } catch { body = {} }
    const name = (body?.accepted_name || '').trim()
    if (!name) return NextResponse.json({ error: 'Please type your full name to accept' }, { status: 400 })

    const { data: ag } = await admin.from('agreements').select('id, status').eq('public_token', token).maybeSingle()
    if (!ag) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (ag.status === 'accepted') return NextResponse.json({ error: 'This agreement is already accepted' }, { status: 400 })

    const { error } = await admin.from('agreements')
      .update({ status: 'accepted', accepted_name: name, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', ag.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[public/agreement POST] failed:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
