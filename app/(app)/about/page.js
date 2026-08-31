import { Card } from '@/components/ui/card'
import { Zap, Layers, Eye, Sparkles, TrendingUp } from 'lucide-react'

// Company / product About page. Reads as a legitimate PRISIM · WedOps product page;
// the engineering credit sits understated in the middle, not as a personal banner.

const NAVY = '#1F2A37'
const GOLD = '#C79A5C'

const PRINCIPLES = [
  { icon: Zap, title: 'Automation', body: 'Reduce repetitive manual processes.' },
  { icon: Layers, title: 'Centralization', body: 'Keep business information in one place.' },
  { icon: Eye, title: 'Visibility', body: 'Give teams a clearer view of ongoing operations.' },
  { icon: Sparkles, title: 'Intelligence', body: 'Turn business data into useful insights.' },
  { icon: TrendingUp, title: 'Scalability', body: 'Build systems that can grow with the organization.' }
]

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-14 pb-10">

      {/* Hero */}
      <header className="space-y-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: GOLD }}>About · PRISIM WedOps</div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight" style={{ color: NAVY }}>PRISIM</h1>
        <p className="text-lg text-slate-600">Business Automation. Built for the way modern teams work.</p>
        <div className="space-y-3 text-slate-700 leading-relaxed">
          <p>PRISIM is a business-automation platform designed to reduce repetitive work, improve operational visibility, and help teams manage their day-to-day processes more efficiently.</p>
          <p>From lead management and customer communication to follow-ups, appointments, workflows and internal operations, PRISIM brings critical business activities into one connected system.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
          style={{ background: 'rgba(199,154,92,0.12)', color: NAVY, border: '1px solid rgba(199,154,92,0.35)' }}>
          Save Time. &nbsp;Reduce Costs. &nbsp;Scale Faster.
        </div>
      </header>

      <Divider />

      {/* What is WedOps */}
      <section className="space-y-4">
        <h2 className="text-2xl font-serif font-semibold" style={{ color: NAVY }}>What is WedOps?</h2>
        <div className="space-y-3 text-slate-700 leading-relaxed">
          <p><strong>WedOps</strong> is PRISIM’s specialized operations platform built for the wedding industry.</p>
          <p>Created for businesses such as <strong>TYAARA — The Tales Of Wedding</strong>, WedOps brings together the operational processes involved in managing enquiries, clients, follow-ups, appointments, communication and ongoing wedding projects.</p>
          <p>Instead of relying on disconnected spreadsheets, chats and manual reminders, WedOps provides a centralized operational layer that helps teams stay organized and respond faster.</p>
          <p><strong>WedOps v1.0</strong> represents the first product iteration of this system, with the foundation designed to expand as business requirements evolve.</p>
        </div>
      </section>

      {/* Built around one idea */}
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-semibold" style={{ color: NAVY }}>Built Around One Idea</h2>
          <p className="text-lg text-slate-600 italic">
            Let people focus on the work that matters.<br />Let software handle the work that repeats.
          </p>
        </div>
        <p className="text-slate-700 leading-relaxed">PRISIM focuses on automating repetitive operational tasks while keeping people in control of important decisions. The platform is designed around five ideas:</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {PRINCIPLES.map(p => (
            <Card key={p.title} className="p-4 flex gap-3 items-start">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(15,76,58,0.08)', color: '#0F4C3A' }}>
                <p.icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: NAVY }}>{p.title}</div>
                <div className="text-sm text-slate-600">{p.body}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Divider />

      {/* Product & Engineering */}
      <section className="space-y-4">
        <h2 className="text-2xl font-serif font-semibold" style={{ color: NAVY }}>Product &amp; Engineering</h2>
        <div className="space-y-3 text-slate-700 leading-relaxed">
          <p>WedOps is developed and maintained as a PRISIM product. Its development focuses on combining practical business workflows with modern software architecture, automation and AI-assisted systems.</p>
          <p>From defining the operational structure to translating real business requirements into software, PRISIM’s approach is centered on building systems that solve actual operational problems — rather than simply adding more software to the workflow.</p>
        </div>
        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">PRISIM · Product Engineering</div>
      </section>

      {/* The PRISIM Approach */}
      <section className="space-y-4">
        <h2 className="text-2xl font-serif font-semibold" style={{ color: NAVY }}>The PRISIM Approach</h2>
        <p className="text-slate-700 leading-relaxed">We believe business software should do more than store information. It should understand the workflow, reduce unnecessary effort and help people make better decisions.</p>
        <p className="text-slate-700 leading-relaxed">PRISIM therefore approaches every product around three questions:</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {['What can be simplified?', 'What can be automated?', 'What can be made measurable?'].map((q, i) => (
            <Card key={i} className="p-4">
              <div className="font-serif text-2xl font-semibold" style={{ color: GOLD }}>{i + 1}</div>
              <div className="mt-1 font-medium" style={{ color: NAVY }}>{q}</div>
            </Card>
          ))}
        </div>
        <p className="text-sm text-slate-500">The answers form the foundation of the systems we build.</p>
      </section>

      {/* Understated engineering credit — sits between the Approach and the closing */}
      <p className="text-center text-sm text-slate-400">
        Product Architecture &amp; Engineering — <span className="text-slate-500 font-medium">Gagan, PRISIM</span>
      </p>

      <Divider />

      {/* Built for today */}
      <section className="space-y-4">
        <h2 className="text-2xl font-serif font-semibold" style={{ color: NAVY }}>Built for Today. Designed for What’s Next.</h2>
        <div className="space-y-3 text-slate-700 leading-relaxed">
          <p>WedOps v1.0 is the beginning of a larger operational ecosystem. As the platform evolves, PRISIM aims to introduce deeper automation, intelligent assistance, advanced reporting and increasingly connected business workflows.</p>
          <p>The objective remains simple: <strong>make operations easier to manage, easier to understand and easier to scale.</strong></p>
        </div>
      </section>

      {/* Closing brand block */}
      <Card className="p-8 text-center space-y-2" style={{ background: NAVY, borderColor: NAVY }}>
        <div className="font-serif text-2xl font-bold text-white tracking-wide">PRISIM</div>
        <div className="text-sm" style={{ color: GOLD }}>Save Time. Reduce Costs. Scale Faster.</div>
        <div className="pt-3 text-white/80 text-sm">WedOps v1.0</div>
        <div className="font-mono text-xs text-white/50">PRSM-WDO-2026-0114</div>
        <div className="pt-2 text-[11px] uppercase tracking-[0.2em] text-white/60">Powered by WedOps™</div>
      </Card>
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      <span className="h-px w-12" style={{ background: GOLD }} />
      <span className="h-1.5 w-1.5 rotate-45" style={{ background: GOLD }} />
      <span className="h-px w-12" style={{ background: GOLD }} />
    </div>
  )
}
