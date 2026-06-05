// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/brevo', () => ({ sendMagicLinkEmail: vi.fn() }))

import { POST } from '@/app/api/getcourse/purchase-webhook/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendMagicLinkEmail } from '@/lib/brevo'

// ── Constants ─────────────────────────────────────────────────────────────────

const SECRET = 'test-webhook-secret'
const VALID_OFFER_ID = '5410171'
const MAGIC_LINK = 'https://platform.incf.eu/auth/callback?token=abc123'

// ── Mock factories ────────────────────────────────────────────────────────────

// Returns the Supabase `from()` mock pre-loaded for the happy path (new user).
// Call sequence matches purchase-webhook.ts exactly:
//   1. webhook_events  → insert → select → single
//   2. profiles        → select → eq → maybeSingle  (null = not found)
//   3. profiles        → upsert
//   4. getcourse_orders → upsert
//   5. enrollments     → upsert
//   6. webhook_events  → update → eq
function buildHappyFromMock({ profileExists = false } = {}) {
  const m = vi.fn()

  // 1. webhook_events insert
  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ev-1' }, error: null }),
      }),
    }),
  })

  // 2. webhook_events idempotency check (select → eq → is → not → maybeSingle)
  const idem: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // not a duplicate
  }
  idem.select = vi.fn().mockReturnValue(idem)
  idem.eq    = vi.fn().mockReturnValue(idem)
  idem.is    = vi.fn().mockReturnValue(idem)
  idem.not   = vi.fn().mockReturnValue(idem)
  m.mockReturnValueOnce(idem)

  // 3. profiles lookup
  m.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(
          profileExists
            ? { data: { id: 'user-existing' }, error: null }
            : { data: null, error: null }
        ),
      }),
    }),
  })

  // 4. profiles upsert
  m.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ data: null, error: null }) })

  // 5. getcourse_orders upsert
  m.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ data: null, error: null }) })

  // 6. enrollments upsert
  m.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ data: null, error: null }) })

  // 7. webhook_events update (processed_at)
  m.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  })

  return m
}

// Minimal mock for failure paths (fields validated inside try, event log always written).
// Sequence: insert (event log) → update (save error).
function buildFailFromMock() {
  const m = vi.fn()
  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ev-1' }, error: null }),
      }),
    }),
  })
  m.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  })
  return m
}

function makeMockClient({ profileExists = false } = {}) {
  return {
    from: buildHappyFromMock({ profileExists }),
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-new' } },
          error: null,
        }),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { action_link: MAGIC_LINK } },
          error: null,
        }),
      },
    },
  }
}

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/getcourse/purchase-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'student@example.com',
    order_id: 'ord-001',
    offer_id: VALID_OFFER_ID,
    payment_status: 'paid',
    first_name: 'Анна',
    last_name: 'Иванова',
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GETCOURSE_WEBHOOK_SECRET = SECRET
  process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
  vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
})

// ── Auth / Config ─────────────────────────────────────────────────────────────

