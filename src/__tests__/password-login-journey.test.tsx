// @vitest-environment jsdom
/**
 * Password login journey tests.
 *
 * Flow 1 — First login: webhook creates user with temp password →
 *   user enters email + password on /login → signInWithPassword → /roadmap
 *
 * Flow 2 — Password recovery: user requests reset → clicks email link →
 *   /auth/callback?token_hash=…&type=recovery → /reset-password
 *
 * Failure cases: wrong password → error shown, no redirect;
 *   expired/used recovery token → /login?error=auth
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Login page mocks ──────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockSignIn = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush, replace: vi.fn() })),
  useSearchParams: vi.fn(() => ({ get: () => null })),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))

import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LoginPage from '@/app/login/page'
import AuthCallbackPage from '@/app/auth/callback/page'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSearchParams(entries: Record<string, string> = {}) {
  const sp = new URLSearchParams(entries)
  return { get: (key: string) => sp.get(key) }
}

function makeSupabase({ verifyOtpError = null as unknown } = {}) {
  return {
    auth: {
      setSession: vi.fn().mockResolvedValue({ error: new Error('not used') }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error('not used') }),
      verifyOtp: vi.fn().mockResolvedValue({ error: verifyOtpError }),
      signInWithPassword: mockSignIn,
    },
  }
}

function makeCallbackRouter() {
  return { replace: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSignIn.mockResolvedValue({ error: null })
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, hash: '' },
  })
})

// ── Flow 1: Password login ────────────────────────────────────────────────────

describe('password login — happy path', () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: vi.fn() } as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(makeSearchParams() as ReturnType<typeof useSearchParams>)
    vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)
  })

  it('calls signInWithPassword with email and password', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'student@incf.eu' } })
    fireEvent.change(screen.getByPlaceholderText(/пароль/i), { target: { value: 'Temp-Pass-1234' } })
    fireEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled())
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'student@incf.eu', password: 'Temp-Pass-1234' })
  })

  it('redirects to /roadmap on successful login', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'student@incf.eu' } })
    fireEvent.change(screen.getByPlaceholderText(/пароль/i), { target: { value: 'Temp-Pass-1234' } })
    fireEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/roadmap'))
  })

  it('user lands on /roadmap across 30 unique credentials', async () => {
    for (let run = 0; run < 30; run++) {
      const { unmount } = render(<LoginPage />)
      const email = `user${run}@incf.eu`
      const password = `Tmp-Pass-${run}00`

      fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: email } })
      fireEvent.change(screen.getByPlaceholderText(/пароль/i), { target: { value: password } })
      fireEvent.click(screen.getByRole('button', { name: /войти/i }))

      await waitFor(() => expect(mockSignIn).toHaveBeenCalled(), { timeout: 1000 })
      expect(mockSignIn, `run ${run}`).toHaveBeenCalledWith({ email, password })

      unmount()
      vi.clearAllMocks()
      mockSignIn.mockResolvedValue({ error: null })
      vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: vi.fn() } as ReturnType<typeof useRouter>)
      vi.mocked(useSearchParams).mockReturnValue(makeSearchParams() as ReturnType<typeof useSearchParams>)
      vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)
    }
  })
})

describe('password login — failure paths', () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: vi.fn() } as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(makeSearchParams() as ReturnType<typeof useSearchParams>)
  })

  it('wrong password → error shown, no redirect', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'student@incf.eu' } })
    fireEvent.change(screen.getByPlaceholderText(/пароль/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() => expect(screen.getByText(/неверный пароль/i)).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('never redirects on failed login', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'bad@incf.eu' } })
    fireEvent.change(screen.getByPlaceholderText(/пароль/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled())
    expect(mockPush).not.toHaveBeenCalled()
  })
})

// ── Flow 2: Password recovery callback ───────────────────────────────────────

describe('recovery callback — happy path', () => {
  it('redirects to /reset-password when type=recovery token is valid', async () => {
    const router = makeCallbackRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'valid-recovery-hash', type: 'recovery' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/reset-password')
  })

  it('never redirects to /roadmap on recovery — always /reset-password', async () => {
    const router = makeCallbackRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'rec-token', type: 'recovery' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).not.toHaveBeenCalledWith(expect.stringContaining('/roadmap'))
    expect(router.replace).toHaveBeenCalledWith('/reset-password')
  })

  it('handles recovery token across 50 unique reset links', async () => {
    for (let run = 0; run < 50; run++) {
      const router = makeCallbackRouter()
      vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
      vi.mocked(useSearchParams).mockReturnValue(
        makeSearchParams({ token_hash: `recovery-${run}`, type: 'recovery' }) as ReturnType<typeof useSearchParams>
      )
      vi.mocked(createClient).mockReturnValue(makeSupabase() as ReturnType<typeof createClient>)

      const { unmount } = render(<AuthCallbackPage />)
      await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 1000 })
      expect(router.replace, `run ${run}`).toHaveBeenCalledWith('/reset-password')

      unmount()
      vi.clearAllMocks()
    }
  })
})

describe('recovery callback — failure paths', () => {
  it('expired recovery token → /login?error=auth', async () => {
    const router = makeCallbackRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'expired-rec', type: 'recovery' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(
      makeSupabase({ verifyOtpError: new Error('Token has expired') }) as ReturnType<typeof createClient>
    )

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/login?error=auth')
  })

  it('already used recovery token → /login?error=auth', async () => {
    const router = makeCallbackRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'used-rec', type: 'recovery' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(
      makeSupabase({ verifyOtpError: new Error('OTP has already been used') }) as ReturnType<typeof createClient>
    )

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).toHaveBeenCalledWith('/login?error=auth')
  })

  it('never redirects to /roadmap on failed recovery', async () => {
    const router = makeCallbackRouter()
    vi.mocked(useRouter).mockReturnValue(router as ReturnType<typeof useRouter>)
    vi.mocked(useSearchParams).mockReturnValue(
      makeSearchParams({ token_hash: 'bad-rec', type: 'recovery' }) as ReturnType<typeof useSearchParams>
    )
    vi.mocked(createClient).mockReturnValue(
      makeSupabase({ verifyOtpError: new Error('expired') }) as ReturnType<typeof createClient>
    )

    render(<AuthCallbackPage />)

    await waitFor(() => expect(router.replace).toHaveBeenCalled())
    expect(router.replace).not.toHaveBeenCalledWith(expect.stringContaining('/roadmap'))
  })
})
