// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuthCallbackPage from '@/app/auth/callback/page'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRouter() {
  return { replace: vi.fn() }
}

function makeSearchParams(entries: Record<string, string> = {}) {
  const sp = new URLSearchParams(entries)
  return { get: (key: string) => sp.get(key) }
}

function makeSupabaseClient({
  setSessionError = null as unknown,
  exchangeError = null as unknown,
  verifyOtpError = null as unknown,
} = {}) {
  return {
    auth: {
      setSession: vi.fn().mockResolvedValue({ error: setSessionError }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: exchangeError }),
      verifyOtp: vi.fn().mockResolvedValue({ error: verifyOtpError }),
    },
  }
}

function setHash(fragment: string) {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, hash: fragment },
  })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  setHash('')
})

// ── Implicit flow (tokens in URL fragment) ────────────────────────────────────

describe('implicit flow (hash tokens)', () => {
  it('redirects to /roadmap?session=start on success — 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      const router = makeRouter()
      vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
      vi.mocked(useSearchParams).mockReturnValue(makeSearchParams() as ReturnType<typeof useSearchParams>)

      const supabase = makeSupabaseClient()
      vi.mocked(createClient).mockReturnValue(supabase as ReturnType<typeof createClient>)

      setHash(`#access_token=tok-${run}&refresh_token=ref-${run}&token_type=bearer`)

      const { unmount } = render(<AuthCallbackPage />)

      await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 1000 })

      expect(router.replace, `run ${run}`).toHaveBeenCalledWith('/roadmap?session=start')
      expect(supabase.auth.setSession, `run ${run}`).toHaveBeenCalledWith({
        access_token: `tok-${run}`,
        refresh_token: `ref-${run}`,
      })

      unmount()
      vi.clearAllMocks()
    }
  })

  it('falls through to /login?error=auth when setSession fails', async () => {
    const router = makeRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(makeSearchParams() as ReturnType<typeof useSearchParams>)
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ setSessionError: new Error('invalid token') }) as ReturnType<typeof createClient>
    )

    setHash('#access_token=bad&refresh_token=bad')

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/login?error=auth')
  })
})

// ── PKCE flow (code in query params) ─────────────────────────────────────────

describe('PKCE flow (code param)', () => {
  it('redirects to /roadmap?session=start on success — 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      const router = makeRouter()
      vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
      vi.mocked(useSearchParams).mockReturnValue(
        makeSearchParams({ code: `pkce-code-${run}` }) as ReturnType<typeof useSearchParams>
      )

      const supabase = makeSupabaseClient()
      vi.mocked(createClient).mockReturnValue(supabase as ReturnType<typeof createClient>)

      const { unmount } = render(<AuthCallbackPage />)

      await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 1000 })

      expect(router.replace, `run ${run}`).toHaveBeenCalledWith('/roadmap?session=start')
      expect(supabase.auth.exchangeCodeForSession, `run ${run}`).toHaveBeenCalledWith(`pkce-code-${run}`)

      unmount()
      vi.clearAllMocks()
    }
  })

  it('falls through to /login?error=auth when exchangeCodeForSession fails', async () => {
    const router = makeRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ code: 'bad-code' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ exchangeError: new Error('bad code') }) as ReturnType<typeof createClient>
    )

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/login?error=auth')
  })
})

// ── Token hash flow (admin.generateLink) ─────────────────────────────────────

describe('token hash flow (token_hash + type params)', () => {
  it('redirects to /roadmap?session=start on success — 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      const router = makeRouter()
      vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
      vi.mocked(useSearchParams).mockReturnValue(
        makeSearchParams({ token_hash: `th-${run}`, type: 'magiclink' }) as ReturnType<typeof useSearchParams>
      )

      const supabase = makeSupabaseClient()
      vi.mocked(createClient).mockReturnValue(supabase as ReturnType<typeof createClient>)

      const { unmount } = render(<AuthCallbackPage />)

      await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 1000 })

      expect(router.replace, `run ${run}`).toHaveBeenCalledWith('/roadmap?session=start')
      expect(supabase.auth.verifyOtp, `run ${run}`).toHaveBeenCalledWith({
        token_hash: `th-${run}`,
        type: 'magiclink',
      })

      unmount()
      vi.clearAllMocks()
    }
  })

  it('falls through to /login?error=auth when verifyOtp fails', async () => {
    const router = makeRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'bad', type: 'magiclink' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ verifyOtpError: new Error('otp expired') }) as ReturnType<typeof createClient>
    )

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/login?error=auth')
  })
})

// ── No params ─────────────────────────────────────────────────────────────────

describe('no auth params', () => {
  it('redirects to /login?error=auth when no tokens, code, or token_hash present', async () => {
    const router = makeRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(makeSearchParams() as ReturnType<typeof useSearchParams>)
    vi.mocked(createClient).mockReturnValue(makeSupabaseClient() as ReturnType<typeof createClient>)

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/login?error=auth')
  })
})
