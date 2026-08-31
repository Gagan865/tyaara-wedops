'use client'
import { useEffect, useState } from 'react'
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
import { Plus, Printer, Armchair } from 'lucide-react'

export default function SeatingPage() {
  const [ctx, setCtx] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [tables, setTables] = useState([])
  const [assignments, setAssignments] = useState([])
  const [guests, setGuests] = useState([])
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [open, setOpen] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      setCtx({ projectId: pm.project_id, orgId: pm.projects?.org_id })
      const [t, ta, g, e] = await Promise.all([
        supabase.from('tables').select('*').eq('project_id', pm.project_id).order('name'),
        supabase.from('table_assignments').select('*, guests(name, is_vip)').eq('project_id', pm.project_id),
        supabase.from('guests').select('id,name,is_vip,rsvp').eq('project_id', pm.project_id).order('name'),
        supabase.from('events').select('id,name,slug').eq('project_id', pm.project_id).order('display_order')
      ])
      setTables(t.data || []); setAssignments(ta.data || []); setGuests(g.data || []); setEvents(e.data || [])
      if (!selectedEvent && e.data?.length) {
        const wed = e.data.find(x => x.slug === 'wedding-ceremony')
        setSelectedEvent(wed?.id || e.data[0].id)
      }
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const eventTables = tables.filter(t => !selectedEvent || t.event_id === selectedEvent || !t.event_id)
  const assignedGuestIds = new Set(assignments.map(a => a.guest_id))
  const unassigned = guests.filter(g => !assignedGuestIds.has(g.id))
  const totalSeated = assignments.length
  const totalCapacity = eventTables.reduce((a, t) => a + t.capacity, 0)

  async function assignGuest(guestId, tableId) {
    const supabase = createClient()
    await supabase.from('table_assignments').delete().eq('guest_id', guestId)
    if (tableId) {
      const { error } = await supabase.from('table_assignments').insert({ project_id: ctx.projectId, table_id: tableId, guest_id: guestId })
      if (error) return toast.error(error.message)
    }
    load()
  }

  async function addTable(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.from('tables').insert({
      project_id: ctx.projectId, org_id: ctx.orgId,
      event_id: selectedEvent,
      name: fd.get('name'),
      capacity: parseInt(fd.get('capacity')) || 10,
      shape: fd.get('shape')
    })
    if (error) return toast.error(error.message)
    toast.success('Table added'); setOpen(false); load()
  }

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Seating</h1>
          <p className="text-sm text-slate-500">{totalSeated}/{guests.length} seated · {eventTables.length} tables · {totalCapacity} seats</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedEvent || ''} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Function" /></SelectTrigger>
            <SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
          <Button className="bg-[#0F4C3A]" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add table</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4 lg:col-span-1">
          <div className="font-semibold mb-2">Unassigned ({unassigned.length})</div>
          <div className="space-y-1 max-h-[520px] overflow-auto">
            {unassigned.length === 0 ? (
              <div className="text-xs text-slate-500">Everyone is seated 🎉</div>
            ) : unassigned.map(g => (
              <div key={g.id} className="flex items-center gap-2 text-sm border-b py-1.5">
                <span className="flex-1">{g.is_vip && '⭐ '}{g.name}</span>
                <Select onValueChange={(v) => assignGuest(g.id, v)}>
                  <SelectTrigger className="h-7 text-[11px] w-32"><SelectValue placeholder="Assign" /></SelectTrigger>
                  <SelectContent>{eventTables.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {eventTables.length === 0 ? (
            <Card className="p-10 text-center col-span-full">
              <Armchair className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <div className="text-sm text-slate-600">No tables set up for this function.</div>
              <Button className="bg-[#0F4C3A] mt-3" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add first table</Button>
            </Card>
          ) : eventTables.map(t => {
            const seated = assignments.filter(a => a.table_id === t.id)
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-slate-500">{seated.length}/{t.capacity}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {seated.length === 0 ? <span className="text-xs text-slate-400">No one seated yet.</span> : seated.map(a => (
                    <button key={a.id} onClick={() => assignGuest(a.guest_id, null)}
                      className="text-xs px-2 py-1 rounded-full bg-slate-100 border border-slate-200 hover:bg-rose-50 hover:border-rose-200">
                      {a.guests?.is_vip && '⭐ '}{a.guests?.name} ✖
                    </button>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add table</DialogTitle></DialogHeader>
          <form onSubmit={addTable} className="space-y-3">
            <div><Label>Name</Label><Input name="name" required placeholder="Table 5 — College Friends" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Capacity</Label><Input name="capacity" type="number" defaultValue={10} /></div>
              <div><Label>Shape</Label>
                <Select name="shape" defaultValue="round">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">Round</SelectItem>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button className="bg-[#0F4C3A]">Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
