const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('Missing BREVO_API_KEY')

  const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#ece9e2;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ece9e2;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;padding:40px 36px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="width:48px;height:48px;border-radius:12px;background:#b45032;display:inline-flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-size:22px;font-weight:700;">i</span>
          </div>
          <h1 style="margin:16px 0 4px;font-size:20px;color:#1a1a1a;">Введение в нейрокоучинг</h1>
          <p style="margin:0;font-size:13px;color:#888;">Трёхдневный блиц-курс INCF</p>
        </td></tr>
        <tr><td style="padding-bottom:28px;font-size:15px;color:#333;line-height:1.6;">
          Здравствуйте!<br><br>
          Вы запросили ссылку для входа на платформу. Нажмите кнопку ниже:
        </td></tr>
        <tr><td align="center" style="padding-bottom:28px;">
          <a href="${magicLink}" style="display:inline-block;background:#b45032;color:#fff;text-decoration:none;padding:14px 32px;border-radius:999px;font-size:15px;font-weight:600;">
            Войти на платформу
          </a>
        </td></tr>
        <tr><td style="font-size:12px;color:#aaa;line-height:1.6;">
          Ссылка одноразовая и действует 1 час.<br>
          Если вы не запрашивали вход — просто проигнорируйте это письмо.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const body = {
    sender: { name: 'INCF Нейрокоучинг', email: 'noreply@incf.eu' },
    to: [{ email }],
    subject: 'Ваша ссылка для входа на платформу INCF',
    htmlContent,
    textContent: `Здравствуйте!\n\nВойти на платформу: ${magicLink}\n\nСсылка одноразовая и действует 1 час.\n\nЕсли вы не запрашивали вход — просто проигнорируйте это письмо.`,
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
