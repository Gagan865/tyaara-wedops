import { NextResponse } from 'next/server'
import { admin } from '@/lib/supabase/admin'

// Public bride/groom intake form, resolved by token. GET returns the form; POST saves the
// couple's answers back and marks it submitted. Service-role — no login required.
export async function GET(request, { params }) {
  try {
    const { token } = await params
    if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data } = await admin.from('couple_forms')
      .select('id, title, status, data, submitted_at').eq('public_token', token).maybeSingle()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ form: data })
  } catch (e) {
    console.error('[public/form GET] failed:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const { token } = await params
    let body
    try { body = await request.json() } catch { body = {} }
    const data = body?.data
    if (!data || typeof data !== 'object') return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })

    const { data: form } = await admin.from('couple_forms').select('id').eq('public_token', token).maybeSingle()
    if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error } = await admin.from('couple_forms')
      .update({ data, status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', form.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[public/form POST] failed:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
