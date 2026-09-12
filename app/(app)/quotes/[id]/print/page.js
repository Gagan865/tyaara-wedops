'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LoadingState, ErrorState } from '@/components/app/page-state'
import { formatINR, formatDate } from '@/lib/format'
import { computeQuoteTotals, QUOTE_BUCKETS, BUCKET_LABELS } from '@/lib/quote-total'

// ============================================================================
// CLIENT-FACING QUOTATION — cost & margin MUST NEVER appear here.
// This page renders ONLY: element, description, amount_paise (per bucket), and the
// summary totals. It deliberately does not read `cost_paise` or `margin_paise` on any
// row anywhere. Leaking internal cost onto a client quotation is the worst bug in this
// feature. If you add a field here, it must come from the amount side only.
// (Enforced by convention + review: search this file for "cost" or "margin" — there
// should be ZERO references below this banner.)
// ============================================================================

export default function QuotePrintPage() {
  const { id } = useParams()
  const [q, setQ] = useState(null)
  const [groups, setGroups] = useState([])
  const [lines, setLines] = useState([])
  const [adders, setAdders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function load() {
    try {
      const supabase = createClient()
      const { data: quote, error } = await supabase.from('quotations').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      if (!quote) { setLoadError(new Error('Quotation not found')); setLoading(false); return }
      // Note: we intentionally select amount_paise only for lines/adders — never cost_paise.
      const [g, l, a] = await Promise.all([
        supabase.from('quote_groups').select('*').eq('quotation_id', id).order('display_order'),
        supabase.from('quote_lines').select('id, group_id, element, description, bucket, amount_paise, display_order').eq('quotation_id', id).order('display_order'),
        supabase.from('quote_adders').select('id, label, bucket, amount_paise, display_order').eq('quotation_id', id).order('display_order')
      ])
      setQ(quote); setGroups(g.data || []); setLines(l.data || []); setAdders(a.data || [])
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e); setLoading(false)
    }
  }
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingState />
  if (loadError) return <ErrorState error={loadError} />

  const totals = computeQuoteTotals({ groups, lines, adders })
  const extraRows = totals.combinations[0]?.extraRows || []
  const validFrom = q.created_at

  return (
    <div className="quote-print">
      <style>{`
        /* Hide the app chrome and neutralise page padding when printing. */
        @media print {
          aside, header { display: none !important; }
          main { padding: 0 !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 14mm; }
          body { background: #fff !important; }
        }
        .quote-print { max-width: 800px; margin: 0 auto; color: #1f2a37; background: #fff; }
        .quote-print table { width: 100%; border-collapse: collapse; }
        .quote-print th, .quote-print td { border: 1px solid #d8dcd4; padding: 6px 8px; font-size: 12px; }
        .quote-print th { background: #f3f5f0; text-align: left; font-weight: 600; }
        .quote-print .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      `}</style>

      <div className="no-print mb-4 flex gap-2">
        <button onClick={() => window.print()} className="rounded-md bg-[#0F4C3A] text-white text-sm px-4 py-2">Print / Save as PDF</button>
        <a href={`/quotes/${id}`} className="rounded-md border border-slate-300 text-sm px-4 py-2">Back to editor</a>
      </div>

      {/* Letterhead */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <img src="/tyaara-logo.jpg" alt="Tyaara" style={{ height: 56, width: 56, objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Tyaara</div>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8a94a6' }}>The Tales Of Wedding</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12, color: '#55605a' }}>
          <div style={{ fontWeight: 600, color: '#1f2a37' }}>Quotation {q.quote_number} · V{q.version}</div>
          <div>{formatDate(q.created_at)}</div>
        </div>
      </div>

      {/* Client header */}
      <table style={{ marginBottom: 16 }}>
        <tbody>
          <tr><th style={{ width: '25%' }}>Client</th><td>{q.client_name}{q.client_contact ? ` · ${q.client_contact}` : ''}</td></tr>
          <tr><th>Venue</th><td>{q.venue_name || '—'}</td></tr>
          <tr><th>Event date(s)</th><td>{q.event_dates || '—'}</td></tr>
        </tbody>
      </table>

      {/* Groups — five-bucket table each */}
      {groups.map((g) => {
        const glines = lines.filter((l) => l.group_id === g.id)
        if (glines.length === 0) return null
        const sub = Object.fromEntries(QUOTE_BUCKETS.map((b) => [b, glines.filter((l) => l.bucket === b).reduce((s, l) => s + Number(l.amount_paise || 0), 0)]))
        return (
          <div key={g.id} style={{ marginBottom: 14, breakInside: 'avoid' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{g.label}{g.kind === 'options' ? ' (choose one)' : ''}</div>
            <table>
              <thead>
                <tr>
                  <th>Element</th><th>Description</th>
                  {QUOTE_BUCKETS.map((b) => <th key={b} className="num">{BUCKET_LABELS[b]}</th>)}
                </tr>
              </thead>
              <tbody>
                {glines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.element}</td>
                    <td>{l.description || ''}</td>
                    {QUOTE_BUCKETS.map((b) => <td key={b} className="num">{l.bucket === b ? formatINR(l.amount_paise) : ''}</td>)}
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600 }}>Subtotal</td>
                  {QUOTE_BUCKETS.map((b) => <td key={b} className="num" style={{ fontWeight: 600 }}>{sub[b] ? formatINR(sub[b]) : ''}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}

      {/* Summary */}
      <div style={{ marginTop: 18, breakInside: 'avoid' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Summary</div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              {totals.combinations.map((c, i) => <th key={i} className="num">{totals.combinations.length > 1 ? c.label : 'Amount'}</th>)}
            </tr>
          </thead>
          <tbody>
            {QUOTE_BUCKETS.map((b) => (
              <tr key={b}>
                <td>{BUCKET_LABELS[b]}</td>
                {totals.combinations.map((c, i) => <td key={i} className="num">{formatINR(c.buckets[b])}</td>)}
              </tr>
            ))}
            {extraRows.map((r, ri) => (
              <tr key={ri}>
                <td>{r.label}</td>
                {totals.combinations.map((c, i) => <td key={i} className="num">{formatINR(r.amount_paise)}</td>)}
              </tr>
            ))}
            <tr>
              <td style={{ fontWeight: 700 }}>Total (incl. GST)</td>
              {totals.combinations.map((c, i) => <td key={i} className="num" style={{ fontWeight: 700 }}>{formatINR(c.total_paise)}</td>)}
            </tr>
          </tbody>
        </table>
        {totals.combinations.length > 1 && <p style={{ fontSize: 11, color: '#55605a', marginTop: 6 }}>Totals shown per option — final total depends on the option selected.</p>}
      </div>

      {/* Terms */}
      <div style={{ marginTop: 20, fontSize: 11, color: '#55605a', breakInside: 'avoid' }}>
        <div style={{ fontWeight: 600, color: '#1f2a37', marginBottom: 4 }}>Terms &amp; Conditions</div>
        {q.terms ? <div style={{ whiteSpace: 'pre-wrap' }}>{q.terms}</div> : <div>Standard terms apply.</div>}
        <div style={{ marginTop: 8, fontStyle: 'italic' }}>Valid for {q.valid_days} days from {formatDate(validFrom)}.</div>
      </div>
    </div>
  )
}
