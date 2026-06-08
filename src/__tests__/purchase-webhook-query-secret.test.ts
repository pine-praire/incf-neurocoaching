// @vitest-environment node
/**
 * Tests documenting the meta.verkyt@gmail.com incident.
 *
 * Root cause: GetCourse automation sends the webhook secret as a URL query
 * parameter (?secret=...), not as the x-getcourse-secret header. The old code
 * checked only the header → every automation-triggered request returned 401
 * and was never logged in webhook_events → user never appeared in enrollments.
 *
 * Fix: webhook now accepts secret from either header or ?secret= query param.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/brevo', () => ({ sendMagicLinkEmail: vi.fn() }))

import { POST } from '@/app/api/getcourse/purchase-webhook/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendMagicLinkEmail } from '@/lib/brevo'

const SECRET = 'test-webhook-secret'
const VALID_OFFER_ID = '5410171'
const MAGIC_LINK = 'https://platform.incf.eu/auth/callback?token=abc'

const BASE = 'http://localhost/api/getcourse/purchase-webhook'
const WITH_SECRET = `${BASE}?secret=${SECRET}`

// ── Mock factories ────────────────────────────────────────────────────────────

// Call order mirrors route.ts exactly:
// 1. webhook_events insert
// 2. webhook_events idempotency check
// 3. profiles lookup            (skipped when idempotencyHit)
// 4. profiles upsert            (skipped when idempotencyHit)
// 5. getcourse_orders upsert    (skipped when idempotencyHit)
// 6. enrollments upsert         (skipped when idempotencyHit)
// 7. webhook_events update      (skipped when idempotencyHit)
function buildFromMock({ profileExists = false, idempotencyHit = false } = {}) {
  const m = vi.fn()

  // 1. webhook_events insert
  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ev-1' }, error: null }),
      }),
    }),
  })

  // 2. idempotency check
  const idem = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(), maybeSingle: vi.fn() }
  idem.select = vi.fn().mockReturnValue(idem)
  idem.eq     = vi.fn().mockReturnValue(idem)
  idem.is     = vi.fn().mockReturnValue(idem)
  idem.not    = vi.fn().mockReturnValue(idem)
  idem.maybeSingle = vi.fn().mockResolvedValue({
    data: idempotencyHit ? { id: 'ev-prev' } : null,
    error: null,
  })
  m.mockReturnValueOnce(idem)

  if (idempotencyHit) return m

  // 3. profiles lookup
  m.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(
          profileExists
            ? { data: { id: 'user-123' }, error: null }
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

function makeMockClient(opts: Parameters<typeof buildFromMock>[0] = {}) {
  return {
    from: buildFromMock(opts),
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-new' } }, error: null }),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { action_link: MAGIC_LINK } },
          error: null,
        }),
      },
    },
  }
}

// Builds the form-encoded request that GetCourse automation actually sends:
// secret in ?secret= query param, body as application/x-www-form-urlencoded.
function makeAutomationRequest(params: Record<string, string>, url = WITH_SECRET) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
}

function validParams(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    email: 'meta.verkyt@gmail.com',
    order_id: 'gc-order-99999',
    offer_id: VALID_OFFER_ID,
    payment_status: 'Завершен',
    first_name: 'Meta',
    last_name: 'Verkyt',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GETCOURSE_WEBHOOK_SECRET = SECRET
  process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
  vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
})

// ── Root cause: secret in ?secret= query param ───────────────────────────────

describe('GetCourse automation — secret as ?secret= query param', () => {
  it('enrolls user when secret is in query param (no header)', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeAutomationRequest(validParams()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('sends magic link to the correct email when secret is in query param', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeAutomationRequest(validParams()))
    expect(sendMagicLinkEmail).toHaveBeenCalledWith('meta.verkyt@gmail.com', MAGIC_LINK)
  })

  it('returns 401 when query param secret is wrong', async () => {
    const res = await POST(
      makeAutomationRequest(validParams(), `${BASE}?secret=wrong-secret`)
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 when neither header nor query param is present', async () => {
    const res = await POST(makeAutomationRequest(validParams(), BASE))
    expect(res.status).toBe(401)
  })

  it('header secret also works when query param is absent (manual test calls)', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const req = new Request(BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-getcourse-secret': SECRET,
      },
      body: new URLSearchParams(validParams()).toString(),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('enrolls across 50 automation-style requests', async () => {
    for (let run = 0; run < 50; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)

      const res = await POST(
        makeAutomationRequest(validParams({ order_id: `gc-order-${run}` }))
      )
      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })

      vi.clearAllMocks()
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
    }
  })
})

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('idempotency', () => {
  it('skips re-enrollment when same order_id was already processed successfully', async () => {
    const client = makeMockClient({ idempotencyHit: true })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeAutomationRequest(validParams()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    // Enrollment logic never ran — createUser was not called
    expect(client.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('re-processes when previous webhook_events entry has error set (failed attempt)', async () => {
    // The idempotency query: .is('error', null).not('processed_at', 'is', null)
    // When the previous row has error IS NOT NULL → query returns null → retry is allowed.
    const client = makeMockClient({ idempotencyHit: false })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeAutomationRequest(validParams()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    // Enrollment logic ran — createUser was called
    expect(client.auth.admin.createUser).toHaveBeenCalledOnce()
  })

  it('re-processes across 50 retries when previous attempt errored', async () => {
    for (let run = 0; run < 50; run++) {
      const client = makeMockClient({ idempotencyHit: false })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        client as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)

      const res = await POST(
        makeAutomationRequest(validParams({ order_id: `retry-${run}` }))
      )
      expect(res.status, `run ${run}`).toBe(200)
      expect(client.auth.admin.createUser, `run ${run}`).toHaveBeenCalledOnce()

      vi.clearAllMocks()
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
    }
  })
})

// ── Enrollment survives partial downstream failures ───────────────────────────

describe('enrollment is not blocked by magic link or email failures', () => {
  it('returns { ok: true } when generateLink fails — user is still enrolled', async () => {
    const client = makeMockClient()
    client.auth.admin.generateLink = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('Supabase generateLink failed'),
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeAutomationRequest(validParams()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns { ok: true } when Brevo throws — user is still enrolled', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    vi.mocked(sendMagicLinkEmail).mockRejectedValue(new Error('Brevo timeout'))
    const res = await POST(makeAutomationRequest(validParams()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

// ── Existing user path ────────────────────────────────────────────────────────

describe('user with existing profile', () => {
  it('skips createUser but still writes enrollment', async () => {
    const client = makeMockClient({ profileExists: true })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeAutomationRequest(validParams()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(client.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('sends magic link to existing user', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeMockClient({ profileExists: true }) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeAutomationRequest(validParams()))
    expect(sendMagicLinkEmail).toHaveBeenCalledWith('meta.verkyt@gmail.com', MAGIC_LINK)
  })
})
