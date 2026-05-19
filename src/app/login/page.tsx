'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'register' | 'magic'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) setError(error.message)
      else setSent(true)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Неверный email или пароль')
      else window.location.href = '/roadmap'
    }
    setLoading(false)
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/roadmap` },
    })
  }

  const handleApple = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/roadmap` },
    })
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
    fontFamily: 'var(--font-body)', cursor: 'pointer', border: 'none',
    borderRadius: 8, transition: 'background .15s',
    background: active ? 'var(--terra-2)' : 'transparent',
    color: active ? '#fff' : 'var(--ink-soft)',
  })

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
              {mode === 'register' ? 'Подтверди email' : 'Письмо отправлено'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
              Проверь {email} — там ссылка для входа.
            </p>
          </div>
        ) : (
          <>
            {/* Social buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleGoogle} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: '#fff', color: 'var(--ink)',
                border: '1px solid var(--line)', borderRadius: 10,
                padding: '11px 16px', fontWeight: 600, fontSize: 14,
                fontFamily: 'var(--font-body)', cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                  <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                </svg>
                Войти через Google
              </button>

              <button onClick={handleApple} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'var(--ink)', color: '#fff',
                border: 'none', borderRadius: 10,
                padding: '11px 16px', fontWeight: 600, fontSize: 14,
                fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}>
                <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.4-57.8-155.5-127.4C46 790.9 0 663.8 0 541.8c0-194.3 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
                </svg>
                Войти через Apple
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>или</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>

            {/* Mode tabs */}
            <div style={{
              display: 'flex', gap: 4, padding: 4,
              background: 'var(--bg-deep)', borderRadius: 10,
            }}>
              <button style={btnStyle(mode === 'login')} onClick={() => { setMode('login'); setError(null) }}>Войти</button>
              <button style={btnStyle(mode === 'register')} onClick={() => { setMode('register'); setError(null) }}>Регистрация</button>
              <button style={btnStyle(mode === 'magic')} onClick={() => { setMode('magic'); setError(null) }}>Без пароля</button>
            </div>

            {/* Form */}
            {mode === 'magic' ? (
              <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="твой@email.com" required
                  style={inputStyle}
                />
                {error && <p style={errorStyle}>{error}</p>}
                <button type="submit" disabled={loading} style={submitStyle(loading)}>
                  {loading ? 'Отправляем...' : 'Получить ссылку на почту'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleEmailPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {mode === 'register' && (
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Твоё имя" required
                    style={inputStyle}
                  />
                )}
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="твой@email.com" required
                  style={inputStyle}
                />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Придумай пароль (мин. 6 символов)' : 'Пароль'}
                  required minLength={6}
                  style={inputStyle}
                />
                {error && <p style={errorStyle}>{error}</p>}
                <button type="submit" disabled={loading} style={submitStyle(loading)}>
                  {loading ? '...' : mode === 'register' ? 'Создать аккаунт' : 'Войти'}
                </button>
              </form>
            )}
          </>
        )}

        <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', textAlign: 'center', margin: 0 }}>
          Входя, ты принимаешь условия использования INCF
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
