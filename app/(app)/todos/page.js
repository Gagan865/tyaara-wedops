'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TASK_PRIORITIES, PRIORITY_STYLES } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Trash2, Sparkles } from 'lucide-react'

export default function TodosPage() {
  const [ctx, setCtx] = useState({ projectId: null, orgId: null })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [lists, setLists] = useState([])
  const [items, setItems] = useState([])
  const [members, setMembers] = useState([])
  const [confetti, setConfetti] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      const projectId = pm.project_id
      setCtx({ projectId, orgId: pm.projects?.org_id })
      const [l, i, m] = await Promise.all([
        supabase.from('todo_lists').select('*').eq('project_id', projectId).order('display_order'),
        supabase.from('todo_items').select('*').eq('project_id', projectId),
        supabase.from('memberships').select('id,name').eq('project_id', projectId)
      ])
      setLists(l.data || []); setItems(i.data || []); setMembers(m.data || [])
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function addList() {
    const name = prompt('List name?')
    if (!name) return
    const supabase = createClient()
    await supabase.from('todo_lists').insert({ project_id: ctx.projectId, org_id: ctx.orgId, name, display_order: lists.length + 1 })
    load()
  }

  async function addItem(listId) {
    const supabase = createClient()
    const { data } = await supabase.from('todo_items').insert({ list_id: listId, project_id: ctx.projectId, text: 'New item', priority: 'Medium', done: false }).select('*').single()
    if (data) setItems(prev => [...prev, data])
  }

  async function updateItem(id, patch) {
    const supabase = createClient()
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    await supabase.from('todo_items').update(patch).eq('id', id)

    // Confetti check
    setTimeout(() => {
      const currentList = items.find(i => i.id === id)?.list_id
      if (!currentList) return
      const listItems = items.map(i => i.id === id ? { ...i, ...patch } : i).filter(i => i.list_id === currentList)
      if (listItems.length > 0 && listItems.every(i => i.done)) {
        setConfetti(true)
        setTimeout(() => setConfetti(false), 2500)
      }
    }, 100)
  }

  async function deleteItem(id) {
    const supabase = createClient()
    await supabase.from('todo_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5 relative">
      {confetti && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="text-6xl animate-bounce">🎉</div>
        </div>
      )}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">To-Do Lists</h1>
          <p className="text-sm text-slate-500">Inline everything. Priority · Owner · Due date on every row.</p>
        </div>
        <Button variant="outline" onClick={addList}><Plus className="h-4 w-4 mr-2" />New list</Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.map(list => {
          const listItems = items.filter(i => i.list_id === list.id)
          const doneCount = listItems.filter(i => i.done).length
          return (
            <Card key={list.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-serif font-semibold">{list.name}</div>
                <div className="text-xs text-slate-500">{doneCount}/{listItems.length}</div>
              </div>
              <div className="space-y-2">
                {listItems.length === 0 && (
                  <div className="text-xs text-slate-500">No items yet. Add one below.</div>
                )}
                {listItems.map(i => (
                  <div key={i.id} className="rounded-md border border-slate-200 bg-white p-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={i.done} onChange={(e) => updateItem(i.id, { done: e.target.checked })} className="h-4 w-4" />
                      <input type="text" defaultValue={i.text} onBlur={(e) => updateItem(i.id, { text: e.target.value })}
                        className={`flex-1 bg-transparent outline-none text-sm ${i.done ? 'line-through text-slate-400' : ''}`} />
                      <button onClick={() => deleteItem(i.id)}><Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-rose-500" /></button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pl-6">
                      <Select value={i.priority || 'Medium'} onValueChange={(v) => updateItem(i.id, { priority: v })}>
                        <SelectTrigger className="h-7 text-[11px] w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{TASK_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={i.owner_membership_id || 'none'} onValueChange={(v) => updateItem(i.id, { owner_membership_id: v === 'none' ? null : v })}>
                        <SelectTrigger className="h-7 text-[11px] w-28"><SelectValue placeholder="Owner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No owner</SelectItem>
                          {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="date" defaultValue={i.due_date || ''} onBlur={(e) => updateItem(i.id, { due_date: e.target.value || null })}
                        className="h-7 text-[11px] w-32" />
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => addItem(list.id)}><Plus className="h-3.5 w-3.5 mr-1.5" />Add item</Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
