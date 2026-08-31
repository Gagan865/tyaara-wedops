'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { formatINR } from '@/lib/format'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts'

const COLORS = ['#0F4C3A','#166B4E','#0891b2','#f59e0b','#e11d48','#7c3aed','#059669','#f97316','#84cc16']

export default function AnalyticsPage() {
  const [data, setData] = useState(null)

  async function load() {
    const supabase = createClient()
    const { data: pm } = await activeProjectQuery(supabase, 'project_id').limit(1).maybeSingle()
    if (!pm) { setData({ guests: [], tasks: [], bookings: [], taskAssignees: [], members: [], invitations: [], events: [], expenses: [] }); return }
    const [g, t, b, ta, m, i, ev, ex] = await Promise.all([
      supabase.from('guests').select('id,rsvp,is_vip,group').eq('project_id', pm.project_id),
      supabase.from('tasks').select('id,status').eq('project_id', pm.project_id),
      supabase.from('bookings').select('id,status').eq('project_id', pm.project_id),
      supabase.from('task_assignees').select('membership_id,memberships(name)'),
      supabase.from('memberships').select('id,name').eq('project_id', pm.project_id),
      supabase.from('guest_invitations').select('event_id, invited'),
      supabase.from('events').select('id,name').eq('project_id', pm.project_id).order('display_order'),
      supabase.from('expenses').select('date,amount_paise').eq('project_id', pm.project_id).order('date')
    ])
    setData({ guests: g.data || [], tasks: t.data || [], bookings: b.data || [], taskAssignees: ta.data || [], members: m.data || [], invitations: i.data || [], events: ev.data || [], expenses: ex.data || [] })
  }
  useEffect(() => { load() }, [])

  if (!data) return <LoadingState label="Loading analytics…" />

  const guestStats = {
    total: data.guests.length,
    Coming: data.guests.filter(g => g.rsvp === 'Coming').length,
    'Not coming': data.guests.filter(g => g.rsvp === 'Not coming').length,
    Pending: data.guests.filter(g => g.rsvp === 'Pending').length,
    Maybe: data.guests.filter(g => g.rsvp === 'Maybe').length,
    VIP: data.guests.filter(g => g.is_vip).length,
    Family: data.guests.filter(g => g.group === 'Family').length
  }

  const eventAttendance = data.events.map(e => ({
    name: e.name,
    invited: data.invitations.filter(x => x.event_id === e.id && x.invited).length
  }))

  const taskStatusData = ['Completed','In Progress','Not Started','Waiting','Blocked','Cancelled'].map(s => ({
    name: s,
    value: data.tasks.filter(t => t.status === s).length
  })).filter(x => x.value > 0)

  const bookingData = ['confirmed','pending','overdue'].map(s => ({
    name: s,
    value: data.bookings.filter(b => b.status === s).length
  }))

  const workload = data.members.map(m => ({
    name: m.name.length > 15 ? m.name.substring(0,15)+'…' : m.name,
    tasks: data.taskAssignees.filter(a => a.membership_id === m.id).length
  }))

  // Spending over time (cumulative)
  let running = 0
  const spending = data.expenses.map(e => { running += Number(e.amount_paise); return { date: e.date, total: running / 100 } })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Analytics</h1>
        <p className="text-sm text-slate-500">Every chart, wired to real data.</p>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {Object.entries(guestStats).map(([k, v]) => (
          <Card key={k} className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
            <div className="text-2xl font-serif font-semibold">{v}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Guests invited per function</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={eventAttendance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="invited" fill="#0F4C3A" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Task status</div>
          {taskStatusData.length === 0 ? <div className="text-sm text-slate-500 text-center py-12">No tasks yet.</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={taskStatusData} dataKey="value" nameKey="name" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {taskStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Booking pipeline</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bookingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#166B4E" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Workload by person</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={workload} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip />
              <Bar dataKey="tasks" fill="#0F4C3A" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Spending over time</div>
          {spending.length === 0 ? <div className="text-sm text-slate-500 text-center py-12">No spending yet.</div> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={spending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`} />
                <Line type="monotone" dataKey="total" stroke="#0F4C3A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  )
}
