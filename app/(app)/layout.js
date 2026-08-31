import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'
import { ACTIVE_PROJECT_COOKIE } from '@/lib/active-project'
import { resolveAccessRole } from '@/lib/access'
import Sidebar from '@/components/app/sidebar'
import Topbar from '@/components/app/topbar'

export default async function AppLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch user's projects via admin (skips RLS complexity for the layout).
  // Ordered by membership age so the default pick is deterministic and matches the
  // per-page fallback in lib/active-project.js.
  const { data: memberships } = await admin
    .from('project_members')
    .select('project_id, created_at, projects(id, name, org_id, wedding_date, project_code, organizations(id, name, type))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const projects = (memberships || []).map(m => m.projects).filter(Boolean)

  if (projects.length === 0) redirect('/onboarding')

  // Honor the active-wedding cookie, but only if it names a wedding this user actually
  // belongs to — a forged cookie simply isn't in `projects`, so we fall back safely.
  const cookieStore = await cookies()
  const activeId = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value
  const active = projects.find(p => p.id === activeId) || projects[0]
  // Effective access role for nav filtering (middleware does the hard route enforcement).
  const role = await resolveAccessRole(admin, user.id, active.id)
  const { data: profile } = await admin.from('profiles').select('name, avatar_initials').eq('id', user.id).single()
  const { data: events } = await admin.from('events')
    .select('id, name, slug, icon, color_gradient, event_date, display_order')
    .eq('project_id', active.id)
    .order('display_order')

  // Unread notification count
  const { count: unreadCount } = await admin
    .from('notifications').select('*', { count: 'exact', head: true })
    .eq('project_id', active.id).is('read_at', null)

  return (
    <div className="flex min-h-screen bg-[#FBF8F1]">
      <Sidebar
        project={active}
        org={active.organizations}
        events={events || []}
        role={role}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          user={{ email: user.email, name: profile?.name || user.email, initials: profile?.avatar_initials || 'YU' }}
          unreadCount={unreadCount || 0}
          projectId={active.id}
          project={active}
          org={active.organizations}
          events={events || []}
          role={role}
        />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
