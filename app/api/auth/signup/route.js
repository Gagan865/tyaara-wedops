import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    const { email, password, name } = await request.json()
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Valid email and 6+ character password required' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name: name || email.split('@')[0] } }
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ user: data.user, session: data.session }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
