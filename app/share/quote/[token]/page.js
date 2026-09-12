'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatINR, formatDate } from '@/lib/format'
import { computeQuoteTotals, QUOTE_BUCKETS, BUCKET_LABELS } from '@/lib/quote-total'

// PUBLIC client quotation. Data comes from /api/public/quote/[token], which returns amount
// only — never cost/margin. Nothing here references cost.
export default function SharedQuotePage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | notfound

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/public/quote/${token}`)
        if (!r.ok) { setState('notfound'); return }
        setData(await r.json()); setState('ok')
      } catch { setState('notfound') }
    })()
  }, [token])

  if (state === 'loading') return <Centered>Loading quotation…</Centered>
  if (state === 'notfound') return <Centered>This quotation link is invalid or has expired.</Centered>

  const { quotation: q, groups, lines, adders } = data
  const totals = computeQuoteTotals({ groups, lines, adders })
  const extraRows = totals.combinations[0]?.extraRows || []
  const validUntil = (() => { const d = new Date(q.created_at); d.setDate(d.getDate() + (q.valid_days || 14)); return d })()

  return (
    <div className="wrap">
      <style>{`
        @media print { .no-print { display:none !important } @page { size:A4; margin:14mm } }
        .wrap { max-width: 820px; margin: 0 auto; padding: 24px 16px 64px; color:#1f2a37; font-size:14px; }
        .wrap table { width:100%; border-collapse:collapse; }
        .wrap th,.wrap td { border:1px solid #d8dcd4; padding:6px 8px; font-size:12px; }
        .wrap th { background:#f3f5f0; text-align:left; font-weight:600; }
        .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
      `}</style>

      <div className="no-print" style={{ marginBottom: 16 }}>
        <button onClick={() => window.print()} style={{ background: '#0F4C3A', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>Print / Save as PDF</button>
      </div>

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

      <table style={{ marginBottom: 16 }}>
        <tbody>
          <tr><th style={{ width: '25%' }}>Client</th><td>{q.client_name}{q.client_contact ? ` · ${q.client_contact}` : ''}</td></tr>
          <tr><th>Venue</th><td>{q.venue_name || '—'}</td></tr>
          <tr><th>Event date(s)</th><td>{q.event_dates || '—'}</td></tr>
        </tbody>
      </table>

      {groups.map((g) => {
        const glines = lines.filter((l) => l.group_id === g.id)
        if (!glines.length) return null
        const sub = Object.fromEntries(QUOTE_BUCKETS.map((b) => [b, glines.filter((l) => l.bucket === b).reduce((s, l) => s + Number(l.amount_paise || 0), 0)]))
        return (
          <div key={g.id} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{g.label}{g.kind === 'options' ? ' (choose one)' : ''}</div>
            <table>
              <thead><tr><th>Element</th><th>Description</th>{QUOTE_BUCKETS.map((b) => <th key={b} className="num">{BUCKET_LABELS[b]}</th>)}</tr></thead>
              <tbody>
                {glines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.element}</td><td>{l.description || ''}</td>
                    {QUOTE_BUCKETS.map((b) => <td key={b} className="num">{l.bucket === b ? formatINR(l.amount_paise) : ''}</td>)}
                  </tr>
                ))}
                <tr><td colSpan={2} style={{ fontWeight: 600 }}>Subtotal</td>{QUOTE_BUCKETS.map((b) => <td key={b} className="num" style={{ fontWeight: 600 }}>{sub[b] ? formatINR(sub[b]) : ''}</td>)}</tr>
              </tbody>
            </table>
          </div>
        )
      })}

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Summary</div>
        <table>
          <thead><tr><th>Item</th>{totals.combinations.map((c, i) => <th key={i} className="num">{totals.combinations.length > 1 ? c.label : 'Amount'}</th>)}</tr></thead>
          <tbody>
            {QUOTE_BUCKETS.map((b) => <tr key={b}><td>{BUCKET_LABELS[b]}</td>{totals.combinations.map((c, i) => <td key={i} className="num">{formatINR(c.buckets[b])}</td>)}</tr>)}
            {extraRows.map((r, ri) => <tr key={ri}><td>{r.label}</td>{totals.combinations.map((c, i) => <td key={i} className="num">{formatINR(r.amount_paise)}</td>)}</tr>)}
            <tr><td style={{ fontWeight: 700 }}>Total (incl. GST)</td>{totals.combinations.map((c, i) => <td key={i} className="num" style={{ fontWeight: 700 }}>{formatINR(c.total_paise)}</td>)}</tr>
          </tbody>
        </table>
        {totals.combinations.length > 1 && <p style={{ fontSize: 11, color: '#55605a', marginTop: 6 }}>Totals shown per option — final total depends on the option selected.</p>}
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: '#55605a' }}>
        <div style={{ fontWeight: 600, color: '#1f2a37', marginBottom: 4 }}>Terms &amp; Conditions</div>
        {q.terms ? <div style={{ whiteSpace: 'pre-wrap' }}>{q.terms}</div> : <div>Standard terms apply.</div>}
        <div style={{ marginTop: 8, fontStyle: 'italic' }}>Valid for {q.valid_days} days — until {formatDate(validUntil)}.</div>
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: '#55605a', fontSize: 14, padding: 24, textAlign: 'center' }}>{children}</div>
}
