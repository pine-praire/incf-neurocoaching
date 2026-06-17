'use client'
import { useState } from 'react'

export default function PaymentSuccessPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    const res = await fetch('/api/auth/resend-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()

    if (!res.ok) {
      setStatus('error')
      setMessage(data.error ?? 'Не удалось отправить ссылку')
      return
    }

    setStatus('success')
    setMessage('Если доступ активен, ссылка для входа отправлена на email.')
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-deep)',
      display: 'grid', placeItems: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--surface)', borderRadius: 20,
        border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)',
        padding: '40px 36px',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'var(--terra-2)', color: '#fff',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20,
          marginBottom: 24,
        }}>i</div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600,
          color: 'var(--ink)', margin: '0 0 12px', letterSpacing: '-0.02em',
        }}>Оплата прошла успешно</h1>

        <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 8px' }}>
          Мы открываем доступ к платформе и отправляем ссылку для входа на email,
          который был указан при покупке.
        </p>

        <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 28px' }}>
          Если письмо не пришло в течение нескольких минут — проверьте папку «Спам»
          или отправьте ссылку повторно ниже.
        </p>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
          <label style={{
            display: 'block', fontSize: 12, fontWeight: 600,
            color: 'var(--ink)', letterSpacing: '.08em',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            Email, указанный при покупке
          </label>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid var(--line)', borderRadius: 10,
                fontFamily: 'var(--font-body)', fontSize: 14,
                color: 'var(--ink)', background: 'var(--bg)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                padding: '11px 20px', borderRadius: 999,
                background: 'var(--terra-2)', color: '#fff',
                border: 'none', fontFamily: 'var(--font-body)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                opacity: status === 'loading' ? 0.7 : 1,
              }}
            >
              {status === 'loading' ? 'Отправляем...' : 'Отправить ссылку для входа'}
            </button>
          </form>

          {message && (
            <p style={{
              marginTop: 12, fontSize: 13,
              color: status === 'error' ? 'var(--terra-2)' : 'var(--sage-2)',
              lineHeight: 1.5,
            }}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
