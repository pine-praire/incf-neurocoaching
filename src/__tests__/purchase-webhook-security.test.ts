// @vitest-environment node
// Tests for S-6 (idempotency) and S-7 edge cases (timing-safe comparison)
// for purchase-webhook. S-9 config guard is also here.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/brevo', () => ({ sendMagicLinkEmail: vi.fn() }))

import { POST } from '@/app/api/getcourse/purchase-webhook/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendMagicLinkEmail } from '@/lib/brevo'

// ── Constants ─────────────────────────────────────────────────────────────────

const SECRET = 'purchase-sec-secret-z'  // 21 chars
const VALID_OFFER_ID = '5410171'
const MAGIC_LINK = 'https://platform.incf.eu/auth/callback?token=xyz'

// ── Mock factories ────────────────────────────────────────────────────────────

// S-6: mock for the duplicate order path.
// Sequence: insert event log → idempotency check returns existing event → early return.
// No profiles/orders/enrollments calls happen.
function buildDuplicateFromMock() {
  const m = vi.fn()

  // 1. webhook_events insert
  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ev-dup' }, error: null }),
      }),
    }),
  })

  // 2. webhook_events idempotency check → existing event found
  const idem: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'ev-prev' }, error: null }), // found!
  }
  idem.select = vi.fn().mockReturnValue(idem)
  idem.eq    = vi.fn().mockReturnValue(idem)
  idem.is    = vi.fn().mockReturnValue(idem)
  idem.not   = vi.fn().mockReturnValue(idem)
  m.mockReturnValueOnce(idem)

  return m
}

// Full happy-path mock (same as in purchase-webhook.test.ts but self-contained here).
function buildHappyFromMock({ profileExists = false } = {}) {
  const m = vi.fn()

  m.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ev-1' }, error: null }),
      }),
    }),
  })

  // idempotency → not found
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
        maybeSingle: vi.fn().mockResolvedValue(
          profileExists
            ? { data: { id: 'user-ex' }, error: null }
            : { data: null, error: null }
        ),
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

function makeClient(fromMock: ReturnType<typeof vi.fn>) {
  return {
    from: fromMock,
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-new' } }, error: null }),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { action_link: MAGIC_LINK } }, error: null,
        }),
      },
    },
  }
}

function makeRequest(
  body: Record<string, unknown>,
  secret = SECRET,
  contentType = 'application/json',
) {
  return new Request('http://localhost/api/getcourse/purchase-webhook', {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'x-getcourse-secret': secret },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'student@example.com',
    order_id: 'ord-001',
    offer_id: VALID_OFFER_ID,
    payment_status: 'paid',
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

// ── S-6: idempotency ──────────────────────────────────────────────────────────

describe('S-6 — idempotency', () => {
  it('returns { ok: true } immediately when order_id already processed — 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeClient(buildDuplicateFromMock()) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )

      const res = await POST(makeRequest(validBody({ order_id: `ord-dup-${run}` })))
      expect(res.status, `run ${run}`).toBe(200)
      expect(await res.json(), `run ${run}`).toEqual({ ok: true })

      vi.clearAllMocks()
      vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined)
    }
  })

  it('does not send email for duplicate order — 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        makeClient(buildDuplicateFromMock()) as unknown as ReturnType<typeof createSupabaseAdminClient>
      )

      await POST(makeRequest(validBody({ order_id: `ord-nomail-${run}` })))

      expect(sendMagicLinkEmail, `run ${run}: must not send to duplicate order`).not.toHaveBeenCalled()

      vi.clearAllMocks()
    }
  })

  it('does not call createUser for duplicate order — 30 runs', async () => {
    for (let run = 0; run < 30; run++) {
      const client = makeClient(buildDuplicateFromMock())
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        client as unknown as ReturnType<typeof createSupabaseAdminClient>
      )

      await POST(makeRequest(validBody({ order_id: `ord-nouser-${run}` })))

      expect(client.auth.admin.createUser, `run ${run}`).not.toHaveBeenCalled()

      vi.clearAllMocks()
    }
  })

  it('processes a new order normally (idempotency check passes)', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeClient(buildHappyFromMock()) as unknown as ReturnType<typeof createSupabaseAdminClient>
    )

    const res = await POST(makeRequest(validBody({ order_id: 'ord-new' })))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(sendMagicLinkEmail).toHaveBeenCalledOnce()
  })
})

// ── S-7: timing-safe comparison edge cases (purchase-webhook) ─────────────────

describe('S-7 — timing-safe comparison (purchase-webhook)', () => {
  it('returns 401 for secret shorter than expected — 30 runs', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await POST(makeRequest(validBody(), SECRET.slice(0, SECRET.length - 3)))
      expect(res.status, `run ${i}`).toBe(401)
    }
  })

  it('returns 401 for secret longer than expected — 30 runs', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await POST(makeRequest(validBody(), SECRET + 'extra'))
      expect(res.status, `run ${i}`).toBe(401)
    }
  })

  it('returns 401 for same-length wrong secret — 30 runs', async () => {
    const wrongSameLen = 'Z'.repeat(SECRET.length)
    for (let i = 0; i < 30; i++) {
      const res = await POST(makeRequest(validBody(), wrongSameLen))
      expect(res.status, `run ${i}`).toBe(401)
    }
  })

  it('returns 401 when secret header is absent — 30 runs', async () => {
    for (let i = 0; i < 30; i++) {
      const req = new Request('http://localhost/api/getcourse/purchase-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody()),
      })
      expect((await POST(req)).status, `run ${i}`).toBe(401)
    }
  })

  it('returns 401 for empty string secret — 30 runs', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await POST(makeRequest(validBody(), ''))
      expect(res.status, `run ${i}`).toBe(401)
    }
  })
})

// ── S-9: next.config.mjs does not suppress build checks ──────────────────────

describe('S-9 — ignoreBuildErrors / ignoreDuringBuilds removed', () => {
  it('next.config.mjs does not contain ignoreBuildErrors', () => {
    const configPath = resolve(process.cwd(), 'next.config.mjs')
    const src = readFileSync(configPath, 'utf8')
    expect(src).not.toContain('ignoreBuildErrors')
  })

  it('next.config.mjs does not contain ignoreDuringBuilds', () => {
    const configPath = resolve(process.cwd(), 'next.config.mjs')
    const src = readFileSync(configPath, 'utf8')
    expect(src).not.toContain('ignoreDuringBuilds')
  })
})
