'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NOT_ENROLLED_MSG =
  'Этот адрес не найден в системе. Убедитесь, что вы покупали курс именно на этот email.'
const WRONG_PASSWORD_MSG =
  'Неверный пароль. Попробуйте ещё раз или воспользуйтесь восстановлением доступа.'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      const checkRes = await fetch('/api/auth/check-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const checkJson = await checkRes.json().catch(() => ({}))
      setError(checkJson.enrolled === false ? NOT_ENROLLED_MSG : WRONG_PASSWORD_MSG)
      setLoading(false)
      return
    }

    router.push('/roadmap')
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotError(null)
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const json = await res.json().catch(() => ({}))
    setForgotLoading(false)
    if (json.notEnrolled) {
      setForgotError(NOT_ENROLLED_MSG)
      return
    }
    setForgotSent(true)
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

        {forgotMode ? (
          forgotSent ? (
            <div style={{
              padding: '20px 16px', background: 'var(--sage-tint)',
              border: '1px solid var(--sage-soft)', borderRadius: 12, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
              <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, margin: '0 0 6px' }}>
                Письмо отправлено
              </p>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 14px' }}>
                Если этот адрес зарегистрирован, вы получите письмо со ссылкой для сброса пароля.
              </p>
              <button onClick={() => { setForgotMode(false); setForgotSent(false) }} style={linkButtonStyle}>
                Вернуться к входу
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
                Введите email, с которым вы покупали курс. Мы пришлём ссылку для установки нового пароля.
              </p>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="твой@email.com" required
                style={inputStyle}
              />
              {forgotError && <p style={errorStyle}>{forgotError}</p>}
              <button type="submit" disabled={forgotLoading} style={submitStyle(forgotLoading)}>
                {forgotLoading ? 'Отправляем...' : 'Восстановить доступ'}
              </button>
              <button type="button" onClick={() => setForgotMode(false)} style={linkButtonStyle}>
                Вернуться к входу
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="твой@email.com" required
              style={inputStyle}
            />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Пароль" required
              style={inputStyle}
            />
            {error && (
              <p style={errorStyle}>{error}</p>
            )}
            <button type="submit" disabled={loading} style={submitStyle(loading)}>
              {loading ? 'Входим...' : 'Войти'}
            </button>
            <button type="button" onClick={() => { setForgotMode(true); setError(null) }} style={linkButtonStyle}>
              Забыли пароль? Восстановить доступ
            </button>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', textAlign: 'center', margin: 0 }}>
            Доступ к платформе предоставляется после покупки курса.
          </p>
          <a
            href="https://incf.eu/vvedenie"
            target="_blank"
            rel="noopener noreferrer"
            style={buyButtonStyle}
          >
            Купить «Введение в нейрокоучинг»
          </a>
        </div>
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
  fontSize: 12.5, color: 'var(--terra-2)', margin: 0, lineHeight: 1.5,
}

const submitStyle = (loading: boolean): React.CSSProperties => ({
  background: 'var(--terra-2)', color: '#fff',
  border: 'none', borderRadius: 999,
  padding: '11px 16px', fontWeight: 600, fontSize: 14,
  fontFamily: 'var(--font-body)', cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.7 : 1,
  boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)',
})

const linkButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0,
  color: 'var(--terra-2)', fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'center',
}

const buyButtonStyle: React.CSSProperties = {
  display: 'block', textAlign: 'center',
  background: 'transparent', color: 'var(--terra-2)',
  border: '1.5px solid var(--terra-2)', borderRadius: 999,
  padding: '10px 16px', fontWeight: 600, fontSize: 13,
  fontFamily: 'var(--font-body)', textDecoration: 'none',
  cursor: 'pointer',
}
