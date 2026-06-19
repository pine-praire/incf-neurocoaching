// @vitest-environment node
/**
 * Tests for "silent failure" paths — requests that fail BEFORE the
 * webhook_events INSERT and therefore leave no trace in the database.
 *
 * If we see "no entry in webhook_events for email X", the root cause
 * is always one of the scenarios covered here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ generateTempPassword: vi.fn(() => 'Test-Pass-1234') }))
vi.mock('@/lib/brevo', () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined), sendAlreadyEnrolledEmail: vi.fn().mockResolvedValue(undefined) }))

import { POST } from '@/app/api/getcourse/purchase-webhook/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const SECRET = 'test-webhook-secret'

function buildMinimalFromMock() {
  const insertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'ev-1' }, error: null }),
    }),
  })
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  })
  const m = vi.fn()
  m.mockReturnValueOnce({ insert: insertMock })
  m.mockReturnValue({ update: updateMock })
  return { from: m, insertMock }
}

function validFormBody(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    email: 'meta.verkyt@gmail.com',
    order_id: 'ord-001',
    offer_id: '5410171',
    payment_status: 'Завершен',
    ...overrides,
  }).toString()
}

function makeFormRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/getcourse/purchase-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-getcourse-secret': SECRET,
      ...headers,
    },
    body,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GETCOURSE_WEBHOOK_SECRET = SECRET
  process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
})

// ── Silent failure: wrong secret ──────────────────────────────────────────────

describe('silent failure: secret mismatch (nothing logged)', () => {
  it('returns 401 and does NOT call supabase when secret is wrong', async () => {
    const client = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const req = makeFormRequest(validFormBody(), { 'x-getcourse-secret': 'wrong-secret' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('secret with trailing newline: HTTP trims header → auth PASSES (not 401)', async () => {
    const client = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const req = makeFormRequest(validFormBody(), { 'x-getcourse-secret': `${SECRET}\n` })
    const res = await POST(req)
    expect(res.status).not.toBe(401)
    expect(client.from).toHaveBeenCalled()
  })

  it('secret with leading/trailing spaces: HTTP trims header → auth PASSES (not 401)', async () => {
    const client = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const req = makeFormRequest(validFormBody(), { 'x-getcourse-secret': ` ${SECRET} ` })
    const res = await POST(req)
    expect(res.status).not.toBe(401)
    expect(client.from).toHaveBeenCalled()
  })

  it('returns 401 for empty secret header', async () => {
    const client = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const req = makeFormRequest(validFormBody(), { 'x-getcourse-secret': '' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('returns 401 for absent secret header', async () => {
    const client = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const req = new Request('http://localhost/api/getcourse/purchase-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: validFormBody(),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(client.from).not.toHaveBeenCalled()
  })
})

// ── Silent failure: malformed body ────────────────────────────────────────────

describe('silent failure: malformed body (nothing logged)', () => {
  it('returns 400 and does NOT log when JSON body is malformed', async () => {
    const client = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const req = new Request('http://localhost/api/getcourse/purchase-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-getcourse-secret': SECRET,
      },
      body: '{ invalid json :::',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(client.from).not.toHaveBeenCalled()
  })
})

// ── Logged failures: valid secret + valid body ────────────────────────────────

describe('logged failure: valid secret, valid body, bad payload data', () => {
  it('logs to webhook_events even when email is missing', async () => {
    const client = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const req = makeFormRequest(validFormBody({ email: '' }))
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(client.from).toHaveBeenCalled()
  })

  it('logs to webhook_events even when offer_id and product_id are unknown', async () => {
    const client = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const req = makeFormRequest(validFormBody({ offer_id: 'unknown-999' }))
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(client.from).toHaveBeenCalled()
  })
})

// ── Diagnostic summary ────────────────────────────────────────────────────────

describe('diagnostic summary', () => {
  it('no webhook_events entry = 401 (secret mismatch) or 400 (malformed body)', async () => {
    const client1 = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client1 as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const r1 = await POST(makeFormRequest(validFormBody(), { 'x-getcourse-secret': 'bad' }))
    expect(r1.status).toBe(401)
    expect(client1.from).not.toHaveBeenCalled()

    vi.clearAllMocks()

    const client2 = buildMinimalFromMock()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client2 as unknown as ReturnType<typeof createSupabaseAdminClient>
    )
    const r2 = await POST(new Request('http://localhost/api/getcourse/purchase-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-getcourse-secret': SECRET },
      body: 'NOT_JSON',
    }))
    expect(r2.status).toBe(400)
    expect(client2.from).not.toHaveBeenCalled()
  })
})
