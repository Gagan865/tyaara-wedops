'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, EmptyState, NoProjectState } from '@/components/app/page-state'
import { useConfirm } from '@/components/app/confirm-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Pencil, Trash2, StickyNote } from 'lucide-react'

// General Notes — org-scoped with per-role visibility. An org admin (owner) sees every
// note in the organisation; an employee sees only the notes they wrote. Enforced in the
// database by the general_notes RLS policy (schema-4.sql); the client just stamps org_id
// and created_by on insert. Authorship is snapshotted via created_by_name.
export default function NotesPage() {
  const confirm = useConfirm()
  const [orgId, setOrgId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [me, setMe] = useState({ id: null, name: 'You' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: pm } = await activeProjectQuery(supabase, 'projects(org_id)').limit(1).maybeSingle()
      const oid = pm?.projects?.org_id || null
      if (!oid) { setNoProject(true); setLoading(false); return }

      let meName = user?.email?.split('@')[0] || 'You'
      let admin = false
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()
        if (prof?.name) meName = prof.name
        const { data: mem } = await supabase.from('org_members').select('role').eq('org_id', oid).eq('user_id', user.id).maybeSingle()
        admin = ['owner', 'admin'].includes(mem?.role)
      }

      // RLS returns all notes to an admin, only own notes to an employee.
      const { data, error } = await supabase
        .from('general_notes').select('*').eq('org_id', oid).order('created_at', { ascending: false })
      if (error) throw error

      setMe({ id: user?.id || null, name: meName })
      setOrgId(oid)
      setIsAdmin(admin)
      setRows(data || [])
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('general_notes')
      .insert({ body, org_id: orgId, created_by: me.id, created_by_name: me.name })
    setSaving(false)
    if (error) return toast.error(error.message)
    setDraft('')
    toast.success('Note added'); load()
  }

  async function saveEdit(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body = String(fd.get('body') || '').trim()
    if (!body) return
    const supabase = createClient()
    const { error } = await supabase.from('general_notes')
      .update({ body, updated_at: new Date().toISOString() }).eq('id', editing.id)
    if (error) return toast.error(error.message)
    toast.success('Note updated')
    setDialogOpen(false); setEditing(null); load()
  }

  async function remove(row) {
    if (!await confirm({ title: 'Delete this note?', description: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true })) return
    const supabase = createClient()
    const { error } = await supabase.from('general_notes').delete().eq('id', row.id)
    if (error) return toast.error(error.message)
    toast.success('Note deleted'); load()
  }

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold">General Notes</h1>
        <p className="text-sm text-slate-500">{isAdmin ? 'Every team member’s notes across the organisation.' : 'Your private notepad — only you can see these notes.'}</p>
      </div>

      <Card className="p-4">
        <form onSubmit={add} className="space-y-3">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Write a note…" />
          <div className="flex justify-end">
            <Button type="submit" className="bg-[#0F4C3A]" disabled={saving || !draft.trim()}>
              <StickyNote className="h-4 w-4 mr-2" />{saving ? 'Adding…' : 'Add note'}
            </Button>
          </div>
        </form>
      </Card>

      {loadError ? <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} /> :
        rows.length === 0 ? (
          <EmptyState title="No notes yet" description="Add your first note above." />
        ) : (
          <div className="space-y-3">
            {rows.map(n => (
              <Card key={n.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap break-words min-w-0">{n.body}</p>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(n); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(n)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  {isAdmin ? <>{n.created_by_name || 'Someone'} · </> : null}{formatDate(n.created_at)}
                </div>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit note</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="space-y-3">
            <Textarea name="body" rows={5} defaultValue={editing?.body || ''} required />
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]">Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
