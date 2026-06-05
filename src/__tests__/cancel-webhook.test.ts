// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))

import { POST } from '@/app/api/getcourse/cancel-webhook/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// ── Constants ─────────────────────────────────────────────────────────────────

const SECRET = 'cancel-test-secret-x'  // 20 chars, used in timing-safe tests
const VALID_OFFER_ID = '5410171'

// ── Mock factories ────────────────────────────────────────────────────────────

// from() call sequence in cancel-webhook.ts (happy path):
//   1. webhook_events  → insert → select → single
//   2. getcourse_orders → update → eq          (terminal)
//   3. enrollments      → update → eq → eq     (terminal)
//   4. webhook_events  → update → eq           (processed_at, terminal)

function buildHappyFromMock() {
  const m = vi.fn()

  // 1. webhook_events insert
  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ev-c1' }, error: null }),
      }),
    }),
  })

  // 2. webhook_events idempotency check → not found
  const idem: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  idem.select = vi.fn().mockReturnValue(idem)
  idem.eq    = vi.fn().mockReturnValue(idem)
  idem.is    = vi.fn().mockReturnValue(idem)
  idem.not   = vi.fn().mockReturnValue(idem)
  m.mockReturnValueOnce(idem)

  // 3. getcourse_orders update → eq
  m.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  })

  // 4. enrollments update → eq → eq
  m.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  })

  // 5. webhook_events update (processed_at)
  m.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  })

  return m
}

function buildDuplicateFromMock() {
  const m = vi.fn()

  // 1. webhook_events insert
  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ev-c-dup' }, error: null }),
      }),
    }),
  })

  // 2. webhook_events idempotency check → existing event found
  const idem: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'ev-prev' }, error: null }),
  }
  idem.select = vi.fn().mockReturnValue(idem)
  idem.eq    = vi.fn().mockReturnValue(idem)
  idem.is    = vi.fn().mockReturnValue(idem)
  idem.not   = vi.fn().mockReturnValue(idem)
  m.mockReturnValueOnce(idem)

  return m
}

// Failure path: only event log insert + error update needed.
function buildFailFromMock() {
  const m = vi.fn()
  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ev-c1' }, error: null }),
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

function makeHappyClient() {
  return { from: buildHappyFromMock(), auth: { admin: {} } }
}

function makeFailClient() {
  return { from: buildFailFromMock(), auth: { admin: {} } }
}

function makeRequest(
  body: string,
  contentType: 'application/json' | 'application/x-www-form-urlencoded',
  secret = SECRET,
) {
  return new Request('http://localhost/api/getcourse/cancel-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'x-getcourse-secret': secret,
    },
    body,
  })
}

function jsonBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    order_id: 'ord-cancel-001',
    offer_id: VALID_OFFER_ID,
    ...overrides,
  })
}

function formBody(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    order_id: 'ord-cancel-001',
    offer_id: VALID_OFFER_ID,
    ...overrides,
  }).toString()
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GETCOURSE_WEBHOOK_SECRET = SECRET
})

// ── S-7: constant-time secret comparison ──────────────────────────────────────

describe('S-7 — constant-time secret validation', () => {
  it('returns 500 when GETCOURSE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.GETCOURSE_WEBHOOK_SECRET
    const res = await POST(makeRequest(jsonBody(), 'application/json', SECRET))
    expect(res.status).toBe(500)
  })

  it('returns 401 when header is absent — 30 runs', async () => {
    for (let i = 0; i < 30; i++) {
      const req = new Request('http://localhost/api/getcourse/cancel-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody(),
      })
      expect((await POST(req)).status, `run ${i}`).toBe(401)
    }
  })

  it('returns 401 for wrong secret shorter than expected — 30 runs', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await POST(makeRequest(jsonBody(), 'application/json', 'short'))
      expect(res.status, `run ${i}`).toBe(401)
    }
  })

  it('returns 401 for wrong secret longer than expected — 30 runs', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await POST(makeRequest(jsonBody(), 'application/json', SECRET + '-extra'))
      expect(res.status, `run ${i}`).toBe(401)
    }
  })

  it('returns 401 for wrong secret with same length — 30 runs', async () => {
    // Same length as SECRET (20 chars), different content
    const sameLen = 'X'.repeat(SECRET.length)
    for (let i = 0; i < 30; i++) {
      const res = await POST(makeRequest(jsonBody(), 'application/json', sameLen))
      expect(res.status, `run ${i}`).toBe(401)
    }
  })

  it('accepts the correct secret', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeHappyClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest(jsonBody(), 'application/json', SECRET))
    expect(res.status).toBe(200)
  })
})

