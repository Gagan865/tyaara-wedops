#!/usr/bin/env node
// End-to-end verification against the live Supabase project.
//
//   npm install          # once
//   node scripts/verify.mjs
//
// Checks, in order:
//   1. .env.local is present and complete
//   2. Supabase is reachable and the keys authenticate
//   3. Every table the app queries exists (catches a partial schema deploy)
//   4. RLS actually blocks anonymous reads  <-- the important one
//   5. The service-role key is NOT exposed in the client bundle (run after `npm run build`)

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ok = s => `\x1b[32m  PASS\x1b[0m ${s}`
const bad = s => `\x1b[31m  FAIL\x1b[0m ${s}`
const warn = s => `\x1b[33m  WARN\x1b[0m ${s}`
let failures = 0

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  }
}

console.log('\n1. Environment')
loadEnv()
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
for (const [n, v] of [['NEXT_PUBLIC_SUPABASE_URL', URL], ['NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON], ['SUPABASE_SERVICE_ROLE_KEY', SVC]]) {
  if (v) console.log(ok(n)); else { console.log(bad(`${n} is missing`)); failures++ }
}
if (!process.env.WHATSAPP_WEBHOOK_SECRET) {
  console.log(warn('WHATSAPP_WEBHOOK_SECRET unset — /api/whatsapp/reply will only accept signed-in callers'))
}
if (!URL || !ANON || !SVC) { console.log('\nCannot continue without credentials.\n'); process.exit(1) }

async function rest(path, key, extra = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...extra }
  })
  let body = null
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

console.log('\n2. Connectivity')
try {
  const r = await rest('organizations?select=id&limit=1', SVC)
  if (r.status < 400) {
    console.log(ok(`service-role key authenticates (HTTP ${r.status})`))
  } else if (r.body === null) {
    // A JSON-less 4xx/5xx is a proxy or firewall, not Supabase: PostgREST always
    // returns a JSON error body. Bail out rather than reporting 32 phantom failures.
    console.log(bad(`HTTP ${r.status} with no JSON body — a proxy or firewall is intercepting, not Supabase.`))
    console.log(`         Check that ${new global.URL(URL).host} is reachable from this machine.`)
    console.log('\nCannot verify further from here.\n')
    process.exit(1)
  } else {
    console.log(bad(`service-role rejected: HTTP ${r.status} ${JSON.stringify(r.body)}`)); failures++
  }
} catch (e) {
  console.log(bad(`cannot reach ${URL} — ${e.message}`))
  console.log('\nNetwork unreachable; skipping remaining checks.\n'); process.exit(1)
}

console.log('\n3. Schema')
const TABLES = [
  'organizations', 'profiles', 'org_members', 'projects', 'project_members', 'memberships',
  'events', 'categories', 'tasks', 'task_assignees', 'todo_lists', 'todo_items',
  'shopping_items', 'guests', 'guest_invitations', 'vendors', 'bookings', 'booking_lead_times',
  'expenses', 'activity', 'notifications', 'event_notes', 'event_inspo',
  'tables', 'table_assignments', 'floor_layouts', 'vehicles', 'trials', 'invoices',
  'whatsapp_messages', 'whatsapp_settings', 'subscriptions'
]
const missing = []
for (const t of TABLES) {
  const r = await rest(`${t}?select=*&limit=0`, SVC)
  if (r.status >= 400) missing.push(`${t} (${r.body?.message || r.status})`)
}
if (missing.length === 0) console.log(ok(`all ${TABLES.length} tables present`))
else {
  console.log(bad(`${missing.length} table(s) missing or unreadable:`)); failures++
  missing.forEach(m => console.log(`         - ${m}`))
  console.log('         Run schema.sql then schema-2.sql in the Supabase SQL editor.')
}

console.log('\n4. Row Level Security (anonymous key must see nothing)')
const LEAKY = []
for (const t of ['projects', 'guests', 'vendors', 'invoices', 'whatsapp_messages', 'expenses']) {
  const r = await rest(`${t}?select=*&limit=1`, ANON)
  if (r.status === 200 && Array.isArray(r.body) && r.body.length > 0) LEAKY.push(t)
}
if (LEAKY.length === 0) console.log(ok('anonymous key cannot read tenant data'))
else {
  console.log(bad(`RLS NOT enforced — anon key read rows from: ${LEAKY.join(', ')}`)); failures++
  console.log('         Re-run the RLS sections of schema.sql and schema-2.sql.')
}

console.log('\n5. Service-role key must not reach the browser')
const nextDir = '.next'
if (!existsSync(nextDir)) {
  console.log(warn('.next not found — run `npm run build` first to check the client bundle'))
} else {
  const hits = []
  const walk = d => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      const s = statSync(p)
      if (s.isDirectory()) walk(p)
      else if (/\.(js|map|json)$/.test(e) && s.size < 20_000_000) {
        try { if (readFileSync(p, 'utf8').includes(SVC)) hits.push(p) } catch {}
      }
    }
  }
  walk(join(nextDir, 'static'))
  if (hits.length === 0) console.log(ok('service-role key absent from the client bundle'))
  else { console.log(bad(`service-role key found in: ${hits.join(', ')}`)); failures++ }
}

console.log(failures === 0
  ? '\n\x1b[32mAll checks passed.\x1b[0m\n'
  : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`)
process.exit(failures ? 1 : 0)
