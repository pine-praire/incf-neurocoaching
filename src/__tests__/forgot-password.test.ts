// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/brevo', () => ({ sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined) }))

import { POST } from '@/app/api/auth/forgot-password/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendPasswordResetEmail } from '@/lib/brevo'

const RESET_LINK = 'https://supabase.co/auth/v1/verify?token=abc&type=recovery'

// Builds a mock client.
// profileFound: whether .from('profiles') returns a row
function makeMockClient({ profileFound = true } = {}) {
  const generateLink = vi.fn().mockResolvedValue({
    data: { properties: { action_link: RESET_LINK } },
    error: null,
  })
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: profileFound ? { id: 'user-1' } : null,
            error: null,
          }),
        }),
      }),
    }),
    auth: { admin: { generateLink } },
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
})

// ── Input validation ──────────────────────────────────────────────────────────

describe('input validation', () => {
  it('returns 400 when email is absent', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/email/i)
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('returns { ok: true } for a registered email', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest({ email: 'student@example.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('calls generateLink with correct redirectTo', async () => {
    const client = makeMockClient()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest({ email: 'student@example.com' }))
    expect(client.auth.admin.generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'recovery',
        email: 'student@example.com',
        options: expect.objectContaining({ redirectTo: expect.stringContaining('/auth/callback') }),
      })
    )
  })

  it('sends the reset email via Brevo', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest({ email: 'student@example.com' }))
    expect(vi.mocked(sendPasswordResetEmail)).toHaveBeenCalledWith(
      'student@example.com',
      RESET_LINK,
    )
  })

  it('normalises email to lowercase', async () => {
    const client = makeMockClient()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest({ email: '  STUDENT@EXAMPLE.COM  ' }))
    expect(client.auth.admin.generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'student@example.com' })
    )
  })

  it('works consistently across 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const res = await POST(makeRequest({ email: `user${run}@example.com` }))
      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })
      vi.clearAllMocks()
    }
  })
})

// ── Not enrolled ──────────────────────────────────────────────────────────────

describe('not enrolled', () => {
  it('returns { notEnrolled: true } when email is not in profiles', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient({ profileFound: false }) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest({ email: 'unknown@nowhere.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ notEnrolled: true })
  })

  it('does not call generateLink when email is not enrolled', async () => {
    const client = makeMockClient({ profileFound: false })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest({ email: 'unknown@nowhere.com' }))
    expect(client.auth.admin.generateLink).not.toHaveBeenCalled()
  })

  it('does not send Brevo email when email is not enrolled', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient({ profileFound: false }) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest({ email: 'unknown@nowhere.com' }))
    expect(vi.mocked(sendPasswordResetEmail)).not.toHaveBeenCalled()
  })
})
