'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatINR, formatDate } from '@/lib/format'
import { Download, FileText, Printer } from 'lucide-react'

function toCSV(rows) {
  return rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n')
}
function downloadCSV(name, rows) {
  const url = URL.createObjectURL(new Blob([toCSV(rows)], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
function downloadXLSX(name, rows) {
  // Simple TSV — Excel opens .xls with TSV
  const tsv = rows.map(r => r.map(c => String(c ?? '').replace(/\t/g,' ')).join('\t')).join('\n')
  const url = URL.createObjectURL(new Blob([tsv], { type: 'application/vnd.ms-excel' }))
  const a = document.createElement('a'); a.href = url; a.download = name.replace('.csv','.xls'); a.click(); URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [data, setData] = useState(null)

  async function load() {
    const supabase = createClient()
    const { data: pm } = await activeProjectQuery(supabase, 'project_id').limit(1).maybeSingle()
    if (!pm) { setData({ vendors: [], expenses: [], events: [] }); return }
    const [v, ex, ev] = await Promise.all([
      supabase.from('vendors').select('*, categories(name)').eq('project_id', pm.project_id),
      supabase.from('expenses').select('*, events(name), vendors(name), categories(name)').eq('project_id', pm.project_id),
      supabase.from('events').select('id,name').eq('project_id', pm.project_id).order('display_order')
    ])
    setData({ vendors: v.data || [], expenses: ex.data || [], events: ev.data || [] })
  }
  useEffect(() => { load() }, [])

  if (!data) return <LoadingState label="Loading reports…" />

  const { vendors, expenses, events } = data

  // Vendor Report
  const vendorRows = [['Name','Category','Contact','Phone','GST','Quoted','Advance','Balance','Due','Status','Rating']]
  vendors.forEach(v => vendorRows.push([v.name, v.categories?.name || '', v.contact_name || '', v.phone || '', v.gst_number || '', formatINR(v.quoted_paise), formatINR(v.advance_paise), formatINR(v.balance_paise), v.balance_due_date || '', v.status, v.rating || '']))
  const vendorTotal = vendors.reduce((a, v) => a + Number(v.quoted_paise), 0)

  // Expense Report (event + vendor columns POPULATED)
  const expRows = [['Date','Description','Event','Vendor','Category','Type','Amount']]
  expenses.forEach(e => expRows.push([e.date, e.description, e.events?.name || 'General', e.vendors?.name || '—', e.categories?.name || '—', e.type, formatINR(e.amount_paise)]))
  const expTotal = expenses.reduce((a, e) => a + Number(e.amount_paise), 0)

  // Tax Report — include ALL vendors (with or without GST)
  const taxRows = [['Vendor','GST Number','Base','Tax @ 18%','Total']]
  vendors.forEach(v => taxRows.push([v.name, v.gst_number || '(Fill GST)', formatINR(v.quoted_paise), formatINR(v.tax_paise), formatINR(Number(v.quoted_paise) + Number(v.tax_paise))]))
  const taxTotal = vendors.reduce((a, v) => a + Number(v.tax_paise || 0), 0)

  // Payment Report
  const payRows = [['Vendor','Due Date','Balance','Status']]
  vendors.filter(v => Number(v.balance_paise) > 0).forEach(v => payRows.push([v.name, v.balance_due_date || '—', formatINR(v.balance_paise), v.status]))
  const payTotal = vendors.reduce((a, v) => a + Number(v.balance_paise), 0)

  // Budget Report per event
  const budRows = [['Event','Actual']]
  events.forEach(e => {
    const evExp = expenses.filter(x => x.event_id === e.id).reduce((a, x) => a + Number(x.amount_paise), 0)
    budRows.push([e.name, formatINR(evExp)])
  })

  const REPORTS = [
    { key: 'vendor',  label: 'Vendor',   rows: vendorRows, total: vendorTotal, file: 'vendor-report.csv' },
    { key: 'expense', label: 'Expense',  rows: expRows,    total: expTotal,    file: 'expense-report.csv' },
    { key: 'tax',     label: 'Tax',      rows: taxRows,    total: taxTotal,    file: 'tax-report.csv' },
    { key: 'payment', label: 'Payment',  rows: payRows,    total: payTotal,    file: 'payment-report.csv' },
    { key: 'budget',  label: 'Budget',   rows: budRows,    total: expTotal,    file: 'budget-report.csv' }
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Reports</h1>
        <p className="text-sm text-slate-500">Every report exportable to CSV, Excel, or PDF.</p>
      </div>

      <Tabs defaultValue="vendor">
        <TabsList>
          {REPORTS.map(r => <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>)}
        </TabsList>

        {REPORTS.map(r => (
          <TabsContent key={r.key} value={r.key}>
            <Card>
              <div className="flex items-center justify-between p-3 border-b bg-slate-50">
                <div className="text-sm text-slate-700">{r.rows.length - 1} rows · Total {formatINR(r.total)}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadCSV(r.file, r.rows)}><Download className="h-3.5 w-3.5 mr-1.5" />CSV</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadXLSX(r.file, r.rows)}><Download className="h-3.5 w-3.5 mr-1.5" />Excel</Button>
                  <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white text-slate-600 text-xs"><tr>{r.rows[0].map((h, i) => <th key={i} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">{r.rows.slice(1).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">{row.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
