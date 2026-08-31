'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatINR } from '@/lib/format'
import { PRIORITY_STYLES, STATUS_STYLES } from '@/lib/constants'
import { toast } from 'sonner'
import { ImagePlus, Plus } from 'lucide-react'

export default function EventWorkspacePage() {
  const { slug } = useParams()
  const [ev, setEv] = useState(null)
  const [tasks, setTasks] = useState([])
  const [bookings, setBookings] = useState([])
  const [shopping, setShopping] = useState([])
  const [expenses, setExpenses] = useState([])
  const [inspo, setInspo] = useState([])
  const [notes, setNotes] = useState('')
  const [notesTimer, setNotesTimer] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const { data: pm } = await activeProjectQuery(supabase, 'project_id').limit(1).maybeSingle()
    if (!pm) { setLoading(false); return }
    const { data: e } = await supabase.from('events').select('*').eq('slug', slug).eq('project_id', pm.project_id).single()
    if (!e) { setLoading(false); return }
    setEv(e)
    const [t, b, s, ex, ins, n] = await Promise.all([
      supabase.from('tasks').select('*').eq('event_id', e.id),
      supabase.from('bookings').select('*, vendors(name), categories(name)').eq('event_id', e.id),
      supabase.from('shopping_items').select('*').eq('event_id', e.id),
      supabase.from('expenses').select('*').eq('event_id', e.id),
      supabase.from('event_inspo').select('*').eq('event_id', e.id),
      supabase.from('event_notes').select('body').eq('event_id', e.id).maybeSingle()
    ])
    setTasks(t.data || []); setBookings(b.data || []); setShopping(s.data || [])
    setExpenses(ex.data || []); setInspo(ins.data || []); setNotes(n.data?.body || '')
    setLoading(false)
  }
  useEffect(() => { load() }, [slug])

  async function saveNotes(newBody) {
    setNotes(newBody)
    if (notesTimer) clearTimeout(notesTimer)
    setNotesTimer(setTimeout(async () => {
      const supabase = createClient()
      await supabase.from('event_notes').upsert({ event_id: ev.id, project_id: ev.project_id, body: newBody, updated_at: new Date().toISOString() })
    }, 600))
  }

  async function addInspo(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.from('event_inspo').insert({
      event_id: ev.id, project_id: ev.project_id, image_url: fd.get('image_url'), caption: fd.get('caption') || null
    })
    if (error) return toast.error(error.message)
    e.currentTarget.reset(); toast.success('Added'); load()
  }

  if (loading) return <LoadingState />
  if (!ev) return <div>Event not found.</div>

  const bought = shopping.filter(s => s.purchased).length
  const bookingsLocked = bookings.filter(b => b.status === 'confirmed').length
  const tasksDone = tasks.filter(t => t.status === 'Completed').length
  const totalSpent = expenses.reduce((a, e) => a + Number(e.amount_paise || 0), 0)

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-0 shadow">
        <div className={`p-8 text-white bg-gradient-to-br ${ev.color_gradient}`}>
          <div className="text-4xl">{ev.icon}</div>
          <div className="font-serif text-3xl font-semibold mt-2">{ev.name}</div>
          <div className="text-sm text-white/80 mt-1">{ev.event_date ? formatDate(ev.event_date) : 'Date TBD'}</div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Tasks done" value={`${tasksDone} of ${tasks.length}`} />
        <Stat label="Bookings locked" value={`${bookingsLocked} of ${bookings.length}`} />
        <Stat label="Items bought" value={`${bought} of ${shopping.length}`} />
        <Stat label="Spent" value={formatINR(totalSpent, { compact: true })} />
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="shopping">Shopping</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="inspo">Inspo</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card className="divide-y">
            {tasks.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No tasks for this event yet. <a href="/tasks" className="text-[#0F4C3A] underline">Create one</a></div>
            ) : tasks.map(t => (
              <div key={t.id} className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{t.title}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                    {t.due_date && <span className="text-[10px] text-slate-500">{formatDate(t.due_date)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card className="divide-y">
            {bookings.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No bookings for this event. <a href="/bookings" className="text-[#0F4C3A] underline">Manage bookings</a></div>
            ) : bookings.map(b => (
              <div key={b.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{b.vendors?.name || b.categories?.name || 'Booking'}</div>
                  <div className="text-xs text-slate-500">Book by {formatDate(b.ideal_book_by)}</div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded border">{b.status}</span>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="shopping">
          <Card className="divide-y">
            {shopping.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No shopping items for this event. <a href="/shopping" className="text-[#0F4C3A] underline">Add one</a></div>
            ) : shopping.map(s => (
              <div key={s.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-slate-500">Qty {s.quantity} · {s.store || 'Any store'}</div>
                </div>
                <div className="text-sm">{formatINR(s.budget_paise)}</div>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="budget">
          <Card className="p-6 text-sm text-slate-600">
            Event budget total: <b>{formatINR(totalSpent, { compact: true })}</b> across {expenses.length} expenses. Full financials in prompt 2.
          </Card>
        </TabsContent>

        <TabsContent value="inspo">
          <Card className="p-4 space-y-4">
            <form onSubmit={addInspo} className="flex gap-2">
              <Input name="image_url" placeholder="Paste image URL…" required />
              <Input name="caption" placeholder="Caption (optional)" />
              <Button type="submit" className="bg-[#0F4C3A]"><ImagePlus className="h-4 w-4 mr-1.5" />Add</Button>
            </form>
            {inspo.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">No inspiration pinned yet. Paste an image URL above.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {inspo.map(i => (
                  <div key={i.id} className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <img src={i.image_url} alt="" className="h-32 w-full object-cover" />
                    {i.caption && <div className="p-2 text-xs">{i.caption}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card className="p-4">
            <Textarea value={notes} onChange={(e) => saveNotes(e.target.value)} rows={12} placeholder="Anything to remember for this function… autosaves as you type." />
            <div className="text-[10px] text-slate-500 mt-2">Autosaves</div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-serif font-semibold">{value}</div>
    </Card>
  )
}
