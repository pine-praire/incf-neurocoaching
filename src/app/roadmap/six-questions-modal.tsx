'use client'

import { useState, useEffect } from 'react'

const QUESTIONS = [
  'Как бы вы описали основную задачу коучинга?',
  'Какой коучинговый вопрос вы бы задали себе прямо сейчас?',
  'Какие особенности коучингового образа мышления вы хотели бы развить в себе?',
  'Как бы вы описали профессионального коуча?',
  'Что ценного вы взяли для себя из урока с демо-сессиями?',
  'В какой сфере жизни вас может поддержать коучинг?',
]

export const SIX_ANSWER_KEYS = QUESTIONS.map((_, i) => `six_q${i + 1}`)

interface Props {
  initialAnswers: Record<string, string>
  alreadyDone: boolean
  onClose: () => void
  onSave: (answers: Record<string, string>) => Promise<void>
  onPass: () => void
}

export function SixQuestionsModal({ initialAnswers, alreadyDone, onClose, onSave, onPass }: Props) {
  const [values, setValues] = useState<string[]>(
    SIX_ANSWER_KEYS.map(k => initialAnswers[k] ?? '')
  )
  const [errors, setErrors] = useState<boolean[]>(new Array(6).fill(false))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSubmit() {
    const newErrors = values.map(v => v.trim().length === 0)
    setErrors(newErrors)
    if (newErrors.some(Boolean)) return

    setSaving(true)
    const answersMap = Object.fromEntries(SIX_ANSWER_KEYS.map((k, i) => [k, values[i]]))
    await onSave(answersMap)
    setSaving(false)
    onPass()
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="6 финальных вопросов"
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,18,16,.55)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 680, maxHeight: '92vh', background: 'var(--surface)', borderRadius: 18, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--terra-2)' }}>
            Финал · INCF
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-mute)', background: 'rgba(0,0,0,.04)', padding: '2px 7px', borderRadius: 4 }}>
            10 мин · +100 XP
          </span>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: 5, cursor: 'pointer', color: 'var(--ink-mute)', display: 'grid', placeItems: 'center', fontSize: 16 }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
              6 финальных вопросов
            </h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, margin: 0 }}>
              Рефлексия после курса — что осталось внутри. Все поля обязательны.
            </p>
          </div>

          {QUESTIONS.map((q, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 }}>
                {i + 1}. {q}
                <span style={{ color: 'var(--terra-2)', marginLeft: 3 }}>*</span>
              </label>
              <textarea
                value={values[i]}
                onChange={e => {
                  const next = [...values]; next[i] = e.target.value; setValues(next)
                  if (errors[i] && e.target.value.trim()) {
                    const ne = [...errors]; ne[i] = false; setErrors(ne)
                  }
                }}
                placeholder="Ваш ответ..."
                rows={3}
                style={{
                  width: '100%', resize: 'vertical', padding: '10px 12px',
                  fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--ink)',
                  background: 'var(--bg-deep)',
                  border: `1.5px solid ${errors[i] ? 'oklch(0.6 0.15 20)' : 'var(--line)'}`,
                  borderRadius: 10, outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
              />
              {errors[i] && (
                <p style={{ margin: 0, fontSize: 12, color: 'oklch(0.5 0.15 20)' }}>Обязательное поле</p>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4 }}>
            {!alreadyDone ? (
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--terra-2)', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-body)', cursor: saving ? 'wait' : 'pointer', boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Сохраняем...' : '✓ Отправить ответы · +100 XP'}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sage-2)', fontWeight: 600, fontSize: 13.5 }}>
                ✅ Ответы сохранены · +100 XP
              </div>
            )}
            <button
              onClick={onClose}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', padding: '10px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