// ── S-5: dual body format parsing ─────────────────────────────────────────────

describe('S-5 — dual body format', () => {
  it('processes JSON body and returns { ok: true } — 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeHappyClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const res = await POST(makeRequest(
        jsonBody({ order_id: `ord-json-${run}` }),
        'application/json',
      ))
      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })
      vi.clearAllMocks()
    }
  })

  it('processes form-urlencoded body and returns { ok: true } — 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeHappyClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const res = await POST(makeRequest(
        formBody({ order_id: `ord-form-${run}` }),
        'application/x-www-form-urlencoded',
      ))
      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })
      vi.clearAllMocks()
    }
  })

  it('returns same result for JSON and form-urlencoded with identical data', async () => {
    for (let run = 0; run < 30; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeHappyClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const resJson = await POST(makeRequest(jsonBody(), 'application/json'))
      const jsonResult = await resJson.json()

      vi.clearAllMocks()
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeHappyClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const resForm = await POST(makeRequest(formBody(), 'application/x-www-form-urlencoded'))
      const formResult = await resForm.json()

      expect(resJson.status, `run ${run}`).toBe(resForm.status)
      expect(jsonResult, `run ${run}`).toEqual(formResult)
      vi.clearAllMocks()
    }
  })
})

// ── Payload validation ────────────────────────────────────────────────────────

describe('payload validation', () => {
  beforeEach(() => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeFailClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
  })

  it('returns 400 when order_id is missing (JSON)', async () => {
    const res = await POST(makeRequest(
      JSON.stringify({ offer_id: VALID_OFFER_ID }),
      'application/json',
    ))
    expect(res.status).toBe(400)
  })

  it('returns 400 when order_id is missing (form-urlencoded)', async () => {
    const res = await POST(makeRequest(
      new URLSearchParams({ offer_id: VALID_OFFER_ID }).toString(),
      'application/x-www-form-urlencoded',
    ))
    expect(res.status).toBe(400)
  })

  it('returns 400 when offer_id is missing', async () => {
    const res = await POST(makeRequest(
      JSON.stringify({ order_id: 'ord-001' }),
      'application/json',
    ))
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown offer_id', async () => {
    const res = await POST(makeRequest(jsonBody({ offer_id: 'unknown-99' }), 'application/json'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unknown offer_id/i)
  })

  it('returns 400 on invalid JSON', async () => {
    const res = await POST(makeRequest('not-json', 'application/json'))
    expect(res.status).toBe(400)
  })
})

// ── S-6: idempotency ──────────────────────────────────────────────────────────

describe('S-6 — idempotency (cancel-webhook)', () => {
  it('returns { ok: true } immediately for duplicate cancel — 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        { from: buildDuplicateFromMock(), auth: { admin: {} } } as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const res = await POST(makeRequest(jsonBody({ order_id: `ord-dup-${run}` }), 'application/json'))
      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })
      vi.clearAllMocks()
    }
  })

  it('does not update orders or enrollments for duplicate cancel — 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      const fromMock = buildDuplicateFromMock()
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        { from: fromMock, auth: { admin: {} } } as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      await POST(makeRequest(jsonBody({ order_id: `ord-dup-nowrite-${run}` }), 'application/json'))
      // Only 2 from() calls: insert + idempotency check. No update calls.
      expect(fromMock.mock.calls.length, `run ${run}`).toBe(2)
      vi.clearAllMocks()
    }
  })
})

// ── Cancellation logic ────────────────────────────────────────────────────────

describe('cancellation logic', () => {
  it('updates getcourse_orders and enrollments when cancelling', async () => {
    const fromMock = buildHappyFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      { from: fromMock, auth: { admin: {} } } as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    const res = await POST(makeRequest(jsonBody(), 'application/json'))
    expect(res.status).toBe(200)

    // getcourse_orders update was called (call index 2, after insert + idempotency check)
    const ordersCall = fromMock.mock.calls[2]
    expect(ordersCall[0]).toBe('getcourse_orders')

    // enrollments update was called (call index 3)
    const enrollCall = fromMock.mock.calls[3]
    expect(enrollCall[0]).toBe('enrollments')
  })
})
