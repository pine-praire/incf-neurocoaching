import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock must be defined before the component import.
const mockSignInWithOtp = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOtp: mockSignInWithOtp } }),
}))

import LoginPage from '@/app/login/page'

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function submitLoginForm(email: string) {
  render(<LoginPage />)
  fireEvent.change(screen.getByPlaceholderText(/email/i), {
    target: { value: email },
  })
  fireEvent.click(screen.getByRole('button', { name: /получить ссылку/i }))
  await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalled())
}

// ── S-3: shouldCreateUser: false ──────────────────────────────────────────────

describe('S-3 — shouldCreateUser: false', () => {
  it('passes shouldCreateUser: false to signInWithOtp', async () => {
    await submitLoginForm('student@example.com')

    const call = mockSignInWithOtp.mock.calls[0][0]
    expect(call.options.shouldCreateUser).toBe(false)
  })

  it('shouldCreateUser is false — not missing, not true — 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      const { unmount } = render(<LoginPage />)

      fireEvent.change(screen.getByPlaceholderText(/email/i), {
        target: { value: `user${run}@test.com` },
      })
      fireEvent.click(screen.getByRole('button', { name: /получить ссылку/i }))

      await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalled())

      const call = mockSignInWithOtp.mock.calls[0][0]
      expect(call.options.shouldCreateUser, `run ${run}: must be false`).toBe(false)
      expect(call.options.shouldCreateUser, `run ${run}: must not be true`).not.toBe(true)
      expect(call.options.shouldCreateUser, `run ${run}: must not be undefined`).not.toBeUndefined()

      unmount()
      vi.clearAllMocks()
      mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
    }
  })

  it('sends the entered email address', async () => {
    await submitLoginForm('specific@incf.eu')
    const call = mockSignInWithOtp.mock.calls[0][0]
    expect(call.email).toBe('specific@incf.eu')
  })

  it('includes emailRedirectTo in options', async () => {
    await submitLoginForm('student@example.com')
    const call = mockSignInWithOtp.mock.calls[0][0]
    expect(call.options.emailRedirectTo).toContain('/auth/callback')
  })

  it('shows success state after submission', async () => {
    await submitLoginForm('student@example.com')
    expect(screen.getByText(/проверьте почту/i)).toBeInTheDocument()
  })
})
