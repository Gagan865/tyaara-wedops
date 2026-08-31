'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { toIsoDate } from '@/lib/format'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [orgType, setOrgType] = useState('couple')
  // Default wedding date: 6 months from today so countdown is populated
  const defaultDate = new Date(); defaultDate.setMonth(defaultDate.getMonth() + 6)
  const defaultDateStr = toIsoDate(defaultDate)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      orgName: fd.get('orgName'),
      orgType,
      projectName: fd.get('projectName'),
      weddingDate: fd.get('weddingDate'),
      displayName: fd.get('displayName')
    }
    const r = await fetch('/api/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const j = await r.json()
    setLoading(false)
    if (!r.ok) { toast.error(j.error || 'Onboarding failed'); return }
    toast.success('Workspace ready — welcome!')
    router.push('/dashboard'); router.refresh()
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[#FBF8F1] to-[#F1EDE1] p-6">
      <Card className="w-full max-w-xl p-8 bg-white/90 backdrop-blur border-slate-200 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <img src="/tyaara-logo.jpg" alt="Tyaara" className="h-11 w-11 rounded-xl object-contain bg-white border border-slate-200" />
          <div>
            <div className="text-xl font-bold text-[#1F2A37]">Tyaara</div>
            <div className="text-xs text-slate-500">Let’s set up your workspace</div>
          </div>
        </div>
        <h1 className="text-2xl font-serif font-semibold mb-1">Create your first project</h1>
        <p className="text-sm text-slate-600 mb-6">We’ll seed 7 functions, 23 categories, 3 checklists, sample vendors, guests and shopping items — ready to explore.</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="orgName">Workspace name</Label>
              <Input id="orgName" name="orgName" required placeholder="e.g. The Sharma Wedding" />
            </div>
            <div>
              <Label>Workspace type</Label>
              <Select value={orgType} onValueChange={setOrgType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="couple">Couple</SelectItem>
                  <SelectItem value="planner_solo">Wedding Planner (solo)</SelectItem>
                  <SelectItem value="planner_agency">Planning Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="projectName">Wedding / Project name</Label>
            <Input id="projectName" name="projectName" required placeholder="e.g. Aditi & Rahul Wedding" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="weddingDate">Wedding date</Label>
              <Input id="weddingDate" name="weddingDate" type="date" required defaultValue={defaultDateStr} />
            </div>
            <div>
              <Label htmlFor="displayName">Your display name</Label>
              <Input id="displayName" name="displayName" required placeholder="You" defaultValue="You" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#0F4C3A] hover:bg-[#0B3A2C]">
            {loading ? 'Setting up your workspace…' : 'Create workspace'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
