// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ generateTempPassword: vi.fn(() => 'Test-Pass-PS1') }))

import { POST } from '@/app/api/getcourse/purchase-webhook/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const SECRET = 'payment-status-secret-xyz'
const VALID_OFFER_ID = '5410171'

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/getcourse/purchase-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-getcourse-secret': SECRET },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'student@example.com',
    order_id: 'ord-ps-001',
    offer_id: VALID_OFFER_ID,
    first_name: 'Анна',
    last_name: 'Иванова',
    ...overrides,
  }
}

// Mock for unpaid path: insert eventLog → update with skipped: log (2 from() calls, early return)
function buildSkipMock(eventId = 'ev-skip-1') {
  const m = vi.fn()
  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: eventId }, error: null }),
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

// Minimal happy-path mock for paid statuses (7 from() calls)
function buildPaidMock() {
  const m = vi.fn()
  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ev-paid-1' }, error: null }),
      }),
    }),
  })
  const idem: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  idem.select = vi.fn().mockReturnValue(idem)
  idem.eq    = vi.fn().mockReturnValue(idem)
  idem.is    = vi.fn().mockReturnValue(idem)
  idem.not   = vi.fn().mockReturnValue(idem)
  m.mockReturnValueOnce(idem)
  m.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  })
  m.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ data: null, error: null }) })
  m.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ data: null, error: null }) })
  m.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ data: null, error: null }) })
  m.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  })
  return m
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GETCOURSE_WEBHOOK_SECRET = SECRET
  process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
})

// ── Unpaid statuses → skip ────────────────────────────────────────────────────

describe('payment_status guard — unpaid statuses', () => {
  it.each([
    ['pending'],
    ['refunded'],
    ['отменён'],
    ['Отменен'],
    ['failed'],
  ])('returns 200 ok:true immediately for status "%s" without enrolling', async (status) => {
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })
    const m = vi.fn()
    m.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'ev-skip-1' }, error: null }),
        }),
      }),
    })
    m.mockReturnValueOnce({ update: updateFn })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      { from: m } as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    const res = await POST(makeRequest(validBody({ payment_status: status })))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    // from() called exactly twice: insert + update — no enrollment calls
    expect(m).toHaveBeenCalledTimes(2)
  })

  it('logs skipped:unpaid_status:<value> in webhook_events', async () => {
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })
    const m = buildSkipMock()
    m.mockReturnValueOnce({ update: updateFn })
    // rebuild since buildSkipMock already set up 2 returns; use inline mock instead
    const m2 = vi.fn()
    m2.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'ev-skip-2' }, error: null }),
        }),
      }),
    })
    const capturedUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
    m2.mockReturnValueOnce({ update: capturedUpdate })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      { from: m2 } as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    await POST(makeRequest(validBody({ payment_status: 'pending' })))

    expect(capturedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'skipped:unpaid_status:pending' })
    )
  })

  it('returns 200 ok:true even when eventLog is missing (no id to update)', async () => {
    const m = vi.fn()
    m.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }),
        }),
      }),
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      { from: m } as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    const res = await POST(makeRequest(validBody({ payment_status: 'pending' })))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

// ── Paid statuses → proceed ───────────────────────────────────────────────────

describe('payment_status guard — paid statuses proceed to enrollment', () => {
  it.each([['paid'], ['Завершен']])('status "%s" proceeds past the guard', async (status) => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      { from: buildPaidMock() } as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    vi.mocked(createSupabaseAdminClient).mockImplementation(() => ({
      from: buildPaidMock(),
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-new' } }, error: null }),
        },
      },
    } as unknown as ReturnType<typeof createSupabaseAdminClient>))

    const res = await POST(makeRequest(validBody({ payment_status: status, order_id: `ord-paid-${status}` })))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

// ── Missing payment_status → proceed ─────────────────────────────────────────

describe('payment_status guard — absent field does not block', () => {
  it('proceeds to enrollment when payment_status is omitted', async () => {
    vi.mocked(createSupabaseAdminClient).mockImplementation(() => ({
      from: buildPaidMock(),
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-nops' } }, error: null }),
        },
      },
    } as unknown as ReturnType<typeof createSupabaseAdminClient>))

    const body = validBody()
    delete (body as Record<string, unknown>).payment_status
    const res = await POST(makeRequest(body))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
