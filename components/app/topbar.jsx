'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, LogOut, User as UserIcon, Command } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import GlobalSearch from './global-search'
import MobileSidebar from './mobile-sidebar'

export default function Topbar({ user, unreadCount, projectId, project, org, events, role }) {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login'); router.refresh()
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#FBF8F1]/90 backdrop-blur border-b border-slate-200/70 px-6 py-3 flex items-center gap-4">
        {project && <MobileSidebar project={project} org={org} events={events} role={role} />}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex-1 max-w-xl flex items-center gap-2 text-left rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-500 hover:border-slate-300 transition"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1">Search everything…</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">⌘K</kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg pl-1 pr-2.5 py-1 hover:bg-white/60">
                <div className="h-8 w-8 rounded-full bg-[#0F4C3A] text-white text-xs font-bold flex items-center justify-center">
                  {user.initials}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-medium text-slate-800">{user.name}</div>
                  <div className="text-[10px] text-slate-500">{user.email}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem><UserIcon className="h-4 w-4 mr-2" /> My profile</DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}><LogOut className="h-4 w-4 mr-2" /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <GlobalSearch open={searchOpen} setOpen={setSearchOpen} projectId={projectId} role={role} />
    </>
  )
}
