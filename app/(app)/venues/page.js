'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, EmptyState, NoProjectState } from '@/components/app/page-state'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatINR, rupeesToPaise, paiseToRupees } from '@/lib/format'
import { downloadCsv } from '@/lib/export-csv'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Download, MapPin } from 'lucide-react'

// Maps the nullable boolean to the tri-state <Select> value and back.
const DECOR_TO_SELECT = { true: 'yes', false: 'no' }
function decorToSelect(v) { return v === null || v === undefined ? 'unknown' : DECOR_TO_SELECT[String(v)] }
function selectToDecor(v) { return v === 'yes' ? true : v === 'no' ? false : null }
function decorLabel(v) { return v === true ? 'Yes' : v === false ? 'No' : '—' }

// Venue tracker — ORG-scoped, shared across every wedding in the organisation.
export default function VenuesPage() {
  const confirm = useConfirm()
  const [orgId, setOrgId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [me, setMe] = useState({ id: null, name: 'You' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: pm } = await activeProjectQuery(supabase, 'projects(org_id)').limit(1).maybeSingle()
      const oid = pm?.projects?.org_id || null
      if (!oid) { setNoProject(true); setLoading(false); return }

      let meName = user?.email?.split('@')[0] || 'You'
      let admin = false
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()
        if (prof?.name) meName = prof.name
        const { data: mem } = await supabase.from('org_members').select('role').eq('org_id', oid).eq('user_id', user.id).maybeSingle()
        admin = ['owner', 'admin'].includes(mem?.role)
      }

      // RLS returns every venue to an admin, only the caller's own to an employee.
      const { data, error } = await supabase
        .from('venue_tracker').select('*').eq('org_id', oid)
        .order('created_at', { ascending: true })
      if (error) throw error

      setMe({ id: user?.id || null, name: meName })
      setOrgId(oid)
      setIsAdmin(admin)
      setRows(data || [])
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const capacity = fd.get('guest_capacity')
    const rooms = fd.get('no_of_rooms')
    const payload = {
      org_id: orgId,
      venue_name: fd.get('venue_name'),
      location: fd.get('location') || null,
      location_link: fd.get('location_link') || null,
      booking_contact: fd.get('booking_contact') || null,
      venue_charge_paise: rupeesToPaise(fd.get('venue_charge') || 0),
      guest_capacity: capacity ? parseInt(capacity) : null,
      no_of_rooms: rooms ? parseInt(rooms) : null,
      outside_decorators_allowed: selectToDecor(fd.get('outside_decorators_allowed')),
      parking: fd.get('parking') || null,
      remark: fd.get('remark') || null
    }
    const supabase = createClient()
    if (editing) {
      const { error } = await supabase.from('venue_tracker').update(payload).eq('id', editing.id)
      if (error) return toast.error(error.message)
      toast.success('Venue updated')
    } else {
      const { error } = await supabase.from('venue_tracker')
        .insert({ ...payload, created_by: me.id, created_by_name: me.name })
      if (error) return toast.error(error.message)
      toast.success('Venue added')
    }
    setDialogOpen(false); setEditing(null); load()
  }

  async function remove(row) {
    if (!await confirm({ title: 'Delete this venue?', description: `Remove ${row.venue_name} from the tracker. This cannot be undone.`, confirmLabel: 'Delete', destructive: true })) return
    const supabase = createClient()
    const { error } = await supabase.from('venue_tracker').delete().eq('id', row.id)
    if (error) return toast.error(error.message)
    toast.success('Venue deleted'); load()
  }

  function exportCsv() {
    const cols = [
      { header: 'Sl No', value: r => rows.indexOf(r) + 1 },
      { header: 'Venue', value: r => r.venue_name },
      { header: 'Location', value: r => r.location || '' },
      { header: 'Location Link', value: r => r.location_link || '' },
      { header: 'Booking Contact', value: r => r.booking_contact || '' },
      { header: 'Venue Charge', value: r => paiseToRupees(r.venue_charge_paise), money: true },
      { header: 'Guest Capacity', value: r => r.guest_capacity ?? '' },
      { header: 'No of Rooms', value: r => r.no_of_rooms ?? '' },
      { header: 'Outside Decorators Allowed', value: r => (r.outside_decorators_allowed === null || r.outside_decorators_allowed === undefined) ? '' : (r.outside_decorators_allowed ? 'Yes' : 'No') },
      { header: 'Parking', value: r => r.parking || '' },
      { header: 'Remark', value: r => r.remark || '' }
    ]
    if (isAdmin) cols.push({ header: 'Added By', value: r => r.created_by_name || '' })
    downloadCsv('venues', cols, rows)
  }

  const total = rows.length
  const avgCharge = total ? Math.round(rows.reduce((a, r) => a + Number(r.venue_charge_paise || 0), 0) / total) : 0
  const largestCapacity = rows.reduce((m, r) => Math.max(m, Number(r.guest_capacity || 0)), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Venue Tracker</h1>
          <p className="text-sm text-slate-500">{isAdmin ? 'Every team member’s venues across the organisation.' : 'Your venues — only you can see these.'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]" onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />Add venue
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI label="Total venues" value={`${total}`} />
        <KPI label="Average charge" value={formatINR(avgCharge, { compact: true })} />
        <KPI label="Largest capacity" value={largestCapacity ? `${largestCapacity}` : '—'} />
      </div>

      {loading ? <LoadingState /> :
        noProject ? <NoProjectState /> :
        loadError ? <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} /> :
        rows.length === 0 ? (
          <EmptyState
            title="No venues yet"
            description="Add a venue once and it stays available for every wedding you plan."
            action={<Button className="bg-[#0F4C3A]" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add venue</Button>}
          />
        ) : (
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sl No</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Location Link</TableHead>
                  <TableHead>Booking Contact</TableHead>
                  <TableHead className="text-right">Venue Charge</TableHead>
                  <TableHead className="text-right">Guest Capacity</TableHead>
                  <TableHead className="text-right">No of Rooms</TableHead>
                  <TableHead>Outside Decorators Allowed</TableHead>
                  <TableHead>Parking</TableHead>
                  <TableHead>Remark</TableHead>
                  {isAdmin && <TableHead>Added By</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{r.venue_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.location || '—'}</TableCell>
                    <TableCell>
                      {r.location_link
                        ? <a href={r.location_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[#0F4C3A] hover:underline"><MapPin className="h-3.5 w-3.5 mr-1" />Map</a>
                        : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.booking_contact || '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatINR(r.venue_charge_paise)}</TableCell>
                    <TableCell className="text-right">{r.guest_capacity ?? '—'}</TableCell>
                    <TableCell className="text-right">{r.no_of_rooms ?? '—'}</TableCell>
                    <TableCell>{decorLabel(r.outside_decorators_allowed)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.parking || '—'}</TableCell>
                    <TableCell className="max-w-[16rem] truncate" title={r.remark || ''}>{r.remark || '—'}</TableCell>
                    {isAdmin && <TableCell className="whitespace-nowrap text-slate-500">{r.created_by_name || '—'}</TableCell>}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit venue' : 'Add venue'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Venue</Label><Input name="venue_name" defaultValue={editing?.venue_name || ''} required /></div>
              <div><Label>Location</Label><Input name="location" defaultValue={editing?.location || ''} /></div>
            </div>
            <div><Label>Location link (Google Maps URL)</Label><Input name="location_link" type="url" defaultValue={editing?.location_link || ''} placeholder="https://maps.google.com/…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Booking contact</Label><Input name="booking_contact" defaultValue={editing?.booking_contact || ''} placeholder="+91…" /></div>
              <div><Label>Venue charge (₹)</Label><Input name="venue_charge" type="number" step="0.01" min="0" defaultValue={editing ? paiseToRupees(editing.venue_charge_paise) : 0} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Guest capacity</Label><Input name="guest_capacity" type="number" min="0" defaultValue={editing?.guest_capacity ?? ''} /></div>
              <div><Label>No of rooms</Label><Input name="no_of_rooms" type="number" min="0" defaultValue={editing?.no_of_rooms ?? ''} /></div>
              <div><Label>Outside decorators</Label>
                <Select name="outside_decorators_allowed" defaultValue={decorToSelect(editing?.outside_decorators_allowed)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Not known</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Parking</Label><Input name="parking" defaultValue={editing?.parking || ''} /></div>
            <div><Label>Remark</Label><Textarea name="remark" rows={2} defaultValue={editing?.remark || ''} /></div>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]">{editing ? 'Save' : 'Add'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KPI({ label, value }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-serif font-semibold">{value}</div>
    </Card>
  )
}
