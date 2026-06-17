// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/certificate-pdf', () => ({
  generateCertificatePDF: vi.fn().mockResolvedValue(Buffer.from('PDF-CONTENT')),
}))

import { GET } from '@/app/api/certificate/[certNumber]/route'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateCertificatePDF } from '@/lib/certificate-pdf'

const USER_ID = 'user-abc-123'
const CERT_NUMBER = 42

function makeParams(certNumber: string | number): Promise<{ certNumber: string }> {
  return Promise.resolve({ certNumber: String(certNumber) })
}

function makeReq() {
  return new Request('http://localhost/api/certificate/42')
}

function makeAuthClient(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  }
}

function makeAdminClient(cert: Record<string, unknown> | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: cert, error: null }),
        }),
      }),
    }),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/certificate/[certNumber] — async params (Next.js 15)', () => {
  it('params is a Promise and is correctly awaited to extract certNumber', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(USER_ID) as never)
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAdminClient({ name: 'Анна', cert_number: CERT_NUMBER, issued_at: '2025-01-01', user_id: USER_ID }) as never
    )

    const res = await GET(makeReq(), { params: makeParams(CERT_NUMBER) })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(vi.mocked(generateCertificatePDF)).toHaveBeenCalledWith('Анна', CERT_NUMBER, '2025-01-01')
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null) as never)

    const res = await GET(makeReq(), { params: makeParams(CERT_NUMBER) })

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 400 for non-numeric certNumber', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(USER_ID) as never)
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAdminClient(null) as never
    )

    const res = await GET(makeReq(), { params: makeParams('not-a-number') })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid' })
  })

  it('returns 404 when certificate does not exist', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(USER_ID) as never)
    vi.mocked(createSupabaseAdminClient).mockReturnValue(makeAdminClient(null) as never)

    const res = await GET(makeReq(), { params: makeParams(CERT_NUMBER) })

    expect(res.status).toBe(404)
  })

  it('returns 404 when certificate belongs to a different user', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(USER_ID) as never)
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAdminClient({ name: 'Другой', cert_number: CERT_NUMBER, issued_at: '2025-01-01', user_id: 'other-user' }) as never
    )

    const res = await GET(makeReq(), { params: makeParams(CERT_NUMBER) })

    expect(res.status).toBe(404)
  })

  it('Content-Disposition header includes the cert number', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(USER_ID) as never)
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAdminClient({ name: 'Анна', cert_number: CERT_NUMBER, issued_at: '2025-01-01', user_id: USER_ID }) as never
    )

    const res = await GET(makeReq(), { params: makeParams(CERT_NUMBER) })

    expect(res.headers.get('Content-Disposition')).toContain(`INCF-certificate-${CERT_NUMBER}.pdf`)
  })
})
