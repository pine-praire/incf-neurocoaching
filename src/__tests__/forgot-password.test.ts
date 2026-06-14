// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))

import { POST } from '@/app/api/auth/forgot-password/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

function makeMockClient() {
  return {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
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
    const body = await res.json()
    expect(body.error).toMatch(/email/i)
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

  it('calls resetPasswordForEmail with correct redirectTo', async () => {
    const client = makeMockClient()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest({ email: 'student@example.com' }))
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'student@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/auth/callback') })
    )
  })

  it('normalises email to lowercase', async () => {
    const client = makeMockClient()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest({ email: '  STUDENT@EXAMPLE.COM  ' }))
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'student@example.com',
      expect.any(Object)
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

// ── Security: no account enumeration ─────────────────────────────────────────

describe('security — no account enumeration', () => {
  it('returns { ok: true } for an unregistered email (same as registered)', async () => {
    const client = makeMockClient()
    client.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest({ email: 'unknown@nowhere.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns { ok: true } even when Supabase returns an error', async () => {
    const client = makeMockClient()
    client.auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: { message: 'User not found' } })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest({ email: 'unknown@nowhere.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
