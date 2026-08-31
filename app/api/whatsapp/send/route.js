import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { data: pm } = await admin
    .from('project_members')
    .select('project_id, projects(org_id)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!pm?.projects?.org_id) return NextResponse.json({ error: 'No project' }, { status: 400 })

  // Strip caller-supplied tenant fields before spreading. Previously `...body` was
  // spread *after* orgId/projectId, letting a caller send messages attributed to
  // another org's project.
  const { orgId: _o, projectId: _p, ...safeBody } = body || {}

  try {
    const result = await sendWhatsApp({
      ...safeBody,
      orgId: pm.projects.org_id,
      projectId: pm.project_id
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[whatsapp/send] failed:', e)
    return NextResponse.json({ error: e.message || 'Send failed' }, { status: 400 })
  }
}
