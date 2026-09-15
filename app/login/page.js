'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'

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
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[#FBF8F1] to-[#F1EDE1] p-6">
      <Card className="w-full max-w-md p-8 bg-white/90 backdrop-blur border-slate-200 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <img src="/tyaara-logo.jpg" alt="Tyaara" className="h-11 w-11 rounded-xl object-contain bg-white border border-slate-200" />
          <div>
            <div className="text-xl font-bold text-[#1F2A37]">Tyaara</div>
            <div className="text-xs text-slate-500">The Tales Of Wedding</div>
          </div>
        </div>
        <h1 className="text-2xl font-serif font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-slate-600 mb-6">Continue to your workspace.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#0F4C3A] hover:bg-[#0B3A2C]">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <div className="text-sm text-slate-600 mt-4 text-center">
          New here? <Link href="/signup" className="text-[#0F4C3A] font-medium hover:underline">Create an account</Link>
        </div>
        <div className="text-xs text-slate-500 mt-3 text-center">
          Need to install the schema first? <Link href="/setup" className="underline">One-time setup</Link>
        </div>
        <div className="text-[11px] text-slate-400 mt-4 text-center">
          By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> &amp; <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </div>
      </Card>
    </div>
  )
}
