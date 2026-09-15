import Link from 'next/link'

// Elegant split-screen shell for the auth pages (login / signup). Left: a deep-green brand
// panel with a faint logo watermark and gold accents. Right: the form. Collapses to a
// single column with a slim brand header on mobile.
export default function AuthShell({ heading, subheading, children, altPrompt, altHref, altLabel }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#FBF8F1', color: '#1f2a37' }}>
      {/* Brand panel — desktop only */}
      <div className="auth-brand">
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/tyaara-logo.jpg" alt="Tyaara" style={{ height: 46, width: 46, objectFit: 'contain', borderRadius: 10, background: '#fff' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>Tyaara</div>
              <div style={{ fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#C79A5C', marginTop: 4 }}>The Tales Of Wedding</div>
            </div>
          </div>

          <div>
            <div style={{ width: 44, height: 2, background: '#C79A5C', marginBottom: 22 }} />
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 34, lineHeight: 1.18, fontWeight: 600, margin: 0, maxWidth: 440 }}>
              Every celebration,<br />a story worth telling.
            </h2>
            <p style={{ marginTop: 16, color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.6, maxWidth: 400 }}>
              Plan enquiries, clients, vendors, quotations and every function — beautifully organised, all in one place.
            </p>
          </div>

          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            A PRISIM product
          </div>
        </div>
        {/* faint logo watermark */}
        <img src="/tyaara-logo.jpg" alt="" aria-hidden="true"
          style={{ position: 'absolute', right: -70, bottom: -70, width: 360, height: 360, objectFit: 'contain', opacity: 0.06, zIndex: 1, filter: 'grayscale(1) brightness(3)' }} />
      </div>

      {/* Form panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* mobile brand strip */}
        <div className="auth-mobile-brand">
          <img src="/tyaara-logo.jpg" alt="Tyaara" style={{ height: 40, width: 40, objectFit: 'contain', borderRadius: 9, background: '#fff', border: '1px solid #e3e7df' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontWeight: 700, fontSize: 17, lineHeight: 1, color: '#1f2a37' }}>Tyaara</div>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C79A5C', marginTop: 3 }}>The Tales Of Wedding</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px 40px' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>
            <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 6px' }}>{heading}</h1>
            {subheading && <p style={{ color: '#55605a', fontSize: 14.5, margin: '0 0 26px' }}>{subheading}</p>}

            {children}

            {altPrompt && (
              <p style={{ textAlign: 'center', fontSize: 14, color: '#55605a', marginTop: 22 }}>
                {altPrompt} <Link href={altHref} style={{ color: '#0F4C3A', fontWeight: 600, textDecoration: 'none' }}>{altLabel}</Link>
              </p>
            )}

            <p style={{ textAlign: 'center', fontSize: 11, color: '#9aa4ae', marginTop: 20 }}>
              By continuing you agree to our <Link href="/terms" style={{ color: '#8a94a6', textDecoration: 'underline' }}>Terms</Link> &amp; <Link href="/privacy" style={{ color: '#8a94a6', textDecoration: 'underline' }}>Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .auth-brand {
          width: 44%;
          padding: 48px;
          position: relative;
          overflow: hidden;
          color: #fff;
          background: linear-gradient(150deg, #0B3A2C 0%, #0F4C3A 52%, #14303A 100%);
        }
        .auth-mobile-brand { display: none; }
        @media (max-width: 900px) {
          .auth-brand { display: none; }
          .auth-mobile-brand {
            display: flex; align-items: center; gap: 10;
            gap: 10px; padding: 20px 24px; border-bottom: 1px solid #eae6da;
          }
        }
      `}</style>
    </div>
  )
}
