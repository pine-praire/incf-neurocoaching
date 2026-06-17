// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ generateTempPassword: vi.fn(() => 'Test-Pass-1234') }))
vi.mock('@/lib/brevo', () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) }))

import { POST } from '@/app/api/getcourse/purchase-webhook/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateTempPassword } from '@/lib/auth-utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const SECRET = 'test-webhook-secret'
const VALID_OFFER_ID = '5410171'
const VALID_PRODUCT_ID = '829285153'

// ── Mock factories ────────────────────────────────────────────────────────────

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

  // 2. webhook_events idempotency check
  const idem: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-1234')
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
    ['paid'], ['Завершен'],
  ])('proceeds to enrollment for paid status "%s"', async (status) => {
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
  it('creates user with password, returns { ok: true } across 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient({ profileExists: false }) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )

      const res = await POST(
        makeRequest(
          validBody({ order_id: `ord-${run}` }),
          { 'x-getcourse-secret': SECRET }
        )
      )

      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })

      vi.clearAllMocks()
      vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-1234')
    }
  })

  it('calls createUser with a password when profile does not exist', async () => {
    const client = makeMockClient({ profileExists: false })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    await POST(makeRequest(validBody(), { 'x-getcourse-secret': SECRET }))

    expect(client.auth.admin.createUser).toHaveBeenCalledOnce()
    expect(client.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'Test-Pass-1234' })
    )
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

      const res = await POST(
        makeRequest(validBody({ order_id: `ord-ex-${run}` }), { 'x-getcourse-secret': SECRET })
      )

      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })

      vi.clearAllMocks()
      vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-1234')
    }
  })
})

// ── Password generation ───────────────────────────────────────────────────────

describe('password generation', () => {
  it('generateTempPassword is called for each new user', async () => {
    const client = makeMockClient({ profileExists: false })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    await POST(makeRequest(validBody(), { 'x-getcourse-secret': SECRET }))

    expect(generateTempPassword).toHaveBeenCalledOnce()
  })

  it('generateTempPassword IS called (tempPassword computed before profile check)', async () => {
    const client = makeMockClient({ profileExists: true })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    await POST(makeRequest(validBody(), { 'x-getcourse-secret': SECRET }))

    // tempPassword is now computed unconditionally before the existingProfile branch
    // so createUser can reuse it — generateTempPassword is always called once
    expect(generateTempPassword).toHaveBeenCalledTimes(1)
  })
})

// ── Security ─────────────────────────────────────────────────────────────────

describe('security — response body', () => {
  it('never exposes the password in the response body across 50 runs', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )

      const res = await POST(
        makeRequest(validBody({ order_id: `ord-sec-${run}` }), { 'x-getcourse-secret': SECRET })
      )

      const text = await res.text()
      expect(text, `run ${run} must not contain password`).not.toContain('Test-Pass-1234')
      expect(text, `run ${run} must be { ok: true }`).toContain('"ok":true')

      vi.clearAllMocks()
      vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-1234')
    }
  })

  it('response Content-Type is application/json', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest(validBody(), { 'x-getcourse-secret': SECRET }))
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})

// ── product_id routing ────────────────────────────────────────────────────────

describe('product_id routing (no offer_id)', () => {
  it('enrolls user when only product_id is present', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(
      makeRequest(
        validBody({ offer_id: undefined, product_id: VALID_PRODUCT_ID }),
        { 'x-getcourse-secret': SECRET }
      )
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 400 for unknown product_id when offer_id is absent', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      { from: buildFailFromMock(), auth: { admin: {} } } as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(
      makeRequest(
        validBody({ offer_id: undefined, product_id: 'unknown-999' }),
        { 'x-getcourse-secret': SECRET }
      )
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unknown offer_id\/product_id/i)
  })

  it('returns 400 when both offer_id and product_id are absent', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      { from: buildFailFromMock(), auth: { admin: {} } } as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(
      makeRequest(
        validBody({ offer_id: undefined, product_id: undefined }),
        { 'x-getcourse-secret': SECRET }
      )
    )
    expect(res.status).toBe(400)
  })

  it('offer_id takes priority over product_id when both are present', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(
      makeRequest(
        validBody({ offer_id: VALID_OFFER_ID, product_id: VALID_PRODUCT_ID }),
        { 'x-getcourse-secret': SECRET }
      )
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('parses product_id from form-encoded body', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const params = new URLSearchParams({
      email: 'student@example.com',
      order_id: 'ord-product-001',
      product_id: VALID_PRODUCT_ID,
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

  it('enrolls across 50 runs with product_id only', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )

      const res = await POST(
        makeRequest(
          validBody({ offer_id: undefined, product_id: VALID_PRODUCT_ID, order_id: `ord-prod-${run}` }),
          { 'x-getcourse-secret': SECRET }
        )
      )
      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })

      vi.clearAllMocks()
      vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-1234')
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
