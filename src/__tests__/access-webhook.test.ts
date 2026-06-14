// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/getcourse/grant-access', () => ({ grantCourseAccess: vi.fn() }))

import { POST } from '@/app/api/getcourse/access-webhook/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { grantCourseAccess } from '@/lib/getcourse/grant-access'

const SECRET = 'access-webhook-secret'
const VALID_OFFER_ID = '5410171'

function makeRequest(params: Record<string, string>, secret = SECRET) {
  return new Request(
    `http://localhost/api/getcourse/access-webhook?secret=${secret}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    }
  )
}

function validParams(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    email: 'student@example.com',
    offer_id: VALID_OFFER_ID,
    event_type: 'access_granted',
    first_name: 'Anna',
    last_name: 'Ivanova',
    ...overrides,
  }
}

// ── Supabase mock helpers ────────────────────────────────────────────────────

const webhookInsert = () => ({
  insert: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'ev-1' }, error: null }),
    }),
  }),
})

const makeIdem = (hit = false) => {
  const idem: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: hit ? { id: 'ev-prev' } : null, error: null }),
  }
  idem.select = vi.fn().mockReturnValue(idem)
  idem.eq     = vi.fn().mockReturnValue(idem)
  idem.is     = vi.fn().mockReturnValue(idem)
  idem.not    = vi.fn().mockReturnValue(idem)
  return idem
}

const eventUpdate = () => ({
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
})

function makeClient(fromMock: ReturnType<typeof vi.fn>) {
  return { from: fromMock, auth: { admin: { createUser: vi.fn() } } }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GETCOURSE_WEBHOOK_SECRET = SECRET
  vi.mocked(grantCourseAccess).mockResolvedValue({ userId: 'user-123' })
})

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('authentication', () => {
  it('returns 401 when secret is wrong', async () => {
    const m = vi.fn().mockReturnValue(webhookInsert())
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
    const res = await POST(makeRequest(validParams(), 'wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 500 when GETCOURSE_WEBHOOK_SECRET is not set', async () => {
    delete process.env.GETCOURSE_WEBHOOK_SECRET
    const m = vi.fn()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
    const res = await POST(makeRequest(validParams()))
    expect(res.status).toBe(500)
  })

  it('accepts secret in x-getcourse-secret header', async () => {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValueOnce(makeIdem())
    m.mockReturnValue(eventUpdate())
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
    const res = await POST(new Request('http://localhost/api/getcourse/access-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-getcourse-secret': SECRET },
      body: new URLSearchParams(validParams()).toString(),
    }))
    expect(res.status).toBe(200)
  })
})

// ── Validation ───────────────────────────────────────────────────────────────

describe('payload validation', () => {
  it('returns 400 when email is missing', async () => {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValue(eventUpdate())
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
    const res = await POST(makeRequest({ offer_id: VALID_OFFER_ID }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Missing email' })
  })

  it('returns 400 when offer_id is unknown', async () => {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValue(eventUpdate())
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
    const res = await POST(makeRequest({ email: 'x@x.com', offer_id: '9999999' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('9999999') })
  })

  it('returns 400 when neither offer_id nor product_id are provided', async () => {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValue(eventUpdate())
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
    const res = await POST(makeRequest({ email: 'x@x.com' }))
    expect(res.status).toBe(400)
  })

  it('accepts product_id when offer_id is absent', async () => {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValueOnce(makeIdem())
    m.mockReturnValue(eventUpdate())
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
    const res = await POST(makeRequest({ email: 'x@x.com', product_id: '829285153' }))
    expect(res.status).toBe(200)
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe('happy path', () => {
  function buildFromMock() {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValueOnce(makeIdem())
    m.mockReturnValue(eventUpdate())
    return m
  }

  it('returns 200 { ok: true }', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(buildFromMock()) as never)
    const res = await POST(makeRequest(validParams()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('calls grantCourseAccess with normalised email and correct courseId', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(buildFromMock()) as never)
    await POST(makeRequest(validParams({ email: '  STUDENT@EXAMPLE.COM  ' })))
    expect(grantCourseAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: 'student@example.com',
        courseId: 'neurocoaching-intro',
      })
    )
  })

  it('passes optional fields to grantCourseAccess', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(buildFromMock()) as never)
    await POST(makeRequest(validParams({ order_id: 'ord-free-001', getcourse_user_id: 'gc-99', first_name: 'Anna', last_name: 'Ivanova' })))
    expect(grantCourseAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        getcourseOrderId: 'ord-free-001',
        getcourseUserId: 'gc-99',
        firstName: 'Anna',
        lastName: 'Ivanova',
      })
    )
  })

  it('succeeds across 20 runs', async () => {
    for (let run = 0; run < 20; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(buildFromMock()) as never)
      const res = await POST(makeRequest(validParams()))
      expect(res.status, `run ${run}`).toBe(200)
      vi.clearAllMocks()
      vi.mocked(grantCourseAccess).mockResolvedValue({ userId: 'user-123' })
    }
  })
})

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('idempotency', () => {
  it('returns 200 without calling grantCourseAccess when event already processed', async () => {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValueOnce(makeIdem(true)) // hit
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
    const res = await POST(makeRequest(validParams({ order_id: 'ord-dup' })))
    expect(res.status).toBe(200)
    expect(grantCourseAccess).not.toHaveBeenCalled()
  })
})

// ── grantCourseAccess errors ──────────────────────────────────────────────────

describe('grantCourseAccess failure', () => {
  it('returns 400 and logs error when grantCourseAccess throws', async () => {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValueOnce(makeIdem())
    m.mockReturnValue(eventUpdate())
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
    vi.mocked(grantCourseAccess).mockRejectedValue(new Error('DB exploded'))
    const res = await POST(makeRequest(validParams()))
    expect(res.status).toBe(400)
  })

  it('returns 400 consistently across 20 failure runs', async () => {
    for (let run = 0; run < 20; run++) {
      const m = vi.fn()
      m.mockReturnValueOnce(webhookInsert())
      m.mockReturnValueOnce(makeIdem())
      m.mockReturnValue(eventUpdate())
      vi.mocked(createSupabaseAdminClient).mockReturnValue(makeClient(m) as never)
      vi.mocked(grantCourseAccess).mockRejectedValue(new Error('DB error'))
      const res = await POST(makeRequest(validParams()))
      expect(res.status, `run ${run}`).toBe(400)
      vi.clearAllMocks()
      vi.mocked(grantCourseAccess).mockRejectedValue(new Error('DB error'))
    }
  })
})
