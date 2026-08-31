'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState } from '@/components/app/page-state'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function EventsPage() {
  const confirm = useConfirm()
  const [events, setEvents] = useState([])
  const [projectId, setProjectId] = useState(null)
  const [orgId, setOrgId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    const supabase = createClient()
    const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(id, org_id, wedding_date)').limit(1).maybeSingle()
    if (!pm) { setLoading(false); return }
    setProjectId(pm.project_id); setOrgId(pm.projects?.org_id)
    const { data } = await supabase.from('events').select('*').eq('project_id', pm.project_id).order('display_order')
    setEvents(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      project_id: projectId, org_id: orgId,
      name: fd.get('name'),
      slug: (fd.get('slug') || fd.get('name') || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      icon: fd.get('icon') || '🎉',
      color_gradient: fd.get('color_gradient') || 'from-emerald-400 to-green-600',
      event_date: fd.get('event_date') || null,
      display_order: parseInt(fd.get('display_order')) || (events.length + 1)
    }
    const supabase = createClient()
    if (editing) {
      const { error } = await supabase.from('events').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
      toast.success('Function updated')
    } else {
      const { error } = await supabase.from('events').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Function added')
    }
    setDialogOpen(false); setEditing(null); load()
  }

  async function remove(id) {
    if (!await confirm({ title: 'Delete this function?', description: 'Related tasks and invitations will keep their history.', confirmLabel: 'Delete', destructive: true })) return
    const supabase = createClient()
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Function removed'); load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Manage Events</h1>
          <p className="text-sm text-slate-500">The 7 functions in your celebration. Add, edit, or remove.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
          <DialogTrigger asChild>
            <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]"><Plus className="h-4 w-4 mr-2" />Add function</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit function' : 'Add function'}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label>Name</Label><Input name="name" defaultValue={editing?.name} required /></div>
                <div><Label>Icon</Label><Input name="icon" defaultValue={editing?.icon} placeholder="🎉" maxLength={3} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Slug (URL)</Label><Input name="slug" defaultValue={editing?.slug} placeholder="auto" /></div>
                <div><Label>Event date</Label><Input name="event_date" type="date" defaultValue={editing?.event_date || ''} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Color gradient</Label><Input name="color_gradient" defaultValue={editing?.color_gradient || 'from-emerald-400 to-green-600'} /></div>
                <div><Label>Display order</Label><Input name="display_order" type="number" defaultValue={editing?.display_order || (events.length + 1)} /></div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-[#0F4C3A]">{editing ? 'Save' : 'Add'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <LoadingState /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map(e => (
            <Card key={e.id} className="overflow-hidden">
              <div className={`p-6 text-white bg-gradient-to-br ${e.color_gradient}`}>
                <div className="text-3xl">{e.icon}</div>
                <div className="font-serif text-xl font-semibold mt-2">{e.name}</div>
                <div className="text-xs text-white/80 mt-1">{e.event_date ? formatDate(e.event_date) : 'Date TBD — set one to activate reminders'}</div>
              </div>
              <div className="p-3 flex items-center gap-2 justify-between">
                <Link href={`/events/${e.slug}`}><Button size="sm" variant="outline">Open workspace</Button></Link>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
