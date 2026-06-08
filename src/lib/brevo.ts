const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

export async function sendCertificateEmail(
  email: string,
  name: string,
  certNumber: number,
  issuedAt: string,
  pdfBuffer: Buffer,
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('Missing BREVO_API_KEY')

  const date = new Date(issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://incf-neurocoaching.vercel.app'

  const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ece9e2;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ece9e2;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td align="center" style="background:#1c2233;padding:32px 40px 28px;">
          <div style="width:52px;height:52px;border-radius:12px;background:#c96442;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
            <span style="color:#fff;font-size:24px;font-weight:700;line-height:1;">i</span>
          </div>
          <div style="font-size:11px;letter-spacing:2px;color:#c96442;text-transform:uppercase;font-weight:700;margin-bottom:4px;">INCF</div>
          <div style="font-size:18px;color:#fff;font-weight:600;">Введение в нейрокоучинг</div>
        </td></tr>

        <!-- Congrats banner -->
        <tr><td style="background:#c96442;padding:18px 40px;text-align:center;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">🎓 Поздравляем, ${name}!</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px 0;">
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.7;">
            Вы успешно прошли курс <strong>«Введение в нейрокоучинг»</strong> и получаете официальный сертификат INCF.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.7;">
            Ваш сертификат <strong>№&nbsp;${certNumber}</strong> от ${date} прикреплён к этому письму в формате PDF.
          </p>

          <!-- Certificate number block -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f0;border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:6px;">Номер сертификата</div>
              <div style="font-size:22px;font-weight:700;color:#1c2233;font-family:monospace;letter-spacing:1px;">${certNumber}</div>
              <div style="font-size:12px;color:#888;margin-top:4px;">${date}</div>
            </td></tr>
          </table>

          <!-- Opportunities block -->
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1c2233;">Что открывается для вас дальше:</p>

          <!-- Discount -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:10px;margin-bottom:10px;">
            <tr><td style="padding:16px 20px;">
              <div style="display:flex;align-items:flex-start;gap:12px;">
                <span style="font-size:22px;line-height:1;">⚡</span>
                <div>
                  <div style="font-size:13px;font-weight:700;color:#1c2233;margin-bottom:4px;">Скидка 5% на курс L1</div>
                  <div style="font-size:13px;color:#666;line-height:1.5;">Используйте знания базового курса и продолжите обучение на полной программе нейрокоучинга.</div>
                  <a href="https://incf.eu" style="display:inline-block;margin-top:8px;font-size:12px;color:#c96442;font-weight:600;text-decoration:none;">Узнать о курсе L1 →</a>
                </div>
              </div>
            </td></tr>
          </table>

          <!-- Diagnostic -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:10px;margin-bottom:10px;">
            <tr><td style="padding:16px 20px;">
              <div>
                <span style="font-size:22px;line-height:1;">📅</span>
                <div style="display:inline-block;vertical-align:top;margin-left:12px;width:calc(100% - 42px);">
                  <div style="font-size:13px;font-weight:700;color:#1c2233;margin-bottom:4px;">Бесплатная диагностика 30 минут</div>
                  <div style="font-size:13px;color:#666;line-height:1.5;">Разберём вашу точку А, составим план из 3 шагов для входа в профессию нейрокоуча.</div>
                  <a href="https://t.me/incf_team" style="display:inline-block;margin-top:8px;font-size:12px;color:#c96442;font-weight:600;text-decoration:none;">Записаться в Telegram →</a>
                </div>
              </div>
            </td></tr>
          </table>

          <!-- Community -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4de;border-radius:10px;margin-bottom:28px;">
            <tr><td style="padding:16px 20px;">
              <div>
                <span style="font-size:22px;line-height:1;">💬</span>
                <div style="display:inline-block;vertical-align:top;margin-left:12px;width:calc(100% - 42px);">
                  <div style="font-size:13px;font-weight:700;color:#1c2233;margin-bottom:4px;">Сообщество и поддержка</div>
                  <div style="font-size:13px;color:#666;line-height:1.5;">Задайте вопрос, получите обратную связь от команды INCF.</div>
                  <a href="https://t.me/incf_team" style="display:inline-block;margin-top:8px;font-size:12px;color:#c96442;font-weight:600;text-decoration:none;">Написать нам →</a>
                </div>
              </div>
            </td></tr>
          </table>

          <!-- Access reminder -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f5;border:1px solid #f5d8cc;border-radius:10px;margin-bottom:32px;">
            <tr><td style="padding:14px 20px;">
              <p style="margin:0;font-size:13px;color:#7a3a22;line-height:1.6;">
                <strong>Напоминание:</strong> доступ к курсу открыт в течение <strong>1 года</strong> с момента покупки. Вы можете пересматривать уроки и выполнять задания в любое время.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:0 40px 36px;">
          <a href="${siteUrl}/roadmap" style="display:inline-block;background:#c96442;color:#fff;text-decoration:none;padding:14px 36px;border-radius:999px;font-size:15px;font-weight:600;">
            Вернуться на платформу
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f5f3f0;padding:20px 40px;border-top:1px solid #e8e4de;">
          <p style="margin:0;font-size:12px;color:#aaa;text-align:center;line-height:1.6;">
            INCF — International Neurological Coaching Federation<br>
            <a href="https://incf.eu" style="color:#aaa;">incf.eu</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const body = {
    sender: { name: 'INCF Нейрокоучинг', email: 'noreply@incf.eu' },
    to: [{ email }],
    subject: `🎓 Ваш сертификат INCF №${certNumber} — Введение в нейрокоучинг`,
    htmlContent,
    attachment: [{
      name: `INCF-certificate-${certNumber}.pdf`,
      content: pdfBuffer.toString('base64'),
    }],
  }

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Brevo API error ${res.status}: ${text}`)
  }
}

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
