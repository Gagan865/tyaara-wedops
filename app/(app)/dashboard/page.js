'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatINR, formatDate, daysUntil, toIsoDate } from '@/lib/format'
import CountdownLive from '@/components/app/countdown-live'
import { PRIORITY_STYLES, STATUS_STYLES } from '@/lib/constants'
import {
  CheckSquare, Users, Store, Wallet, PartyPopper, Plus,
  AlertCircle, CalendarClock, Sparkles
} from 'lucide-react'

export default function DashboardPage() {
  const [state, setState] = useState({ loading: true, project: null, data: null, error: null, noProject: false })

  useEffect(() => { load() }, [])

  async function load() {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
    const supabase = createClient()
    const { data: pmRows, error: pmErr } = await activeProjectQuery(supabase, 'project_id').limit(1)
    if (pmErr) throw pmErr
    // Previously returned early without clearing `loading`, leaving the dashboard
    // stuck on "Loading dashboard…" forever for a user with no project.
    if (!pmRows || pmRows.length === 0) {
      setState({ loading: false, project: null, data: null, error: null, noProject: true })
      return
    }
    const projectId = pmRows[0].project_id

    const [project, tasks, bookings, guests, vendors, expenses, shopping, events, activity] = await Promise.all([
      supabase.from('projects').select('*, organizations(name, type)').eq('id', projectId).single(),
      supabase.from('tasks').select('id,title,priority,status,due_date,created_at').eq('project_id', projectId),
      supabase.from('bookings').select('id,status').eq('project_id', projectId),
      supabase.from('guests').select('id,rsvp').eq('project_id', projectId),
      supabase.from('vendors').select('id,name,quoted_paise,advance_paise,balance_paise,status,balance_due_date').eq('project_id', projectId),
      supabase.from('expenses').select('id,amount_paise').eq('project_id', projectId),
      supabase.from('shopping_items').select('id,budget_paise,actual_price_paise,purchased').eq('project_id', projectId),
      supabase.from('events').select('id,name,slug,icon,color_gradient,event_date,display_order').eq('project_id', projectId).order('display_order'),
      supabase.from('activity').select('id,verb,entity_type,entity_name,created_at,memberships(name)').eq('project_id', projectId).order('created_at', { ascending: false }).limit(10)
    ])

    setState({
      loading: false,
      error: null,
      noProject: false,
      project: project.data,
      data: {
        tasks: tasks.data || [],
        bookings: bookings.data || [],
        guests: guests.data || [],
        vendors: vendors.data || [],
        expenses: expenses.data || [],
        shopping: shopping.data || [],
        events: events.data || [],
        activity: activity.data || []
      }
    })
    } catch (e) {
      console.error('dashboard load failed:', e)
      setState(s => ({ ...s, loading: false, error: e }))
    }
  }

  if (state.loading) return <LoadingState label="Loading dashboard…" />
  if (state.error) return <ErrorState error={state.error} onRetry={load} />
  if (state.noProject || !state.project) return <NoProjectState />

  const { project, data } = state
  const daysLeft = daysUntil(project.wedding_date)
  const totalDays = Math.max(1, Math.round((new Date(project.wedding_date) - new Date(project.created_at)) / 86400000))
  const elapsedDays = Math.max(0, totalDays - daysLeft)
  const elapsedPct = Math.min(100, Math.round((elapsedDays / totalDays) * 100))

  const tasksDone = data.tasks.filter(t => t.status === 'Completed').length
  const tasksTotal = data.tasks.length
  const bookingsLocked = data.bookings.filter(b => b.status === 'confirmed').length
  const bookingsTotal = data.bookings.length || data.vendors.length
  const guestsConfirmed = data.guests.filter(g => g.rsvp === 'Coming').length
  const guestsTotal = data.guests.length
  const totalBudget = data.vendors.reduce((a, v) => a + Number(v.quoted_paise || 0), 0) +
                       data.shopping.reduce((a, s) => a + Number(s.budget_paise || 0), 0)
  const totalSpent = data.expenses.reduce((a, e) => a + Number(e.amount_paise || 0), 0) +
                     data.vendors.reduce((a, v) => a + Number(v.advance_paise || 0), 0) +
                     data.shopping.reduce((a, s) => a + Number(s.actual_price_paise || 0), 0)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Urgent tasks: not completed/cancelled, sort by due_date asc then created_at
  const activeTasks = data.tasks
    .filter(t => t.status !== 'Completed' && t.status !== 'Cancelled')
    .sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity
      if (da !== db) return da - db
      return new Date(a.created_at) - new Date(b.created_at)
    })
  const urgentTasks = activeTasks.filter(t => t.priority === 'Critical' || t.priority === 'High').slice(0, 4)
  const todayIso = toIsoDate(new Date())
  const todayTasks = activeTasks.filter(t => t.due_date === todayIso).slice(0, 4)
  const upcomingTasks = activeTasks.slice(0, 6)

  // Ring math
  const ringSize = 160, ringStroke = 14, ringR = (ringSize - ringStroke) / 2, ringC = 2 * Math.PI * ringR
  const ringPct = Math.min(1, elapsedDays / totalDays)
  const ringOffset = ringC * (1 - ringPct)

  return (
    <div className="space-y-6">
      {/* HERO */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="relative p-8 md:p-10 bg-gradient-to-br from-[#0B3A2C] via-[#0F4C3A] to-[#166B4E] text-white">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="relative flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
                <Sparkles className="h-4 w-4" /> {greeting}
              </div>
              <h1 className="text-3xl md:text-4xl font-serif font-semibold">{project.name}</h1>
              <div className="text-sm text-white/70 mt-1">Wedding on {formatDate(project.wedding_date)} · {project.project_code}</div>
              <div className="mt-6">
                <CountdownLive target={project.wedding_date} />
              </div>
              <div className="mt-6 max-w-md">
                <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                  <span>Planning time elapsed</span>
                  <span>{elapsedPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-300 to-rose-300" style={{ width: `${elapsedPct}%` }} />
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <svg width={ringSize} height={ringSize} className="transform -rotate-90">
                <circle cx={ringSize/2} cy={ringSize/2} r={ringR} stroke="rgba(255,255,255,0.15)" strokeWidth={ringStroke} fill="none" />
                <circle cx={ringSize/2} cy={ringSize/2} r={ringR} stroke="url(#g)" strokeWidth={ringStroke} fill="none"
                  strokeDasharray={ringC} strokeDashoffset={ringOffset} strokeLinecap="round" />
                <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#f472b6" />
                </linearGradient></defs>
              </svg>
              <div className="relative -mt-[110px] text-center pointer-events-none">
                <div className="text-4xl font-serif font-semibold">{daysLeft}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/70">Days left</div>
              </div>
              <div className="mt-14 text-center text-xs text-white/60">of {totalDays} total</div>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<CheckSquare className="h-4 w-4" />} label="Tasks completed"
             value={`${tasksDone} of ${tasksTotal}`}
             tint="emerald"
             ratio={tasksTotal ? tasksDone / tasksTotal : 0} />
        <Kpi icon={<Store className="h-4 w-4" />} label="Bookings locked"
             value={`${bookingsLocked} of ${bookingsTotal}`}
             tint="sky"
             ratio={bookingsTotal ? bookingsLocked / bookingsTotal : 0} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Guests confirmed"
             value={`${guestsConfirmed} of ${guestsTotal}`}
             tint="violet"
             ratio={guestsTotal ? guestsConfirmed / guestsTotal : 0} />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Budget used"
             value={`${formatINR(totalSpent, { compact: true })} of ${formatINR(totalBudget, { compact: true })}`}
             tint="amber"
             ratio={totalBudget ? totalSpent / totalBudget : 0} />
      </div>

      {/* EVENTS GRID */}
      <Section title="Events" subtitle="Your 7 functions — open a workspace to plan each one.">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {data.events.map(e => (
            <Link key={e.id} href={`/events/${e.slug}`} className={`group rounded-xl p-4 text-white bg-gradient-to-br ${e.color_gradient || 'from-emerald-500 to-teal-600'} shadow hover:shadow-lg transition`}>
              <div className="text-2xl">{e.icon}</div>
              <div className="text-sm font-semibold mt-2 leading-tight">{e.name}</div>
              <div className="text-[10px] text-white/80 mt-1">{e.event_date ? formatDate(e.event_date) : 'Date TBD'}</div>
            </Link>
          ))}
        </div>
      </Section>

      {/* URGENT + TODAY + UPCOMING */}
      <div className="grid lg:grid-cols-3 gap-4">
        <TaskList title="Urgent & Critical" tasks={urgentTasks} emptyText="Nothing urgent — nice work." icon={<AlertCircle className="h-4 w-4 text-rose-500" />} />
        <TaskList title="Today" tasks={todayTasks} emptyText="Nothing scheduled for today." icon={<CalendarClock className="h-4 w-4 text-amber-500" />} />
        <TaskList title="Upcoming Deadlines" tasks={upcomingTasks} emptyText="You’re all clear." icon={<CheckSquare className="h-4 w-4 text-emerald-500" />} />
      </div>

      {/* QUICK ACTIONS + ACTIVITY */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Quick actions</div>
              <div className="text-xs text-slate-500">Jump to the most-used flows.</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/tasks"><Button variant="outline" className="w-full justify-start"><Plus className="h-3.5 w-3.5 mr-2" />New task</Button></Link>
            <Link href="/guests"><Button variant="outline" className="w-full justify-start"><Plus className="h-3.5 w-3.5 mr-2" />Add guest</Button></Link>
            <Link href="/vendors"><Button variant="outline" className="w-full justify-start"><Plus className="h-3.5 w-3.5 mr-2" />Add vendor</Button></Link>
            <Link href="/shopping"><Button variant="outline" className="w-full justify-start"><Plus className="h-3.5 w-3.5 mr-2" />Add shopping</Button></Link>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Recent activity</div>
          {data.activity.length === 0 ? (
            <div className="text-sm text-slate-500">No activity yet.</div>
          ) : (
            <ul className="space-y-3">
              {data.activity.map(a => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                    {(a.memberships?.name || 'S').substring(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div><span className="font-medium">{a.memberships?.name || 'System'}</span> <span className="text-slate-600">{a.verb}</span> <span className="font-medium">{a.entity_name}</span></div>
                    <div className="text-[10px] text-slate-500">{formatDate(a.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, ratio, tint = 'emerald' }) {
  const tints = {
    emerald: 'from-emerald-50 to-emerald-100 text-emerald-800 border-emerald-200',
    sky: 'from-sky-50 to-sky-100 text-sky-800 border-sky-200',
    violet: 'from-violet-50 to-violet-100 text-violet-800 border-violet-200',
    amber: 'from-amber-50 to-amber-100 text-amber-800 border-amber-200'
  }[tint]
  const barTints = {
    emerald: 'bg-emerald-500', sky: 'bg-sky-500', violet: 'bg-violet-500', amber: 'bg-amber-500'
  }[tint]
  return (
    <Card className={`p-4 border bg-gradient-to-br ${tints}`}>
      <div className="flex items-center gap-2 text-xs font-medium">{icon}<span>{label}</span></div>
      <div className="text-xl font-serif font-semibold mt-2">{value}</div>
      <div className="h-1.5 rounded-full bg-white/50 mt-3 overflow-hidden">
        <div className={`h-full ${barTints}`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
      </div>
    </Card>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-lg font-serif font-semibold">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

function TaskList({ title, tasks, emptyText, icon }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {tasks.length === 0 ? (
        <div className="text-sm text-slate-500">
          {emptyText}
          <Link href="/tasks" className="block mt-3">
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1.5" />New task</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map(t => (
            <li key={t.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 whitespace-nowrap">{t.due_date ? formatDate(t.due_date) : '—'}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
