'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatINR, formatDate } from '@/lib/format'
import { COMPANY } from '@/lib/agreement-template'

// PUBLIC agreement. Loads /api/public/agreement/[token]; the client reads the terms and
// e-accepts by typing their full name. No login.
export default function SharedAgreementPage() {
  const { token } = useParams()
  const [ag, setAg] = useState(null)
  const [state, setState] = useState('loading')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const r = await fetch(`/api/public/agreement/${token}`)
      if (!r.ok) { setState('notfound'); return }
      const j = await r.json(); setAg(j.agreement); setState('ok')
    } catch { setState('notfound') }
  }
  useEffect(() => { load() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function accept(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const r = await fetch(`/api/public/agreement/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accepted_name: name })
      })
      const j = await r.json()
      setSaving(false)
      if (!r.ok) { setError(j.error || 'Could not accept'); return }
      load()
    } catch { setSaving(false); setError('Could not accept') }
  }

  if (state === 'loading') return <Shell><p style={muted}>Loading…</p></Shell>
  if (state === 'notfound') return <Shell><p style={muted}>This agreement link is invalid or has expired.</p></Shell>

  const accepted = ag.status === 'accepted'

  return (
    <Shell wide>
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em' }}>AGREEMENT</div>
        <div style={{ fontSize: 12, color: '#55605a' }}>{COMPANY.name} · {ag.agreement_date ? formatDate(ag.agreement_date) : formatDate(ag.created_at)}</div>
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.6 }}>
        This agreement is made between <b>{COMPANY.name}</b>, represented by {COMPANY.rep} ({COMPANY.role}),
        and <b>{ag.client_name}</b>{ag.client_relation ? ` (${ag.client_relation})` : ''} for wedding services
        totalling <b>{formatINR(ag.total_paise)}</b>.
        {ag.advance_paise ? <> Advance received <b>{formatINR(ag.advance_paise)}</b>; balance <b>{formatINR(ag.balance_paise)}</b> payable {ag.balance_due_text || 'before the event'}.</> : null}
      </p>

      <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.6, marginTop: 10 }}>{ag.terms || ''}</div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#55605a' }}>
        {COMPANY.rep} · {COMPANY.role}, {COMPANY.name} · {COMPANY.phone} · {COMPANY.email}
      </div>

      <div style={{ marginTop: 22, borderTop: '1px solid #e3e7df', paddingTop: 18 }}>
        {accepted ? (
          <div style={{ background: '#e7f2ec', border: '1px solid #bfe0cd', borderRadius: 10, padding: 14, fontSize: 13 }}>
            ✓ Accepted by <b>{ag.accepted_name}</b> on {formatDate(ag.accepted_at)}. Thank you.
          </div>
        ) : (
          <form onSubmit={accept}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Accept the agreement</div>
            <p style={muted}>Type your full name to confirm you have read, understood and accept these terms.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" style={{ flex: 1, minWidth: 200, border: '1px solid #d8dcd4', borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
              <button type="submit" disabled={saving || !name.trim()} style={{ background: '#0F4C3A', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}>{saving ? 'Submitting…' : 'I Accept'}</button>
            </div>
            {error && <p style={{ color: '#b4362b', fontSize: 12, marginTop: 8 }}>{error}</p>}
          </form>
        )}
      </div>
    </Shell>
  )
}

const muted = { color: '#55605a', fontSize: 13, margin: 0 }

function Shell({ children, wide }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FBF8F1', padding: '28px 16px' }}>
      <div style={{ maxWidth: wide ? 720 : 560, margin: '0 auto', background: '#fff', border: '1px solid #e3e7df', borderRadius: 14, padding: 24, color: '#1f2a37' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <img src="/tyaara-logo.jpg" alt="Tyaara" style={{ height: 44, width: 44, objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 700 }}>Tyaara</div>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8a94a6' }}>The Tales Of Wedding</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
