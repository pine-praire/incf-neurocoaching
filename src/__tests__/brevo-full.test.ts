// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendWelcomeEmail,
  sendCertificateEmail,
} from '@/lib/brevo'

// ── Helpers ───────────────────────────────────────────────────────────────────

function stubFetch(ok: boolean, status = 200, body = '') {
  const mock = vi.fn().mockResolvedValue({ ok, status, text: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', mock)
  return mock
}

function getBody(mock: ReturnType<typeof vi.fn>) {
  const [, opts] = mock.mock.calls[0] as [string, RequestInit]
  return JSON.parse(opts.body as string)
}

function getHeaders(mock: ReturnType<typeof vi.fn>) {
  const [, opts] = mock.mock.calls[0] as [string, RequestInit]
  return opts.headers as Record<string, string>
}

function getUrl(mock: ReturnType<typeof vi.fn>) {
  return mock.mock.calls[0][0] as string
}

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const SENDER_EMAIL = 'noreply@incf.eu'
const SENDER_NAME = 'INCF Нейрокоучинг'
const FAKE_PDF = Buffer.from('fake-pdf')
const ISSUED_AT = '2025-03-01T10:00:00Z'

const HTTP_ERRORS = [400, 401, 403, 422, 429, 500, 502, 503] as const

beforeEach(() => { process.env.BREVO_API_KEY = 'test-key-123' })
afterEach(() => { vi.restoreAllMocks(); delete process.env.BREVO_API_KEY; delete process.env.NEXT_PUBLIC_SITE_URL })

// ══════════════════════════════════════════════════════════════════════════════
// sendPasswordResetEmail
// ══════════════════════════════════════════════════════════════════════════════

describe('sendPasswordResetEmail — auth', () => {
  it('throws Missing BREVO_API_KEY when env var absent', async () => {
    delete process.env.BREVO_API_KEY
    await expect(sendPasswordResetEmail('a@b.com', 'https://x.com/reset')).rejects.toThrow('Missing BREVO_API_KEY')
  })

  it('does not throw when api key is present', async () => {
    stubFetch(true)
    await expect(sendPasswordResetEmail('a@b.com', 'https://x.com/reset')).resolves.not.toThrow()
  })
})

describe('sendPasswordResetEmail — request', () => {
  it('POSTs to the Brevo SMTP endpoint', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/reset')
    expect(getUrl(m)).toBe(BREVO_URL)
  })

  it('uses POST method', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/reset')
    const [, opts] = m.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
  })

  it('sets Content-Type: application/json header', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/reset')
    expect(getHeaders(m)['Content-Type']).toBe('application/json')
  })

  it('sends api-key header with BREVO_API_KEY value', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/reset')
    expect(getHeaders(m)['api-key']).toBe('test-key-123')
  })

  it('body is valid JSON', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/reset')
    const [, opts] = m.mock.calls[0] as [string, RequestInit]
    expect(() => JSON.parse(opts.body as string)).not.toThrow()
  })
})

describe('sendPasswordResetEmail — payload', () => {
  it('sender email is noreply@incf.eu', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/reset')
    expect(getBody(m).sender.email).toBe(SENDER_EMAIL)
  })

  it('sender name is INCF Нейрокоучинг', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/reset')
    expect(getBody(m).sender.name).toBe(SENDER_NAME)
  })

  it.each(['user@example.com', 'student@incf.eu', 'test+tag@domain.org'])(
    'to field contains recipient "%s"', async (email) => {
      const m = stubFetch(true)
      await sendPasswordResetEmail(email, 'https://x.com/r')
      expect(getBody(m).to).toEqual([{ email }])
    }
  )

  it('subject mentions восстановление', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/reset')
    expect(getBody(m).subject.toLowerCase()).toMatch(/восстановление|пароль/)
  })

  it.each(['https://reset.example.com/r?token=abc', 'https://incf.eu/reset-password?code=xyz'])(
    'HTML body contains resetUrl "%s"', async (url) => {
      const m = stubFetch(true)
      await sendPasswordResetEmail('a@b.com', url)
      expect(getBody(m).htmlContent).toContain(url)
    }
  )

  it('HTML body contains login link', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/r')
    expect(getBody(m).htmlContent).toContain('/login')
  })

  it('htmlContent is a non-empty string', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/r')
    expect(typeof getBody(m).htmlContent).toBe('string')
    expect(getBody(m).htmlContent.length).toBeGreaterThan(100)
  })

  it('htmlContent contains DOCTYPE', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/r')
    expect(getBody(m).htmlContent).toContain('<!DOCTYPE html>')
  })
})

