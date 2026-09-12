'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, EmptyState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatINR, formatDate } from '@/lib/format'
import { computeQuoteTotals } from '@/lib/quote-total'
import { toast } from 'sonner'
import { Plus, FileText } from 'lucide-react'

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-sky-100 text-sky-800 border-sky-200',
  accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  expired: 'bg-amber-100 text-amber-800 border-amber-200',
  superseded: 'bg-slate-100 text-slate-400 border-slate-200'
}

function validUntil(createdAt, validDays) {
  const d = new Date(createdAt)
  d.setDate(d.getDate() + (validDays || 14))
  return d
}

// Total for the list: a single figure when resolved, otherwise a min–max range across the
// still-open option combinations.
function totalLabel(q) {
  const { combinations, total_paise } = computeQuoteTotals(q)
  if (total_paise !== null) return formatINR(total_paise)
  const totals = combinations.map((c) => c.total_paise)
  return `${formatINR(Math.min(...totals))} – ${formatINR(Math.max(...totals))}`
}

export default function QuotesPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState(null)
  const [me, setMe] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [creating, setCreating] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: pm } = await activeProjectQuery(supabase, 'projects(org_id)').limit(1).maybeSingle()
      const oid = pm?.projects?.org_id || null
      if (!oid) { setNoProject(true); setLoading(false); return }

      const [q, g, l, a] = await Promise.all([
        supabase.from('quotations').select('*').eq('org_id', oid).order('created_at', { ascending: false }),
        supabase.from('quote_groups').select('*').eq('org_id', oid),
        supabase.from('quote_lines').select('*').eq('org_id', oid),
        supabase.from('quote_adders').select('*').eq('org_id', oid)
      ])
      if (q.error) throw q.error
      const groupsBy = {}, linesBy = {}, addersBy = {}
      for (const x of g.data || []) (groupsBy[x.quotation_id] ||= []).push(x)
      for (const x of l.data || []) (linesBy[x.quotation_id] ||= []).push(x)
      for (const x of a.data || []) (addersBy[x.quotation_id] ||= []).push(x)
      const quotes = (q.data || []).map((qt) => ({
        ...qt,
        groups: groupsBy[qt.id] || [],
        lines: linesBy[qt.id] || [],
        adders: addersBy[qt.id] || []
      }))

      setMe(user?.id || null)
      setOrgId(oid)
      setRows(quotes)
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createQuote() {
    if (!orgId) return
    setCreating(true)
    const supabase = createClient()
    const number = 'Q-' + String((rows.length || 0) + 1).padStart(4, '0')
    const { data, error } = await supabase.from('quotations').insert({
      org_id: orgId, quote_number: number, version: 1,
      client_name: 'New client', status: 'draft', valid_days: 14, created_by: me
    }).select('id').maybeSingle()
    setCreating(false)
    if (error || !data) return toast.error(error?.message || 'Could not create quotation')
    router.push(`/quotes/${data.id}`)
  }

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-[#0F4C3A]" />Quotations</h1>
          <p className="text-sm text-slate-500">Shared across the organisation — a quote exists before a wedding does.</p>
        </div>
        <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]" disabled={creating} onClick={createQuote}>
          <Plus className="h-4 w-4 mr-2" />{creating ? 'Creating…' : 'New quotation'}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No quotations yet" description="Create your first quotation to start building estimates."
          action={<Button className="bg-[#0F4C3A]" disabled={creating} onClick={createQuote}><Plus className="h-4 w-4 mr-2" />New quotation</Button>} />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Ver</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead className="text-right">Total (incl. GST)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((q) => (
                <TableRow key={q.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/quotes/${q.id}`)}>
                  <TableCell className="font-medium whitespace-nowrap">{q.quote_number}</TableCell>
                  <TableCell className="text-slate-500">V{q.version}</TableCell>
                  <TableCell className="whitespace-nowrap">{q.client_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{q.venue_name || '—'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{totalLabel(q)}</TableCell>
                  <TableCell><span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[q.status] || STATUS_STYLES.draft}`}>{q.status}</span></TableCell>
                  <TableCell className="whitespace-nowrap text-slate-500">{formatDate(validUntil(q.created_at, q.valid_days))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
