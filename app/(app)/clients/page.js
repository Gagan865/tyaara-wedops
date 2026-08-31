'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { formatINR, formatDate, rupeesToPaise, paiseToRupees } from '@/lib/format'
import { downloadCsv } from '@/lib/export-csv'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Download, ArrowRightLeft, ExternalLink } from 'lucide-react'

const CUISINES = ['North Indian', 'South Indian', 'Both', 'Other']

// Client tracker — ORG-scoped, shared across every wedding in the organisation.
// Column order mirrors the source sheet exactly (Sl No is positional, not stored).
export default function ClientsPage() {
  const confirm = useConfirm()
  const router = useRouter()
  const [orgId, setOrgId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [me, setMe] = useState({ id: null, name: 'You' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [converting, setConverting] = useState(null)

  async function load() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      // Trackers are org-scoped; derive the org from the active wedding (every user in
      // the app belongs to at least one). RLS keeps this to the caller's own org.
      const { data: pm } = await activeProjectQuery(supabase, 'projects(org_id)').limit(1).maybeSingle()
      const oid = pm?.projects?.org_id || null
      if (!oid) { setNoProject(true); setLoading(false); return }

      // Snapshot the caller's display name for authorship. profiles_self lets a user
      // read only their own row, which is exactly what we need here.
      let meName = user?.email?.split('@')[0] || 'You'
      let admin = false
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()
        if (prof?.name) meName = prof.name
        const { data: mem } = await supabase.from('org_members').select('role').eq('org_id', oid).eq('user_id', user.id).maybeSingle()
        admin = ['owner', 'admin'].includes(mem?.role)
      }

      // RLS returns every client to an admin, only the caller's own to an employee.
      const { data, error } = await supabase
        .from('client_tracker').select('*').eq('org_id', oid)
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
    const services = String(fd.get('services_required') || '').split(',').map(s => s.trim()).filter(Boolean)
    const payload = {
      org_id: orgId,
      contacted_date: fd.get('contacted_date') || null,
      client_name: fd.get('client_name'),
      client_contact: fd.get('client_contact') || null,
      event_date: fd.get('event_date') || null,
      cuisine_style: fd.get('cuisine_style') === 'none' ? null : fd.get('cuisine_style'),
      event_flow: fd.get('event_flow') || null,
      services_required: services,
      overall_budget_paise: rupeesToPaise(fd.get('overall_budget') || 0),
      preferred_location: fd.get('preferred_location') || null,
      updates: fd.get('updates') || null,
      remark: fd.get('remark') || null
    }
    const supabase = createClient()
    if (editing) {
      const { error } = await supabase.from('client_tracker').update(payload).eq('id', editing.id)
      if (error) return toast.error(error.message)
      toast.success('Client updated')
    } else {
      const { error } = await supabase.from('client_tracker')
        .insert({ ...payload, created_by: me.id, created_by_name: me.name })
      if (error) return toast.error(error.message)
      toast.success('Client added')
    }
    setDialogOpen(false); setEditing(null); load()
  }

  async function remove(row) {
    if (!await confirm({ title: 'Delete this client?', description: `Remove ${row.client_name} from the tracker. This cannot be undone.`, confirmLabel: 'Delete', destructive: true })) return
    const supabase = createClient()
    const { error } = await supabase.from('client_tracker').delete().eq('id', row.id)
    if (error) return toast.error(error.message)
    toast.success('Client deleted'); load()
  }

  async function convert(row) {
    if (row.converted_project_id) return
    if (!row.event_date) return toast.error('Add an event date first — a wedding needs a date.')
    if (!await confirm({
      title: 'Convert to a wedding?',
      description: `Creates a real wedding for ${row.client_name} with the standard 7 functions, 23 categories and checklists.`,
      confirmLabel: 'Convert'
    })) return
    setConverting(row.id)
    try {
      const r = await fetch('/api/clients/convert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: row.id })
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Convert failed'); setConverting(null); return }
      toast.success('Wedding created')
      await load()
      setConverting(null)
      if (await confirm({ title: 'Switch to this wedding now?', description: 'Make the new wedding your active workspace.', confirmLabel: 'Switch' })) {
        await fetch('/api/project/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: j.projectId }) })
        router.refresh()
      }
    } catch (e) {
      console.error('convert failed:', e)
      toast.error('Convert failed'); setConverting(null)
    }
  }

  async function goToWedding(projectId) {
    await fetch('/api/project/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
    window.location.href = '/dashboard'
  }

  function exportCsv() {
    const cols = [
      { header: 'Sl No', value: r => rows.indexOf(r) + 1 },
      { header: 'Contacted Date', value: r => r.contacted_date ? formatDate(r.contacted_date) : '' },
      { header: 'Client Name', value: r => r.client_name },
      { header: 'Client Contact', value: r => r.client_contact || '' },
      { header: 'Event Date', value: r => r.event_date ? formatDate(r.event_date) : '' },
      { header: 'North / South Indian', value: r => r.cuisine_style || '' },
      { header: 'Event Flow', value: r => r.event_flow || '' },
      { header: 'Services Required', value: r => (r.services_required || []).join(', ') },
      { header: 'Overall Budget', value: r => paiseToRupees(r.overall_budget_paise), money: true },
      { header: 'Preferred Location', value: r => r.preferred_location || '' },
      { header: 'Status', value: r => r.status || '' },
      { header: 'Updates', value: r => r.updates || '' },
      { header: 'Remark', value: r => r.remark || '' }
    ]
    if (isAdmin) cols.push({ header: 'Added By', value: r => r.created_by_name || '' })
    downloadCsv('clients', cols, rows)
  }

  const total = rows.length
  const booked = rows.filter(r => r.converted_project_id || r.status === 'Booked').length
  const pipeline = rows.reduce((a, r) => a + Number(r.overall_budget_paise || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Client Tracker</h1>
          <p className="text-sm text-slate-500">{isAdmin ? 'Every team member’s enquiries across the organisation.' : 'Your enquiries — only you can see these.'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]" onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />Add client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI label="Total clients" value={`${total}`} />
        <KPI label="Booked" value={`${booked}`} />
        <KPI label="Pipeline value" value={formatINR(pipeline, { compact: true })} />
      </div>

      {loading ? <LoadingState /> :
        noProject ? <NoProjectState /> :
        loadError ? <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} /> :
        rows.length === 0 ? (
          <EmptyState
            title="No clients yet"
            description="Add your first enquiry to start tracking leads across all your weddings."
            action={<Button className="bg-[#0F4C3A]" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add client</Button>}
          />
        ) : (
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sl No</TableHead>
                  <TableHead>Contacted Date</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Client Contact</TableHead>
                  <TableHead>Event Date</TableHead>
                  <TableHead>North / South Indian</TableHead>
                  <TableHead>Event Flow</TableHead>
                  <TableHead>Services Required</TableHead>
                  <TableHead className="text-right">Overall Budget</TableHead>
                  <TableHead>Preferred Location</TableHead>
                  <TableHead>Updates</TableHead>
                  <TableHead>Remark</TableHead>
                  {isAdmin && <TableHead>Added By</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(r.contacted_date)}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{r.client_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.client_contact || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(r.event_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.cuisine_style || '—'}</TableCell>
                    <TableCell className="max-w-[16rem] truncate" title={r.event_flow || ''}>{r.event_flow || '—'}</TableCell>
                    <TableCell className="max-w-[14rem]">{(r.services_required || []).length ? (r.services_required || []).join(', ') : '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatINR(r.overall_budget_paise)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.preferred_location || '—'}</TableCell>
                    <TableCell className="max-w-[14rem] truncate" title={r.updates || ''}>{r.updates || '—'}</TableCell>
                    <TableCell className="max-w-[14rem] truncate" title={r.remark || ''}>{r.remark || '—'}</TableCell>
                    {isAdmin && <TableCell className="whitespace-nowrap text-slate-500">{r.created_by_name || '—'}</TableCell>}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {r.converted_project_id ? (
                          <Button size="sm" variant="outline" className="h-7" onClick={() => goToWedding(r.converted_project_id)}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Wedding
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7" disabled={converting === r.id} onClick={() => convert(r)}>
                            <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />{converting === r.id ? 'Converting…' : 'Convert'}
                          </Button>
                        )}
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
          <DialogHeader><DialogTitle>{editing ? 'Edit client' : 'Add client'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contacted date</Label><Input name="contacted_date" type="date" defaultValue={editing?.contacted_date || ''} /></div>
              <div><Label>Event date</Label><Input name="event_date" type="date" defaultValue={editing?.event_date || ''} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Client name</Label><Input name="client_name" defaultValue={editing?.client_name || ''} required /></div>
              <div><Label>Client contact</Label><Input name="client_contact" defaultValue={editing?.client_contact || ''} placeholder="+91…" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>North / South Indian</Label>
                <Select name="cuisine_style" defaultValue={editing?.cuisine_style || 'none'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {CUISINES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Overall budget (₹)</Label><Input name="overall_budget" type="number" step="0.01" min="0" defaultValue={editing ? paiseToRupees(editing.overall_budget_paise) : 0} /></div>
            </div>
            <div><Label>Services required</Label><Input name="services_required" defaultValue={(editing?.services_required || []).join(', ')} placeholder="Comma separated, e.g. Catering, Decor, Photography" /></div>
            <div><Label>Preferred location</Label><Input name="preferred_location" defaultValue={editing?.preferred_location || ''} /></div>
            <div><Label>Event flow</Label><Textarea name="event_flow" rows={2} defaultValue={editing?.event_flow || ''} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Updates</Label><Textarea name="updates" rows={2} defaultValue={editing?.updates || ''} /></div>
              <div><Label>Remark</Label><Textarea name="remark" rows={2} defaultValue={editing?.remark || ''} /></div>
            </div>
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