describe('sendPasswordResetEmail — errors & result', () => {
  it.each(HTTP_ERRORS)('throws on HTTP %i', async (status) => {
    stubFetch(false, status, `{"error":"fail"}`)
    await expect(sendPasswordResetEmail('a@b.com', 'https://x.com/r')).rejects.toThrow(`Brevo API error ${status}`)
  })

  it('resolves to undefined on success', async () => {
    stubFetch(true)
    const result = await sendPasswordResetEmail('a@b.com', 'https://x.com/r')
    expect(result).toBeUndefined()
  })

  it('calls fetch exactly once per invocation', async () => {
    const m = stubFetch(true)
    await sendPasswordResetEmail('a@b.com', 'https://x.com/r')
    expect(m).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// sendPasswordChangedEmail
// ══════════════════════════════════════════════════════════════════════════════

describe('sendPasswordChangedEmail — auth', () => {
  it('throws Missing BREVO_API_KEY when env var absent', async () => {
    delete process.env.BREVO_API_KEY
    await expect(sendPasswordChangedEmail('a@b.com')).rejects.toThrow('Missing BREVO_API_KEY')
  })

  it('does not throw when api key present', async () => {
    stubFetch(true)
    await expect(sendPasswordChangedEmail('a@b.com')).resolves.not.toThrow()
  })
})

describe('sendPasswordChangedEmail — request', () => {
  it('POSTs to Brevo SMTP endpoint', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getUrl(m)).toBe(BREVO_URL)
  })

  it('method is POST', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    const [, opts] = m.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
  })

  it('Content-Type header is application/json', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getHeaders(m)['Content-Type']).toBe('application/json')
  })

  it('api-key header matches BREVO_API_KEY', async () => {
    process.env.BREVO_API_KEY = 'changed-key-abc'
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getHeaders(m)['api-key']).toBe('changed-key-abc')
  })
})

describe('sendPasswordChangedEmail — payload', () => {
  it('sender email is noreply@incf.eu', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getBody(m).sender.email).toBe(SENDER_EMAIL)
  })

  it('sender name is INCF Нейрокоучинг', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getBody(m).sender.name).toBe(SENDER_NAME)
  })

  it.each(['alice@example.com', 'bob@incf.eu', 'student123@gmail.com'])(
    'to field contains "%s"', async (email) => {
      const m = stubFetch(true)
      await sendPasswordChangedEmail(email)
      expect(getBody(m).to).toEqual([{ email }])
    }
  )

  it('subject mentions пароль or изменён', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getBody(m).subject.toLowerCase()).toMatch(/пароль|изменён/)
  })

  it('HTML body contains Войти на платформу', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getBody(m).htmlContent).toContain('Войти на платформу')
  })

  it('HTML body mentions @incf_team', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getBody(m).htmlContent).toContain('@incf_team')
  })

  it('HTML body contains /login link', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getBody(m).htmlContent).toContain('/login')
  })

  it('htmlContent is a non-empty string', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    const html = getBody(m).htmlContent
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(100)
  })

  it('htmlContent contains DOCTYPE', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getBody(m).htmlContent).toContain('<!DOCTYPE html>')
  })

  it('htmlContent does not contain raw resetUrl placeholder', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(getBody(m).htmlContent).not.toContain('${resetUrl}')
  })
})

describe('sendPasswordChangedEmail — errors & result', () => {
  it.each(HTTP_ERRORS)('throws on HTTP %i', async (status) => {
    stubFetch(false, status, 'err')
    await expect(sendPasswordChangedEmail('a@b.com')).rejects.toThrow(`Brevo API error ${status}`)
  })

  it('resolves to undefined on success', async () => {
    stubFetch(true)
    expect(await sendPasswordChangedEmail('a@b.com')).toBeUndefined()
  })

  it('calls fetch exactly once', async () => {
    const m = stubFetch(true)
    await sendPasswordChangedEmail('a@b.com')
    expect(m).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// sendWelcomeEmail
// ══════════════════════════════════════════════════════════════════════════════

describe('sendWelcomeEmail — auth', () => {
  it('throws Missing BREVO_API_KEY when absent', async () => {
    delete process.env.BREVO_API_KEY
    await expect(sendWelcomeEmail('a@b.com', 'Pass-1234-Abc')).rejects.toThrow('Missing BREVO_API_KEY')
  })

  it('does not throw when api key present', async () => {
    stubFetch(true)
    await expect(sendWelcomeEmail('a@b.com', 'Pass-1234-Abc')).resolves.not.toThrow()
  })
})

describe('sendWelcomeEmail — request', () => {
  it('POSTs to Brevo SMTP endpoint', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getUrl(m)).toBe(BREVO_URL)
  })

  it('method is POST', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    const [, opts] = m.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
  })

  it('Content-Type is application/json', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getHeaders(m)['Content-Type']).toBe('application/json')
  })

  it('api-key header matches BREVO_API_KEY', async () => {
    process.env.BREVO_API_KEY = 'welcome-key-xyz'
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getHeaders(m)['api-key']).toBe('welcome-key-xyz')
  })

  it('body is valid JSON', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    const [, opts] = m.mock.calls[0] as [string, RequestInit]
    expect(() => JSON.parse(opts.body as string)).not.toThrow()
  })

  it('calls fetch exactly once', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(m).toHaveBeenCalledTimes(1)
  })
})

