import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'

// Reports whether the DB schema has been deployed, and (for signed-in users only)
// returns the SQL to paste into the Supabase SQL editor.
//
// The SQL dump reveals the full table layout, so it is only served to authenticated
// users. Anonymous callers still get the boolean deploy status, which is what the
// pre-login /setup page needs in order to render its "schema not deployed" banner.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Ping the DB by querying a prompt-2 table, so a partial (prompt-1-only) deploy is detected too.
    const { error: err1 } = await admin.from('organizations').select('id').limit(1)
    const { error: err2 } = await admin.from('whatsapp_messages').select('id').limit(1)
    const schemaDeployed = !err1 && !err2

    const body = {
      schemaDeployed,
      partial: !err1 && !!err2,
      // Raw driver errors can name internal tables/columns; only expose them to signed-in users.
      error: user ? (err1?.message || err2?.message || null) : (schemaDeployed ? null : 'Schema not deployed'),
      authenticated: Boolean(user)
    }

    if (user) {
      const sql1 = await readFile(path.join(process.cwd(), 'schema.sql'), 'utf8')
      const sql2 = await readFile(path.join(process.cwd(), 'schema-2.sql'), 'utf8')
      const sql3 = await readFile(path.join(process.cwd(), 'schema-3.sql'), 'utf8')
      const sql4 = await readFile(path.join(process.cwd(), 'schema-4.sql'), 'utf8')
      const sql5 = await readFile(path.join(process.cwd(), 'schema-5.sql'), 'utf8')
      const sql6 = await readFile(path.join(process.cwd(), 'schema-6.sql'), 'utf8')
      body.sql = sql1 +
        '\n\n-- ============================================================\n' +
        '-- PROMPT 2 ADDITIONS BELOW\n' +
        '-- ============================================================\n\n' + sql2 +
        '\n\n-- ============================================================\n' +
        '-- PROMPT 3 ADDITIONS BELOW\n' +
        '-- ============================================================\n\n' + sql3 +
        '\n\n-- ============================================================\n' +
        '-- PROMPT 4 ADDITIONS BELOW\n' +
        '-- ============================================================\n\n' + sql4 +
        '\n\n-- ============================================================\n' +
        '-- PROMPT 5 ADDITIONS BELOW\n' +
        '-- ============================================================\n\n' + sql5 +
        '\n\n-- ============================================================\n' +
        '-- PROMPT 6 ADDITIONS BELOW\n' +
        '-- ============================================================\n\n' + sql6
      body.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    }

    return NextResponse.json(body)
  } catch (e) {
    console.error('[setup] failed:', e)
    return NextResponse.json({ error: 'Setup check failed' }, { status: 500 })
  }
}
