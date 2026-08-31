import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'

// Signup creates the account with the service-role client and email_confirm:true, so the
// user is confirmed immediately and can sign in right away — regardless of the project's
// "Confirm email" auth setting and without depending on (rate-limited, often-undelivered)
// confirmation emails. It then signs them in to set the session cookie, so the client lands
// straight in onboarding.
export async function POST(request) {
  try {
    const { email, password, name } = await request.json()
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Valid email and 6+ character password required' }, { status: 400 })
    }
    const normalizedEmail = String(email).trim().toLowerCase()

    // Create a pre-confirmed account.
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: name || normalizedEmail.split('@')[0] }
    })
    if (cErr) {
      const msg = /already|exists|registered/i.test(cErr.message)
        ? 'An account with this email already exists — sign in instead.'
        : cErr.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Establish the browser session (sets the auth cookies on this response).
    const supabase = await createClient()
    const { error: sErr } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (sErr) {
      // Account exists and is confirmed; the user can just sign in on the login page.
      return NextResponse.json({ user: created.user, needsManualSignin: true }, { status: 201 })
    }

    return NextResponse.json({ user: created.user }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
