'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveProjectId } from '@/lib/active-project'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatDate, daysUntil } from '@/lib/format'
import { toast } from 'sonner'
import { Check, ArrowLeftRight, CalendarHeart, Plus } from 'lucide-react'

// Lists every wedding the signed-in user belongs to and lets them make one active.
// Switching hits the membership-validated endpoint, then does a full navigation to the
// dashboard so the layout and all pages re-read the new cookie with no stale state.
export default function WeddingSwitcher() {
  const [projects, setProjects] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      // Must filter by the current user: RLS lets a member READ every project_members row
      // of a wedding they belong to (other teammates included), so without this a wedding
      // with N members would appear N times. Ordered by membership age to match the
      // deterministic fallback used by the layout and pages.
      let q = supabase
        .from('project_members')
        .select('project_id, created_at, projects(id, name, wedding_date, project_code)')
        .order('created_at', { ascending: true })
      if (user) q = q.eq('user_id', user.id)
      const { data } = await q
      // Dedupe by project id as a belt-and-braces guard against any duplicate memberships.
      const seen = new Set()
      const rows = (data || []).map(r => r.projects).filter(p => p && !seen.has(p.id) && seen.add(p.id))
      setProjects(rows)
      setActiveId(getActiveProjectId() || rows[0]?.id || null)
      setLoading(false)
    })()
  }, [])

  async function switchTo(projectId) {
    setSwitching(projectId)
    try {
      const r = await fetch('/api/project/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Could not switch'); setSwitching(null); return }
      toast.success('Switched wedding')
      // Full navigation so every server component and page picks up the new cookie.
      window.location.href = '/dashboard'
    } catch {
      toast.error('Could not switch')
      setSwitching(null)
    }
  }

  async function createWedding(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setCreating(true)
    try {
      const r = await fetch('/api/project/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fd.get('name'), weddingDate: fd.get('wedding_date') })
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Could not create wedding'); setCreating(false); return }
      toast.success('Wedding created')
      // The route already set this wedding active; full nav so the app loads it.
      window.location.href = '/dashboard'
    } catch {
      toast.error('Could not create wedding')
      setCreating(false)
    }
  }

  const newWeddingButton = (
    <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]" onClick={() => setCreateOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />New wedding
    </Button>
  )

  const createDialog = (
    <Dialog open={createOpen} onOpenChange={(o) => { if (!creating) setCreateOpen(o) }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New wedding</DialogTitle></DialogHeader>
        <form onSubmit={createWedding} className="space-y-3">
          <div><Label>Wedding name</Label><Input name="name" placeholder="e.g. Aarav & Isha" required /></div>
          <div><Label>Wedding date</Label><Input name="wedding_date" type="date" required /></div>
          <p className="text-xs text-slate-500">Adds a new wedding to your current workspace, seeded with the standard 7 functions, 23 categories and checklists. You'll switch to it right away.</p>
          <DialogFooter><Button type="submit" className="bg-[#0F4C3A]" disabled={creating}>{creating ? 'Creating…' : 'Create wedding'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  if (loading) return <Card className="p-6 text-sm text-slate-500">Loading your weddings…</Card>

  if (projects.length <= 1) {
    return (
      <>
        <Card className="p-6 text-sm text-slate-600">
          <p>
            You have {projects.length === 1 ? 'one wedding' : 'no weddings'} right now. Create another and you can
            switch the whole app between them.
          </p>
          <div className="mt-4">{newWeddingButton}</div>
        </Card>
        {createDialog}
      </>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">{newWeddingButton}</div>
      <Card className="divide-y">
      {projects.map(p => {
        const isActive = p.id === activeId
        const d = daysUntil(p.wedding_date)
        return (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-lg bg-[#0F4C3A]/10 text-[#0F4C3A] flex items-center justify-center flex-shrink-0">
              <CalendarHeart className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-slate-500 truncate">
                {formatDate(p.wedding_date)} · {d < 0 ? `${Math.abs(d)}d ago` : `${d}d to go`}
                {p.project_code ? <> · {p.project_code}</> : null}
              </div>
            </div>
            {isActive ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C3A] bg-[#0F4C3A]/10 rounded-full px-2.5 py-1 flex-shrink-0">
                <Check className="h-3.5 w-3.5" /> Active
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0"
                disabled={switching === p.id}
                onClick={() => switchTo(p.id)}
              >
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
                {switching === p.id ? 'Switching…' : 'Switch'}
              </Button>
            )}
          </div>
        )
      })}
      </Card>
      {createDialog}
    </div>
  )
}
