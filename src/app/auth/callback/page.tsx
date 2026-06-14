'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { EmailOtpType } from '@supabase/supabase-js'

function AuthCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const supabase = createClient()

    async function handleAuth() {
      // 1. Implicit flow — tokens in URL fragment (Supabase default)
      const hash = window.location.hash.substring(1)
      if (hash) {
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (!error) { router.replace('/roadmap?session=start'); return }
        }
      }

      // 2. PKCE flow — code in query params
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { router.replace('/roadmap?session=start'); return }
      }

      // 3. Token hash flow (admin.generateLink with PKCE enabled)
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type') as EmailOtpType | null
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (!error) {
          if (type === 'recovery') { router.replace('/reset-password'); return }
          router.replace('/roadmap?session=start'); return
        }
      }

      router.replace('/login?error=auth')
    }

    handleAuth()
  }, [router, searchParams])

  return (
    <div style={{
      minHeight: '100vh', background: '#ece9e2',
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--font-body)',
    }}>
      <p style={{ color: '#888', fontSize: 14 }}>Входим...</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackHandler />
    </Suspense>
  )
}
