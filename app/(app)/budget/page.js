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
import { formatINR, formatDate, rupeesToPaise, paiseToRupees, toIsoDate } from '@/lib/format'
import { toast } from 'sonner'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Plus, Wallet, AlertCircle, TrendingUp } from 'lucide-react'

const COLORS = ['#0F4C3A','#166B4E','#0891b2','#f59e0b','#e11d48','#7c3aed','#059669','#f97316','#84cc16','#0284c7','#db2777','#a855f7']

export default function BudgetPage() {
  const [ctx, setCtx] = useState({ projectId: null, orgId: null })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [vendors, setVendors] = useState([])
  const [shopping, setShopping] = useState([])
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [open, setOpen] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      setCtx({ projectId: pm.project_id, orgId: pm.projects?.org_id })
      const [ex, v, s, e, c] = await Promise.all([
        supabase.from('expenses').select('*, events(name), vendors(name), categories(name)').eq('project_id', pm.project_id).order('date', { ascending: false }),
        supabase.from('vendors').select('*, categories(name)').eq('project_id', pm.project_id),
        supabase.from('shopping_items').select('*, events(name), categories(name)').eq('project_id', pm.project_id),
        supabase.from('events').select('id,name,color_gradient').eq('project_id', pm.project_id).order('display_order'),
        supabase.from('categories').select('id,name').eq('project_id', pm.project_id).order('display_order')
      ])
      setExpenses(ex.data || []); setVendors(v.data || []); setShopping(s.data || [])
      setEvents(e.data || []); setCategories(c.data || [])
      // Total budget = quoted from vendors + budget from shopping
      const tb = (v.data || []).reduce((a, x) => a + Number(x.quoted_paise || 0), 0)
              + (s.data || []).reduce((a, x) => a + Number(x.budget_paise || 0), 0)
      setTotalBudget(tb)
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const spent = expenses.reduce((a, e) => a + Number(e.amount_paise), 0)
  const remaining = totalBudget - spent
  const overBudget = totalBudget > 0 && spent > totalBudget

  // Spend by category
  const catData = categories.map(c => ({
    name: c.name,
    value: expenses.filter(e => e.category_id === c.id).reduce((a, e) => a + Number(e.amount_paise), 0) / 100
  })).filter(d => d.value > 0)

  // Budget vs spent per event (include ALL events)
  const eventData = events.map(e => {
    const evExpenses = expenses.filter(x => x.event_id === e.id).reduce((a, x) => a + Number(x.amount_paise), 0)
    return { name: e.name, spent: evExpenses / 100 }
  })

  async function addExpense(ev) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.from('expenses').insert({
      project_id: ctx.projectId, org_id: ctx.orgId,
      description: fd.get('description'),
      amount_paise: rupeesToPaise(fd.get('amount') || 0),
      date: fd.get('date') || toIsoDate(new Date()),
      event_id: fd.get('event_id') === 'none' ? null : fd.get('event_id'),
      vendor_id: fd.get('vendor_id') === 'none' ? null : fd.get('vendor_id'),
      category_id: fd.get('category_id') === 'none' ? null : fd.get('category_id'),
      type: fd.get('type') || 'expense'
    })
    if (error) return toast.error(error.message)
    toast.success('Expense added'); setOpen(false); load()
  }

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Budget</h1>
          <p className="text-sm text-slate-500">Every rupee, wired to real event and vendor FKs.</p>
        </div>
        <Button className="bg-[#0F4C3A]" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add expense</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-medium"><Wallet className="h-4 w-4" />Total Budget</div>
          <div className="text-2xl font-serif font-semibold text-emerald-900 mt-2">{formatINR(totalBudget, { compact: true })}</div>
          <div className="text-xs text-emerald-700 mt-1">Across vendors + planned shopping</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="flex items-center gap-2 text-amber-800 text-xs font-medium"><TrendingUp className="h-4 w-4" />Spent so far</div>
          <div className="text-2xl font-serif font-semibold text-amber-900 mt-2">{formatINR(spent, { compact: true })}</div>
          <div className="text-xs text-amber-700 mt-1">{expenses.length} recorded expenses</div>
        </Card>
        <Card className={`p-4 border ${overBudget ? 'bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200' : 'bg-gradient-to-br from-sky-50 to-sky-100 border-sky-200'}`}>
          <div className={`flex items-center gap-2 text-xs font-medium ${overBudget ? 'text-rose-800' : 'text-sky-800'}`}>
            {overBudget ? <AlertCircle className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
            Remaining
          </div>
          <div className={`text-2xl font-serif font-semibold mt-2 ${overBudget ? 'text-rose-900' : 'text-sky-900'}`}>{formatINR(remaining, { compact: true })}</div>
          <div className={`text-xs mt-1 ${overBudget ? 'text-rose-700' : 'text-sky-700'}`}>{overBudget ? 'Over budget!' : totalBudget === 0 ? 'Set a budget by adding vendors/shopping' : `${Math.round((remaining/totalBudget)*100)}% left`}</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Spending by category</div>
          {catData.length === 0 ? <div className="text-sm text-slate-500 text-center py-12">No spending yet.</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" outerRadius={90} label={({ name, percent }) => `${name} ${Math.round(percent*100)}%`}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Spend by event (all 7)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={eventData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v/1000}k`} />
              <Tooltip formatter={(v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`} />
              <Bar dataKey="spent" fill="#0F4C3A" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-3 border-b bg-slate-50"><div className="text-sm font-semibold">Expense history</div></div>
        <table className="w-full text-sm">
          <thead className="bg-white text-slate-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-left px-3 py-2">Event</th>
              <th className="text-left px-3 py-2">Vendor</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-right px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.length === 0 ? (
              <tr><td colSpan="7" className="px-3 py-6 text-center text-slate-500">No expenses yet. <button className="text-[#0F4C3A] underline" onClick={() => setOpen(true)}>Add one</button></td></tr>
            ) : expenses.map(e => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-600">{formatDate(e.date)}</td>
                <td className="px-3 py-2 font-medium">{e.description}</td>
                <td className="px-3 py-2 text-slate-600">{e.events?.name || 'General'}</td>
                <td className="px-3 py-2 text-slate-600">{e.vendors?.name || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{e.categories?.name || '—'}</td>
                <td className="px-3 py-2"><span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">{e.type}</span></td>
                <td className="px-3 py-2 text-right font-medium">{formatINR(e.amount_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
          <form onSubmit={addExpense} className="space-y-3">
            <div><Label>Description</Label><Input name="description" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (₹)</Label><Input name="amount" type="number" step="0.01" required /></div>
              <div><Label>Date</Label><Input name="date" type="date" defaultValue={toIsoDate(new Date())} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Event</Label>
                <Select name="event_id" defaultValue="none">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">General</SelectItem>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Vendor</Label>
                <Select name="vendor_id" defaultValue="none">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label>
                <Select name="category_id" defaultValue="none">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Type</Label>
                <Select name="type" defaultValue="expense">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="vendor_payment">Vendor payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button className="bg-[#0F4C3A]" type="submit">Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
