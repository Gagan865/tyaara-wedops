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
import { formatINR, rupeesToPaise, paiseToRupees } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Check, ShoppingBag } from 'lucide-react'

export default function ShoppingPage() {
  const [ctx, setCtx] = useState({ projectId: null, orgId: null })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [events, setEvents] = useState([])
  const [members, setMembers] = useState([])
  const [open, setOpen] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      const projectId = pm.project_id
      setCtx({ projectId, orgId: pm.projects?.org_id })
      const [i, c, e, m] = await Promise.all([
        supabase.from('shopping_items').select('*, categories(name), events(name), memberships(name)').eq('project_id', projectId).order('created_at'),
        supabase.from('categories').select('id,name').eq('project_id', projectId).order('display_order'),
        supabase.from('events').select('id,name').eq('project_id', projectId).order('display_order'),
        supabase.from('memberships').select('id,name').eq('project_id', projectId)
      ])
      setItems(i.data || []); setCategories(c.data || []); setEvents(e.data || []); setMembers(m.data || [])
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function addItem(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.from('shopping_items').insert({
      project_id: ctx.projectId, org_id: ctx.orgId,
      name: fd.get('name'),
      category_id: fd.get('category_id') === 'none' ? null : fd.get('category_id'),
      event_id: fd.get('event_id') === 'none' ? null : fd.get('event_id'),
      quantity: parseInt(fd.get('quantity')) || 1,
      store: fd.get('store') || null,
      budget_paise: rupeesToPaise(fd.get('budget') || 0),
      actual_price_paise: rupeesToPaise(fd.get('actual') || 0),
      assigned_membership_id: fd.get('assigned_membership_id') === 'none' ? null : fd.get('assigned_membership_id'),
      purchased: false
    })
    if (error) return toast.error(error.message)
    toast.success('Item added'); setOpen(false); load()
  }

  async function togglePurchased(id, cur) {
    const supabase = createClient()
    await supabase.from('shopping_items').update({ purchased: !cur }).eq('id', id)
    load()
  }

  const purchased = items.filter(i => i.purchased).length
  const totalBudget = items.reduce((a, i) => a + Number(i.budget_paise || 0), 0)
  const totalActual = items.reduce((a, i) => a + Number(i.actual_price_paise || 0), 0)

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Shopping</h1>
          <p className="text-sm text-slate-500">Everything to buy — tracked, budgeted, assigned.</p>
        </div>
        <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add shopping item</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Purchased</div><div className="text-lg font-serif font-semibold">{purchased} of {items.length}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Planned budget</div><div className="text-lg font-serif font-semibold">{formatINR(totalBudget, { compact: true })}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Actually spent</div><div className="text-lg font-serif font-semibold">{formatINR(totalActual, { compact: true })}</div></Card>
      </div>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          <ShoppingBag className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          No shopping items yet.
          <div className="mt-3"><Button className="bg-[#0F4C3A]" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add your first item</Button></div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Event</th>
                <th className="text-left px-3 py-2">Qty</th>
                <th className="text-left px-3 py-2">Store</th>
                <th className="text-right px-3 py-2">Budget</th>
                <th className="text-right px-3 py-2">Actual</th>
                <th className="text-center px-3 py-2">Done</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(i => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{i.name}</td>
                  <td className="px-3 py-2 text-slate-600">{i.categories?.name || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{i.events?.name || 'General'}</td>
                  <td className="px-3 py-2 text-slate-600">{i.quantity}</td>
                  <td className="px-3 py-2 text-slate-600">{i.store || '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatINR(i.budget_paise)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(i.actual_price_paise)}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => togglePurchased(i.id, i.purchased)}
                      className={`h-6 w-6 rounded-md ${i.purchased ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'} inline-flex items-center justify-center`}>
                      {i.purchased ? <Check className="h-4 w-4" /> : ''}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add shopping item</DialogTitle></DialogHeader>
          <form onSubmit={addItem} className="space-y-3">
            <div><Label>Item</Label><Input name="name" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label>
                <Select name="category_id" defaultValue="none">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Event</Label>
                <Select name="event_id" defaultValue="none">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">General</SelectItem>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity</Label><Input name="quantity" type="number" defaultValue={1} /></div>
              <div><Label>Store</Label><Input name="store" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Budget (₹)</Label><Input name="budget" type="number" step="0.01" defaultValue={0} /></div>
              <div><Label>Actual price (₹)</Label><Input name="actual" type="number" step="0.01" defaultValue={0} /></div>
            </div>
            <div><Label>Assign to</Label>
              <Select name="assigned_membership_id" defaultValue="none">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Unassigned</SelectItem>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]">Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
