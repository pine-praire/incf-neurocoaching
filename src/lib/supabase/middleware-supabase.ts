import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              supabaseResponse.headers.set(key, value)
            )
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAppRoute =
    request.nextUrl.pathname.startsWith('/roadmap') ||
    request.nextUrl.pathname.startsWith('/profile')

  if (isAppRoute && !user) {
    return redirectTo(request, '/login')
  }

  if (isAppRoute && user) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!enrollment) {
      return redirectTo(request, '/no-access')
    }
  }

  return supabaseResponse
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.redirect(url)
}
