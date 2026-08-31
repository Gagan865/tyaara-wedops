'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, SkipForward } from 'lucide-react'
import { formatDate, toIsoDate } from '@/lib/format'

const LEGEND = [
  { key: 'function', color: 'bg-amber-500', label: 'Function' },
  { key: 'task',     color: 'bg-blue-500',  label: 'Task due' },
  { key: 'trial',    color: 'bg-purple-500', label: 'Trial/Fitting' },
  { key: 'payment',  color: 'bg-rose-500',  label: 'Payment due' }
]

export default function CalendarPage() {
  const [ctx, setCtx] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [items, setItems] = useState([])
  const [trials, setTrials] = useState([])
  const [vendors, setVendors] = useState([])
  const [cursor, setCursor] = useState(new Date())
  const [open, setOpen] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      setCtx({ projectId: pm.project_id, orgId: pm.projects?.org_id })
      const [ev, tk, tr, ven] = await Promise.all([
        supabase.from('events').select('id,name,event_date,icon').eq('project_id', pm.project_id).not('event_date','is',null),
        supabase.from('tasks').select('id,title,due_date').eq('project_id', pm.project_id).not('due_date','is',null),
        supabase.from('trials').select('*, vendors(name)').eq('project_id', pm.project_id),
        supabase.from('vendors').select('id,name,balance_paise,balance_due_date').eq('project_id', pm.project_id).gt('balance_paise', 0)
      ])
      const arr = []
      ;(ev.data || []).forEach(x => arr.push({ date: x.event_date, kind: 'function', title: `${x.icon || ''} ${x.name}` }))
      ;(tk.data || []).forEach(x => arr.push({ date: x.due_date, kind: 'task', title: x.title }))
      ;(tr.data || []).forEach(x => arr.push({ date: x.date, kind: 'trial', title: `${x.name}${x.vendors?.name ? ' @ ' + x.vendors.name : ''}` }))
      ;(ven.data || []).forEach(x => { if (x.balance_due_date) arr.push({ date: x.balance_due_date, kind: 'payment', title: `₹ ${x.name} balance` }) })
      setItems(arr); setTrials(tr.data || []); setVendors(ven.data || [])

      // Default cursor to the month of the next upcoming activity
      const today = new Date(); today.setHours(0,0,0,0)
      const futures = arr.map(a => new Date(a.date)).filter(d => d >= today).sort((a,b) => a-b)
      if (futures.length) setCursor(new Date(futures[0].getFullYear(), futures[0].getMonth(), 1))
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  function jumpToNext() {
    const today = new Date(); today.setHours(0,0,0,0)
    const next = items.map(a => new Date(a.date)).filter(d => d >= today).sort((a,b) => a-b)[0]
    if (next) setCursor(new Date(next.getFullYear(), next.getMonth(), 1))
  }

  const year = cursor.getFullYear(); const month = cursor.getMonth()
  const first = new Date(year, month, 1); const firstDay = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid = []
  for (let i = 0; i < firstDay; i++) grid.push(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d))

  const itemsByDate = useMemo(() => {
    const m = new Map()
    items.forEach(i => { (m.get(i.date) || m.set(i.date, []).get(i.date)).push(i) })
    return m
  }, [items])

  async function addTrial(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.from('trials').insert({
      project_id: ctx.projectId, org_id: ctx.orgId,
      name: fd.get('name'), date: fd.get('date'), time: fd.get('time') || null,
      location: fd.get('location') || null, notes: fd.get('notes') || null
    })
    if (error) return toast.error(error.message)
    toast.success('Trial added'); setOpen(false); load()
  }

  const monthLabel = cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Calendar</h1>
          <p className="text-sm text-slate-500">Functions, tasks, trials, and payment deadlines — all wired to real data.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={jumpToNext}><SkipForward className="h-4 w-4 mr-2" />Jump to next event</Button>
          <Button className="bg-[#0F4C3A]" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add trial/fitting</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {LEGEND.map(l => (
          <div key={l.key} className="flex items-center gap-2 text-xs">
            <span className={`h-3 w-3 rounded-full ${l.color}`} /> {l.label}
          </div>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-serif font-semibold text-lg">{monthLabel}</div>
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center py-1 font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            const iso = d ? toIsoDate(d) : null
            const list = iso ? (itemsByDate.get(iso) || []) : []
            const today = toIsoDate(new Date()) === iso
            return (
              <div key={i} className={`min-h-24 rounded-md border p-1 text-[11px] ${d ? 'bg-white' : 'bg-slate-50'} ${today ? 'ring-2 ring-[#0F4C3A]' : 'border-slate-200'}`}>
                {d && (<><div className="font-medium text-slate-700">{d.getDate()}</div>
                  <div className="space-y-0.5 mt-1">
                    {list.slice(0, 3).map((x, j) => {
                      const c = LEGEND.find(l => l.key === x.kind)?.color || 'bg-slate-400'
                      return <div key={j} className={`px-1 py-0.5 rounded text-white truncate ${c}`}>{x.title}</div>
                    })}
                    {list.length > 3 && <div className="text-slate-500">+{list.length - 3} more</div>}
                  </div>
                </>)}
              </div>
            )
          })}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add trial / fitting</DialogTitle></DialogHeader>
          <form onSubmit={addTrial} className="space-y-3">
            <div><Label>Name</Label><Input name="name" required placeholder="Sherwani first fitting" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input name="date" type="date" required /></div>
              <div><Label>Time</Label><Input name="time" type="time" /></div>
            </div>
            <div><Label>Location</Label><Input name="location" placeholder="Manish Malhotra Store" /></div>
            <div><Label>Notes</Label><Input name="notes" /></div>
            <DialogFooter><Button className="bg-[#0F4C3A]">Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
