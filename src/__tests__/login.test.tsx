import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import LoginPage from '@/app/login/page'

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function submitLoginForm(email: string) {
  render(<LoginPage />)
  fireEvent.change(screen.getByPlaceholderText(/email/i), {
    target: { value: email },
  })
  fireEvent.click(screen.getByRole('button', { name: /получить ссылку/i }))
  await waitFor(() => expect(mockFetch).toHaveBeenCalled())
}

// ── Login flow ────────────────────────────────────────────────────────────────

describe('login form — calls resend-magic-link endpoint', () => {
  it('sends POST to /api/auth/resend-magic-link with the email', async () => {
    await submitLoginForm('student@example.com')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/resend-magic-link',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'student@example.com' }),
      })
    )
  })

  it('sends the entered email address — 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      const { unmount } = render(<LoginPage />)
      const email = `user${run}@test.com`

      fireEvent.change(screen.getByPlaceholderText(/email/i), {
        target: { value: email },
      })
      fireEvent.click(screen.getByRole('button', { name: /получить ссылку/i }))
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())

      const [, opts] = mockFetch.mock.calls[0]
      const body = JSON.parse(opts.body)
      expect(body.email, `run ${run}`).toBe(email)

      unmount()
      vi.clearAllMocks()
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    }
  })

  it('shows success state after submission', async () => {
    await submitLoginForm('student@example.com')
    expect(screen.getByText(/проверьте почту/i)).toBeInTheDocument()
  })

  it('shows error message when API returns non-ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Ошибка отправки' }),
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'bad@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /получить ссылку/i }))

    await waitFor(() =>
      expect(screen.getByText(/ошибка отправки/i)).toBeInTheDocument()
    )
  })

  it('does not show success state on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'fail' }),
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'bad@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /получить ссылку/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(screen.queryByText(/проверьте почту/i)).not.toBeInTheDocument()
  })
})
