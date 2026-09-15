import Link from 'next/link'

// Shared shell for the public legal pages (/terms, /privacy). Server component — static.
export default function LegalShell({ title, updated, children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FBF8F1', color: '#1f2a37' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 80px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <img src="/tyaara-logo.jpg" alt="Tyaara" style={{ height: 44, width: 44, objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Tyaara</div>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8a94a6' }}>The Tales Of Wedding</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 13 }}>
            <Link href="/terms" style={{ color: '#0F4C3A', textDecoration: 'none' }}>Terms</Link>
            <Link href="/privacy" style={{ color: '#0F4C3A', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/login" style={{ color: '#55605a', textDecoration: 'none' }}>Sign in</Link>
          </div>
        </header>

        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em', margin: '8px 0 4px' }}>{title}</h1>
        <p style={{ color: '#8a94a6', fontSize: 13, margin: '0 0 20px' }}>Last updated: {updated}</p>

        <div style={{ background: '#FBF0DA', border: '1px solid #ECD3A2', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#935B0C', marginBottom: 24 }}>
          <b>Please review before use.</b> This document is a general template for the WedOps platform, not legal advice. Fill in the bracketed <code>[…]</code> details and have it reviewed by a qualified professional before relying on it.
        </div>

        <div className="legal-prose">{children}</div>

        <style>{`
          .legal-prose { font-size: 15px; line-height: 1.7; }
          .legal-prose h2 { font-size: 18px; font-weight: 600; margin: 28px 0 8px; }
          .legal-prose p { margin: 10px 0; }
          .legal-prose ul { margin: 8px 0 8px 20px; padding: 0; }
          .legal-prose li { margin: 5px 0; }
          .legal-prose a { color: #0F4C3A; }
          .legal-prose code { background: #f2f4ef; border: 1px solid #e3e7df; border-radius: 4px; padding: 0 4px; font-size: 0.9em; }
        `}</style>

        <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #e3e7df', fontSize: 12, color: '#8a94a6' }}>
          WedOps — a PRISIM product. · <Link href="/terms" style={{ color: '#55605a' }}>Terms</Link> · <Link href="/privacy" style={{ color: '#55605a' }}>Privacy</Link> · <Link href="/login" style={{ color: '#55605a' }}>Sign in</Link>
        </footer>
      </div>
    </div>
  )
}
