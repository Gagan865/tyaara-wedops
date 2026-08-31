'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { formatINR, formatDate, daysUntil } from '@/lib/format'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts'
import { Wallet, TrendingUp, AlertCircle, Users, CalendarClock } from 'lucide-react'

const COLORS = ['#0F4C3A','#166B4E','#0891b2','#f59e0b','#e11d48','#7c3aed','#059669','#f97316','#84cc16','#0284c7','#db2777','#a855f7']

export default function FinancialsPage() {
  const [ctx, setCtx] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [vendors, setVendors] = useState([])
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [shopping, setShopping] = useState([])

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id, wedding_date)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      setCtx({ projectId: pm.project_id, orgId: pm.projects?.org_id, weddingDate: pm.projects?.wedding_date })
      const [ex, v, e, c, s] = await Promise.all([
        supabase.from('expenses').select('*, events(name), vendors(name), categories(name)').eq('project_id', pm.project_id).order('date'),
        supabase.from('vendors').select('*, categories(name)').eq('project_id', pm.project_id),
        supabase.from('events').select('id,name').eq('project_id', pm.project_id).order('display_order'),
        supabase.from('categories').select('id,name').eq('project_id', pm.project_id).order('display_order'),
        supabase.from('shopping_items').select('*').eq('project_id', pm.project_id)
      ])
      setExpenses(ex.data || []); setVendors(v.data || []); setEvents(e.data || []); setCategories(c.data || []); setShopping(s.data || [])
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const totalBudget = vendors.reduce((a, v) => a + Number(v.quoted_paise || 0), 0)
                     + shopping.reduce((a, s) => a + Number(s.budget_paise || 0), 0)
  const totalInvoiced = vendors.reduce((a, v) => a + Number(v.quoted_paise || 0) + Number(v.tax_paise || 0) - Number(v.discount_paise || 0), 0)
  const totalPaid = expenses.filter(e => e.type === 'advance' || e.type === 'vendor_payment').reduce((a, e) => a + Number(e.amount_paise), 0)
  const remainingBalance = vendors.reduce((a, v) => a + Number(v.balance_paise || 0), 0)

  const now = new Date()
  const upcoming30 = vendors.filter(v => {
    if (!v.balance_due_date || Number(v.balance_paise) <= 0) return false
    const d = daysUntil(v.balance_due_date)
    return d >= 0 && d <= 30
  })
  const overdue = vendors.filter(v => v.balance_due_date && Number(v.balance_paise) > 0 && daysUntil(v.balance_due_date) < 0)

  const totalVendors = vendors.length
  const avgVendorCost = totalVendors ? totalBudget / totalVendors : 0

  // Budget vs actual per event (all 7)
  const eventChart = events.map(e => {
    const evExp = expenses.filter(x => x.event_id === e.id).reduce((a, x) => a + Number(x.amount_paise), 0)
    // approx budget per event from shopping tagged to event + vendors are not tagged to event
    const evBudget = shopping.filter(s => s.event_id === e.id).reduce((a, s) => a + Number(s.budget_paise || 0), 0)
    return { name: e.name, Budget: evBudget / 100, Actual: evExp / 100 }
  })

  // Spend by category
  const catChart = categories.map(c => ({
    name: c.name,
    value: expenses.filter(x => x.category_id === c.id).reduce((a, x) => a + Number(x.amount_paise), 0) / 100
  })).filter(d => d.value > 0)

  // Monthly cash flow — aggregate expenses by month
  const monthMap = new Map()
  expenses.forEach(e => {
    const d = new Date(e.date); const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    monthMap.set(key, (monthMap.get(key) || 0) + Number(e.amount_paise))
  })
  let monthArr = Array.from(monthMap.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => ({ month: k, amount: v/100 }))
  // If one month, show it as-is; render bar
  const monthChartType = monthArr.length <= 1 ? 'bar' : 'line'

  // Vendor breakdown
  const vendorChart = vendors.map(v => ({
    name: v.name.length > 14 ? v.name.substring(0, 14) + '…' : v.name,
    quoted: Number(v.quoted_paise) / 100,
    paid: Number(v.advance_paise) / 100
  }))

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Financials</h1>
        <p className="text-sm text-slate-500">The planner-grade money view. Every metric reconciles.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Wallet className="h-4 w-4" />} label="Total Budget" value={formatINR(totalBudget, { compact: true })} />
        <KPI icon={<TrendingUp className="h-4 w-4" />} label="Total Invoiced" value={formatINR(totalInvoiced, { compact: true })} tint="sky" />
        <KPI icon={<TrendingUp className="h-4 w-4" />} label="Total Paid" value={formatINR(totalPaid, { compact: true })} tint="emerald" hint="Advances + payments" />
        <KPI icon={<AlertCircle className="h-4 w-4" />} label="Remaining Balance" value={formatINR(remainingBalance, { compact: true })} tint="rose" hint="Sum of vendor balances" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<CalendarClock className="h-4 w-4" />} label="Upcoming Payments (30d)" value={formatINR(upcoming30.reduce((a,v) => a + Number(v.balance_paise),0), { compact: true })} hint={`${upcoming30.length} vendor(s)`} />
        <KPI icon={<AlertCircle className="h-4 w-4" />} label="Overdue" value={formatINR(overdue.reduce((a,v)=>a+Number(v.balance_paise),0), { compact: true })} tint="rose" hint={`${overdue.length} vendor(s)`} />
        <KPI icon={<Users className="h-4 w-4" />} label="Total Vendors" value={totalVendors} />
        <KPI icon={<Wallet className="h-4 w-4" />} label="Avg Vendor Cost" value={formatINR(avgVendorCost, { compact: true })} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Budget vs Actual per event</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={eventChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v/1000}k`} />
              <Tooltip formatter={(v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`} />
              <Legend />
              <Bar dataKey="Budget" fill="#94a3b8" />
              <Bar dataKey="Actual" fill="#0F4C3A" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Spending by category</div>
          {catChart.length === 0 ? <div className="text-sm text-slate-500 text-center py-12">No spending yet.</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={catChart} dataKey="value" nameKey="name" outerRadius={90} label={({ name, percent }) => `${name} ${Math.round(percent*100)}%`}>
                  {catChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Monthly cash flow</div>
          {monthArr.length === 0 ? <div className="text-sm text-slate-500 text-center py-12">No expenses to plot.</div> : monthChartType === 'bar' ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthArr}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v/1000}k`} />
                <Tooltip formatter={(v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`} />
                <Bar dataKey="amount" fill="#0F4C3A" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthArr}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v/1000}k`} />
                <Tooltip formatter={(v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`} />
                <Line type="monotone" dataKey="amount" stroke="#0F4C3A" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Vendor expense breakdown</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={vendorChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v/1000}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={(v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`} />
              <Legend />
              <Bar dataKey="quoted" fill="#94a3b8" />
              <Bar dataKey="paid" fill="#0F4C3A" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}

function KPI({ icon, label, value, tint, hint }) {
  const tints = { emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900', sky: 'bg-sky-50 border-sky-200 text-sky-900', rose: 'bg-rose-50 border-rose-200 text-rose-900' }
  return (
    <Card className={`p-4 border ${tint ? tints[tint] : ''}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">{icon}<span>{label}</span></div>
      <div className="text-xl font-serif font-semibold mt-2">{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-1">{hint}</div>}
    </Card>
  )
}
