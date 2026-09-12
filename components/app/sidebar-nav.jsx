'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, ChevronDown, ChevronRight, Plus,
  CheckSquare, CalendarCheck, ListChecks, ShoppingBag, Wallet, LineChart, FileText,
  Store, Users, Armchair, LayoutGrid, UsersRound, Calendar, Car, Clock, BarChart3, FileBarChart, Settings, PartyPopper,
  MessageCircle, Building2, StickyNote, Info
} from 'lucide-react'

// Org-level pipeline — NOT tied to the selected wedding, so these live in their own
// section above Planning and are hard-coded rather than pulled from SIDEBAR_PLANNING.
const SIDEBAR_BUSINESS = [
  { key: 'clients', label: 'Clients', Icon: Users, href: '/clients' },
  { key: 'venues', label: 'Venues', Icon: Building2, href: '/venues' },
  { key: 'quotes', label: 'Quotations', Icon: FileText, href: '/quotes' },
  { key: 'notes', label: 'General Notes', Icon: StickyNote, href: '/notes' }
]
import { SIDEBAR_PLANNING } from '@/lib/constants'
import { daysUntil } from '@/lib/format'
import { canAccessPath } from '@/lib/access'

const ICON_MAP = {
  CheckSquare, CalendarCheck, ListChecks, ShoppingBag, Wallet, LineChart, FileText, Store, Users,
  Armchair, LayoutGrid, UsersRound, Calendar, Car, Clock, BarChart3, FileBarChart, Settings,
  MessageCircle, Info
}

// Shared nav body rendered by both the desktop <aside> (components/app/sidebar.jsx)
// and the mobile slide-over (components/app/mobile-sidebar.jsx). onNavigate lets the
// mobile Sheet close itself when a link is tapped.
export default function SidebarNav({ project, org, events, role, onNavigate }) {
  const pathname = usePathname()
  const [eventsOpen, setEventsOpen] = useState(true)
  const daysToGo = daysUntil(project.wedding_date)

  // Restricted roles (anyone the admin hasn't made Admin or Wedding Planner) only see the
  // operational pages; the rest are hidden here and hard-blocked by middleware.
  const allow = (href) => canAccessPath(role, href)
  const businessItems = SIDEBAR_BUSINESS.filter(i => allow(i.href))
  const planningItems = SIDEBAR_PLANNING.filter(i => allow(i.href))
  const showDashboard = allow('/dashboard')
  const showEvents = allow('/events')

  return (
    <>
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <img src="/tyaara-logo.jpg" alt="Tyaara" className="h-10 w-10 rounded-lg object-contain bg-white flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Tyaara</div>
            <div className="text-[10px] uppercase tracking-wider text-white/60 truncate">The Tales Of Wedding</div>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-white/8 border border-white/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/60">Countdown</div>
          <div className="text-lg font-serif font-semibold">{daysToGo} days to go</div>
          <div className="text-[11px] text-white/60 truncate">{project.name}</div>
        </div>
      </div>

      <nav className="px-2 py-3 text-sm">
        {showDashboard && (
          <NavItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} active={pathname === '/dashboard'} onNavigate={onNavigate}>
            Dashboard
          </NavItem>
        )}

        {showEvents && (
          <>
            <button
              onClick={() => setEventsOpen(v => !v)}
              className="w-full mt-4 flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/60 hover:text-white/80"
            >
              <span>Events</span>
              {eventsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {eventsOpen && (
              <div className="mt-1 space-y-0.5">
                {events.map(e => (
                  <NavItem
                    key={e.id}
                    href={`/events/${e.slug}`}
                    icon={<span className="text-base leading-none">{e.icon || '🎉'}</span>}
                    active={pathname === `/events/${e.slug}`}
                    onNavigate={onNavigate}
                  >
                    {e.name}
                  </NavItem>
                ))}
                <NavItem href="/events" icon={<Plus className="h-4 w-4" />} active={pathname === '/events'} onNavigate={onNavigate}>
                  Manage Events
                </NavItem>
              </div>
            )}
          </>
        )}

        {businessItems.length > 0 && (
          <>
            <div className="mt-4 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/60">Business</div>
            <div className="space-y-0.5">
              {businessItems.map(item => (
                <NavItem key={item.key} href={item.href} icon={<item.Icon className="h-4 w-4" />} active={pathname === item.href} onNavigate={onNavigate}>
                  {item.label}
                </NavItem>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/60">Planning</div>
        <div className="space-y-0.5">
          {planningItems.map(item => {
            const Icon = ICON_MAP[item.icon] || PartyPopper
            return (
              <NavItem key={item.key} href={item.href} icon={<Icon className="h-4 w-4" />} active={pathname === item.href} onNavigate={onNavigate}>
                {item.label}
              </NavItem>
            )
          })}
        </div>

        <div className="mt-6 mx-3 pt-4 border-t border-white/10 text-[10px] leading-relaxed text-white/45">
          <div className="tracking-wider">Powered by <span className="text-white/70 font-medium">WedOps™</span></div>
          <div className="text-white/40">PRISIM · WedOps v1.0</div>
          <div className="font-mono text-white/30">PRSM-WDO-2026-0114</div>
        </div>
      </nav>
    </>
  )
}

function NavItem({ href, icon, active, children, onNavigate }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-white/80 hover:text-white hover:bg-white/8 transition ${active ? 'bg-white/12 text-white font-medium' : ''}`}
    >
      <span className="opacity-90">{icon}</span>
      <span className="truncate">{children}</span>
    </Link>
  )
}
