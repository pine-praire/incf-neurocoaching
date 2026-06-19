'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NOT_ENROLLED_MSG =
  'Этот адрес не найден в системе. Убедитесь, что вы покупали курс именно на этот email.'
const WRONG_PASSWORD_MSG =
  'Неверный пароль. Попробуйте ещё раз или воспользуйтесь восстановлением доступа.'

const EyeIcon = ({ open }: { open: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<'email' | 'password' | null>(null)

  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setErrorField(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      const checkRes = await fetch('/api/auth/check-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const checkJson = await checkRes.json().catch(() => ({}))
      if (checkJson.enrolled === false) {
        setError(NOT_ENROLLED_MSG)
        setErrorField('email')
      } else {
        setError(WRONG_PASSWORD_MSG)
        setErrorField('password')
      }
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
      minHeight: '100vh', background: '#f2ede8',
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
          <img src="/incf-logo.png" alt="INCF" style={{ width: 80, height: 80, objectFit: 'contain' }} />
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
                placeholder="ваш@email.com" required
                style={inputStyle}
              />
              {forgotError && (
                <div style={errorBannerStyle}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{forgotError}</p>
                </div>
              )}
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
              type="email" value={email} onChange={e => { setEmail(e.target.value); setError(null); setErrorField(null) }}
              placeholder="ваш@email.com" required
              style={{ ...inputStyle, ...(errorField === 'email' ? errorBorderStyle : {}) }}
            />
            <div style={fieldWrapStyle}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => { setPassword(e.target.value); setError(null); setErrorField(null) }}
                placeholder="Пароль" required
                style={{ ...inputStyle, paddingRight: 42, ...(errorField === 'password' ? errorBorderStyle : {}) }}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} style={eyeStyle} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {error && (
              <div style={errorBannerStyle}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading} style={submitStyle(loading)}>
              {loading ? 'Входим...' : 'Войти'}
            </button>
            <button type="button" onClick={() => { setForgotMode(true); setError(null); setErrorField(null) }} style={linkButtonStyle}>
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

const fieldWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
}

const eyeStyle: React.CSSProperties = {
  position: 'absolute', right: 12,
  background: 'none', border: 'none', padding: 0,
  cursor: 'pointer', color: 'var(--ink-soft)',
  display: 'flex', alignItems: 'center',
  lineHeight: 1,
}

const inputStyle: React.CSSProperties = {
  padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-body)',
  color: 'var(--ink)', background: '#f2ede8',
  border: '1px solid var(--line)', borderRadius: 10,
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

const errorBorderStyle: React.CSSProperties = {
  border: '1.5px solid var(--terra-2)',
}

const errorBannerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: '12px 14px',
  background: '#fff3f0',
  border: '1px solid var(--terra-soft)',
  borderRadius: 10,
  color: 'var(--terra-2)',
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
