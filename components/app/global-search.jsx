'use client'
import { useEffect, useState } from 'react'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { canAccessPath } from '@/lib/access'
import { CheckSquare, Users, Store, PartyPopper } from 'lucide-react'

const EMPTY = { data: [] }

export default function GlobalSearch({ open, setOpen, projectId, role }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState({ tasks: [], guests: [], vendors: [], events: [] })

  // Only search the categories this role is allowed to open — a restricted member must not
  // reach vendor or event records through search either.
  const canTasks = canAccessPath(role, '/tasks')
  const canGuests = canAccessPath(role, '/guests')
  const canVendors = canAccessPath(role, '/vendors')
  const canEvents = canAccessPath(role, '/events')

  useEffect(() => {
    if (!open || !projectId) return
    const supabase = createClient()
    const term = q.trim()
    const like = term ? `%${term}%` : '%'
    const run = async () => {
      const [tasks, guests, vendors, events] = await Promise.all([
        canTasks ? supabase.from('tasks').select('id,title,status').eq('project_id', projectId).ilike('title', like).limit(6) : Promise.resolve(EMPTY),
        canGuests ? supabase.from('guests').select('id,name,rsvp').eq('project_id', projectId).ilike('name', like).limit(6) : Promise.resolve(EMPTY),
        canVendors ? supabase.from('vendors').select('id,name,status').eq('project_id', projectId).ilike('name', like).limit(6) : Promise.resolve(EMPTY),
        canEvents ? supabase.from('events').select('id,name,slug').eq('project_id', projectId).ilike('name', like).limit(6) : Promise.resolve(EMPTY)
      ])
      setResults({
        tasks: tasks.data || [],
        guests: guests.data || [],
        vendors: vendors.data || [],
        events: events.data || []
      })
    }
    const t = setTimeout(run, 120)
    return () => clearTimeout(t)
  }, [q, open, projectId, canTasks, canGuests, canVendors, canEvents])

  function go(path) { setOpen(false); router.push(path) }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tasks, guests, vendors, events…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {results.tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {results.tasks.map(t => (
              <CommandItem key={t.id} onSelect={() => go('/tasks')}>
                <CheckSquare className="h-4 w-4 mr-2 text-slate-500" />
                <span className="flex-1">{t.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">{t.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.guests.length > 0 && (
          <CommandGroup heading="Guests">
            {results.guests.map(g => (
              <CommandItem key={g.id} onSelect={() => go('/guests')}>
                <Users className="h-4 w-4 mr-2 text-slate-500" />
                <span className="flex-1">{g.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">{g.rsvp}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.vendors.length > 0 && (
          <CommandGroup heading="Vendors">
            {results.vendors.map(v => (
              <CommandItem key={v.id} onSelect={() => go('/vendors')}>
                <Store className="h-4 w-4 mr-2 text-slate-500" />
                <span className="flex-1">{v.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">{v.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.events.length > 0 && (
          <CommandGroup heading="Events">
            {results.events.map(e => (
              <CommandItem key={e.id} onSelect={() => go(`/events/${e.slug}`)}>
                <PartyPopper className="h-4 w-4 mr-2 text-slate-500" />
                <span className="flex-1">{e.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
