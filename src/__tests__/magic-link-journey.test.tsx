// @vitest-environment jsdom
/**
 * Magic link journey tests.
 *
 * Flow: webhook sends magic link → user clicks email → /auth/callback
 * processes token → user lands on /roadmap?session=start
 *
 * Failure cases: expired/used token → /login?error=auth
 */
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

function makeRouter() {
  return { replace: vi.fn() }
}

function makeSearchParams(entries: Record<string, string> = {}) {
  const sp = new URLSearchParams(entries)
  return { get: (key: string) => sp.get(key) }
}

function makeSupabase({ verifyError = null as unknown } = {}) {
  return {
    auth: {
      setSession: vi.fn().mockResolvedValue({ error: new Error('not used') }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error('not used') }),
      verifyOtp: vi.fn().mockResolvedValue({ error: verifyError }),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, hash: '' },
  })
})

// ── Magic link: happy path ────────────────────────────────────────────────────

describe('magic link — happy path', () => {
  it('user lands on /roadmap?session=start after clicking valid magic link', async () => {
    const router = makeRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'valid-token-hash', type: 'magiclink' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/roadmap?session=start')
  })

  it('verifyOtp is called with token_hash and type=magiclink', async () => {
    const router = makeRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'tok-abc', type: 'magiclink' }) as ReturnType<typeof useSearchParams>
    )
    const supabase = makeSupabase()
    vi.mocked(createClient).mockReturnValue(supabase as ReturnType<typeof createClient>)

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'tok-abc', type: 'magiclink' })
  })

  it('user lands on /roadmap?session=start across 50 unique magic links', async () => {
    for (let run = 0; run < 50; run++) {
      const router = makeRouter()
      vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
      vi.mocked(useSearchParams).mockReturnValue(
        makeSearchParams({ token_hash: `token-${run}`, type: 'magiclink' }) as ReturnType<typeof useSearchParams>
      )
      vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)

      const { unmount } = render(<AuthCallbackPage />)
      await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 1000 })
      expect(router.replace, `run ${run}`).toHaveBeenCalledWith('/roadmap?session=start')

      unmount()
      vi.clearAllMocks()
    }
  })
})

// ── Magic link: failure paths ─────────────────────────────────────────────────

describe('magic link — failure paths', () => {
  it('expired token → user lands on /login?error=auth', async () => {
    const router = makeRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'expired-token', type: 'magiclink' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(
      makeSupabase({ verifyError: new Error('Token has expired') }) as ReturnType<typeof createClient>
    )

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/login?error=auth')
  })

  it('already used token → user lands on /login?error=auth', async () => {
    const router = makeRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'used-token', type: 'magiclink' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(
      makeSupabase({ verifyError: new Error('OTP has already been used') }) as ReturnType<typeof createClient>
    )

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/login?error=auth')
  })

  it('missing token_hash → user lands on /login?error=auth', async () => {
    const router = makeRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams() as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/login?error=auth')
  })

  it('never redirects to anywhere other than /roadmap or /login', async () => {
    const scenarios = [
      { token_hash: 'valid', type: 'magiclink', verifyError: null, expected: '/roadmap?session=start' },
      { token_hash: 'expired', type: 'magiclink', verifyError: new Error('expired'), expected: '/login?error=auth' },
    ]

    for (const s of scenarios) {
      const router = makeRouter()
      vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
      vi.mocked(useSearchParams).mockReturnValue(
        makeSearchParams({ token_hash: s.token_hash, type: s.type }) as ReturnType<typeof useSearchParams>
      )
      vi.mocked(createClient).mockReturnValue(
        makeSupabase({ verifyError: s.verifyError }) as ReturnType<typeof createClient>
      )

      const { unmount } = render(<AuthCallbackPage />)
      await waitFor(() => expect(router.replace).toHaveBeenCalled())

      const destination = router.replace.mock.calls[0][0] as string
      expect(
        destination.startsWith('/roadmap') || destination.startsWith('/login'),
        `unexpected redirect to: ${destination}`
      ).toBe(true)
      expect(router.replace).toHaveBeenCalledWith(s.expected)

      unmount()
      vi.clearAllMocks()
    }
  })
})