describe('sendWelcomeEmail — payload: sender & recipient', () => {
  it('sender email is noreply@incf.eu', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).sender.email).toBe(SENDER_EMAIL)
  })

  it('sender name is INCF Нейрокоучинг', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).sender.name).toBe(SENDER_NAME)
  })

  it.each(['new@example.com', 'student@incf.eu', 'learner+tag@domain.org'])(
    'to field contains recipient "%s"', async (email) => {
      const m = stubFetch(true)
      await sendWelcomeEmail(email, 'Pw-abcd-1234')
      expect(getBody(m).to).toEqual([{ email }])
    }
  )

  it('to array has exactly one element', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).to).toHaveLength(1)
  })
})

describe('sendWelcomeEmail — payload: subject', () => {
  it('subject mentions Добро пожаловать', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).subject).toContain('Добро пожаловать')
  })

  it('subject mentions INCF', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).subject).toContain('INCF')
  })

  it('subject mentions данные для входа or пароль', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).subject.toLowerCase()).toMatch(/данные|пароль/)
  })
})

describe('sendWelcomeEmail — payload: HTML content', () => {
  it('HTML contains the recipient email address', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('unique@example.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('unique@example.com')
  })

  it.each(['Pw-abcd-1234', 'XyZ9-MnPq-RsTu', 'aaaa-bbbb-cccc'])(
    'HTML contains the password "%s"', async (pw) => {
      const m = stubFetch(true)
      await sendWelcomeEmail('a@b.com', pw)
      expect(getBody(m).htmlContent).toContain(pw)
    }
  )

  it('HTML contains /login link', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('/login')
  })

  it('HTML contains /reset-password link', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://platform.incf.eu'
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('/reset-password')
  })

  it('HTML contains @incf_team', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('@incf_team')
  })

  it('HTML contains monospace font reference for password', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('monospace')
  })

  it('HTML contains Войти на платформу', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('Войти на платформу')
  })

  it('HTML contains INCF branding', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('INCF')
  })

  it('HTML contains DOCTYPE', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('<!DOCTYPE html>')
  })

  it('HTML is a non-empty string longer than 200 chars', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent.length).toBeGreaterThan(200)
  })

  it('uses siteUrl fallback when NEXT_PUBLIC_SITE_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('incf')
  })

  it('HTML contains siteUrl when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mysite.incf.eu'
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).toContain('mysite.incf.eu')
  })

  it('HTML does not contain raw ${password} template literal', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).not.toContain('${password}')
  })

  it('HTML does not contain raw ${email} template literal', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).not.toContain('${email}')
  })

  it('HTML does not contain raw ${siteUrl} template literal', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).htmlContent).not.toContain('${siteUrl}')
  })
})

describe('sendWelcomeEmail — errors & result', () => {
  it.each(HTTP_ERRORS)('throws on HTTP %i', async (status) => {
    stubFetch(false, status, 'error body')
    await expect(sendWelcomeEmail('a@b.com', 'Pw')).rejects.toThrow(`Brevo API error ${status}`)
  })

  it('resolves to undefined on success', async () => {
    stubFetch(true)
    expect(await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')).toBeUndefined()
  })

  it('no attachment field in body', async () => {
    const m = stubFetch(true)
    await sendWelcomeEmail('a@b.com', 'Pw-abcd-1234')
    expect(getBody(m).attachment).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// sendCertificateEmail
// ══════════════════════════════════════════════════════════════════════════════

describe('sendCertificateEmail — auth', () => {
  it('throws Missing BREVO_API_KEY when absent', async () => {
    delete process.env.BREVO_API_KEY
    await expect(sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)).rejects.toThrow('Missing BREVO_API_KEY')
  })
})

describe('sendCertificateEmail — request', () => {
  it('POSTs to Brevo SMTP endpoint', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getUrl(m)).toBe(BREVO_URL)
  })

  it('method is POST', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    const [, opts] = m.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
  })

  it('Content-Type is application/json', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getHeaders(m)['Content-Type']).toBe('application/json')
  })

  it('api-key header matches BREVO_API_KEY', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getHeaders(m)['api-key']).toBe('test-key-123')
  })
})

