'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState } from '@/components/app/page-state'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatINR, formatDate, rupeesToPaise, paiseToRupees } from '@/lib/format'
import { VENDOR_STATUSES } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Phone, MessageCircle, Star, Pencil, Trash2 } from 'lucide-react'

export default function VendorsPage() {
  const confirm = useConfirm()
  const [ctx, setCtx] = useState({ projectId: null, orgId: null })
  const [vendors, setVendors] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    const supabase = createClient()
    const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
    if (!pm) { setLoading(false); return }
    const projectId = pm.project_id
    setCtx({ projectId, orgId: pm.projects?.org_id })
    const [v, c] = await Promise.all([
      supabase.from('vendors').select('*, categories(name)').eq('project_id', projectId).order('created_at'),
      supabase.from('categories').select('id,name').eq('project_id', projectId).order('display_order')
    ])
    setVendors(v.data || []); setCategories(c.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveVendor(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const quoted = rupeesToPaise(fd.get('quoted') || 0)
    const advance = rupeesToPaise(fd.get('advance') || 0)
    const payload = {
      project_id: ctx.projectId, org_id: ctx.orgId,
      name: fd.get('name'), phone: fd.get('phone') || null, contact_name: fd.get('contact_name') || null,
      gst_number: fd.get('gst_number') || null,
      category_id: fd.get('category_id') === 'none' ? null : fd.get('category_id'),
      quoted_paise: quoted, advance_paise: advance, balance_paise: Math.max(0, quoted - advance),
      status: fd.get('status') || 'pending',
      balance_due_date: fd.get('balance_due_date') || null,
      rating: fd.get('rating') ? parseInt(fd.get('rating')) : null
    }
    const supabase = createClient()
    if (editing) {
      const { error } = await supabase.from('vendors').update(payload).eq('id', editing.id)
      if (error) return toast.error(error.message)
      toast.success('Vendor updated')
    } else {
      const { error } = await supabase.from('vendors').insert(payload)
      if (error) return toast.error(error.message)
      toast.success('Vendor added')
    }
    setDialogOpen(false); setEditing(null); load()
  }

  async function remove(id) {
    if (!await confirm({ title: 'Remove this vendor?', description: 'This cannot be undone.', confirmLabel: 'Remove', destructive: true })) return
    const supabase = createClient()
    await supabase.from('vendors').delete().eq('id', id)
    toast.success('Vendor removed'); load()
  }

  const totalQuoted = vendors.reduce((a, v) => a + Number(v.quoted_paise || 0), 0)
  const totalAdvance = vendors.reduce((a, v) => a + Number(v.advance_paise || 0), 0)
  const totalBalance = vendors.reduce((a, v) => a + Number(v.balance_paise || 0), 0)
  const confirmed = vendors.filter(v => v.status === 'confirmed').length

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Vendors</h1>
          <p className="text-sm text-slate-500">Advance/Balance the way Indian weddings actually pay.</p>
        </div>
        <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]" onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />Add vendor
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Vendors" value={`${vendors.length}`} />
        <KPI label="Confirmed" value={`${confirmed}`} />
        <KPI label="Total quoted" value={formatINR(totalQuoted, { compact: true })} />
        <KPI label="Balance due" value={formatINR(totalBalance, { compact: true })} tint="rose" />
      </div>

      {loading ? <LoadingState /> : vendors.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No vendors yet.
          <div className="mt-3"><Button className="bg-[#0F4C3A]" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add your first vendor</Button></div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map(v => (
            <Card key={v.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-serif font-semibold text-lg truncate">{v.name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {v.categories?.name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">{v.categories.name}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${v.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : v.status === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>{v.status}</span>
                  </div>
                  {v.contact_name && <div className="text-xs text-slate-500 mt-1">{v.contact_name}</div>}
                </div>
                {v.rating && <div className="flex items-center text-xs"><Star className="h-3 w-3 fill-amber-400 text-amber-500" /> {v.rating}</div>}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div><div className="text-slate-500">Quoted</div><div className="font-medium">{formatINR(v.quoted_paise)}</div></div>
                <div><div className="text-slate-500">Advance</div><div className="font-medium">{formatINR(v.advance_paise)}</div></div>
                <div><div className="text-slate-500">Balance</div><div className="font-medium text-rose-600">{formatINR(v.balance_paise)}</div></div>
              </div>
              {v.balance_due_date && <div className="text-[10px] text-slate-500 mt-2">Balance due {formatDate(v.balance_due_date)}</div>}
              <div className="flex items-center gap-2 mt-3">
                {v.phone && <>
                  <a href={`tel:${v.phone}`}><Button size="sm" variant="outline"><Phone className="h-3.5 w-3.5 mr-1.5" />Call</Button></a>
                  {/* Opens the vendor's WhatsApp chat so you can message them by hand.
                      No automated send — the WhatsApp engine ships in a later update. */}
                  <a href={`https://wa.me/${(v.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><MessageCircle className="h-3.5 w-3.5 mr-1.5" />WhatsApp</Button>
                  </a>
                </>}
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(v); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(v.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit vendor' : 'Add vendor'}</DialogTitle></DialogHeader>
          <form onSubmit={saveVendor} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input name="name" defaultValue={editing?.name} required /></div>
              <div><Label>Contact person</Label><Input name="contact_name" defaultValue={editing?.contact_name || ''} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input name="phone" defaultValue={editing?.phone || ''} placeholder="+91…" /></div>
              <div><Label>GST number</Label><Input name="gst_number" defaultValue={editing?.gst_number || ''} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label>
                <Select name="category_id" defaultValue={editing?.category_id || 'none'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select name="status" defaultValue={editing?.status || 'pending'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VENDOR_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quoted (₹)</Label><Input name="quoted" type="number" step="0.01" defaultValue={editing ? paiseToRupees(editing.quoted_paise) : 0} /></div>
              <div><Label>Advance paid (₹)</Label><Input name="advance" type="number" step="0.01" defaultValue={editing ? paiseToRupees(editing.advance_paise) : 0} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Balance due date</Label><Input name="balance_due_date" type="date" defaultValue={editing?.balance_due_date || ''} /></div>
              <div><Label>Rating (1-5)</Label><Input name="rating" type="number" min={1} max={5} defaultValue={editing?.rating || ''} /></div>
            </div>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]">{editing ? 'Save' : 'Add'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KPI({ label, value, tint }) {
  return (
    <Card className={`p-3 ${tint === 'rose' ? 'bg-rose-50 border-rose-200' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-lg font-serif font-semibold ${tint === 'rose' ? 'text-rose-700' : ''}`}>{value}</div>
    </Card>
  )
}
