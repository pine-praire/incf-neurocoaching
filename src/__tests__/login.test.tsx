// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockPush = vi.fn()
const mockSignIn = vi.fn()
const mockResetPassword = vi.fn()
const mockFetch = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
    },
  }),
}))

vi.stubGlobal('fetch', mockFetch)

import LoginPage from '@/app/login/page'

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockSignIn.mockResolvedValue({ error: null })
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fillAndSubmit(email: string, password: string) {
  render(<LoginPage />)
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText(/пароль/i), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /войти/i }))
  await waitFor(() => expect(mockSignIn).toHaveBeenCalled())
}

// ── Login form ────────────────────────────────────────────────────────────────

describe('login form — email + password', () => {
  it('calls signInWithPassword with email and password', async () => {
    await fillAndSubmit('student@example.com', 'MyPass-1234')
    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'student@example.com',
      password: 'MyPass-1234',
    })
  })

  it('redirects to /roadmap on successful login', async () => {
    await fillAndSubmit('student@example.com', 'MyPass-1234')
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/roadmap'))
  })

  it('shows error message on wrong credentials', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'bad@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/пароль/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() =>
      expect(screen.getByText(/неверный email или пароль/i)).toBeInTheDocument()
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not redirect on failed login', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    await fillAndSubmit('bad@example.com', 'wrong')
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('submits correct credentials across 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      const { unmount } = render(<LoginPage />)
      const email = `user${run}@test.com`
      const password = `pass-${run}`

      fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: email } })
      fireEvent.change(screen.getByPlaceholderText(/пароль/i), { target: { value: password } })
      fireEvent.click(screen.getByRole('button', { name: /войти/i }))

      await waitFor(() => expect(mockSignIn).toHaveBeenCalled())
      expect(mockSignIn, `run ${run}`).toHaveBeenCalledWith({ email, password })

      unmount()
      vi.clearAllMocks()
      mockSignIn.mockResolvedValue({ error: null })
    }
  })
})

// ── Forgot password ───────────────────────────────────────────────────────────

describe('forgot password flow', () => {
  it('shows forgot-password form when link is clicked', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /забыли пароль/i }))
    expect(screen.getByRole('button', { name: /восстановить доступ/i })).toBeInTheDocument()
  })

  it('calls /api/auth/forgot-password with the email', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'student@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /забыли пароль/i }))

    fireEvent.click(screen.getByRole('button', { name: /восстановить доступ/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'student@example.com' }),
      })
    ))
  })

  it('shows success message after forgot-password is submitted', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'student@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /забыли пароль/i }))
    fireEvent.click(screen.getByRole('button', { name: /восстановить доступ/i }))

    await waitFor(() =>
      expect(screen.getByText(/письмо отправлено/i)).toBeInTheDocument()
    )
  })
})
