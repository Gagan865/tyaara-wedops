'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatDate } from '@/lib/format'
import { TASK_PRIORITIES, TASK_STATUSES, PRIORITY_STYLES, STATUS_STYLES } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Copy, Trash2, Pencil, Filter } from 'lucide-react'

export default function TasksPage() {
  const confirm = useConfirm()
  const [ctx, setCtx] = useState({ projectId: null, orgId: null })
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [members, setMembers] = useState([])
  const [categories, setCategories] = useState([])
  const [assigneeMap, setAssigneeMap] = useState({})
  const [loading, setLoading] = useState(true)

  const [filterEvent, setFilterEvent] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterMember, setFilterMember] = useState('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [dialogAssignees, setDialogAssignees] = useState([])

  async function load() {
    const supabase = createClient()
    const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
    if (!pm) { setLoading(false); return }
    const projectId = pm.project_id; const orgId = pm.projects?.org_id
    setCtx({ projectId, orgId })
    const [t, e, m, c, ta] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', projectId).order('due_date', { nullsFirst: false }),
      supabase.from('events').select('id,name,slug,icon,color_gradient').eq('project_id', projectId).order('display_order'),
      supabase.from('memberships').select('id,name,role').eq('project_id', projectId),
      supabase.from('categories').select('id,name').eq('project_id', projectId).order('display_order'),
      supabase.from('task_assignees').select('task_id,membership_id,memberships(name)')
    ])
    setTasks(t.data || []); setEvents(e.data || []); setMembers(m.data || []); setCategories(c.data || [])
    const map = {}
    ;(ta.data || []).forEach(r => { (map[r.task_id] = map[r.task_id] || []).push(r) })
    setAssigneeMap(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = tasks.filter(t => {
    if (filterEvent === 'unassigned' && t.event_id) return false
    if (filterEvent !== 'all' && filterEvent !== 'unassigned' && t.event_id !== filterEvent) return false
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false
    if (filterMember !== 'all') {
      const rows = assigneeMap[t.id] || []
      if (!rows.find(r => r.membership_id === filterMember)) return false
    }
    return true
  })

  async function saveTask(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      project_id: ctx.projectId, org_id: ctx.orgId,
      title: fd.get('title'),
      description: fd.get('description') || null,
      event_id: fd.get('event_id') === 'none' ? null : fd.get('event_id'),
      category_id: fd.get('category_id') === 'none' ? null : fd.get('category_id'),
      priority: fd.get('priority'),
      status: fd.get('status'),
      due_date: fd.get('due_date') || null,
      estimated_hours: parseInt(fd.get('estimated_hours')) || 4
    }
    const supabase = createClient()
    let taskId
    if (editing) {
      const { data, error } = await supabase.from('tasks').update(payload).eq('id', editing.id).select('id').single()
      if (error) return toast.error(error.message)
      taskId = data.id
      await supabase.from('task_assignees').delete().eq('task_id', taskId)
    } else {
      const { data, error } = await supabase.from('tasks').insert(payload).select('id').single()
      if (error) return toast.error(error.message)
      taskId = data.id
    }
    if (dialogAssignees.length > 0) {
      await supabase.from('task_assignees').insert(dialogAssignees.map(mid => ({ task_id: taskId, membership_id: mid })))
    }
    toast.success(editing ? 'Task updated' : 'Task created')
    setDialogOpen(false); setEditing(null); setDialogAssignees([]); load()
  }

  async function duplicateTask(t) {
    const supabase = createClient()
    const base = t.title.replace(/ \(copy \d+\)$/,'')
    const copies = tasks.filter(x => x.title.startsWith(base + ' (copy'))
    const nextN = copies.length + 1
    const { id, created_at, updated_at, ...rest } = t
    const { error } = await supabase.from('tasks').insert({ ...rest, title: `${base} (copy ${nextN})` })
    if (error) return toast.error(error.message)
    toast.success('Duplicated'); load()
  }

  async function deleteTask(id) {
    if (!await confirm({ title: 'Delete this task?', description: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true })) return
    const supabase = createClient()
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Deleted'); load()
  }

  async function moveStatus(taskId, status) {
    const supabase = createClient()
    await supabase.from('tasks').update({ status }).eq('id', taskId)
    load()
  }

  function openNew() { setEditing(null); setDialogAssignees([]); setDialogOpen(true) }
  function openEdit(t) {
    setEditing(t)
    setDialogAssignees((assigneeMap[t.id] || []).map(r => r.membership_id))
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Tasks</h1>
          <p className="text-sm text-slate-500">Board · List · Table — keep everyone unblocked.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex items-center gap-1 text-slate-500"><Filter className="h-4 w-4" /></div>
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="unassigned">General / Unassigned</SelectItem>
              {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {TASK_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]" onClick={openNew}><Plus className="h-4 w-4 mr-2" />New task</Button>
        </div>
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {TASK_STATUSES.map(s => {
              const bucket = filtered.filter(t => t.status === s)
              return (
                <Card key={s} className="p-3 bg-white/70 min-h-40">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_STYLES[s]}`}>{s}</span>
                    <span className="text-[10px] text-slate-500">{bucket.length}</span>
                  </div>
                  <div className="space-y-2">
                    {bucket.map(t => (
                      <div key={t.id} className="rounded-md border border-slate-200 bg-white p-2.5 text-sm shadow-sm">
                        <div className="font-medium leading-tight">{t.title}</div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                          {t.due_date && <span className="text-[10px] text-slate-500">{formatDate(t.due_date)}</span>}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <Select value={t.status} onValueChange={(v) => moveStatus(t.id, v)}>
                            <SelectTrigger className="h-6 text-[10px] w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TASK_STATUSES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <div className="flex">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(t)}><Pencil className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => duplicateTask(t)}><Copy className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteTask(t.id)}><Trash2 className="h-3 w-3 text-rose-500" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <Card className="divide-y">
            {filtered.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No tasks match your filters. <Button variant="link" onClick={openNew}>Create one →</Button></div>
            ) : filtered.map(t => (
              <div key={t.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{t.title}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                    {t.due_date && <span className="text-[10px] text-slate-500">{formatDate(t.due_date)}</span>}
                  </div>
                </div>
                <div className="text-xs text-slate-500">{(assigneeMap[t.id]||[]).map(a => a.memberships?.name).join(', ') || '—'}</div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateTask(t)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTask(t.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="table">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Title</th>
                  <th className="text-left px-3 py-2">Priority</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Due</th>
                  <th className="text-left px-3 py-2">Assignees</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{t.title}</td>
                    <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span></td>
                    <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[t.status]}`}>{t.status}</span></td>
                    <td className="px-3 py-2 text-slate-600">{t.due_date ? formatDate(t.due_date) : '—'}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{(assigneeMap[t.id]||[]).map(a => a.memberships?.name).join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateTask(t)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTask(t.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setDialogAssignees([]) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit task' : 'New task'}</DialogTitle></DialogHeader>
          <form onSubmit={saveTask} className="space-y-3">
            <div><Label>Title</Label><Input name="title" defaultValue={editing?.title} required /></div>
            <div><Label>Description</Label><Textarea name="description" defaultValue={editing?.description || ''} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Event</Label>
                <Select name="event_id" defaultValue={editing?.event_id || 'none'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General / Unassigned</SelectItem>
                    {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select name="category_id" defaultValue={editing?.category_id || 'none'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Priority</Label>
                <Select name="priority" defaultValue={editing?.priority || 'Medium'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={editing?.status || 'Not Started'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Est. hours</Label>
                <Input name="estimated_hours" type="number" defaultValue={editing?.estimated_hours || 4} />
              </div>
            </div>
            <div><Label>Due date</Label><Input name="due_date" type="date" defaultValue={editing?.due_date || ''} /></div>
            <div>
              <Label>Assignees</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {members.map(m => {
                  const on = dialogAssignees.includes(m.id)
                  return (
                    <button key={m.id} type="button"
                      onClick={() => setDialogAssignees(a => on ? a.filter(x => x !== m.id) : [...a, m.id])}
                      className={`text-xs px-2 py-1 rounded-full border ${on ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white border-slate-200 text-slate-700'}`}>
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]">{editing ? 'Save' : 'Create'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
