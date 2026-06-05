const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('Missing BREVO_API_KEY')

  const body = {
    sender: { name: 'INCF', email: 'noreply@incf.eu' },
    to: [{ email }],
    subject: 'Ваша ссылка для входа на платформу INCF',
    textContent: `Здравствуйте!\n\nВот ваша ссылка для входа на платформу INCF Нейрокоучинг:\n\n${magicLink}\n\nСсылка одноразовая и действует 1 час.\n\nЕсли вы не запрашивали эту ссылку — просто проигнорируйте письмо.`,
  }

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Brevo API error ${res.status}: ${text}`)
  }
}
