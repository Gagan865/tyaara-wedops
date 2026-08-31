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
import { Plus, Car, Users } from 'lucide-react'

export default function TransportationPage() {
  const [ctx, setCtx] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [vehicles, setVehicles] = useState([])
  const [guests, setGuests] = useState([])
  const [open, setOpen] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      setCtx({ projectId: pm.project_id, orgId: pm.projects?.org_id })
      const [v, g] = await Promise.all([
        supabase.from('vehicles').select('*').eq('project_id', pm.project_id).order('created_at'),
        supabase.from('guests').select('id,name,vehicle_id').eq('project_id', pm.project_id).order('name')
      ])
      setVehicles(v.data || []); setGuests(g.data || [])
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function addVehicle(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.from('vehicles').insert({
      project_id: ctx.projectId, org_id: ctx.orgId,
      name: fd.get('name'), type: fd.get('type'),
      seats: parseInt(fd.get('seats')) || 4,
      driver_name: fd.get('driver_name') || null,
      driver_phone: fd.get('driver_phone') || null
    })
    if (error) return toast.error(error.message)
    toast.success('Vehicle added'); setOpen(false); load()
  }

  async function assignGuest(guestId, vehicleId) {
    const supabase = createClient()
    await supabase.from('guests').update({ vehicle_id: vehicleId || null }).eq('id', guestId)
    load()
  }

  const assigned = guests.filter(g => g.vehicle_id).length
  const unassignedGuests = guests.filter(g => !g.vehicle_id)
  const totalSeats = vehicles.reduce((a, v) => a + v.seats, 0)

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Transportation</h1>
          <p className="text-sm text-slate-500">{vehicles.length} vehicles · {totalSeats} seats · {assigned} guests assigned · {unassignedGuests.length} unassigned</p>
        </div>
        <Button className="bg-[#0F4C3A]" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add vehicle</Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4 lg:col-span-1">
          <div className="font-semibold mb-2">Unassigned ({unassignedGuests.length})</div>
          <div className="space-y-1 max-h-[520px] overflow-auto">
            {unassignedGuests.length === 0 ? (
              <div className="text-xs text-slate-500">All guests have transport 🎯</div>
            ) : unassignedGuests.map(g => (
              <div key={g.id} className="flex items-center gap-2 text-sm border-b py-1.5">
                <span className="flex-1">{g.name}</span>
                <Select onValueChange={(v) => assignGuest(g.id, v)}>
                  <SelectTrigger className="h-7 text-[11px] w-32"><SelectValue placeholder="Assign" /></SelectTrigger>
                  <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.length === 0 ? (
            <Card className="p-10 text-center col-span-full">
              <Car className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <div className="text-sm text-slate-600">No vehicles yet.</div>
              <Button className="bg-[#0F4C3A] mt-3" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add your first vehicle</Button>
            </Card>
          ) : vehicles.map(v => {
            const inCar = guests.filter(g => g.vehicle_id === v.id)
            return (
              <Card key={v.id} className="p-4">
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-slate-600" />
                  <div className="font-semibold">{v.name}</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 ml-auto">{v.type}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{v.driver_name} · {v.driver_phone}</div>
                <div className="text-xs text-slate-600 mt-2"><Users className="h-3 w-3 inline mr-1" />{inCar.length}/{v.seats} seats</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {inCar.map(g => (
                    <button key={g.id} onClick={() => assignGuest(g.id, null)} className="text-xs px-2 py-1 rounded-full bg-slate-100 border border-slate-200 hover:bg-rose-50 hover:border-rose-200">
                      {g.name} ✖
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
          <DialogHeader><DialogTitle>Add vehicle</DialogTitle></DialogHeader>
          <form onSubmit={addVehicle} className="space-y-3">
            <div><Label>Name</Label><Input name="name" required placeholder="Innova Crysta — Family car" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select name="type" defaultValue="car">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="bus">Bus</SelectItem>
                    <SelectItem value="tempo">Tempo Traveller</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Seats</Label><Input name="seats" type="number" defaultValue={4} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Driver name</Label><Input name="driver_name" /></div>
              <div><Label>Driver phone</Label><Input name="driver_phone" placeholder="+91…" /></div>
            </div>
            <DialogFooter><Button className="bg-[#0F4C3A]">Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