describe('secret validation', () => {
  it('returns 500 when GETCOURSE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.GETCOURSE_WEBHOOK_SECRET
    const res = await POST(makeRequest(validBody(), { 'x-getcourse-secret': SECRET }))
    expect(res.status).toBe(500)
  })

  it('returns 401 on wrong secret across 50 attempts', async () => {
    for (let i = 0; i < 50; i++) {
      const res = await POST(makeRequest(validBody(), { 'x-getcourse-secret': `wrong-${i}` }))
      expect(res.status).toBe(401)
    }
  })

  it('returns 401 when x-getcourse-secret header is absent', async () => {
    const req = new Request('http://localhost/api/getcourse/purchase-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})

// ── Payload validation ────────────────────────────────────────────────────────

describe('payload validation', () => {
  beforeEach(() => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      { from: buildFailFromMock(), auth: { admin: {} } } as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
  })

  it.each([
    ['email', { email: undefined }],
    ['order_id', { order_id: undefined }],
    ['offer_id', { offer_id: undefined }],
  ])('returns 400 when %s is missing', async (_, override) => {
    const res = await POST(
      makeRequest(validBody(override), { 'x-getcourse-secret': SECRET })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown offer_id', async () => {
    const res = await POST(
      makeRequest(validBody({ offer_id: 'unknown-999' }), { 'x-getcourse-secret': SECRET })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unknown offer_id/i)
  })

  it.each([
    ['pending'], ['refunded'], ['failed'], ['ожидание'], ['отменён'],
  ])('returns 400 for non-paid status "%s"', async (status) => {
    const res = await POST(
      makeRequest(validBody({ payment_status: status }), { 'x-getcourse-secret': SECRET })
    )
    expect(res.status).toBe(400)
  })

  it.each([
    ['paid'], ['success'], ['completed'], ['оплачен'], ['оплачено'], ['завершен'], ['завершено'], ['завершён'],
    ['PAID'], ['  Paid  '], ['ОПЛАЧЕН'],
  ])('accepts paid-equivalent status "%s"', async (status) => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(
      makeRequest(validBody({ payment_status: status }), { 'x-getcourse-secret': SECRET })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe('happy path — new user', () => {
  it('creates user, sends email, returns { ok: true } across 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient({ profileExists: false }) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)

      const res = await POST(
        makeRequest(
          validBody({ order_id: `ord-${run}` }),
          { 'x-getcourse-secret': SECRET }
        )
      )

      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })
      expect(sendMagicLinkEmail, `run ${run}`).toHaveBeenCalledWith(
        'student@example.com',
        MAGIC_LINK
      )

      vi.clearAllMocks()
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
    }
  })

  it('calls createUser when profile does not exist', async () => {
    const client = makeMockClient({ profileExists: false })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    await POST(makeRequest(validBody(), { 'x-getcourse-secret': SECRET }))

    expect(client.auth.admin.createUser).toHaveBeenCalledOnce()
  })

  it('skips createUser when profile already exists', async () => {
    const client = makeMockClient({ profileExists: true })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    await POST(makeRequest(validBody(), { 'x-getcourse-secret': SECRET }))

    expect(client.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('returns { ok: true } for existing user across 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient({ profileExists: true }) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)

      const res = await POST(
        makeRequest(validBody({ order_id: `ord-ex-${run}` }), { 'x-getcourse-secret': SECRET })
      )

      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })

      vi.clearAllMocks()
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
    }
  })
})

// ── Security ─────────────────────────────────────────────────────────────────

describe('security — response body', () => {
  it('never exposes the magic link in the response body across 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)

      const res = await POST(
        makeRequest(validBody({ order_id: `ord-sec-${run}` }), { 'x-getcourse-secret': SECRET })
      )

      const text = await res.text()
      expect(text, `run ${run} must not contain token`).not.toContain('token=')
      expect(text, `run ${run} must not contain callback`).not.toContain('/auth/callback')
      expect(text, `run ${run} must be { ok: true }`).toContain('"ok":true')

      vi.clearAllMocks()
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
    }
  })

  it('response Content-Type is application/json, not text/plain', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest(validBody(), { 'x-getcourse-secret': SECRET }))
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})

// ── Resilience ────────────────────────────────────────────────────────────────

describe('email send failure resilience', () => {
  it('still returns { ok: true } when Brevo throws across 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      vi.mocked(sendMagicLinkEmail).mockRejectedValue(new Error(`Brevo timeout run ${run}`))

      const res = await POST(
        makeRequest(validBody({ order_id: `ord-err-${run}` }), { 'x-getcourse-secret': SECRET })
      )

      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })

      vi.clearAllMocks()
    }
  })
})

// ── Form-encoded body ─────────────────────────────────────────────────────────

describe('form-encoded body parsing', () => {
  it('parses application/x-www-form-urlencoded payload', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const params = new URLSearchParams({
      email: 'student@example.com',
      order_id: 'ord-form-001',
      offer_id: VALID_OFFER_ID,
      payment_status: 'paid',
    })
    const req = new Request('http://localhost/api/getcourse/purchase-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-getcourse-secret': SECRET,
      },
      body: params.toString(),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
