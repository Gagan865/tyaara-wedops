'use client'
import { createBrowserClient } from '@supabase/ssr'
import { publicSupabaseConfig } from '@/lib/env'

let client
export function createClient() {
  if (!client) {
    const { url, anonKey } = publicSupabaseConfig()
    client = createBrowserClient(url, anonKey)
  }
  return client
}
