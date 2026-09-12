'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { COUPLE_FORM_FIELDS } from '@/lib/agreement-template'

// PUBLIC bride/groom intake form. Loads /api/public/form/[token], the couple fills it, and
// POST saves it back. No login.
export default function SharedFormPage() {
  const { token } = useParams()
  const [form, setForm] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | notfound
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/public/form/${token}`)
        if (!r.ok) { setState('notfound'); return }
        const j = await r.json()
        setForm(j.form); setValues(j.form.data || {}); setDone(j.form.status === 'submitted'); setState('ok')
      } catch { setState('notfound') }
    })()
  }, [token])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await fetch(`/api/public/form/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: values })
      })
      setSaving(false)
      if (!r.ok) return
      setDone(true)
    } catch { setSaving(false) }
  }

  if (state === 'loading') return <Shell><p style={muted}>Loading…</p></Shell>
  if (state === 'notfound') return <Shell><p style={muted}>This form link is invalid or has expired.</p></Shell>

  if (done) return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 40 }}>💐</div>
        <h2 style={{ fontSize: 20, margin: '10px 0 6px' }}>Thank you!</h2>
        <p style={muted}>Your wedding details have been sent to Tyaara Weddings. We&apos;ll be in touch shortly.</p>
      </div>
    </Shell>
  )

  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))

  return (
    <Shell>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 2px' }}>{form.title || 'Wedding details'}</h1>
      <p style={muted}>Tell us about your wedding so we can plan it beautifully.</p>
      <form onSubmit={submit} style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {COUPLE_FORM_FIELDS.map((f) => (
          <label key={f.key} style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{f.label}{f.required && <span style={{ color: '#b4362b' }}> *</span>}</span>
            {f.type === 'textarea' ? (
              <textarea value={values[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} rows={3} placeholder={f.placeholder || ''} style={input} />
            ) : f.type === 'select' ? (
              <select value={values[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} style={input}>
                <option value="">Select…</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type} required={f.required} value={values[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder || ''} style={input} />
            )}
          </label>
        ))}
        <button type="submit" disabled={saving} style={{ marginTop: 6, background: '#0F4C3A', color: '#fff', border: 0, borderRadius: 8, padding: '12px 16px', fontSize: 15, cursor: 'pointer' }}>
          {saving ? 'Sending…' : 'Submit details'}
        </button>
      </form>
    </Shell>
  )
}

const input = { border: '1px solid #d8dcd4', borderRadius: 8, padding: '9px 11px', fontSize: 14, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
const muted = { color: '#55605a', fontSize: 14, margin: 0 }

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FBF8F1', padding: '28px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', border: '1px solid #e3e7df', borderRadius: 14, padding: 24, color: '#1f2a37' }}>
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
