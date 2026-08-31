// Enums and static seeds shared across the app.

export const MEMBERSHIP_ROLES = [
  'Family Member','Bride','Groom','Parents','Wedding Planner','Photographer',
  'Videographer','Decorator','Caterer','Makeup Artist','DJ','Volunteer','Admin'
]

export const TASK_PRIORITIES = ['Critical','High','Medium','Low']
export const TASK_STATUSES = ['Not Started','In Progress','Waiting','Blocked','Completed','Cancelled']

export const PRIORITY_STYLES = {
  Critical: 'bg-red-100 text-red-800 border-red-200',
  High:     'bg-orange-100 text-orange-800 border-orange-200',
  Medium:   'bg-amber-100 text-amber-800 border-amber-200',
  Low:      'bg-slate-100 text-slate-700 border-slate-200'
}

export const STATUS_STYLES = {
  'Not Started': 'bg-slate-100 text-slate-700 border-slate-200',
  'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
  'Waiting':     'bg-purple-100 text-purple-800 border-purple-200',
  'Blocked':     'bg-red-100 text-red-800 border-red-200',
  'Completed':   'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Cancelled':   'bg-zinc-100 text-zinc-500 border-zinc-200 line-through'
}

export const GUEST_GROUPS = ['Family','Friends','VIP','Other']
export const GUEST_SIDES = ['Both','Groom','Bride']
export const GUEST_RSVP = ['Coming','Pending','Maybe','Not coming']

export const VENDOR_STATUSES = ['pending','confirmed','overdue']
export const BOOKING_STATUSES = ['confirmed','pending','overdue']

export const SIDEBAR_PLANNING = [
  { key: 'tasks',          label: 'Tasks',          icon: 'CheckSquare',  href: '/tasks' },
  { key: 'bookings',       label: 'Bookings',       icon: 'CalendarCheck', href: '/bookings' },
  { key: 'todos',          label: 'To-Do Lists',    icon: 'ListChecks',   href: '/todos' },
  { key: 'shopping',       label: 'Shopping',       icon: 'ShoppingBag',  href: '/shopping' },
  { key: 'budget',         label: 'Budget',         icon: 'Wallet',       href: '/budget' },
  { key: 'financials',     label: 'Financials',     icon: 'LineChart',    href: '/financials' },
  { key: 'invoices',       label: 'Invoices',       icon: 'FileText',     href: '/invoices' },
  { key: 'vendors',        label: 'Vendors',        icon: 'Store',        href: '/vendors' },
  { key: 'guests',         label: 'Guests',         icon: 'Users',        href: '/guests' },
  { key: 'seating',        label: 'Seating',        icon: 'Armchair',     href: '/seating' },
  { key: 'floor',          label: 'Floor Plan',     icon: 'LayoutGrid',   href: '/floor-plan' },
  { key: 'team',           label: 'Team',           icon: 'UsersRound',   href: '/team' },
  { key: 'calendar',       label: 'Calendar',       icon: 'Calendar',     href: '/calendar' },
  { key: 'transportation', label: 'Transportation', icon: 'Car',          href: '/transportation' },
  { key: 'timeline',       label: 'Timeline',       icon: 'Clock',        href: '/timeline' },
  { key: 'messaging',      label: 'Messaging',      icon: 'MessageCircle', href: '/messaging' },
  { key: 'analytics',      label: 'Analytics',      icon: 'BarChart3',    href: '/analytics' },
  { key: 'reports',        label: 'Reports',        icon: 'FileBarChart', href: '/reports' },
  { key: 'settings',       label: 'Settings',       icon: 'Settings',     href: '/settings' },
  { key: 'about',          label: 'About',          icon: 'Info',         href: '/about' }
]
