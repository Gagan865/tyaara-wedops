'use client'
import { Card } from '@/components/ui/card'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Shared loading / error / empty states.
//
// Previously each page hand-rolled these (or omitted them): a failed query left the
// page rendering an empty list with no indication anything had gone wrong, and pages
// that returned early on "no project" sat on "Loading…" forever.

export function LoadingState({ label = 'Loading…', rows = 3 }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-3">
            <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
            <div className="h-5 w-20 bg-slate-200 rounded animate-pulse mt-2" />
          </Card>
        ))}
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <div className="h-4 w-2/3 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-full bg-slate-100 rounded animate-pulse mt-3" />
          </Card>
        ))}
      </div>
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Could not load this page' }) {
  const message = typeof error === 'string' ? error : error?.message || 'Something went wrong.'
  return (
    <Card className="p-8 text-center border-rose-200 bg-rose-50/50" role="alert">
      <AlertCircle className="h-8 w-8 mx-auto text-rose-500" />
      <div className="mt-3 font-serif font-semibold text-rose-900">{title}</div>
      <p className="mt-1 text-sm text-rose-700 max-w-md mx-auto break-words">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />Try again
        </Button>
      )}
    </Card>
  )
}

export function EmptyState({ title = 'Nothing here yet', description, action }) {
  return (
    <Card className="p-10 text-center">
      <Inbox className="h-8 w-8 mx-auto text-slate-300" />
      <div className="mt-3 font-serif font-semibold text-slate-700">{title}</div>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}

export function NoProjectState() {
  return (
    <EmptyState
      title="No project yet"
      description="Create a project to start planning. If you were invited, ask the organiser to re-send your invite."
      action={<Button asChild className="bg-[#0F4C3A]"><a href="/onboarding">Set up a project</a></Button>}
    />
  )
}
