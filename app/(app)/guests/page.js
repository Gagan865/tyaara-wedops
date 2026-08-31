'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { GUEST_GROUPS, GUEST_SIDES, GUEST_RSVP } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Star, Download, Trash2, Pencil, Search } from 'lucide-react'

export default function GuestsPage() {
  const confirm = useConfirm()
  const [ctx, setCtx] = useState({ projectId: null, orgId: null })
  const [guests, setGuests] = useState([])
  const [events, setEvents] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [fGroup, setFGroup] = useState('all')
  const [fSide, setFSide] = useState('all')
  const [fRsvp, setFRsvp] = useState('all')
  const [vipOnly, setVipOnly] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    const supabase = createClient()
    const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
    if (!pm) { setLoading(false); return }
    const projectId = pm.project_id; const orgId = pm.projects?.org_id
    setCtx({ projectId, orgId })
    const [g, e, inv] = await Promise.all([
      supabase.from('guests').select('*').eq('project_id', projectId).order('name'),
      supabase.from('events').select('id,name,icon,slug,color_gradient').eq('project_id', projectId).order('display_order'),
      supabase.from('guest_invitations').select('guest_id,event_id,invited')
    ])
    setGuests(g.data || []); setEvents(e.data || []); setInvitations(inv.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const invitedMap = useMemo(() => {
    const m = {}
    invitations.forEach(i => { m[`${i.guest_id}:${i.event_id}`] = i.invited })
    return m
  }, [invitations])

  async function toggleInvite(guestId, eventId, invited) {
    const supabase = createClient()
    await supabase.from('guest_invitations').upsert({ guest_id: guestId, event_id: eventId, invited })
    setInvitations(prev => {
      const idx = prev.findIndex(x => x.guest_id === guestId && x.event_id === eventId)
      if (idx === -1) return [...prev, { guest_id: guestId, event_id: eventId, invited }]
      const cp = [...prev]; cp[idx] = { ...cp[idx], invited }; return cp
    })
  }

  async function saveGuest(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      project_id: ctx.projectId, org_id: ctx.orgId,
      name: fd.get('name'),
      group: fd.get('group'), side: fd.get('side'), rsvp: fd.get('rsvp'),
      is_vip: fd.get('is_vip') === 'on', meal: fd.get('meal') || null, invited_via: fd.get('invited_via') || null
    }
    const supabase = createClient()
    if (editing) {
      const { error } = await supabase.from('guests').update(payload).eq('id', editing.id)
      if (error) return toast.error(error.message)
      toast.success('Guest updated')
    } else {
      const { error } = await supabase.from('guests').insert(payload)
      if (error) return toast.error(error.message)
      toast.success('Guest added')
    }
    setDialogOpen(false); setEditing(null); load()
  }

  async function removeGuest(id) {
    if (!await confirm({ title: 'Remove this guest?', description: 'This cannot be undone.', confirmLabel: 'Remove', destructive: true })) return
    const supabase = createClient()
    await supabase.from('guests').delete().eq('id', id)
    toast.success('Guest removed'); load()
  }

  function exportCSV() {
    const rows = [['Name','Group','Side','RSVP','VIP','Meal','Invited via', ...events.map(e => e.name)]]
    filtered.forEach(g => {
      rows.push([
        g.name, g.group, g.side, g.rsvp, g.is_vip ? 'Yes' : 'No', g.meal || '', g.invited_via || '',
        ...events.map(e => invitedMap[`${g.id}:${e.id}`] ? 'Yes' : 'No')
      ])
    })
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'guests.csv'; a.click()
    URL.revokeObjectURL(url); toast.success('Exported')
  }

  const filtered = guests.filter(g => {
    if (q && !g.name.toLowerCase().includes(q.toLowerCase())) return false
    if (fGroup !== 'all' && g.group !== fGroup) return false
    if (fSide !== 'all' && g.side !== fSide) return false
    if (fRsvp !== 'all' && g.rsvp !== fRsvp) return false
    if (vipOnly && !g.is_vip) return false
    return true
  })

  const rsvpCounts = {
    Coming: guests.filter(g => g.rsvp === 'Coming').length,
    Pending: guests.filter(g => g.rsvp === 'Pending').length,
    Maybe: guests.filter(g => g.rsvp === 'Maybe').length,
    'Not coming': guests.filter(g => g.rsvp === 'Not coming').length
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Guests</h1>
          <p className="text-sm text-slate-500">{guests.length} guests · {rsvpCounts.Coming} coming · {rsvpCounts.Pending} pending</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add guest</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 items-end">
        <div className="col-span-2 relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
          <Input placeholder="Search guests…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <Select value={fGroup} onValueChange={setFGroup}>
          <SelectTrigger><SelectValue placeholder="Group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {GUEST_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fSide} onValueChange={setFSide}>
          <SelectTrigger><SelectValue placeholder="Side" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sides</SelectItem>
            {GUEST_SIDES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fRsvp} onValueChange={setFRsvp}>
          <SelectTrigger><SelectValue placeholder="RSVP" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RSVP</SelectItem>
            {GUEST_RSVP.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch checked={vipOnly} onCheckedChange={setVipOnly} />
          <span className="text-sm">VIPs only</span>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="grid">Master Grid</TabsTrigger>
          <TabsTrigger value="byevent">By Event</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Group</th>
                  <th className="text-left px-3 py-2">Side</th>
                  <th className="text-left px-3 py-2">RSVP</th>
                  <th className="text-left px-3 py-2">Meal</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">
                      <div className="flex items-center gap-1">
                        {g.is_vip && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                        {g.name}
                      </div>
                    </td>
                    <td className="px-3 py-2">{g.group}</td>
                    <td className="px-3 py-2">{g.side}</td>
                    <td className="px-3 py-2">{g.rsvp}</td>
                    <td className="px-3 py-2">{g.meal || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(g); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeGuest(g.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="grid">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-slate-50">Guest</th>
                  {events.map(e => (
                    <th key={e.id} className="px-2 py-2 text-center">
                      <div className="text-lg">{e.icon}</div>
                      <div className="text-[10px] font-medium">{e.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(g => (
                  <tr key={g.id}>
                    <td className="px-3 py-2 sticky left-0 bg-white font-medium">
                      <div className="flex items-center gap-1">
                        {g.is_vip && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                        {g.name}
                      </div>
                      <div className="text-[10px] text-slate-500">{g.group} · {g.rsvp}</div>
                    </td>
                    {events.map(e => {
                      const invited = invitedMap[`${g.id}:${e.id}`] || false
                      return (
                        <td key={e.id} className="px-2 py-2 text-center">
                          <button
                            onClick={() => toggleInvite(g.id, e.id, !invited)}
                            className={`h-6 w-6 rounded-md border ${invited ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 hover:border-slate-400'} transition`}
                            title={invited ? 'Invited' : 'Not invited'}
                          >{invited ? '✓' : ''}</button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="byevent">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.map(e => {
              const invitedGuests = guests.filter(g => invitedMap[`${g.id}:${e.id}`])
              return (
                <Card key={e.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{e.icon}</span>
                    <span className="font-serif font-semibold">{e.name}</span>
                    <span className="ml-auto text-xs text-slate-500">{invitedGuests.length}</span>
                  </div>
                  <div className="space-y-1">
                    {invitedGuests.length === 0 ? (
                      <div className="text-xs text-slate-500">No guests invited yet.</div>
                    ) : invitedGuests.map(g => (
                      <div key={g.id} className="text-sm flex items-center gap-1">
                        {g.is_vip && <Star className="h-3 w-3 fill-amber-400 text-amber-500" />} {g.name}
                        <span className="ml-auto text-[10px] text-slate-500">{g.rsvp}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit guest' : 'Add guest'}</DialogTitle></DialogHeader>
          <form onSubmit={saveGuest} className="space-y-3">
            <div><Label>Name</Label><Input name="name" defaultValue={editing?.name} required /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Group</Label>
                <Select name="group" defaultValue={editing?.group || 'Family'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GUEST_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Side</Label>
                <Select name="side" defaultValue={editing?.side || 'Both'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GUEST_SIDES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>RSVP</Label>
                <Select name="rsvp" defaultValue={editing?.rsvp || 'Pending'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GUEST_RSVP.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Meal</Label><Input name="meal" defaultValue={editing?.meal || ''} placeholder="Veg / Non-Veg / Jain" /></div>
              <div><Label>Invited via</Label><Input name="invited_via" defaultValue={editing?.invited_via || ''} placeholder="WhatsApp / Card" /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_vip" name="is_vip" defaultChecked={editing?.is_vip} />
              <Label htmlFor="is_vip">Mark as VIP</Label>
            </div>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]">{editing ? 'Save' : 'Add'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
