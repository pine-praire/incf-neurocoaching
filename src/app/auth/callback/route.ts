import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!

  const supabase = await createClient()

  // PKCE flow (signInWithOtp from client side)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${siteUrl}/roadmap?session=start`)
    }
  }

  // Token hash flow (admin.generateLink)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${siteUrl}/roadmap?session=start`)
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth`)
}
