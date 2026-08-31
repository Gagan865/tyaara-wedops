'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { useConfirm } from '@/components/app/confirm-dialog'
import { LoadingState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatINR, formatDate, daysUntil } from '@/lib/format'
import WeddingSwitcher from '@/components/app/wedding-switcher'
import { toast } from 'sonner'
import { Save, Trash2, AlertTriangle } from 'lucide-react'

export default function SettingsPage() {
  const confirm = useConfirm()
  const router = useRouter()
  const [project, setProject] = useState(null)
  const [org, setOrg] = useState(null)
  const [leadTimes, setLeadTimes] = useState([])

  const [noProject, setNoProject] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(*, organizations(*))').limit(1).maybeSingle()
    if (!pm) { setNoProject(true); return }
    setProject(pm.projects); setOrg(pm.projects?.organizations)
    const { data: lt } = await supabase.from('booking_lead_times').select('*, categories(name)').eq('project_id', pm.project_id).order('lead_days', { ascending: false })
    setLeadTimes(lt || [])
  }
  useEffect(() => { load() }, [])

  async function saveProject(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const supabase = createClient()
    await supabase.from('projects').update({
      name: fd.get('name'), wedding_date: fd.get('wedding_date'),
      currency: fd.get('currency'), timezone: fd.get('timezone')
    }).eq('id', project.id)
    toast.success('Wedding details saved'); load()
  }

  async function saveOrg(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const supabase = createClient()
    await supabase.from('organizations').update({
      name: fd.get('name'), branding_logo_url: fd.get('logo'),
      branding_color: fd.get('color'), custom_domain: fd.get('domain')
    }).eq('id', org.id)
    toast.success('Branding saved'); load()
  }

  async function saveLeadTime(id, days) {
    const supabase = createClient()
    await supabase.from('booking_lead_times').update({ lead_days: parseInt(days) || 0 }).eq('id', id)
    load()
  }

  async function deleteAccount() {
    if (!await confirm({ title: 'Sign out?', description: 'Contact support to fully delete your data.', confirmLabel: 'Sign out', destructive: true })) return
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  if (noProject) return <NoProjectState />
  if (!project) return <LoadingState label="Loading settings…" />

  const wed = new Date(project.wedding_date)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">The date drives countdown and every urgency flag.</p>
      </div>

      <Tabs defaultValue="wedding">
        <TabsList>
          <TabsTrigger value="weddings">Switch wedding</TabsTrigger>
          <TabsTrigger value="wedding">Wedding details</TabsTrigger>
          <TabsTrigger value="leadtimes">Lead times</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="locale">Locale</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>

        <TabsContent value="weddings">
          <div className="max-w-xl space-y-2">
            <p className="text-sm text-slate-500">Switch which wedding the whole app is showing. Only weddings you're a member of appear here.</p>
            <WeddingSwitcher />
          </div>
        </TabsContent>

        <TabsContent value="wedding">
          <Card className="p-6">
            <form onSubmit={saveProject} className="space-y-3 max-w-lg">
              <div><Label>Project name</Label><Input name="name" defaultValue={project.name} required /></div>
              <div><Label>Wedding date</Label><Input name="wedding_date" type="date" defaultValue={project.wedding_date} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Currency</Label><Input name="currency" defaultValue={project.currency} /></div>
                <div><Label>Timezone</Label><Input name="timezone" defaultValue={project.timezone} /></div>
              </div>
              <div className="text-xs text-slate-500">Project code: <b>{project.project_code}</b></div>
              <Button type="submit" className="bg-[#0F4C3A]"><Save className="h-4 w-4 mr-2" />Save</Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="leadtimes">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs"><tr>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Lead days</th>
                <th className="text-left px-3 py-2">Book by (computed)</th>
                <th className="text-left px-3 py-2">Countdown</th>
              </tr></thead>
              <tbody className="divide-y">
                {leadTimes.map(l => {
                  const bookBy = new Date(wed); bookBy.setDate(bookBy.getDate() - l.lead_days)
                  const d = daysUntil(bookBy)
                  return (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{l.categories?.name}</td>
                      <td className="px-3 py-2">
                        <Input type="number" defaultValue={l.lead_days} className="w-24 h-8"
                          onBlur={(e) => saveLeadTime(l.id, e.target.value)} />
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(bookBy)}</td>
                      <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${d < 0 ? 'bg-rose-100 text-rose-800 border-rose-200' : d < 14 ? 'bg-orange-100 text-orange-800 border-orange-200' : d < 30 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>{d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card className="p-6">
            <form onSubmit={saveOrg} className="space-y-3 max-w-lg">
              <div><Label>Workspace name</Label><Input name="name" defaultValue={org?.name} /></div>
              <div><Label>Logo URL</Label><Input name="logo" defaultValue={org?.branding_logo_url || ''} placeholder="https://…" />
                {org?.branding_logo_url && <img src={org.branding_logo_url} alt="logo" className="h-12 mt-2" />}
              </div>
              <div><Label>Brand color</Label><Input name="color" defaultValue={org?.branding_color || '#0F4C3A'} type="color" className="w-20 h-10" /></div>
              <div><Label>Custom domain</Label><Input name="domain" defaultValue={org?.custom_domain || ''} placeholder="weddings.mystudio.com" /></div>
              <div className="text-xs text-slate-500">Custom domain and white-label are Enterprise features.</div>
              <Button type="submit" className="bg-[#0F4C3A]"><Save className="h-4 w-4 mr-2" />Save branding</Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="locale">
          <Card className="p-6 max-w-lg space-y-2">
            <div className="text-sm">Money format: <b>{formatINR(1320000)}</b> (Indian grouping)</div>
            <div className="text-sm">Date format: <b>{formatDate(new Date())}</b> (dd MMM yyyy)</div>
            <div className="text-sm">Currency: <b>{project.currency}</b> — Timezone: <b>{project.timezone}</b></div>
            <div className="text-xs text-slate-500 mt-2">One locale layer for the whole app. Adjust currency/timezone under Wedding details.</div>
          </Card>
        </TabsContent>

        <TabsContent value="danger">
          <Card className="p-6 border-rose-200 bg-rose-50/40 max-w-lg">
            <div className="flex items-center gap-2 text-rose-800 mb-2"><AlertTriangle className="h-4 w-4" /><b>Danger zone</b></div>
            <p className="text-sm text-slate-700 mb-3">Sign out and disable this account. Reach out to support for permanent deletion.</p>
            <Button variant="destructive" onClick={deleteAccount}><Trash2 className="h-4 w-4 mr-2" />Sign out</Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
