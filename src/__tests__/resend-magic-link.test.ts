// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/brevo', () => ({ sendMagicLinkEmail: vi.fn() }))

import { POST } from '@/app/api/auth/resend-magic-link/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendMagicLinkEmail } from '@/lib/brevo'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAGIC_LINK = 'https://platform.incf.eu/auth/callback?token=def456'

// ── Mock factories ────────────────────────────────────────────────────────────

// from() call sequence in resend-magic-link.ts:
//   1. profiles → select → eq → maybeSingle
//   2. enrollments → select → eq → eq → limit → maybeSingle
//   (both only if previous returned data)

function buildEnrollmentChain(exists: boolean) {
  const c: Record<string, unknown> = {}
  const resolve = vi.fn().mockResolvedValue(
    exists ? { data: { id: 'enr-1' }, error: null } : { data: null, error: null }
  )
  c.maybeSingle = resolve
  c.limit = vi.fn().mockReturnValue(c)
  c.eq = vi.fn().mockReturnValue(c)
  c.select = vi.fn().mockReturnValue(c)
  return c
}

function buildFromMock({ profileExists = true, enrollmentExists = true } = {}) {
  const m = vi.fn()

  // 1. profiles
  m.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(
          profileExists ? { data: { id: 'user-123' }, error: null } : { data: null, error: null }
        ),
      }),
    }),
  })

  // 2. enrollments (only reached when profile exists)
  if (profileExists) {
    m.mockReturnValueOnce(buildEnrollmentChain(enrollmentExists))
  }

  return m
}

function makeMockClient({
  profileExists = true,
  enrollmentExists = true,
  generateLinkResult = { data: { properties: { action_link: MAGIC_LINK } }, error: null } as Record<string, unknown>,
} = {}) {
  return {
    from: buildFromMock({ profileExists, enrollmentExists }),
    auth: {
      admin: {
        generateLink: vi.fn().mockResolvedValue(generateLinkResult),
      },
    },
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/resend-magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
  vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
})

// ── Input validation ──────────────────────────────────────────────────────────

describe('input validation', () => {
  it('returns 400 when email is absent', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/email/i)
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new Request('http://localhost/api/auth/resend-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ── User enumeration protection ───────────────────────────────────────────────

describe('enumeration protection', () => {
  it('returns { ok: true } for unknown email without sending any email — 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient({ profileExists: false }) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )

      const res = await POST(makeRequest({ email: `unknown${run}@example.com` }))

      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })
      expect(sendMagicLinkEmail, `run ${run}: must not send to unknown email`).not.toHaveBeenCalled()

      vi.clearAllMocks()
    }
  })

  it('returns { ok: true } for user without active enrollment — 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient({ profileExists: true, enrollmentExists: false }) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )

      const res = await POST(makeRequest({ email: `revoked${run}@example.com` }))

      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })
      expect(sendMagicLinkEmail, `run ${run}: must not send to revoked user`).not.toHaveBeenCalled()

      vi.clearAllMocks()
    }
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('sends magic link and returns { ok: true } for enrolled user — 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient({ profileExists: true, enrollmentExists: true }) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)

      const email = `student${run}@example.com`
      const res = await POST(makeRequest({ email }))

      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })
      expect(sendMagicLinkEmail, `run ${run}`).toHaveBeenCalledWith(
        'student' + run + '@example.com',
        MAGIC_LINK
      )

      vi.clearAllMocks()
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
    }
  })

  it('normalises email to lowercase before lookup', async () => {
    const client = makeMockClient()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    await POST(makeRequest({ email: '  STUDENT@EXAMPLE.COM  ' }))

    expect(sendMagicLinkEmail).toHaveBeenCalledWith('student@example.com', expect.any(String))
  })
})

// ── Resilience ────────────────────────────────────────────────────────────────

describe('email send failure resilience', () => {
  it('still returns { ok: true } when Brevo throws', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    vi.mocked(sendMagicLinkEmail).mockRejectedValue(new Error('Brevo 503'))

    const res = await POST(makeRequest({ email: 'student@example.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

// ── generateLink error ────────────────────────────────────────────────────────

describe('generateLink failure', () => {
  it('returns 500 when Supabase generateLink returns an error', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient({
        generateLinkResult: { data: null, error: { message: 'User not found' } },
      }) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    const res = await POST(makeRequest({ email: 'student@example.com' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('User not found')
  })
})
