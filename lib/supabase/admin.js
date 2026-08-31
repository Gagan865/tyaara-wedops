import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { publicSupabaseConfig, serviceRoleKey } from '@/lib/env'

// Service-role client — bypasses RLS. Server-side use only.
//
// Built lazily behind a Proxy so that merely importing this module does not throw at
// build time when env vars are absent (Next evaluates modules while collecting page
// data). The error surfaces on first actual use instead, where it is actionable.
let cached = null

function getAdmin() {
  if (!cached) {
    const { url } = publicSupabaseConfig()
    cached = createClient(url, serviceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  }
  return cached
}

export const admin = new Proxy({}, {
  get(_target, prop) {
    const client = getAdmin()
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})
