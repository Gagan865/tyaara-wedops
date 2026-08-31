// Fail fast with an actionable message when configuration is missing.
//
// Without this, a missing SUPABASE_SERVICE_ROLE_KEY surfaces as an opaque
// "Invalid API key" from deep inside the Supabase client, which is hard to trace
// back to a .env problem.

function required(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Copy .env.example to .env.local and fill it in. ` +
      `See https://supabase.com/dashboard/project/_/settings/api for your keys.`
    )
  }
  return value
}

export function publicSupabaseConfig() {
  return {
    url: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  }
}

export function serviceRoleKey() {
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
}
