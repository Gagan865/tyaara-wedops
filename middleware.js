import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { ACTIVE_PROJECT_COOKIE } from '@/lib/active-project'
import { resolveAccessRole, canAccessPath, isUniversallyAllowed, RESTRICTED_HOME } from '@/lib/access'

export async function middleware(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/setup' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/share/') ||  // client-facing tokened pages: quote, couple form, agreement
    pathname.startsWith('/api/')

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Role-based page gating. Skip pages any member may open (no DB round-trip there); for
  // anything else, resolve the caller's role and bounce restricted members to their home.
  if (user && !isPublic && !isUniversallyAllowed(pathname)) {
    const activeId = request.cookies.get(ACTIVE_PROJECT_COOKIE)?.value || null
    const role = await resolveAccessRole(supabase, user.id, activeId)
    if (!canAccessPath(role, pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = RESTRICTED_HOME
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}
