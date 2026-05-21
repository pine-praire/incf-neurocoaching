'use client'
import { useState, useEffect } from 'react'
import { FINAL_TEST_QUESTIONS } from '@/lib/final-test-data'
import { saveCertificateName } from '@/app/actions/progress'

interface Props {
  onClose: () => void
  onPass: () => void
}

const NAME_RE = /^[A-Za-z\s-]+$/

export function FinalTestModal({ onClose, onPass }: Props) {
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<'quiz' | 'result'>('quiz')
  const [certName, setCertName] = useState('')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const q = FINAL_TEST_QUESTIONS[currentQ]
  const total = FINAL_TEST_QUESTIONS.length

  function handleSelect(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    if (idx === q.correct) setScore(s => s + 1)
  }

  function handleNext() {
    if (currentQ < total - 1) {
      setCurrentQ(c => c + 1)
      setSelected(null)
    } else {
      setPhase('result')
    }
  }

  function handleRetry() {
    setCurrentQ(0)
    setSelected(null)
    setScore(0)
    setPhase('quiz')
    setCertName('')
    setNameError('')
  }

  async function handleCertificate() {
    const name = certName.trim()
    if (!name) { setNameError('Введите имя'); return }
    if (!NAME_RE.test(name)) { setNameError('Только латинские буквы, пробел и дефис'); return }
    setNameError('')
    setSaving(true)
    await saveCertificateName(name)
    setSaving(false)
    onPass()
  }

  const passed = score >= 8

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Итоговый тест"
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,18,16,.55)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 680, maxHeight: '92vh', background: 'var(--surface)', borderRadius: 18, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--terra-2)' }}>
            {phase === 'quiz' ? `Вопрос ${currentQ + 1} из ${total}` : 'Результат'}
          </span>
          {phase === 'quiz' && (
            <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', marginLeft: 4 }}>
              <div style={{ height: '100%', width: `${((currentQ + (selected !== null ? 1 : 0)) / total) * 100}%`, background: 'var(--terra-2)', borderRadius: 999, transition: 'width .3s' }} />
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: 5, cursor: 'pointer', color: 'var(--ink-mute)', display: 'grid', placeItems: 'center', fontSize: 16 }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {phase === 'quiz' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.35 }}>
                {q.q}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {q.options.map((opt, idx) => {
                  const isSelected = selected === idx
                  const isCorrect = idx === q.correct
                  const answered = selected !== null

                  let bg = 'var(--surface)'
                  let border = '1.5px solid var(--line)'
                  let color = 'var(--ink)'

                  if (answered && isSelected && isCorrect) {
                    bg = 'oklch(0.94 0.06 145)'; border = '1.5px solid oklch(0.6 0.15 145)'; color = 'oklch(0.3 0.1 145)'
                  } else if (answered && isSelected && !isCorrect) {
                    bg = 'oklch(0.95 0.06 20)'; border = '1.5px solid oklch(0.6 0.15 20)'; color = 'oklch(0.35 0.12 20)'
                  } else if (answered && isCorrect) {
                    bg = 'oklch(0.94 0.06 145)'; border = '1.5px solid oklch(0.6 0.15 145)'; color = 'oklch(0.3 0.1 145)'
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(idx)}
                      disabled={answered}
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 16px',
                        background: bg, border, borderRadius: 12,
                        color, fontSize: 14, fontFamily: 'var(--font-body)',
                        cursor: answered ? 'default' : 'pointer',
                        transition: 'all .15s',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, border: `1.5px solid ${answered && isCorrect ? 'oklch(0.6 0.15 145)' : answered && isSelected ? 'oklch(0.6 0.15 20)' : 'var(--line)'}`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: answered && isSelected ? (isCorrect ? 'oklch(0.6 0.15 145)' : 'oklch(0.6 0.15 20)') : answered && isCorrect ? 'oklch(0.6 0.15 145)' : 'transparent', color: answered && (isSelected || isCorrect) ? '#fff' : 'var(--ink-mute)' }}>
                        {answered && isCorrect ? '✓' : answered && isSelected && !isCorrect ? '✕' : ['А', 'Б', 'В'][idx]}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>

              {selected !== null && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    onClick={handleNext}
                    style={{ background: 'var(--terra-2)', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 10, fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)' }}
                  >
                    {currentQ < total - 1 ? 'Дальше →' : 'Завершить →'}
                  </button>
                </div>
              )}
            </>
          )}

          {phase === 'result' && (
            <>
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{passed ? '🎉' : '📚'}</div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px' }}>
                  {passed ? 'Поздравляем! Вы прошли тест' : 'Почти!'}
                </h2>
                <p style={{ fontSize: 15, color: 'var(--ink-2)', margin: 0 }}>
                  Вы ответили правильно на <strong style={{ color: passed ? 'oklch(0.5 0.15 145)' : 'var(--terra-2)' }}>{score} из {total}</strong>
                </p>
                {!passed && (
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 6 }}>
                    Для прохождения нужно 8 и более.
                  </p>
                )}
              </div>

              {passed ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-deep)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-body)' }}>
                    Имя для сертификата
                  </label>
                  <input
                    type="text"
                    value={certName}
                    onChange={e => { setCertName(e.target.value); setNameError('') }}
                    placeholder="Ваше имя латиницей, например: Alexandra Boldina"
                    style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', border: `1.5px solid ${nameError ? 'oklch(0.6 0.15 20)' : 'var(--line)'}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
                  />
                  {nameError && <p style={{ fontSize: 12, color: 'oklch(0.5 0.15 20)', margin: 0 }}>{nameError}</p>}
                  <button
                    onClick={handleCertificate}
                    disabled={saving}
                    style={{ background: 'var(--terra-2)', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-body)', cursor: saving ? 'wait' : 'pointer', boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)', opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? 'Сохраняем...' : '🎓 Получить сертификат'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    onClick={handleRetry}
                    style={{ background: 'var(--terra-2)', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 10, fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)' }}
                  >
                    Попробовать ещё раз
                  </button>
                  <button
                    onClick={onClose}
                    style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                  >
                    Закрыть
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