describe('sendCertificateEmail — payload', () => {
  it('sender email is noreply@incf.eu', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getBody(m).sender.email).toBe(SENDER_EMAIL)
  })

  it.each(['cert@example.com', 'grad@incf.eu'])(
    'to field contains "%s"', async (email) => {
      const m = stubFetch(true)
      await sendCertificateEmail(email, 'Name', 1, ISSUED_AT, FAKE_PDF)
      expect(getBody(m).to).toEqual([{ email }])
    }
  )

  it.each([1, 42, 999, 10000])(
    'subject contains cert number %i', async (n) => {
      const m = stubFetch(true)
      await sendCertificateEmail('a@b.com', 'Name', n, ISSUED_AT, FAKE_PDF)
      expect(getBody(m).subject).toContain(String(n))
    }
  )

  it('subject mentions сертификат or INCF', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getBody(m).subject.toLowerCase()).toMatch(/сертификат|incf/)
  })

  it('attachment array has exactly one item', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getBody(m).attachment).toHaveLength(1)
  })

  it('attachment content is base64 of the buffer', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getBody(m).attachment[0].content).toBe(FAKE_PDF.toString('base64'))
  })

  it.each([1, 42, 999])(
    'attachment filename contains cert number %i', async (n) => {
      const m = stubFetch(true)
      await sendCertificateEmail('a@b.com', 'Name', n, ISSUED_AT, FAKE_PDF)
      expect(getBody(m).attachment[0].name).toContain(String(n))
    }
  )

  it('attachment filename ends with .pdf', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getBody(m).attachment[0].name).toMatch(/\.pdf$/)
  })

  it.each(['Анна Иванова', 'Мария Петрова', 'John Doe'])(
    'HTML contains recipient name "%s"', async (name) => {
      const m = stubFetch(true)
      await sendCertificateEmail('a@b.com', name, 1, ISSUED_AT, FAKE_PDF)
      expect(getBody(m).htmlContent).toContain(name)
    }
  )

  it.each([7, 42, 1001])(
    'HTML contains cert number %i', async (n) => {
      const m = stubFetch(true)
      await sendCertificateEmail('a@b.com', 'Name', n, ISSUED_AT, FAKE_PDF)
      expect(getBody(m).htmlContent).toContain(String(n))
    }
  )

  it('HTML contains INCF branding', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getBody(m).htmlContent).toContain('INCF')
  })

  it('HTML contains DOCTYPE', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getBody(m).htmlContent).toContain('<!DOCTYPE html>')
  })

  it('HTML does not contain raw ${name} template literal', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getBody(m).htmlContent).not.toContain('${name}')
  })

  it('HTML does not contain raw ${certNumber} template literal', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(getBody(m).htmlContent).not.toContain('${certNumber}')
  })
})

describe('sendCertificateEmail — errors & result', () => {
  it.each(HTTP_ERRORS)('throws on HTTP %i', async (status) => {
    stubFetch(false, status, 'fail')
    await expect(sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)).rejects.toThrow(`Brevo API error ${status}`)
  })

  it('resolves to undefined on success', async () => {
    stubFetch(true)
    expect(await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)).toBeUndefined()
  })

  it('fetch is called with a string URL, not a Request object', async () => {
    const m = stubFetch(true)
    await sendCertificateEmail('a@b.com', 'Name', 1, ISSUED_AT, FAKE_PDF)
    expect(typeof m.mock.calls[0][0]).toBe('string')
  })

  it('succeeds across 20 consecutive calls', async () => {
    stubFetch(true)
    for (let i = 0; i < 20; i++) {
      await expect(sendCertificateEmail(`u${i}@x.com`, 'Name', i, ISSUED_AT, FAKE_PDF)).resolves.toBeUndefined()
    }
  })
})
