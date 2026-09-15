'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthShell from '@/components/auth-shell'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const r = await fetch('/api/auth/signin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') })
    })
    const j = await r.json()
    setLoading(false)
    if (!r.ok) { toast.error(j.error || 'Sign-in failed'); return }
    toast.success('Welcome back')
    router.push('/dashboard'); router.refresh()
  }

  return (
    <AuthShell heading="Sign in" subheading="Continue to your workspace." altPrompt="New here?" altHref="/signup" altLabel="Create an account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="mt-1.5 h-11" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" className="mt-1.5 h-11" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11 text-[15px] bg-[#0F4C3A] hover:bg-[#0B3A2C]">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}
