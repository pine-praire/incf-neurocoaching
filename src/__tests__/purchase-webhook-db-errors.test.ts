// @vitest-environment node
/**
 * Tests for strict DB error-checking added to the purchase webhook (#2).
 *
 * Covers three failure points:
 *   - profiles upsert fails     → 400, GetCourse retries
 *   - orders upsert fails       → 400, GetCourse retries
 *   - enrollments upsert fails  → 400, GetCourse retries
 *
 * And the retry-after-partial-failure scenario:
 *   - First run: createUser succeeds, profiles upsert fails → 400
 *   - Second run: createUser returns "already registered" →
 *     fallback to GoTrue admin REST API to recover userId → enroll succeeds → 200
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ generateTempPassword: vi.fn(() => 'Test-Pass-DBE1') }))
vi.mock('@/lib/brevo', () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) }))

import { POST } from '@/app/api/getcourse/purchase-webhook/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateTempPassword } from '@/lib/auth-utils'

const SECRET = 'db-err-secret-xyz'
const VALID_OFFER_ID = '5410171'
const DB_ERROR = { message: 'database error saving row', code: '23505' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string>, secret = SECRET) {
  return new Request(
    `http://localhost/api/getcourse/purchase-webhook?secret=${secret}`,
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
    order_id: 'ord-dberr-001',
    offer_id: VALID_OFFER_ID,
    payment_status: 'Завершен',
    first_name: 'Test',
    last_name: 'User',
    ...overrides,
  }
}

// Idempotency chain (reused across mocks)
function makeIdem(hit = false) {
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

const webhookInsert = () => ({
  insert: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'ev-1' }, error: null }),
    }),
  }),
})

const profilesLookup = (exists: boolean) => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue(
        exists ? { data: { id: 'user-123' }, error: null } : { data: null, error: null }
      ),
    }),
  }),
})

const upsertOk = () => ({ upsert: vi.fn().mockResolvedValue({ data: null, error: null }) })
const upsertFail = () => ({ upsert: vi.fn().mockResolvedValue({ data: null, error: DB_ERROR }) })
const eventUpdate = () => ({
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
})

function makeClient(fromMock: ReturnType<typeof vi.fn>, createUserResult = { data: { user: { id: 'user-new' } }, error: null }) {
  return {
    from: fromMock,
    auth: { admin: { createUser: vi.fn().mockResolvedValue(createUserResult) } },
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GETCOURSE_WEBHOOK_SECRET = SECRET
  process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-DBE1')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ users: [] }),
  }))
})

// ── profiles upsert fails ─────────────────────────────────────────────────────

describe('profiles upsert DB error', () => {
  function buildFromMock() {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValueOnce(makeIdem())
    m.mockReturnValueOnce(profilesLookup(false))
    m.mockReturnValueOnce(upsertFail())    // profiles
    m.mockReturnValue(eventUpdate())       // error log
    return m
  }

  it('returns 400 so GetCourse retries', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeClient(buildFromMock()) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest(validParams()))
    expect(res.status).toBe(400)
  })

  it('logs the DB error to webhook_events', async () => {
    const fromMock = buildFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeClient(fromMock) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest(validParams()))
    const updateCall = fromMock.mock.results.find(r => r.value?.update)
    expect(updateCall).toBeDefined()
  })

  it('returns 400 consistently across 20 runs', async () => {
    for (let run = 0; run < 20; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeClient(buildFromMock()) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const res = await POST(makeRequest(validParams({ order_id: `ord-pf-${run}` })))
      expect(res.status, `run ${run}`).toBe(400)
      vi.clearAllMocks()
      vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-DBE1')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ users: [] }) }))
    }
  })
})

// ── orders upsert fails ───────────────────────────────────────────────────────

describe('orders upsert DB error', () => {
  function buildFromMock() {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValueOnce(makeIdem())
    m.mockReturnValueOnce(profilesLookup(false))
    m.mockReturnValueOnce(upsertOk())     // profiles ok
    m.mockReturnValueOnce(upsertFail())   // orders fails
    m.mockReturnValue(eventUpdate())      // error log
    return m
  }

  it('returns 400 so GetCourse retries', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeClient(buildFromMock()) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest(validParams()))
    expect(res.status).toBe(400)
  })

  it('returns 400 consistently across 20 runs', async () => {
    for (let run = 0; run < 20; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeClient(buildFromMock()) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const res = await POST(makeRequest(validParams({ order_id: `ord-of-${run}` })))
      expect(res.status, `run ${run}`).toBe(400)
      vi.clearAllMocks()
      vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-DBE1')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ users: [] }) }))
    }
  })
})

// ── enrollments upsert fails ──────────────────────────────────────────────────

describe('enrollments upsert DB error', () => {
  function buildFromMock() {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValueOnce(makeIdem())
    m.mockReturnValueOnce(profilesLookup(false))
    m.mockReturnValueOnce(upsertOk())    // profiles ok
    m.mockReturnValueOnce(upsertOk())    // orders ok
    m.mockReturnValueOnce(upsertFail())  // enrollments FAILS
    m.mockReturnValue(eventUpdate())     // error log
    return m
  }

  it('returns 400 so GetCourse retries — user is NOT silently un-enrolled', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeClient(buildFromMock()) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest(validParams()))
    expect(res.status).toBe(400)
  })

  it('does not mark webhook_events.processed_at when enrollment failed', async () => {
    const fromMock = buildFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeClient(fromMock) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest(validParams()))
    // The update that sets processed_at has no error field — error update sets error field.
    // Verify that the only update call has an error value (not processed_at).
    const updateFn = fromMock.mock.results.find(r => r.value?.update)?.value?.update as ReturnType<typeof vi.fn> | undefined
    expect(updateFn).toBeDefined()
    const updateArg = updateFn?.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    expect(updateArg).not.toHaveProperty('processed_at')
    expect(updateArg).toHaveProperty('error')
  })

  it('returns 400 consistently across 20 runs', async () => {
    for (let run = 0; run < 20; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeClient(buildFromMock()) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const res = await POST(makeRequest(validParams({ order_id: `ord-ef-${run}` })))
      expect(res.status, `run ${run}`).toBe(400)
      vi.clearAllMocks()
      vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-DBE1')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ users: [] }) }))
    }
  })
})

// ── Retry-after-partial-failure: auth user exists, profile does not ───────────

describe('retry after createUser "already registered" (profiles upsert previously failed)', () => {
  const RECOVERED_USER_ID = 'user-recovered-from-auth'

  function buildFromMock() {
    const m = vi.fn()
    m.mockReturnValueOnce(webhookInsert())
    m.mockReturnValueOnce(makeIdem())
    m.mockReturnValueOnce(profilesLookup(false))  // still no profile
    m.mockReturnValueOnce(upsertOk())   // profiles upsert now succeeds
    m.mockReturnValueOnce(upsertOk())   // orders
    m.mockReturnValueOnce(upsertOk())   // enrollments
    m.mockReturnValueOnce(eventUpdate()) // processed_at
    return m
  }

  function makeAlreadyRegisteredClient() {
    const fromMock = buildFromMock()
    return {
      from: fromMock,
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'User already registered', status: 422 },
          }),
        },
      },
    }
  }

  beforeEach(() => {
    // GoTrue admin REST API returns the existing auth user
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [{ id: RECOVERED_USER_ID, email: 'student@example.com' }],
      }),
    }))
  })

  it('recovers userId from GoTrue API and returns 200', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAlreadyRegisteredClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const res = await POST(makeRequest(validParams()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('calls GoTrue admin users endpoint with the correct email filter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ users: [{ id: RECOVERED_USER_ID, email: 'student@example.com' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAlreadyRegisteredClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    await POST(makeRequest(validParams()))

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('student%40example.com'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }),
      })
    )
  })

  it('returns 400 if GoTrue lookup also fails (auth in truly broken state)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ users: [] }), // no match
    }))

    const fromMock = vi.fn()
    fromMock.mockReturnValueOnce(webhookInsert())
    fromMock.mockReturnValueOnce(makeIdem())
    fromMock.mockReturnValueOnce(profilesLookup(false))
    fromMock.mockReturnValue(eventUpdate())

    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: fromMock,
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'User already registered', status: 422 },
          }),
        },
      },
    } as unknown as ReturnType<typeof createSupabaseAdminClient>)

    const res = await POST(makeRequest(validParams()))
    expect(res.status).toBe(400)
  })

  it('enrolls successfully across 20 retries', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ users: [{ id: RECOVERED_USER_ID, email: 'student@example.com' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    for (let run = 0; run < 20; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeAlreadyRegisteredClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
      )
      const res = await POST(makeRequest(validParams({ order_id: `ord-retry-${run}` })))
      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })
      vi.clearAllMocks()
      vi.mocked(generateTempPassword).mockReturnValue('Test-Pass-DBE1')
      vi.stubGlobal('fetch', mockFetch)
    }
  })
})
