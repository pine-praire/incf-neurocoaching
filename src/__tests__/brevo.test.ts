import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendMagicLinkEmail } from '@/lib/brevo'

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('sendMagicLinkEmail', () => {
  it('throws when BREVO_API_KEY is absent', async () => {
    await expect(
      sendMagicLinkEmail('user@example.com', 'https://magic.link/token')
    ).rejects.toThrow('Missing BREVO_API_KEY')
  })

  it('POSTs to the correct Brevo endpoint', async () => {
    process.env.BREVO_API_KEY = 'key-abc'
    const fetchMock = stubFetch(true)

    await sendMagicLinkEmail('user@example.com', 'https://magic.link/token')

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
  })

  it('sends correct headers and body', async () => {
    process.env.BREVO_API_KEY = 'key-xyz'
    const fetchMock = stubFetch(true)

    await sendMagicLinkEmail('student@incf.eu', 'https://magic.link/tok')

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    expect(opts.method).toBe('POST')
    expect(headers['api-key']).toBe('key-xyz')
    expect(headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(opts.body as string)
    expect(body.to).toEqual([{ email: 'student@incf.eu' }])
    expect(body.subject).toContain('INCF')
    expect(body.textContent).toContain('https://magic.link/tok')
    expect(body.textContent).toContain('24 часа')
    expect(body.sender.email).toBe('noreply@incf.eu')
  })

  it('throws with status and response text on non-2xx response', async () => {
    process.env.BREVO_API_KEY = 'key-xyz'
    stubFetch(false, 401, '{"message":"Invalid API key"}')

    await expect(
      sendMagicLinkEmail('u@example.com', 'https://link')
    ).rejects.toThrow('Brevo API error 401')
  })

  it('resolves to undefined on success (returns nothing to caller)', async () => {
    process.env.BREVO_API_KEY = 'key-xyz'
    stubFetch(true)

    const result = await sendMagicLinkEmail('u@example.com', 'https://link')
    expect(result).toBeUndefined()
  })

  it('succeeds consistently across 50 calls with the same input', async () => {
    process.env.BREVO_API_KEY = 'stable-key'
    stubFetch(true)

    for (let i = 0; i < 50; i++) {
      await expect(
        sendMagicLinkEmail(`user${i}@example.com`, `https://magic.link/tok${i}`)
      ).resolves.toBeUndefined()
    }
  })
})
