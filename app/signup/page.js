'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const r = await fetch('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fd.get('email'),
        password: fd.get('password'),
        name: fd.get('name')
      })
    })
    const j = await r.json()
    setLoading(false)
    if (!r.ok) { toast.error(j.error || 'Signup failed'); return }
    toast.success('Account created')
    router.push('/onboarding'); router.refresh()
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[#FBF8F1] to-[#F1EDE1] p-6">
      <Card className="w-full max-w-md p-8 bg-white/90 backdrop-blur border-slate-200 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <img src="/tyaara-logo.jpg" alt="Tyaara" className="h-11 w-11 rounded-xl object-contain bg-white border border-slate-200" />
          <div>
            <div className="text-xl font-bold text-[#1F2A37]">Tyaara</div>
            <div className="text-xs text-slate-500">Wedding-planning workspace</div>
          </div>
        </div>
        <h1 className="text-2xl font-serif font-semibold mb-1">Create account</h1>
        <p className="text-sm text-slate-600 mb-6">Two steps and you’re planning.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" required placeholder="e.g. Aditi Sharma" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#0F4C3A] hover:bg-[#0B3A2C]">
            {loading ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        <div className="text-sm text-slate-600 mt-4 text-center">
          Already have an account? <Link href="/login" className="text-[#0F4C3A] font-medium hover:underline">Sign in</Link>
        </div>
      </Card>
    </div>
  )
}
