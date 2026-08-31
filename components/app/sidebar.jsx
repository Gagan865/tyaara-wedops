import SidebarNav from './sidebar-nav'

// Desktop sidebar. Hidden below the md breakpoint (the mobile slide-over in
// components/app/mobile-sidebar.jsx renders the same nav there). At md+ this is
// unchanged: a sticky, full-height 256px rail.
export default function Sidebar({ project, org, events, role }) {
  return (
    <aside className="hidden md:block w-64 flex-shrink-0 bg-[#0B3A2C] text-white sticky top-0 self-start h-screen overflow-y-auto">
      <SidebarNav project={project} org={org} events={events} role={role} />
    </aside>
  )
}
