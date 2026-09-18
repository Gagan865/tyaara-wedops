'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LoadingState, ErrorState } from '@/components/app/page-state'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatINR, formatDate, rupeesToPaise, paiseToRupees } from '@/lib/format'
import { computeQuoteTotals, QUOTE_BUCKETS, BUCKET_LABELS } from '@/lib/quote-total'
import { DEFAULT_AGREEMENT_TERMS } from '@/lib/agreement-template'
import { toast } from 'sonner'
import { Plus, Trash2, Printer, Copy, ArrowLeft, Eye, EyeOff, FileText, Users, FileSignature, MessageCircle, Mail } from 'lucide-react'

const STATUSES = ['draft', 'sent', 'accepted', 'expired', 'superseded']

export default function QuoteEditorPage() {
  const { id } = useParams()
  const router = useRouter()
  const confirm = useConfirm()
  const [q, setQ] = useState(null)          // quotation row
  const [groups, setGroups] = useState([])
  const [lines, setLines] = useState([])
  const [adders, setAdders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [internal, setInternal] = useState(true)  // default INTERNAL; state-only
  const [coupleForm, setCoupleForm] = useState(null)
  const [agreement, setAgreement] = useState(null)
  const [agOpen, setAgOpen] = useState(false)
  const [email, setEmail] = useState(null)       // { kind, url, to } when the email dialog is open
  const [emailSending, setEmailSending] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: quote, error } = await supabase.from('quotations').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      if (!quote) { setLoadError(new Error('Quotation not found')); setLoading(false); return }
      const [g, l, a] = await Promise.all([
        supabase.from('quote_groups').select('*').eq('quotation_id', id).order('display_order'),
        supabase.from('quote_lines').select('*').eq('quotation_id', id).order('display_order'),
        supabase.from('quote_adders').select('*').eq('quotation_id', id).order('display_order')
      ])
      const [cf, ag] = await Promise.all([
        supabase.from('couple_forms').select('*').eq('quotation_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('agreements').select('*').eq('quotation_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      ])
      setQ(quote); setGroups(g.data || []); setLines(l.data || []); setAdders(a.data || [])
      setCoupleForm(cf.data || null); setAgreement(ag.data || null)
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e); setLoading(false)
    }
  }
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const supabase = createClient()
  const orgId = q?.org_id

  // ---- header ----
  async function saveHeader(patch) {
    setQ((prev) => ({ ...prev, ...patch }))
    const { error } = await supabase.from('quotations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error(error.message)
  }

  // ---- groups ----
  async function addGroup(kind) {
    const display_order = (groups.at(-1)?.display_order || 0) + 1
    const { data, error } = await supabase.from('quote_groups')
      .insert({ quotation_id: id, org_id: orgId, label: kind === 'options' ? 'Options' : 'New section', kind, display_order })
      .select('*').maybeSingle()
    if (error || !data) return toast.error(error?.message || 'Could not add section')
    setGroups((g) => [...g, data])
  }
  async function updateGroup(gid, patch) {
    setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, ...patch } : g)))
    const { error } = await supabase.from('quote_groups').update(patch).eq('id', gid)
    if (error) toast.error(error.message)
  }
  async function deleteGroup(g) {
    if (!await confirm({ title: `Delete "${g.label}"?`, description: 'Removes the section and all its lines.', confirmLabel: 'Delete', destructive: true })) return
    const { error } = await supabase.from('quote_groups').delete().eq('id', g.id)
    if (error) return toast.error(error.message)
    setGroups((gs) => gs.filter((x) => x.id !== g.id))
    setLines((ls) => ls.filter((x) => x.group_id !== g.id))
  }

  // ---- lines ----
  async function addLine(groupId) {
    const order = (lines.filter((l) => l.group_id === groupId).at(-1)?.display_order || 0) + 1
    const { data, error } = await supabase.from('quote_lines')
      .insert({ quotation_id: id, org_id: orgId, group_id: groupId, element: 'New item', bucket: 'decor', amount_paise: 0, display_order: order })
      .select('*').maybeSingle()
    if (error || !data) return toast.error(error?.message || 'Could not add line')
    setLines((ls) => [...ls, data])
  }
  async function updateLine(lid, patch) {
    setLines((ls) => ls.map((l) => (l.id === lid ? { ...l, ...patch } : l)))
    const { error } = await supabase.from('quote_lines').update(patch).eq('id', lid)
    if (error) toast.error(error.message)
  }
  async function deleteLine(lid) {
    const { error } = await supabase.from('quote_lines').delete().eq('id', lid)
    if (error) return toast.error(error.message)
    setLines((ls) => ls.filter((l) => l.id !== lid))
  }

  // ---- adders ----
  async function addAdder() {
    const order = (adders.at(-1)?.display_order || 0) + 1
    const { data, error } = await supabase.from('quote_adders')
      .insert({ quotation_id: id, org_id: orgId, label: 'New adder', bucket: null, amount_paise: 0, display_order: order })
      .select('*').maybeSingle()
    if (error || !data) return toast.error(error?.message || 'Could not add adder')
    setAdders((a) => [...a, data])
  }
  async function updateAdder(aid, patch) {
    setAdders((as) => as.map((a) => (a.id === aid ? { ...a, ...patch } : a)))
    const { error } = await supabase.from('quote_adders').update(patch).eq('id', aid)
    if (error) toast.error(error.message)
  }
  async function deleteAdder(aid) {
    const { error } = await supabase.from('quote_adders').delete().eq('id', aid)
    if (error) return toast.error(error.message)
    setAdders((as) => as.filter((a) => a.id !== aid))
  }

  async function duplicateVersion() {
    if (!await confirm({ title: 'Duplicate as new version?', description: `Creates V${(q.version || 1) + 1} as a draft and marks this one superseded.`, confirmLabel: 'Duplicate' })) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: nq, error } = await supabase.from('quotations').insert({
      org_id: orgId, quote_number: q.quote_number, version: (q.version || 1) + 1,
      client_name: q.client_name, client_contact: q.client_contact, venue_name: q.venue_name,
      event_dates: q.event_dates, status: 'draft', valid_days: q.valid_days, terms: q.terms,
      project_id: q.project_id, created_by: user?.id || null
    }).select('*').maybeSingle()
    if (error || !nq) return toast.error(error?.message || 'Could not duplicate')

    // Copy groups (remap ids), then lines (remap group ids + selected_line_id).
    const groupIdMap = {}, lineIdMap = {}
    if (groups.length) {
      const rows = groups.map((g) => ({ quotation_id: nq.id, org_id: orgId, label: g.label, kind: g.kind, event_id: g.event_id, display_order: g.display_order }))
      const { data: ng, error: ge } = await supabase.from('quote_groups').insert(rows).select('*')
      if (ge) return toast.error(ge.message)
      groups.forEach((g, i) => { groupIdMap[g.id] = ng[i].id })
    }
    if (lines.length) {
      const rows = lines.map((l) => ({ quotation_id: nq.id, org_id: orgId, group_id: groupIdMap[l.group_id], element: l.element, description: l.description, bucket: l.bucket, amount_paise: l.amount_paise, cost_paise: l.cost_paise, display_order: l.display_order }))
      const { data: nl, error: le } = await supabase.from('quote_lines').insert(rows).select('*')
      if (le) return toast.error(le.message)
      lines.forEach((l, i) => { lineIdMap[l.id] = nl[i].id })
      // Re-point selected_line_id on options groups.
      for (const g of groups) {
        if (g.kind === 'options' && g.selected_line_id && lineIdMap[g.selected_line_id]) {
          await supabase.from('quote_groups').update({ selected_line_id: lineIdMap[g.selected_line_id] }).eq('id', groupIdMap[g.id])
        }
      }
    }
    if (adders.length) {
      const rows = adders.map((a) => ({ quotation_id: nq.id, org_id: orgId, label: a.label, bucket: a.bucket, amount_paise: a.amount_paise, cost_paise: a.cost_paise, display_order: a.display_order }))
      const { error: ae } = await supabase.from('quote_adders').insert(rows)
      if (ae) return toast.error(ae.message)
    }
    await supabase.from('quotations').update({ status: 'superseded' }).eq('id', id)
    toast.success(`Created V${nq.version}`)
    router.push(`/quotes/${nq.id}`)
  }

  // ---- client sharing (login-free tokened links) ----
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  async function copyLink(url) { try { await navigator.clipboard.writeText(url); toast.success('Link copied') } catch { toast.error(url) } }
  const clientName = q?.client_name && q.client_name !== 'New client' ? q.client_name : ''

  // Resolve (creating the token/record if needed) the public URL for each artefact.
  async function ensureQuoteUrl() {
    let tok = q.public_token
    if (!tok) {
      tok = crypto.randomUUID()
      const { error } = await supabase.from('quotations').update({ public_token: tok }).eq('id', id)
      if (error) { toast.error(error.message); return null }
      setQ((p) => ({ ...p, public_token: tok }))
    }
    return `${origin}/share/quote/${tok}`
  }
  async function ensureFormUrl() {
    if (coupleForm) return `${origin}/share/form/${coupleForm.public_token}`
    const tok = crypto.randomUUID()
    const { data, error } = await supabase.from('couple_forms')
      .insert({ org_id: orgId, quotation_id: id, public_token: tok, title: 'Wedding details' }).select('*').maybeSingle()
    if (error || !data) { toast.error(error?.message || 'Could not create form'); return null }
    setCoupleForm(data)
    return `${origin}/share/form/${tok}`
  }
  function agreementUrl() { return agreement ? `${origin}/share/agreement/${agreement.public_token}` : null }

  async function urlFor(kind) {
    if (kind === 'quote') return ensureQuoteUrl()
    if (kind === 'form') return ensureFormUrl()
    const u = agreementUrl()
    if (!u) toast.error('Create the agreement first')
    return u
  }
  async function shareQuote() { const u = await ensureQuoteUrl(); if (u) copyLink(u) }
  async function shareForm() { const u = await ensureFormUrl(); if (u) copyLink(u) }

  const SHARE_MSG = {
    quote: (n) => `Hi${n ? ' ' + n : ''}! Here's your wedding quotation from Tyaara Weddings. View & download it here: `,
    form: (n) => `Hi${n ? ' ' + n : ''}! Please share your wedding details with us via this quick form: `,
    agreement: (n) => `Hi${n ? ' ' + n : ''}! Please review and accept your agreement with Tyaara Weddings here: `
  }
  async function whatsappShare(kind) {
    const url = await urlFor(kind)
    if (!url) return
    const phone = (q.client_contact || '').replace(/\D/g, '')
    const base = phone.length >= 10 ? `https://wa.me/${phone}` : 'https://wa.me/'
    window.open(`${base}?text=${encodeURIComponent(SHARE_MSG[kind](clientName) + url)}`, '_blank')
  }
  async function openEmail(kind) {
    const url = await urlFor(kind)
    if (!url) return
    setEmail({ kind, url, to: /@/.test(q.client_contact || '') ? q.client_contact : '' })
  }
  async function sendEmail(e) {
    e.preventDefault()
    const to = new FormData(e.currentTarget).get('to')
    const cfg = {
      quote: { subject: 'Your wedding quotation — Tyaara Weddings', heading: 'Your quotation is ready', message: `Hi${clientName ? ' ' + clientName : ''}, please find your wedding quotation from Tyaara Weddings. You can view the full breakdown and download a PDF.`, ctaLabel: 'View quotation' },
      form: { subject: 'Share your wedding details — Tyaara Weddings', heading: 'Tell us about your wedding', message: `Hi${clientName ? ' ' + clientName : ''}, please take a moment to share your wedding details so we can plan everything beautifully.`, ctaLabel: 'Open the form' },
      agreement: { subject: 'Your agreement — Tyaara Weddings', heading: 'Please review your agreement', message: `Hi${clientName ? ' ' + clientName : ''}, please review the terms of your agreement with Tyaara Weddings and accept online.`, ctaLabel: 'Review & accept' }
    }[email.kind]
    setEmailSending(true)
    const r = await fetch('/api/share/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, url: email.url, ...cfg }) })
    const j = await r.json()
    setEmailSending(false)
    if (!r.ok) return toast.error(j.error || 'Could not send email')
    toast.success('Email sent to ' + to)
    setEmail(null)
  }
  async function saveAgreement(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const total = rupeesToPaise(fd.get('total') || 0)
    const advance = rupeesToPaise(fd.get('advance') || 0)
    const tok = agreement?.public_token || crypto.randomUUID()
    const payload = {
      org_id: orgId, quotation_id: id, public_token: tok,
      client_name: fd.get('client_name'), client_relation: fd.get('client_relation') || null,
      agreement_date: fd.get('agreement_date') || null,
      total_paise: total, advance_paise: advance, balance_paise: Math.max(0, total - advance),
      balance_due_text: fd.get('balance_due_text') || null, terms: fd.get('terms') || null, status: 'sent'
    }
    const res = agreement
      ? await supabase.from('agreements').update(payload).eq('id', agreement.id).select('*').maybeSingle()
      : await supabase.from('agreements').insert(payload).select('*').maybeSingle()
    if (res.error || !res.data) return toast.error(res.error?.message || 'Could not save agreement')
    setAgreement(res.data); setAgOpen(false)
    copyLink(`${origin}/share/agreement/${tok}`)
  }

  if (loading) return <LoadingState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  const quotation = { groups, lines, adders }
  const totals = computeQuoteTotals(quotation)
  const extraRows = totals.combinations[0]?.extraRows || []
  const resolvedTotal = totals.total_paise != null ? totals.total_paise : (totals.combinations[0]?.total_paise || 0)

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/quotes')}><ArrowLeft className="h-4 w-4 mr-1.5" />All quotations</Button>
          <span className="text-sm text-slate-400">{q.quote_number} · V{q.version}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setInternal((v) => !v)}>
            {internal ? <><Eye className="h-4 w-4 mr-1.5" />Internal view</> : <><EyeOff className="h-4 w-4 mr-1.5" />Client view</>}
          </Button>
          <a href={`/quotes/${id}/print`} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-1.5" />Print / PDF</Button></a>
          <Button variant="outline" size="sm" onClick={duplicateVersion}><Copy className="h-4 w-4 mr-1.5" />New version</Button>
        </div>
      </div>

      {internal
        ? <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">Internal view — showing cost & margin. These NEVER appear on the client PDF. Switch to Client view to preview what they see.</div>
        : <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">Client view — cost & margin hidden, exactly like the PDF.</div>}

      {/* header */}
      <Card className="p-5 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div><Label>Client name</Label><Input defaultValue={q.client_name} onBlur={(e) => saveHeader({ client_name: e.target.value })} /></div>
          <div><Label>Client contact</Label><Input defaultValue={q.client_contact || ''} onBlur={(e) => saveHeader({ client_contact: e.target.value || null })} placeholder="+91…" /></div>
          <div><Label>Venue</Label><Input defaultValue={q.venue_name || ''} onBlur={(e) => saveHeader({ venue_name: e.target.value || null })} /></div>
          <div><Label>Event date(s)</Label><Input defaultValue={q.event_dates || ''} onBlur={(e) => saveHeader({ event_dates: e.target.value || null })} placeholder="December 2 & 3 2026" /></div>
          <div><Label>Status</Label>
            <Select value={q.status} onValueChange={(v) => saveHeader({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Valid (days)</Label><Input type="number" min="1" defaultValue={q.valid_days} onBlur={(e) => saveHeader({ valid_days: parseInt(e.target.value) || 14 })} /></div>
        </div>
        <div><Label>Terms &amp; conditions</Label><Textarea rows={2} defaultValue={q.terms || ''} onBlur={(e) => saveHeader({ terms: e.target.value || null })} placeholder="Payment terms, validity, cancellation…" /></div>
      </Card>

      {/* groups */}
      {groups.map((g) => {
        const glines = lines.filter((l) => l.group_id === g.id)
        const sub = Object.fromEntries(QUOTE_BUCKETS.map((b) => [b, glines.filter((l) => l.bucket === b).reduce((s, l) => s + Number(l.amount_paise || 0), 0)]))
        return (
          <Card key={g.id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input className="max-w-md font-medium" defaultValue={g.label} onBlur={(e) => updateGroup(g.id, { label: e.target.value })} />
              <Select value={g.kind} onValueChange={(v) => updateGroup(g.id, { kind: v })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="items">Items</SelectItem><SelectItem value="options">Options</SelectItem></SelectContent>
              </Select>
              {g.kind === 'options' && <span className="text-[11px] text-slate-500">mutually exclusive — client picks one</span>}
              <Button size="icon" variant="ghost" className="h-8 w-8 ml-auto" onClick={() => deleteGroup(g)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    {g.kind === 'options' && <th className="px-2 py-1 text-left w-8">Pick</th>}
                    <th className="px-2 py-1 text-left">Element</th>
                    <th className="px-2 py-1 text-left">Description</th>
                    <th className="px-2 py-1 text-left w-32">Bucket</th>
                    <th className="px-2 py-1 text-right w-28">Amount ₹</th>
                    {internal && <th className="px-2 py-1 text-right w-28">Cost ₹</th>}
                    <th className="px-2 py-1 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {glines.map((l) => (
                    <tr key={l.id} className="border-t">
                      {g.kind === 'options' && (
                        <td className="px-2 py-1 text-center">
                          <input type="radio" name={`opt-${g.id}`} checked={g.selected_line_id === l.id}
                            onChange={() => updateGroup(g.id, { selected_line_id: l.id })} />
                        </td>
                      )}
                      <td className="px-2 py-1"><Input className="h-8" defaultValue={l.element} onBlur={(e) => updateLine(l.id, { element: e.target.value })} /></td>
                      <td className="px-2 py-1"><Input className="h-8" defaultValue={l.description || ''} onBlur={(e) => updateLine(l.id, { description: e.target.value || null })} placeholder="20FT × 10FT HT" /></td>
                      <td className="px-2 py-1">
                        <Select value={l.bucket} onValueChange={(v) => updateLine(l.id, { bucket: v })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{QUOTE_BUCKETS.map((b) => <SelectItem key={b} value={b}>{BUCKET_LABELS[b]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1"><Input className="h-8 text-right" type="number" step="0.01" defaultValue={paiseToRupees(l.amount_paise)} onBlur={(e) => updateLine(l.id, { amount_paise: rupeesToPaise(e.target.value) })} /></td>
                      {internal && <td className="px-2 py-1"><Input className="h-8 text-right" type="number" step="0.01" defaultValue={l.cost_paise != null ? paiseToRupees(l.cost_paise) : ''} placeholder="—" onBlur={(e) => updateLine(l.id, { cost_paise: e.target.value === '' ? null : rupeesToPaise(e.target.value) })} /></td>}
                      <td className="px-2 py-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteLine(l.id)}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-slate-50 text-xs">
                    <td className="px-2 py-1.5 font-medium" colSpan={g.kind === 'options' ? 3 : 2}>Subtotal</td>
                    <td className="px-2 py-1.5 text-slate-500" colSpan={internal ? 3 : 2}>
                      {QUOTE_BUCKETS.filter((b) => sub[b]).map((b) => `${BUCKET_LABELS[b]} ${formatINR(sub[b])}`).join('  ·  ') || '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <Button size="sm" variant="outline" onClick={() => addLine(g.id)}><Plus className="h-3.5 w-3.5 mr-1.5" />Add line</Button>
          </Card>
        )
      })}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => addGroup('items')}><Plus className="h-4 w-4 mr-2" />Add items section</Button>
        <Button variant="outline" onClick={() => addGroup('options')}><Plus className="h-4 w-4 mr-2" />Add options section</Button>
      </div>

      {/* adders */}
      <Card className="p-4 space-y-3">
        <div className="font-medium">Summary adders <span className="text-xs text-slate-500 font-normal">— appear only in the summary (Labour, Transportation, Sounds)</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-1 text-left">Label</th>
                <th className="px-2 py-1 text-left w-40">Summary row</th>
                <th className="px-2 py-1 text-right w-28">Amount ₹</th>
                {internal && <th className="px-2 py-1 text-right w-28">Cost ₹</th>}
                <th className="px-2 py-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {adders.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-2 py-1"><Input className="h-8" defaultValue={a.label} onBlur={(e) => updateAdder(a.id, { label: e.target.value })} /></td>
                  <td className="px-2 py-1">
                    <Select value={a.bucket || 'none'} onValueChange={(v) => updateAdder(a.id, { bucket: v === 'none' ? null : v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Own row</SelectItem>
                        {QUOTE_BUCKETS.map((b) => <SelectItem key={b} value={b}>{BUCKET_LABELS[b]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1"><Input className="h-8 text-right" type="number" step="0.01" defaultValue={paiseToRupees(a.amount_paise)} onBlur={(e) => updateAdder(a.id, { amount_paise: rupeesToPaise(e.target.value) })} /></td>
                  {internal && <td className="px-2 py-1"><Input className="h-8 text-right" type="number" step="0.01" defaultValue={a.cost_paise != null ? paiseToRupees(a.cost_paise) : ''} placeholder="—" onBlur={(e) => updateAdder(a.id, { cost_paise: e.target.value === '' ? null : rupeesToPaise(e.target.value) })} /></td>}
                  <td className="px-2 py-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteAdder(a.id)}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button size="sm" variant="outline" onClick={addAdder}><Plus className="h-3.5 w-3.5 mr-1.5" />Add adder</Button>
      </Card>

      {/* summary matrix */}
      <Card className="p-5">
        <div className="font-serif text-lg font-semibold mb-3">Summary</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-1.5 text-left">Row</th>
                {totals.combinations.map((c, i) => <th key={i} className="px-3 py-1.5 text-right whitespace-nowrap">{totals.combinations.length > 1 ? c.label : 'Amount'}</th>)}
              </tr>
            </thead>
            <tbody>
              {QUOTE_BUCKETS.map((b) => (
                <tr key={b} className="border-t">
                  <td className="px-3 py-1.5">{BUCKET_LABELS[b]}</td>
                  {totals.combinations.map((c, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{formatINR(c.buckets[b])}</td>)}
                </tr>
              ))}
              {extraRows.map((r, ri) => (
                <tr key={ri} className="border-t">
                  <td className="px-3 py-1.5">{r.label}</td>
                  {totals.combinations.map((c, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{formatINR(r.amount_paise)}</td>)}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="px-3 py-2">Total (incl. GST)</td>
                {totals.combinations.map((c, i) => <td key={i} className="px-3 py-2 text-right tabular-nums text-[#0F4C3A]">{formatINR(c.total_paise)}</td>)}
              </tr>
              {internal && (
                <tr className="text-xs text-slate-500">
                  <td className="px-3 py-1.5">Margin (internal)</td>
                  {totals.combinations.map((c, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{formatINR(c.margin_paise)}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totals.combinations.length > 1 && <p className="text-xs text-slate-500 mt-2">Parallel totals — one per option. Pick a variant in the options section to lock a single total.</p>}
      </Card>

      {/* Send to client — login-free tokened links (builder stays admin-only) */}
      <Card className="p-5 space-y-3">
        <div>
          <div className="font-serif text-lg font-semibold">Send to client</div>
          <p className="text-sm text-slate-500">Share over WhatsApp or email, or copy a login-free link. Cost &amp; margin never appear on any of these.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 p-3 flex flex-col">
            <div className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-[#0F4C3A]" />Quotation</div>
            <p className="text-xs text-slate-500 mt-1 flex-1">Client-safe PDF view of this quote.</p>
            <div className="flex items-center gap-1.5 mt-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={shareQuote}><Copy className="h-3.5 w-3.5 mr-1.5" />{q.public_token ? 'Copy' : 'Link'}</Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Send on WhatsApp" onClick={() => whatsappShare('quote')}><MessageCircle className="h-4 w-4 text-emerald-600" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Send by email" onClick={() => openEmail('quote')}><Mail className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 flex flex-col">
            <div className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-[#0F4C3A]" />Couple form</div>
            <p className="text-xs text-slate-500 mt-1 flex-1">{coupleForm ? (coupleForm.status === 'submitted' ? 'Submitted ✓ — reopen to view answers.' : 'Awaiting the couple’s response.') : 'Bride/groom intake form.'}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={shareForm}><Copy className="h-3.5 w-3.5 mr-1.5" />{coupleForm ? 'Copy' : 'Create'}</Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Send on WhatsApp" onClick={() => whatsappShare('form')}><MessageCircle className="h-4 w-4 text-emerald-600" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Send by email" onClick={() => openEmail('form')}><Mail className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 flex flex-col">
            <div className="text-sm font-medium flex items-center gap-2"><FileSignature className="h-4 w-4 text-[#0F4C3A]" />Agreement</div>
            <p className="text-xs text-slate-500 mt-1 flex-1">{agreement ? (agreement.status === 'accepted' ? `Accepted by ${agreement.accepted_name} ✓` : 'Sent — awaiting acceptance.') : 'Tyaara T&C with e-acceptance.'}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setAgOpen(true)}>{agreement ? 'Edit' : 'Create'}</Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Copy link" onClick={() => { const u = agreementUrl(); u ? copyLink(u) : toast.error('Create the agreement first') }}><Copy className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Send on WhatsApp" onClick={() => whatsappShare('agreement')}><MessageCircle className="h-4 w-4 text-emerald-600" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Send by email" onClick={() => openEmail('agreement')}><Mail className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={Boolean(email)} onOpenChange={(o) => { if (!emailSending && !o) setEmail(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Email {email?.kind === 'form' ? 'the couple form' : email?.kind === 'agreement' ? 'the agreement' : 'the quotation'}</DialogTitle></DialogHeader>
          <form onSubmit={sendEmail} className="space-y-3">
            <div><Label>Recipient email</Label><Input name="to" type="email" required defaultValue={email?.to || ''} placeholder="couple@example.com" /></div>
            <p className="text-[11px] text-slate-500">A branded email with the link is sent from Tyaara Weddings. Requires email to be configured (RESEND_API_KEY).</p>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]" disabled={emailSending}><Mail className="h-4 w-4 mr-2" />{emailSending ? 'Sending…' : 'Send email'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={agOpen} onOpenChange={setAgOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{agreement ? 'Edit agreement' : 'Create agreement'}</DialogTitle></DialogHeader>
          <form onSubmit={saveAgreement} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Client name</Label><Input name="client_name" defaultValue={agreement?.client_name || q.client_name} required /></div>
              <div><Label>Relation</Label><Input name="client_relation" defaultValue={agreement?.client_relation || ''} placeholder="Bride's Father" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Total (₹)</Label><Input name="total" type="number" step="0.01" defaultValue={agreement ? paiseToRupees(agreement.total_paise) : paiseToRupees(resolvedTotal)} /></div>
              <div><Label>Advance (₹)</Label><Input name="advance" type="number" step="0.01" defaultValue={agreement ? paiseToRupees(agreement.advance_paise) : 0} /></div>
              <div><Label>Agreement date</Label><Input name="agreement_date" type="date" defaultValue={agreement?.agreement_date || ''} /></div>
            </div>
            <div><Label>Balance due</Label><Input name="balance_due_text" defaultValue={agreement?.balance_due_text || 'before the event'} /></div>
            <div><Label>Terms</Label><Textarea name="terms" rows={6} defaultValue={agreement?.terms || DEFAULT_AGREEMENT_TERMS} /></div>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]">{agreement ? 'Save & copy link' : 'Create & copy link'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
