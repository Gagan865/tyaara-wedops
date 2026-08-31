'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Link from 'next/link'

export default function JoinPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const code = String(fd.get('code') || '').trim().toUpperCase()
    const email = String(fd.get('email') || '').trim()
    const r = await fetch('/api/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, email })
    })
    const j = await r.json()
    setLoading(false)
    if (!r.ok) return toast.error(j.error || 'Join failed')
    toast.success('You’ve been added! Check your email for a magic link.')
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[#FBF8F1] to-[#F1EDE1] p-6">
      <Card className="w-full max-w-md p-8 bg-white/90 backdrop-blur border-slate-200 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <img src="/tyaara-logo.jpg" alt="Tyaara" className="h-11 w-11 rounded-xl object-contain bg-white border border-slate-200" />
          <div>
            <div className="text-xl font-bold text-[#1F2A37]">Tyaara</div>
            <div className="text-xs text-slate-500">Join a wedding workspace</div>
          </div>
        </div>
        <h1 className="text-2xl font-serif font-semibold mb-1">Got a WD-code?</h1>
        <p className="text-sm text-slate-600 mb-6">Family, friends and vendors can join without creating a full account.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="code">Project code</Label>
            <Input id="code" name="code" required placeholder="WD-XXXXXXX" />
          </div>
          <div>
            <Label htmlFor="email">Your email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#0F4C3A] hover:bg-[#0B3A2C]">
            {loading ? 'Joining…' : 'Send magic link'}
          </Button>
        </form>
        <div className="text-sm text-slate-600 mt-4 text-center">
          Just planning? <Link href="/signup" className="text-[#0F4C3A] font-medium hover:underline">Create a full account</Link>
        </div>
      </Card>
    </div>
  )
}
