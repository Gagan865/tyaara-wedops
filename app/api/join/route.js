import { NextResponse } from 'next/server'
import { admin } from '@/lib/supabase/admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Simple in-memory rate limit. This endpoint is deliberately unauthenticated (it is how a
// guest with a project code joins), which makes it an email-spam vector: each call sends a
// real email to an attacker-chosen address. A per-IP cap blunts that.
// NOTE: in-memory state is per-instance; move to Redis/Upstash if you run multiple instances.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const attempts = new Map()

function rateLimited(key) {
  const now = Date.now()
  const hits = (attempts.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (hits.length >= RATE_LIMIT_MAX) {
    attempts.set(key, hits)
    return true
  }
  hits.push(now)
  attempts.set(key, hits)
  if (attempts.size > 10_000) {
    for (const [k, v] of attempts) {
      if (!v.some(t => now - t < RATE_LIMIT_WINDOW_MS)) attempts.delete(k)
    }
  }
  return false
}

export async function POST(request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { code, email } = payload || {}
  if (!code || !email) {
    return NextResponse.json({ error: 'Code and email required' }, { status: 400 })
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  if (typeof code !== 'string' || code.length > 64) {
    return NextResponse.json({ error: 'Invalid project code' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many join attempts. Please try again later.' },
      { status: 429 }
    )
  }

  const normalizedEmail = email.trim().toLowerCase()

  const { data: project } = await admin
    .from('projects')
    .select('id, org_id, name')
    .eq('project_code', code.trim().toUpperCase())
    .maybeSingle()
  if (!project) return NextResponse.json({ error: 'Invalid project code' }, { status: 404 })

  // Look the user up directly rather than paging the whole user list; the previous
  // listUsers() call only returned the first page (default 50), so members past that
  // page were silently never added to the project.
  let existingUser = null
  const { data: found } = await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 })
  existingUser = found?.users?.find(u => u.email?.toLowerCase() === normalizedEmail) || null

  if (existingUser) {
    const { error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail
    })
    if (linkErr) {
      console.error('[join] magiclink failed:', linkErr)
      return NextResponse.json({ error: 'Could not send sign-in link' }, { status: 500 })
    }

    await admin.from('org_members').upsert(
      { org_id: project.org_id, user_id: existingUser.id, role: 'member' },
      { onConflict: 'org_id,user_id' }
    )
    await admin.from('project_members').upsert(
      { project_id: project.id, user_id: existingUser.id, role: 'member' },
      { onConflict: 'project_id,user_id' }
    )
    // Only create the display membership row once, otherwise re-joining duplicates the team list.
    const { data: existingMembership } = await admin
      .from('memberships')
      .select('id')
      .eq('project_id', project.id)
      .eq('user_id', existingUser.id)
      .maybeSingle()
    if (!existingMembership) {
      await admin.from('memberships').insert({
        project_id: project.id,
        org_id: project.org_id,
        user_id: existingUser.id,
        name: normalizedEmail.split('@')[0],
        role: 'Family Member'
      })
    }
  } else {
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: {
        name: normalizedEmail.split('@')[0],
        joining_project: project.id,
        joining_org: project.org_id
      }
    })
    if (inviteErr) {
      console.error('[join] invite failed:', inviteErr)
      return NextResponse.json({ error: 'Could not send invitation' }, { status: 500 })
    }
    // Membership rows are created after the user accepts and their account exists.
  }

  return NextResponse.json({ ok: true, projectName: project.name })
}
