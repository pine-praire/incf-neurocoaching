import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendCertificateEmail } from '@/lib/brevo'

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.BREVO_API_KEY
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function stubFetch(ok: boolean, status = 200, body = '') {
  const mock = vi.fn().mockResolvedValue({ ok, status, text: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', mock)
  return mock
}

const fakePdf = Buffer.from('fake-pdf-content')
const issuedAt = '2025-01-15T10:00:00Z'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('sendCertificateEmail', () => {
  it('throws when BREVO_API_KEY is absent', async () => {
    await expect(
      sendCertificateEmail('user@example.com', 'Анна Иванова', 42, issuedAt, fakePdf)
    ).rejects.toThrow('Missing BREVO_API_KEY')
  })

  it('POSTs to the correct Brevo endpoint', async () => {
    process.env.BREVO_API_KEY = 'key-abc'
    const fetchMock = stubFetch(true)

    await sendCertificateEmail('user@example.com', 'Анна Иванова', 42, issuedAt, fakePdf)

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
  })

  it('sends correct headers and body', async () => {
    process.env.BREVO_API_KEY = 'key-xyz'
    const fetchMock = stubFetch(true)

    await sendCertificateEmail('student@incf.eu', 'Мария Петрова', 7, issuedAt, fakePdf)

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    expect(opts.method).toBe('POST')
    expect(headers['api-key']).toBe('key-xyz')
    expect(headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(opts.body as string)
    expect(body.to).toEqual([{ email: 'student@incf.eu' }])
    expect(body.subject).toContain('7')
    expect(body.sender.email).toBe('noreply@incf.eu')
  })

  it('attaches the PDF as base64', async () => {
    process.env.BREVO_API_KEY = 'key-xyz'
    const fetchMock = stubFetch(true)

    await sendCertificateEmail('user@example.com', 'Анна', 1, issuedAt, fakePdf)

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.attachment).toHaveLength(1)
    expect(body.attachment[0].content).toBe(fakePdf.toString('base64'))
    expect(body.attachment[0].name).toContain('1')
  })

  it('throws with status and response text on non-2xx response', async () => {
    process.env.BREVO_API_KEY = 'key-xyz'
    stubFetch(false, 401, '{"message":"Invalid API key"}')

    await expect(
      sendCertificateEmail('u@example.com', 'Test', 1, issuedAt, fakePdf)
    ).rejects.toThrow('Brevo API error 401')
  })

  it('resolves to undefined on success', async () => {
    process.env.BREVO_API_KEY = 'key-xyz'
    stubFetch(true)

    const result = await sendCertificateEmail('u@example.com', 'Test', 1, issuedAt, fakePdf)
    expect(result).toBeUndefined()
  })

  it('succeeds consistently across 50 calls', async () => {
    process.env.BREVO_API_KEY = 'stable-key'
    stubFetch(true)

    for (let i = 0; i < 50; i++) {
      await expect(
        sendCertificateEmail(`user${i}@example.com`, 'Test User', i + 1, issuedAt, fakePdf)
      ).resolves.toBeUndefined()
    }
  })
})
