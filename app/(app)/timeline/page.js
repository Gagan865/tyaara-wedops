'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, daysUntil, toIsoDate } from '@/lib/format'
import { Heart, Printer, ChevronRight, CalendarCheck, ShoppingBag, CheckSquare } from 'lucide-react'

export default function TimelinePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [events, setEvents] = useState([])
  const [weddingDate, setWeddingDate] = useState(null)
  const [filter, setFilter] = useState('all')
  const [projectName, setProjectName] = useState('')

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(wedding_date, name)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      const projectId = pm.project_id
      setWeddingDate(pm.projects?.wedding_date); setProjectName(pm.projects?.name)
      const wed = new Date(pm.projects?.wedding_date)
      const [t, e, lt] = await Promise.all([
        supabase.from('tasks').select('id,title,due_date,event_id,status').eq('project_id', projectId).not('due_date','is', null),
        supabase.from('events').select('id,name,slug,event_date,icon,color_gradient').eq('project_id', projectId).order('display_order'),
        supabase.from('booking_lead_times').select('*, categories(name)').eq('project_id', projectId)
      ])
      setEvents(e.data || [])
      const arr = []
      ;(t.data || []).forEach(x => arr.push({
        kind: 'task', id: x.id, date: x.due_date, title: x.title, sub: `${x.status}${x.event_id ? '' : ' · General'}`, event_id: x.event_id, icon: CheckSquare, color: 'text-blue-600 bg-blue-100'
      }))
      ;(e.data || []).filter(x => x.event_date).forEach(x => arr.push({
        kind: 'event', id: x.id, date: x.event_date, title: x.name, sub: 'Function day', event_id: x.id, icon: Heart, color: 'text-rose-600 bg-rose-100', gradient: x.color_gradient, emoji: x.icon
      }))
      ;(lt.data || []).forEach(x => {
        const bookBy = new Date(wed); bookBy.setDate(bookBy.getDate() - x.lead_days)
        arr.push({
          kind: 'bookby', id: x.id, date: toIsoDate(bookBy),
          title: `Book ${x.categories?.name || 'category'} by`,
          sub: `Lead time — ${x.lead_days} days`,
          icon: CalendarCheck, color: 'text-amber-600 bg-amber-100'
        })
      })
      arr.sort((a, b) => new Date(a.date) - new Date(b.date))
      setItems(arr)
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const filtered = items.filter(i => {
    if (filter === 'all') return true
    if (filter === 'tasks') return i.kind === 'task'
    if (filter === 'events') return i.kind === 'event'
    if (filter === 'bookby') return i.kind === 'bookby'
    return i.event_id === filter
  })

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Timeline</h1>
          <p className="text-sm text-slate-500">Every milestone from now to <span className="text-[#0F4C3A] font-medium">{formatDate(weddingDate)}</span></p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All milestones</SelectItem>
              <SelectItem value="tasks">Tasks only</SelectItem>
              <SelectItem value="events">Functions only</SelectItem>
              <SelectItem value="bookby">Booking deadlines</SelectItem>
              {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print / PDF</Button>
        </div>
      </div>

      <div className="relative pl-8 max-w-3xl mx-auto">
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-200 via-[#0F4C3A]/40 to-emerald-500" />
        {filtered.map((it, idx) => {
          const Icon = it.icon
          const d = daysUntil(it.date)
          const isPast = d < 0
          return (
            <div key={idx} className="relative mb-4">
              <div className={`absolute -left-8 top-2 h-6 w-6 rounded-full flex items-center justify-center border-2 border-white shadow ${it.color}`}>
                <Icon className="h-3 w-3" />
              </div>
              <Card className={`p-4 ${isPast ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      {it.emoji && <span className="text-lg">{it.emoji}</span>}
                      {it.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{it.sub}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{formatDate(it.date)}</div>
                    <div className={`text-[11px] ${d < 0 ? 'text-slate-400' : d < 7 ? 'text-rose-600 font-medium' : 'text-slate-600'}`}>
                      {d < 0 ? `${Math.abs(d)}d ago` : d === 0 ? 'Today' : `in ${d}d`}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )
        })}
        <div className="relative mb-4">
          <div className="absolute -left-8 top-2 h-6 w-6 rounded-full bg-emerald-500 border-2 border-white shadow flex items-center justify-center">
            <Heart className="h-3 w-3 text-white" />
          </div>
          <Card className="p-6 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-0 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="text-4xl">💚</div>
              <div>
                <div className="text-2xl font-serif font-semibold">The Wedding Day</div>
                <div className="text-sm text-white/80">{formatDate(weddingDate)} · {projectName}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
