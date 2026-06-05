'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth/resend-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Ошибка отправки. Попробуйте ещё раз.')
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#ece9e2',
      display: 'grid', placeItems: 'center',
      padding: '24px', fontFamily: 'var(--font-body)',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)', borderRadius: 18,
        boxShadow: 'var(--shadow-lg)', padding: '36px 32px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--terra-2)', color: '#fff',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
          }}>i</div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600,
            color: 'var(--ink)', margin: 0, textAlign: 'center',
          }}>Введение в нейрокоучинг</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, textAlign: 'center' }}>
            Трёхдневный блиц-курс INCF
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: '20px 16px', background: 'var(--sage-tint)',
            border: '1px solid var(--sage-soft)', borderRadius: 12, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
            <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, margin: '0 0 6px' }}>
              Проверьте почту
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
              Мы отправили ссылку для входа на {email}
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="твой@email.com" required
                style={inputStyle}
              />
              {error && <p style={errorStyle}>{error}</p>}
              <button type="submit" disabled={loading} style={submitStyle(loading)}>
                {loading ? 'Отправляем...' : 'Получить ссылку для входа'}
              </button>
            </form>
          </>
        )}

        <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', textAlign: 'center', margin: 0 }}>
          Доступ к платформе предоставляется после покупки курса.
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-body)',
  color: 'var(--ink)', background: 'var(--bg-deep)',
  border: '1px solid var(--line)', borderRadius: 10,
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

const errorStyle: React.CSSProperties = {
  fontSize: 12.5, color: 'var(--terra-2)', margin: 0,
}

const submitStyle = (loading: boolean): React.CSSProperties => ({
  background: 'var(--terra-2)', color: '#fff',
  border: 'none', borderRadius: 999,
  padding: '11px 16px', fontWeight: 600, fontSize: 14,
  fontFamily: 'var(--font-body)', cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.7 : 1,
  boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)',
})
