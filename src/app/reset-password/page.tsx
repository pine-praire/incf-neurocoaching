'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.')
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают.')
      return
    }

    setLoading(true)
    const { error: updateError } = await createClient().auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('Не удалось обновить пароль. Попробуйте запросить ссылку повторно.')
      return
    }

    setDone(true)
    fetch('/api/auth/password-changed-notify', { method: 'POST' }).catch(() => {})
    setTimeout(() => router.replace('/roadmap?session=start'), 2000)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-deep)',
      display: 'grid', placeItems: 'center',
      padding: '24px', fontFamily: 'var(--font-body)',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)', borderRadius: 18,
        boxShadow: 'var(--shadow-lg)', padding: '36px 32px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
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
          }}>Новый пароль</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, textAlign: 'center' }}>
            Введите пароль, которым будете пользоваться для входа
          </p>
        </div>

        {done ? (
          <div style={{
            padding: '20px 16px', background: 'var(--sage-tint)',
            border: '1px solid var(--sage-soft)', borderRadius: 12, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, margin: '0 0 6px' }}>
              Пароль обновлён
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
              Перенаправляем вас в курс...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {userEmail && (
              <p style={{
                fontSize: 13, color: 'var(--ink-soft)', margin: 0,
                padding: '9px 14px', background: 'var(--bg-deep)',
                border: '1px solid var(--line)', borderRadius: 10,
              }}>
                {userEmail}
              </p>
            )}
            <div style={fieldWrapStyle}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Новый пароль" required minLength={8}
                style={{ ...inputStyle, paddingRight: 42 }}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} style={eyeStyle} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>
                <EyeIcon open={showPassword} />
              </button>
            </div>
            <div style={fieldWrapStyle}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Повторите пароль" required
                style={{ ...inputStyle, paddingRight: 42 }}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} style={eyeStyle} aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'}>
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {error && <p style={errorStyle}>{error}</p>}
            <button type="submit" disabled={loading} style={submitStyle(loading)}>
              {loading ? 'Сохраняем...' : 'Сохранить пароль'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const fieldWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
}

const inputStyle: React.CSSProperties = {
  padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-body)',
  color: 'var(--ink)', background: 'var(--bg-deep)',
  border: '1px solid var(--line)', borderRadius: 10,
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

const eyeStyle: React.CSSProperties = {
  position: 'absolute', right: 12,
  background: 'none', border: 'none', padding: 0,
  cursor: 'pointer', color: 'var(--ink-soft)',
  display: 'flex', alignItems: 'center',
  lineHeight: 1,
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
