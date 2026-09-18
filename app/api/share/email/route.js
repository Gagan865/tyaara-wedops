import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Sends a branded email with a share link via Resend's REST API (no SDK / npm dep — plain
// fetch). Gated on RESEND_API_KEY: if it's not set, we return a clear message so the UI can
// tell the user email isn't configured yet. Only signed-in users may send.
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    let body
    try { body = await request.json() } catch { body = {} }
    const to = (body?.to || '').trim()
    const url = (body?.url || '').trim()
    const subject = body?.subject || 'From Tyaara Weddings'
    const heading = body?.heading || 'Tyaara Weddings'
    const message = body?.message || ''
    const ctaLabel = body?.ctaLabel || 'Open'

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: 'A valid recipient email is required' }, { status: 400 })
    if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: 'A valid link is required' }, { status: 400 })

    const KEY = process.env.RESEND_API_KEY
    const FROM = process.env.EMAIL_FROM || 'Tyaara Weddings <onboarding@resend.dev>'
    if (!KEY) {
      return NextResponse.json({ error: 'Email is not set up yet. Add RESEND_API_KEY (and EMAIL_FROM) in your environment to enable sending. Meanwhile, use “Copy link” or “WhatsApp”.' }, { status: 400 })
    }

    const html = `
    <div style="background:#FBF8F1;padding:28px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1f2a37;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e3e7df;border-radius:14px;overflow:hidden;">
        <div style="background:#0F4C3A;padding:20px 24px;color:#fff;">
          <div style="font-size:20px;font-weight:700;">Tyaara</div>
          <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#C79A5C;">The Tales Of Wedding</div>
        </div>
        <div style="padding:26px 24px;">
          <h1 style="font-size:20px;margin:0 0 10px;">${escapeHtml(heading)}</h1>
          <p style="font-size:14px;line-height:1.6;color:#39433d;margin:0 0 20px;">${escapeHtml(message)}</p>
          <a href="${escapeAttr(url)}" style="display:inline-block;background:#0F4C3A;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:9px;">${escapeHtml(ctaLabel)}</a>
          <p style="font-size:12px;color:#8a94a6;margin:22px 0 0;word-break:break-all;">Or open this link: <br>${escapeHtml(url)}</p>
        </div>
        <div style="padding:14px 24px;border-top:1px solid #eee;font-size:11px;color:#9aa4ae;">Sent by Tyaara Weddings via WedOps.</div>
      </div>
    </div>`

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html })
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      return NextResponse.json({ error: j?.message || j?.error || 'Could not send email' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, id: j?.id })
  } catch (e) {
    console.error('[share/email] failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
