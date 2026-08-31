'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { useConfirm } from '@/components/app/confirm-dialog'
import { LoadingState, ErrorState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { MEMBERSHIP_ROLES } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, UserRound, UserPlus, RefreshCw, KeyRound } from 'lucide-react'

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function TeamPage() {
  const confirm = useConfirm()
  const [ctx, setCtx] = useState({ projectId: null, orgId: null })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [assignees, setAssignees] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [teammateOpen, setTeammateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pwd, setPwd] = useState('')
  const [resetFor, setResetFor] = useState(null)
  const [resetPwd, setResetPwd] = useState('')
  const [resetting, setResetting] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      const projectId = pm.project_id
      const orgId = pm.projects?.org_id
      setCtx({ projectId, orgId })
      if (user) {
        const { data: mem } = await supabase.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle()
        setIsAdmin(['owner', 'admin'].includes(mem?.role))
      }
      const [m, t, ta] = await Promise.all([
        supabase.from('memberships').select('*').eq('project_id', projectId).order('created_at'),
        supabase.from('tasks').select('id,status').eq('project_id', projectId),
        supabase.from('task_assignees').select('task_id,membership_id')
      ])
      setMembers(m.data || []); setTasks(t.data || []); setAssignees(ta.data || [])
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function createTeammate(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setCreating(true)
    try {
      const r = await fetch('/api/team/create-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'), email: fd.get('email'), password: fd.get('password'),
          role: fd.get('role'), phone: fd.get('phone'), skills: fd.get('skills'), availability: fd.get('availability')
        })
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Could not create teammate'); setCreating(false); return }
      toast.success(`Login created for ${j.email} — share the email & password with them.`)
      setTeammateOpen(false); setPwd(''); setCreating(false); load()
    } catch {
      toast.error('Could not create teammate'); setCreating(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      project_id: ctx.projectId, org_id: ctx.orgId,
      name: fd.get('name'), phone: fd.get('phone') || null,
      role: fd.get('role'), skills: fd.get('skills') || null, availability: fd.get('availability') || null
    }
    const supabase = createClient()
    if (editing) {
      const { error } = await supabase.from('memberships').update(payload).eq('id', editing.id)
      if (error) return toast.error(error.message)
      toast.success('Member updated')
    } else {
      const { error } = await supabase.from('memberships').insert(payload)
      if (error) return toast.error(error.message)
      toast.success('Member added')
    }
    setOpen(false); setEditing(null); load()
  }

  async function resetPassword(e) {
    e.preventDefault()
    if (!resetFor) return
    setResetting(true)
    try {
      const r = await fetch('/api/team/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: resetFor.id, password: resetPwd })
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Could not reset password'); setResetting(false); return }
      toast.success(`Password reset for ${resetFor.name} — share the new password with them.`)
      setResetFor(null); setResetPwd(''); setResetting(false)
    } catch {
      toast.error('Could not reset password'); setResetting(false)
    }
  }

  async function remove(m) {
    const hasLogin = Boolean(m.user_id)
    if (!await confirm({
      title: hasLogin ? 'Remove this teammate?' : 'Remove this member?',
      description: hasLogin
        ? 'Their login will be deleted and they will lose all access. The email becomes free to reuse.'
        : 'They will be removed from this project.',
      confirmLabel: 'Remove', destructive: true
    })) return

    if (hasLogin) {
      // Real login — deprovision via the admin route (deletes auth user + memberships).
      const r = await fetch('/api/team/remove', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: m.id })
      })
      const j = await r.json()
      if (!r.ok) return toast.error(j.error || 'Could not remove teammate')
      toast.success(j.deletedLogin ? 'Teammate removed — login deleted' : 'Teammate removed')
    } else {
      // Display-only member — no login to clean up.
      const supabase = createClient()
      const { error } = await supabase.from('memberships').delete().eq('id', m.id)
      if (error) return toast.error(error.message)
      toast.success('Removed')
    }
    load()
  }

  function performanceFor(memberId) {
    const myTaskIds = assignees.filter(a => a.membership_id === memberId).map(a => a.task_id)
    if (myTaskIds.length === 0) return '—'
    const done = tasks.filter(t => myTaskIds.includes(t.id) && t.status === 'Completed').length
    return `${Math.round((done / myTaskIds.length) * 100)}%`
  }

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Team</h1>
          <p className="text-sm text-slate-500">Family, friends and vendors who’re making this happen.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => { setPwd(generatePassword()); setTeammateOpen(true) }}>
              <UserPlus className="h-4 w-4 mr-2" />Add teammate
            </Button>
          )}
          <Button className="bg-[#0F4C3A] hover:bg-[#0B3A2C]" onClick={() => { setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add member</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map(m => (
          <Card key={m.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] font-bold flex items-center justify-center">
                {m.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2">{m.name}{m.is_you && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">You</span>}</div>
                <div className="text-xs text-slate-500">{m.role}</div>
              </div>
              <div className="flex gap-1">
                {isAdmin && m.user_id && !m.is_you && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Reset password" onClick={() => { setResetPwd(generatePassword()); setResetFor(m) }}><KeyRound className="h-3.5 w-3.5 text-slate-500" /></Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(m); setOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                {!m.is_you && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(m)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}
              </div>
            </div>
            <div className="mt-3 text-xs space-y-1">
              {m.phone && <div className="text-slate-600">{m.phone}</div>}
              {m.skills && <div><span className="text-slate-500">Skills:</span> {m.skills}</div>}
              {m.availability && <div><span className="text-slate-500">Availability:</span> {m.availability}</div>}
              <div><span className="text-slate-500">Performance:</span> {performanceFor(m.id)}</div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit member' : 'Add member'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Name</Label><Input name="name" defaultValue={editing?.name} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input name="phone" defaultValue={editing?.phone || ''} /></div>
              <div><Label>Role</Label>
                <Select name="role" defaultValue={editing?.role || 'Family Member'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEMBERSHIP_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Skills</Label><Textarea name="skills" defaultValue={editing?.skills || ''} rows={2} placeholder="e.g. Great with logistics, drives well" /></div>
            <div><Label>Availability</Label><Textarea name="availability" defaultValue={editing?.availability || ''} rows={2} placeholder="e.g. Weekends only, evenings after 6" /></div>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]">{editing ? 'Save' : 'Add'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={teammateOpen} onOpenChange={(o) => { if (!creating) { setTeammateOpen(o); if (!o) setPwd('') } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add teammate (with login)</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 -mt-2">Creates a login and attaches them to this wedding. Share the email &amp; password with them — they can sign in right away.</p>
          <form onSubmit={createTeammate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input name="name" required /></div>
              <div><Label>Role</Label>
                <Select name="role" defaultValue="Wedding Planner">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEMBERSHIP_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Email</Label><Input name="email" type="email" required placeholder="teammate@example.com" /></div>
            <div>
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input name="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required minLength={6} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => setPwd(generatePassword())} title="Generate a new password"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Shown in full so you can copy it. They can change it later.</p>
            </div>
            <div><Label>Phone (optional)</Label><Input name="phone" placeholder="+91…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Skills (optional)</Label><Textarea name="skills" rows={2} /></div>
              <div><Label>Availability (optional)</Label><Textarea name="availability" rows={2} /></div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
              Roles other than <b>Admin</b> and <b>Wedding Planner</b> only see Tasks, Bookings, Shopping, Guests, Timeline and Transport.
            </div>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]" disabled={creating}>{creating ? 'Creating…' : 'Create login'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetFor)} onOpenChange={(o) => { if (!resetting && !o) { setResetFor(null); setResetPwd('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reset password{resetFor ? ` — ${resetFor.name}` : ''}</DialogTitle></DialogHeader>
          <form onSubmit={resetPassword} className="space-y-3">
            <div>
              <Label>New password</Label>
              <div className="flex gap-2">
                <Input value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} required minLength={6} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => setResetPwd(generatePassword())} title="Generate a new password"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Shown in full so you can copy it. Share it with them; they can change it later.</p>
            </div>
            <DialogFooter><Button type="submit" className="bg-[#0F4C3A]" disabled={resetting}>{resetting ? 'Resetting…' : 'Set new password'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
