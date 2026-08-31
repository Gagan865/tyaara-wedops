'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCircle2, Copy, ExternalLink, Loader2, AlertCircle } from 'lucide-react'

export default function SetupPage() {
  const [state, setState] = useState({ loading: true, sql: '', schemaDeployed: false, url: '' })

  async function refresh() {
    setState(s => ({ ...s, loading: true }))
    const r = await fetch('/api/setup')
    const j = await r.json()
    setState({ loading: false, sql: j.sql || '', schemaDeployed: j.schemaDeployed, url: j.supabaseUrl || '' })
  }

  useEffect(() => { refresh() }, [])

  const editorUrl = state.url ? `${state.url.replace('https://','https://supabase.com/dashboard/project/').replace('.supabase.co','')}/sql/new` : '#'

  return (
    <div className="min-h-screen bg-[#FBF8F1] p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <img src="/tyaara-logo.jpg" alt="Tyaara" className="h-10 w-10 rounded-xl object-contain bg-white border border-slate-200" />
          <div>
            <div className="text-2xl font-bold text-[#1F2A37]">Tyaara — One-time Setup</div>
            <div className="text-sm text-slate-600">Deploy the Postgres schema, RLS, and seed function to your Supabase project.</div>
          </div>
        </div>

        {state.loading ? (
          <div className="flex items-center gap-2 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Checking schema status…</div>
        ) : state.schemaDeployed ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
            <div>
              <div className="font-semibold text-emerald-900">Schema is deployed ✅</div>
              <div className="text-sm text-emerald-800 mt-1">You can head to sign up and create your first project.</div>
              <div className="flex gap-2 mt-4">
                <a href="/signup"><Button size="sm">Create account</Button></a>
                <a href="/login"><Button size="sm" variant="outline">Sign in</Button></a>
              </div>
            </div>
          </div>
        ) : state.partial ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0" />
            <div>
              <div className="font-semibold text-amber-900">Prompt-1 schema deployed. Prompt-2 tables still missing.</div>
              <div className="text-sm text-amber-800 mt-1">Re-paste the SQL below (it now includes both prompts). Idempotent — safe to run again.</div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-amber-900">Schema not deployed yet</div>
              <div className="text-sm text-amber-800 mt-1">
                Copy the SQL below, open the Supabase SQL Editor for your project, paste, and click <b>Run</b>. Then reload this page.
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
            <div className="text-sm font-medium text-slate-700">schema.sql</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(state.sql); toast.success('Copied schema.sql to clipboard') }}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy SQL
              </Button>
              <a href={editorUrl} target="_blank" rel="noreferrer">
                <Button size="sm">
                  Open Supabase SQL Editor <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </a>
              <Button size="sm" variant="outline" onClick={refresh}>Re-check</Button>
            </div>
          </div>
          <pre className="text-xs p-4 max-h-[520px] overflow-auto bg-slate-950 text-slate-100 font-mono">{state.sql}</pre>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          Also required in Supabase Auth settings (dev): <b>Authentication → Providers → Email</b> → disable “Confirm email” so signup logs you in instantly.
        </div>
      </div>
    </div>
  )
}
