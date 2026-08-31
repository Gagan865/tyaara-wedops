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
import { Plus, FileText, Printer } from 'lucide-react'

const STATES = ['draft','awaiting_review','unpaid','paid']

export default function InvoicesPage() {
  const [ctx, setCtx] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [vendors, setVendors] = useState([])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(null)

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id, name)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      setCtx({ projectId: pm.project_id, orgId: pm.projects?.org_id, projectName: pm.projects?.name })
      const [i, v] = await Promise.all([
        supabase.from('invoices').select('*, vendors(name, contact_name, phone, gst_number)').eq('project_id', pm.project_id).order('created_at', { ascending: false }),
        supabase.from('vendors').select('*').eq('project_id', pm.project_id).order('name')
      ])
      setInvoices(i.data || []); setVendors(v.data || [])
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function generateFromVendor(vendorId) {
    const v = vendors.find(x => x.id === vendorId)
    if (!v) return
    const supabase = createClient()
    const total = Number(v.quoted_paise || 0) + Number(v.tax_paise || 0) - Number(v.discount_paise || 0)
    const invNo = `INV-${new Date().toISOString().slice(2,7).replace('-','')}-${Math.random().toString(36).substring(2,6).toUpperCase()}`
    const { error } = await supabase.from('invoices').insert({
      project_id: ctx.projectId, org_id: ctx.orgId, vendor_id: v.id,
      invoice_number: invNo, amount_paise: v.quoted_paise, tax_paise: v.tax_paise, discount_paise: v.discount_paise,
      total_paise: total, state: 'draft', issue_date: toIsoDate(new Date()),
      due_date: v.balance_due_date
    })
    if (error) return toast.error(error.message)
    toast.success('Invoice generated'); load()
  }

  async function updateState(id, state) {
    const supabase = createClient()
    await supabase.from('invoices').update({ state }).eq('id', id)
    load()
  }

  function printInvoice(inv) {
    setViewing(inv)
    setTimeout(() => window.print(), 300)
  }

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Invoices</h1>
          <p className="text-sm text-slate-500">Smart invoices generated from vendor quoted + tax + discount.</p>
        </div>
        <Button className="bg-[#0F4C3A]" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Generate invoice</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {STATES.map(s => {
          const rows = invoices.filter(i => i.state === s)
          const total = rows.reduce((a, i) => a + Number(i.total_paise), 0)
          return (
            <Card key={s} className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{s.replace('_',' ')}</div>
              <div className="text-lg font-serif font-semibold">{rows.length} · {formatINR(total, { compact: true })}</div>
            </Card>
          )
        })}
      </div>

      {invoices.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          <FileText className="h-8 w-8 mx-auto text-slate-400 mb-2" />
          No invoices yet.
          <div className="mt-3"><Button className="bg-[#0F4C3A]" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Generate your first invoice</Button></div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Vendor</th>
                <th className="text-left px-3 py-2">Issue</th>
                <th className="text-left px-3 py-2">Due</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-center px-3 py-2">State</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(i => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{i.invoice_number}</td>
                  <td className="px-3 py-2 font-medium">{i.vendors?.name || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDate(i.issue_date)}</td>
                  <td className="px-3 py-2 text-slate-600">{i.due_date ? formatDate(i.due_date) : '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatINR(i.total_paise)}</td>
                  <td className="px-3 py-2 text-center">
                    <Select value={i.state} onValueChange={(v) => updateState(i.id, v)}>
                      <SelectTrigger className="h-7 text-[11px] w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => printInvoice(i)}><Printer className="h-3.5 w-3.5 mr-1" />PDF</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate invoice from a vendor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Choose vendor</Label>
            <div className="space-y-2 max-h-80 overflow-auto">
              {vendors.map(v => (
                <div key={v.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-slate-500">Quoted {formatINR(v.quoted_paise)} + Tax {formatINR(v.tax_paise)}</div>
                  </div>
                  <Button size="sm" className="bg-[#0F4C3A]" onClick={() => { generateFromVendor(v.id); setOpen(false) }}>Generate</Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {viewing && (
        <div className="fixed inset-0 bg-white z-50 p-10 overflow-auto print:p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-8 print:mb-4">
              <div>
                <div className="text-3xl font-serif font-bold text-[#0F4C3A]">Invoice</div>
                <div className="font-mono text-sm text-slate-600 mt-1">{viewing.invoice_number}</div>
              </div>
              <div className="flex items-center gap-2.5">
                <img src="/tyaara-logo.jpg" alt="Tyaara" className="h-11 w-11 rounded-lg object-contain bg-white border border-slate-200" />
                <div className="text-right">
                  <div className="text-xl font-bold text-[#1F2A37]">Tyaara</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">The Tales Of Wedding</div>
                  <div className="text-xs text-slate-500 mt-0.5">{ctx.projectName}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Bill from</div>
                <div className="font-semibold mt-1">{viewing.vendors?.name}</div>
                <div className="text-sm text-slate-600">{viewing.vendors?.contact_name}</div>
                <div className="text-sm text-slate-600">{viewing.vendors?.phone}</div>
                {viewing.vendors?.gst_number && <div className="text-sm text-slate-600">GST: {viewing.vendors.gst_number}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-slate-500">Issue / Due</div>
                <div className="mt-1">{formatDate(viewing.issue_date)}</div>
                <div>{viewing.due_date ? formatDate(viewing.due_date) : '—'}</div>
              </div>
            </div>
            <table className="w-full mb-8">
              <thead className="bg-slate-100"><tr><th className="text-left p-3">Description</th><th className="text-right p-3">Amount</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="p-3">Services</td><td className="p-3 text-right">{formatINR(viewing.amount_paise)}</td></tr>
                <tr><td className="p-3">Tax (GST)</td><td className="p-3 text-right">{formatINR(viewing.tax_paise)}</td></tr>
                <tr><td className="p-3">Discount</td><td className="p-3 text-right">– {formatINR(viewing.discount_paise)}</td></tr>
                <tr className="font-bold text-lg"><td className="p-3">Total</td><td className="p-3 text-right">{formatINR(viewing.total_paise)}</td></tr>
              </tbody>
            </table>
            <div className="flex gap-2 print:hidden">
              <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
