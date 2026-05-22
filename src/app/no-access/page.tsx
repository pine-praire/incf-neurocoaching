import Link from 'next/link'

export default function NoAccessPage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#ece9e2',
      display: 'grid', placeItems: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--surface)', borderRadius: 20,
        border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)',
        padding: '40px 36px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600,
          color: 'var(--ink)', margin: '0 0 16px', letterSpacing: '-0.02em',
        }}>Доступ не найден</h1>

        <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 8px' }}>
          Мы не нашли активного доступа для этого аккаунта.
        </p>

        <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 28px' }}>
          Проверьте, что вы вошли с email, который использовали при покупке.
          Если доступ должен быть открыт — напишите в поддержку.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <a
            href="https://t.me/incf_team"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 24px', borderRadius: 999,
              background: '#29A8E0', color: '#fff',
              textDecoration: 'none', fontFamily: 'var(--font-body)',
              fontSize: 14, fontWeight: 600,
            }}
          >
            Написать в поддержку
          </a>
          <Link
            href="/login"
            style={{
              fontSize: 13, color: 'var(--ink-mute)',
              textDecoration: 'none', marginTop: 4,
            }}
          >
            Войти с другим email →
          </Link>
        </div>
      </div>
    </div>
  )
}
