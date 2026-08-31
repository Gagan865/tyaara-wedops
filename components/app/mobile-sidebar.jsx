'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import SidebarNav from './sidebar-nav'

// Mobile navigation drawer. Only mounted below md (the trigger is md:hidden in the
// topbar). Renders the exact same nav as the desktop sidebar inside a left slide-over.
export default function MobileSidebar({ project, org, events, role }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close the drawer whenever the route changes (belt-and-braces alongside the
  // per-link onNavigate handler, e.g. for programmatic navigation).
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 transition"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        className="w-64 p-0 bg-[#0B3A2C] text-white border-r-0 overflow-y-auto [&>button]:text-white/70 [&>button]:hover:text-white"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNav project={project} org={org} events={events} role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
