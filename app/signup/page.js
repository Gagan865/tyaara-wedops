'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthShell from '@/components/auth-shell'
import { toast } from 'sonner'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const r = await fetch('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password'), name: fd.get('name') })
    })
    const j = await r.json()
    setLoading(false)
    if (!r.ok) { toast.error(j.error || 'Signup failed'); return }
    toast.success('Account created')
    router.push('/onboarding'); router.refresh()
  }

  return (
    <AuthShell heading="Create account" subheading="Two steps and you’re planning." altPrompt="Already have an account?" altHref="/login" altLabel="Sign in">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required placeholder="e.g. Aditi Sharma" className="mt-1.5 h-11" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="mt-1.5 h-11" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" className="mt-1.5 h-11" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11 text-[15px] bg-[#0F4C3A] hover:bg-[#0B3A2C]">
          {loading ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}
