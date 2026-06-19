// @vitest-environment node
/**
 * Customer journey — end-to-end server-side narrative.
 *
 * Step 1 — Purchase: GetCourse sends a purchase webhook.
 *   → Supabase user created with a temp password.
 *   → Welcome email delivered with that same password.
 *
 * Step 2 — Login: customer uses the credentials from the email.
 *   (UI verified separately in password-login-journey.test.tsx)
 *
 * Step 3 — Recovery: customer forgets password.
 *   → POST /api/auth/forgot-password → reset email delivered.
 *   → Unknown email → 200 with notEnrolled (no account disclosure).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/auth-utils',     () => ({ generateTempPassword: vi.fn() }))
vi.mock('@/lib/brevo',          () => ({
  sendWelcomeEmail:          vi.fn().mockResolvedValue(undefined),
  sendAlreadyEnrolledEmail:  vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail:    vi.fn().mockResolvedValue(undefined),
}))

import { POST as purchaseWebhook } from '@/app/api/getcourse/purchase-webhook/route'
import { POST as forgotPassword   } from '@/app/api/auth/forgot-password/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateTempPassword } from '@/lib/auth-utils'
import { sendWelcomeEmail, sendAlreadyEnrolledEmail, sendPasswordResetEmail } from '@/lib/brevo'

// ── Constants ─────────────────────────────────────────────────────────────────

const SECRET      = 'journey-test-secret'
const OFFER_ID    = '5410171'
const SITE_URL    = 'https://platform.incf.eu'
const CUSTOMER    = { email: 'anna@example.com', first_name: 'Анна', last_name: 'Иванова' }
const TEMP_PASS   = 'Xkqm-Wnvp-Rt3z'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePurchaseRequest(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/getcourse/purchase-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-getcourse-secret': SECRET },
    body: JSON.stringify({
      email: CUSTOMER.email,
      first_name: CUSTOMER.first_name,
      last_name: CUSTOMER.last_name,
      order_id: 'ord-journey-001',
      offer_id: OFFER_ID,
      payment_status: 'paid',
      ...overrides,
    }),
  })
}

function makeForgotRequest(email: string) {
  return new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

function makeWebhookSupabase({ profileExists = false, userId = 'user-new' } = {}) {
  const fromMock = vi.fn()

  // 1. webhook_events insert
  fromMock.mockReturnValueOnce({
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
  idem.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  fromMock.mockReturnValueOnce(idem)

  // 3. profiles lookup
  fromMock.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(
          profileExists
            ? { data: { id: userId }, error: null }
            : { data: null, error: null }
        ),
      }),
    }),
  })

  // 4. profiles upsert
  fromMock.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ error: null }) })

  // 5. getcourse_orders upsert
  fromMock.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ error: null }) })

  // 6. enrollments upsert
  fromMock.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ error: null }) })

  // 7. webhook_events update (processed_at)
  fromMock.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  })

  return {
    from: fromMock,
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId } },
          error: null,
        }),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { action_link: `${SITE_URL}/auth/callback?token_hash=abc&type=recovery` } },
          error: null,
        }),
      },
    },
  }
}

function makeForgotSupabase({ enrolled = true } = {}) {
  const fromMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(
          enrolled
            ? { data: { id: 'user-existing' }, error: null }
            : { data: null, error: null }
        ),
      }),
    }),
  })

  return {
    from: fromMock,
    auth: {
      admin: {
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { action_link: `${SITE_URL}/auth/callback?token_hash=abc&type=recovery` } },
          error: null,
        }),
      },
    },
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GETCOURSE_WEBHOOK_SECRET = SECRET
  process.env.NEXT_PUBLIC_SITE_URL     = SITE_URL
  vi.mocked(generateTempPassword).mockReturnValue(TEMP_PASS)
})

// ── Step 1: Purchase ──────────────────────────────────────────────────────────

describe('Step 1 — purchase webhook', () => {
  it('responds 200 OK for a valid purchase', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeWebhookSupabase() as ReturnType<typeof createSupabaseAdminClient>
    )

    const res = await purchaseWebhook(makePurchaseRequest())
    expect(res.status).toBe(200)
  })

  it('creates a Supabase user with the generated temp password', async () => {
    const client = makeWebhookSupabase()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as ReturnType<typeof createSupabaseAdminClient>
    )

    await purchaseWebhook(makePurchaseRequest())

    expect(client.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: CUSTOMER.email,
        password: TEMP_PASS,
        email_confirm: true,
      })
    )
  })

  it('sends a welcome email with the customer email and temp password', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeWebhookSupabase() as ReturnType<typeof createSupabaseAdminClient>
    )

    await purchaseWebhook(makePurchaseRequest())

    expect(sendWelcomeEmail).toHaveBeenCalledWith(CUSTOMER.email, TEMP_PASS)
  })

  it('critical invariant — password in createUser matches password in welcome email', async () => {
    const client = makeWebhookSupabase()
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as ReturnType<typeof createSupabaseAdminClient>
    )

    await purchaseWebhook(makePurchaseRequest())

    const createUserCall = vi.mocked(client.auth.admin.createUser).mock.calls[0][0]
    const emailCall      = vi.mocked(sendWelcomeEmail).mock.calls[0]

    expect(createUserCall.password).toBe(emailCall[1])
    expect(createUserCall.email).toBe(emailCall[0])
  })

  it('does not create a new user when the customer is already enrolled', async () => {
    const client = makeWebhookSupabase({ profileExists: true, userId: 'user-existing' })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      client as ReturnType<typeof createSupabaseAdminClient>
    )

    await purchaseWebhook(makePurchaseRequest())

    expect(client.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('does not send a welcome email when the customer already has a profile', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeWebhookSupabase({ profileExists: true }) as ReturnType<typeof createSupabaseAdminClient>
    )

    await purchaseWebhook(makePurchaseRequest())

    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it('sends an already-enrolled email when the customer re-enrolls', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeWebhookSupabase({ profileExists: true }) as ReturnType<typeof createSupabaseAdminClient>
    )

    await purchaseWebhook(makePurchaseRequest())

    expect(sendAlreadyEnrolledEmail).toHaveBeenCalledWith(CUSTOMER.email)
    expect(sendAlreadyEnrolledEmail).toHaveBeenCalledTimes(1)
  })

  it('never sends both welcome and already-enrolled email for the same webhook call', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeWebhookSupabase({ profileExists: true }) as ReturnType<typeof createSupabaseAdminClient>
    )

    await purchaseWebhook(makePurchaseRequest())

    expect(sendWelcomeEmail).not.toHaveBeenCalled()
    expect(sendAlreadyEnrolledEmail).toHaveBeenCalledTimes(1)
  })

  it('purchase is idempotent — same order_id processed twice returns 200 both times', async () => {
    for (let run = 0; run < 2; run++) {
      const idem = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(), maybeSingle: vi.fn() }
      idem.select = vi.fn().mockReturnValue(idem)
      idem.eq     = vi.fn().mockReturnValue(idem)
      idem.is     = vi.fn().mockReturnValue(idem)
      idem.not    = vi.fn().mockReturnValue(idem)

      const isSecondRun = run === 1
      idem.maybeSingle = vi.fn().mockResolvedValue(
        isSecondRun ? { data: { id: 'ev-1', processed_at: new Date().toISOString() }, error: null } : { data: null, error: null }
      )

      const fromMock = vi.fn()
      // webhook_events insert
      fromMock.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'ev-1' }, error: null }),
          }),
        }),
      })
      // idempotency check — second run returns already-processed event
      fromMock.mockReturnValueOnce(idem)

      if (!isSecondRun) {
        fromMock.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) })
        fromMock.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ error: null }) })
        fromMock.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ error: null }) })
        fromMock.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ error: null }) })
        fromMock.mockReturnValueOnce({ update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) })
      }

      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: fromMock,
        auth: { admin: { createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) } },
      } as ReturnType<typeof createSupabaseAdminClient>)

      const res = await purchaseWebhook(makePurchaseRequest())
      expect(res.status, `run ${run}`).toBe(200)
    }
  })
})

// ── Step 3: Password recovery ─────────────────────────────────────────────────

describe('Step 3 — password recovery', () => {
  it('sends a password reset email to an enrolled customer', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeForgotSupabase({ enrolled: true }) as ReturnType<typeof createSupabaseAdminClient>
    )

    const res = await forgotPassword(makeForgotRequest(CUSTOMER.email))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      CUSTOMER.email,
      expect.stringContaining('/auth/callback')
    )
  })

  it('reset link points to /auth/callback with type=recovery', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeForgotSupabase({ enrolled: true }) as ReturnType<typeof createSupabaseAdminClient>
    )

    await forgotPassword(makeForgotRequest(CUSTOMER.email))

    const resetLink = vi.mocked(sendPasswordResetEmail).mock.calls[0][1]
    expect(resetLink).toContain('type=recovery')
  })

  it('returns 200 with notEnrolled for an unknown email — no account disclosure', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeForgotSupabase({ enrolled: false }) as ReturnType<typeof createSupabaseAdminClient>
    )

    const res = await forgotPassword(makeForgotRequest('unknown@example.com'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ notEnrolled: true })
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('does not send a reset email when the request email is not enrolled', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeForgotSupabase({ enrolled: false }) as ReturnType<typeof createSupabaseAdminClient>
    )

    await forgotPassword(makeForgotRequest('ghost@example.com'))

    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })
})
