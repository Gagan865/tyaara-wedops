'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Standardises the "find my project, then load its data" cycle that every page in
// app/(app) repeats.
//
// Fixes three problems with the hand-rolled version:
//   1. Errors were swallowed — a failed query rendered an empty page with no feedback.
//   2. `if (!pm) return` before `setLoading(false)` left pages stuck on "Loading…".
//   3. State was written after unmount when a user navigated mid-fetch.
//
// Usage:
//   const { ctx, data, loading, error, reload } = useProjectData(
//     'project_id, projects(org_id)',
//     async (supabase, ctx) => ({ vendors: (await supabase.from('vendors')...).data ?? [] })
//   )
export function useProjectData(membershipSelect, loader) {
  const [state, setState] = useState({
    ctx: null,
    data: null,
    loading: true,
    error: null,
    noProject: false
  })

  const run = useCallback(async (signal) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const supabase = createClient()

      const { data: pm, error: pmErr } = await supabase
        .from('project_members')
        .select(membershipSelect)
        .limit(1)
        .maybeSingle()
      if (pmErr) throw pmErr

      if (!pm) {
        if (!signal?.aborted) {
          setState({ ctx: null, data: null, loading: false, error: null, noProject: true })
        }
        return
      }

      const ctx = {
        projectId: pm.project_id,
        orgId: pm.projects?.org_id ?? null,
        project: pm.projects ?? null
      }

      const data = loader ? await loader(supabase, ctx) : null
      if (!signal?.aborted) {
        setState({ ctx, data, loading: false, error: null, noProject: false })
      }
    } catch (e) {
      if (!signal?.aborted) {
        setState(s => ({ ...s, loading: false, error: e, noProject: false }))
      }
    }
    // membershipSelect/loader are treated as stable per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipSelect])

  useEffect(() => {
    const controller = new AbortController()
    run(controller.signal)
    return () => controller.abort()
  }, [run])

  const reload = useCallback(() => run(), [run])

  return { ...state, reload }
}
