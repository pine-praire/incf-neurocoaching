'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, X, ChevronRight, Loader2 } from 'lucide-react'
import { loadDailyQuest, checkQuestAnswer } from './quest-actions'
import type { DailyQuest } from './quest-actions'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyQuestCardProps {
  /** Comma-joined lesson IDs ordered by LESSONS array — stable, re-fetches only when completion changes. */
  completedKey: string
  /** First lesson not yet started, shown in empty-state CTA. */
  firstUnlockedLessonId: string | null
  onStartLesson: (lessonId: string) => void
}

type Phase = 'loading' | 'empty' | 'load-error' | 'active' | 'done'

interface StepAnswer {
  pickedOptionId: string
  correct: boolean
  correctOptionId: string
  explanation: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const QUIZ_SIZE = 5

function scoreLabel(n: number): string {
  if (n === 5) return 'Отлично — весь материал усвоен!'
  if (n === 4) return 'Уверенно — один неверный ответ спишем на случайность.'
  if (n === 3) return 'Хороший старт. Загляните в конспект.'
  if (n === 2) return 'Пробелы есть — стоит пересмотреть урок.'
  return 'Вернитесь к уроку перед следующим.'
}

const emptyAnswers = (): (StepAnswer | null)[] =>
  Array.from({ length: QUIZ_SIZE }, () => null)

// ── Component ─────────────────────────────────────────────────────────────────

export function DailyQuestCard({
  completedKey,
  firstUnlockedLessonId,
  onStartLesson,
}: DailyQuestCardProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [quest, setQuest] = useState<DailyQuest | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [answers, setAnswers] = useState<(StepAnswer | null)[]>(emptyAnswers)
  const [checking, setChecking] = useState(false)
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null)
  const [checkFailed, setCheckFailed] = useState(false)

  const questionRef = useRef<HTMLParagraphElement>(null)
  const nextBtnRef = useRef<HTMLButtonElement>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    setPhase('loading')
    setStepIdx(0)
    setAnswers(emptyAnswers())
    setCheckFailed(false)
    const ids = completedKey ? completedKey.split(',') : []
    loadDailyQuest(ids)
      .then((q) => { setQuest(q); setPhase(q ? 'active' : 'empty') })
      .catch(() => setPhase('load-error'))
  }, [completedKey])

  // ── Focus: "Дальше" after answer ──────────────────────────────────────────

  useEffect(() => {
    if (answers[stepIdx] !== null) nextBtnRef.current?.focus()
  }, [answers, stepIdx])

  // ── Focus: question heading on step advance ────────────────────────────────

  useEffect(() => {
    if (phase === 'active') questionRef.current?.focus()
  }, [stepIdx, phase])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const pick = async (optionId: string) => {
    if (!quest || answers[stepIdx] !== null || checking) return
    setPendingOptionId(optionId)
    setChecking(true)
    setCheckFailed(false)
    try {
      const res = await checkQuestAnswer(quest.questions[stepIdx].id, optionId)
      if (!res.ok) { setCheckFailed(true); return }
      setAnswers((prev) => {
        const next = [...prev]
        next[stepIdx] = {
          pickedOptionId: optionId,
          correct: res.correct,
          correctOptionId: res.correctOptionId,
          explanation: res.explanation,
        }
        return next
      })
    } finally {
      setChecking(false)
      setPendingOptionId(null)
    }
  }

  const advance = () => {
    setCheckFailed(false)
    if (stepIdx < QUIZ_SIZE - 1) setStepIdx((s) => s + 1)
    else setPhase('done')
  }

  const retryLoad = () => {
    setPhase('loading')
    const ids = completedKey ? completedKey.split(',') : []
    loadDailyQuest(ids)
      .then((q) => { setQuest(q); setPhase(q ? 'active' : 'empty') })
      .catch(() => setPhase('load-error'))
  }

  // ── Render: loading ────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ink-mute)' }} />
        <span style={{ fontSize: 12.5, color: 'var(--ink-mute)', fontFamily: 'var(--font-body)' }}>
          Загружаем квест…
        </span>
      </div>
    )
  }

  // ── Render: empty ──────────────────────────────────────────────────────────

  if (phase === 'empty') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--ink)', fontFamily: 'var(--font-display)', margin: 0, lineHeight: 1.45 }}>
          Пройдите первый урок —<br />квест дня откроется после него.
        </p>
        {firstUnlockedLessonId !== null && (
          <button
            onClick={() => onStartLesson(firstUnlockedLessonId)}
            style={{
              padding: '9px 20px', borderRadius: 999,
              background: 'var(--terra-2)', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: '0 8px 18px -10px rgba(181,82,58,.7)',
            }}
          >
            Начать первый урок <ChevronRight size={14} />
          </button>
        )}
      </div>
    )
  }

  // ── Render: load error ─────────────────────────────────────────────────────

  if (phase === 'load-error') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--terra-2)', margin: 0, fontFamily: 'var(--font-body)' }}>
          Не удалось загрузить квест.
        </p>
        <button
          onClick={retryLoad}
          style={{
            fontSize: 12.5, color: 'var(--terra-2)', background: 'none',
            border: '1px solid var(--terra-soft)', borderRadius: 8,
            padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600,
          }}
        >
          Повторить
        </button>
      </div>
    )
  }

  // TypeScript guard — quest is non-null in active/done phases
  if (quest === null) return null

  // ── Render: done ───────────────────────────────────────────────────────────

  if (phase === 'done') {
    const score = answers.filter((a) => a?.correct === true).length
    const nextId = quest.nextLessonId
    const nextTitle = quest.nextLessonTitle

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
        {/* All-filled progress bar */}
        <div style={{ display: 'flex', gap: 4 }}>
          {answers.map((a, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: a?.correct ? 'var(--sage-2)' : 'var(--terra-2)',
            }} />
          ))}
        </div>

        {/* Score */}
        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 48, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--ink)' }}>
              {score}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-mute)', letterSpacing: '-0.02em' }}>
              из {QUIZ_SIZE}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'var(--font-body)', margin: '4px 0 0', lineHeight: 1.5 }}>
            {scoreLabel(score)}
          </p>
        </div>

        {/* Next lesson card or completion note */}
        <div style={{ marginTop: 'auto' }}>
          {nextId !== null && nextTitle !== null ? (
            <div style={{
              padding: '13px 16px', borderRadius: 12,
              background: 'var(--bg)', border: '1px solid rgba(43,38,32,.1)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                  А теперь
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 500,
                  color: 'var(--ink)', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {nextTitle}
                </div>
              </div>
              <button
                onClick={() => onStartLesson(nextId)}
                style={{
                  flexShrink: 0, padding: '9px 16px', borderRadius: 999,
                  background: 'var(--terra-2)', color: '#fff', border: 'none',
                  fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                  boxShadow: '0 8px 18px -10px rgba(181,82,58,.7)', whiteSpace: 'nowrap',
                }}
              >
                Начать урок <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <div style={{
              padding: '13px 16px', borderRadius: 12,
              background: 'var(--gold-tint)', border: '1px solid var(--gold-soft)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-body)', margin: 0, lineHeight: 1.5 }}>
                Все уроки курса пройдены — переходите к финальному тесту.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render: active question ────────────────────────────────────────────────

  const question = quest.questions[stepIdx]
  const currentAnswer = answers[stepIdx]
  const isAnswered = currentAnswer !== null

  return (
    <>
      <style>{`
        .quest-option:focus-visible {
          outline: 2px solid var(--terra-2);
          outline-offset: 2px;
          border-radius: 4px;
        }
        .quest-next:focus-visible {
          outline: 2px solid var(--terra-2);
          outline-offset: 2px;
          border-radius: 999px;
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {Array.from({ length: QUIZ_SIZE }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background:
                i < stepIdx
                  ? answers[i]?.correct ? 'var(--sage-2)' : 'var(--terra-2)'
                  : i === stepIdx ? 'var(--gold-2)'
                  : 'rgba(43,38,32,.12)',
              transition: 'background .2s',
            }} />
          ))}
        </div>

        {/* Lesson label + step chip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{
            fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'var(--ink-mute)', fontFamily: 'var(--font-body)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%',
          }}>
            {quest.lessonTitle}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--gold-2)', background: 'var(--gold-tint)',
            padding: '2px 8px', borderRadius: 4, letterSpacing: '.04em', flexShrink: 0,
          }}>
            {stepIdx + 1}&thinsp;/&thinsp;{QUIZ_SIZE}
          </span>
        </div>

        {/* Question */}
        <p
          ref={questionRef}
          tabIndex={-1}
          aria-label={`Вопрос ${stepIdx + 1} из ${QUIZ_SIZE}${isAnswered ? (currentAnswer.correct ? ', отвечен верно' : ', отвечен неверно') : ''}`}
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 17,
            lineHeight: 1.3, letterSpacing: '-0.015em', color: 'var(--ink)',
            margin: 0, outline: 'none',
          }}
        >
          {question.question}
        </p>

        {/* Options */}
        <div
          role="group"
          aria-label={`Варианты ответа для вопроса ${stepIdx + 1}`}
          style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}
        >
          {question.options.map((opt, i) => {
            const isPicked = currentAnswer?.pickedOptionId === opt.id
            const isPending = pendingOptionId === opt.id && checking
            const isCorrect = isAnswered && opt.id === currentAnswer.correctOptionId
            const isWrong = isAnswered && isPicked && !currentAnswer.correct

            const markBg = isCorrect ? 'var(--sage-2)' : isWrong ? 'var(--terra-2)' : 'transparent'
            const markBorder = isCorrect || isWrong ? 'none' : '1.5px solid rgba(43,38,32,.3)'
            const markColor = isCorrect || isWrong ? '#fff' : 'var(--ink-soft)'
            const textColor = !isAnswered ? 'var(--ink)'
              : isCorrect ? 'var(--sage-2)'
              : isWrong ? 'var(--terra-2)'
              : 'var(--ink-mute)'

            return (
              <button
                key={opt.id}
                className="quest-option"
                onClick={() => pick(opt.id)}
                disabled={isAnswered || checking}
                aria-pressed={isPicked}
                style={{
                  textAlign: 'left', padding: '9px 4px',
                  background: 'transparent', border: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(43,38,32,.09)',
                  fontSize: 13.5, color: textColor, fontFamily: 'var(--font-body)',
                  display: 'grid', gridTemplateColumns: '26px 1fr',
                  alignItems: 'start', gap: 10,
                  cursor: isAnswered ? 'default' : 'pointer',
                  transition: 'color .15s',
                  opacity: isAnswered && !isCorrect && !isPicked ? 0.45 : 1,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 999, flexShrink: 0, marginTop: 1,
                  border: markBorder, background: markBg, color: markColor,
                  display: 'grid', placeItems: 'center',
                }}>
                  {isPending
                    ? <Loader2 size={12} className="animate-spin" />
                    : isCorrect ? <Check size={12} strokeWidth={3} />
                    : isWrong  ? <X     size={12} strokeWidth={3} />
                    : <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                  }
                </span>
                <span style={{ lineHeight: 1.4 }}>{opt.text}</span>
              </button>
            )
          })}
        </div>

        {/* Feedback — aria-live region */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ marginTop: 'auto', paddingTop: 8 }}
        >
          {checkFailed && !isAnswered && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--terra-tint)', border: '1px solid var(--terra-soft)',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 12.5, color: 'var(--terra-2)', fontFamily: 'var(--font-body)' }}>
                Не удалось проверить ответ.
              </span>
              <button
                onClick={() => setCheckFailed(false)}
                style={{
                  fontSize: 12, color: 'var(--terra-2)', background: 'none', border: 'none',
                  fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: 600,
                  padding: '2px 8px', flexShrink: 0,
                }}
              >
                Повторить
              </button>
            </div>
          )}

          {isAnswered && (
            <div style={{
              display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,248,239,.7)',
              borderLeft: `3px solid ${currentAnswer.correct ? 'var(--sage-2)' : 'var(--terra-2)'}`,
            }}>
              <span style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3,
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                letterSpacing: '.07em', textTransform: 'uppercase',
                color: currentAnswer.correct ? 'var(--sage-2)' : 'var(--terra-2)',
              }}>
                {currentAnswer.correct
                  ? <Check size={12} strokeWidth={3} />
                  : <X     size={12} strokeWidth={3} />}
                {currentAnswer.correct ? 'Верно' : 'Мимо'}
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
                {currentAnswer.explanation}
              </span>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          {!isAnswered && !checkFailed
            ? <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
                Подсказок нет.
              </span>
            : <span />
          }
          <button
            ref={nextBtnRef}
            className="quest-next"
            onClick={advance}
            disabled={!isAnswered}
            style={{
              padding: '8px 18px', borderRadius: 999,
              background: isAnswered ? 'var(--ink)' : 'transparent',
              color: isAnswered ? 'var(--bg)' : 'rgba(43,38,32,.28)',
              border: isAnswered ? 'none' : '1px solid rgba(43,38,32,.2)',
              fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font-body)',
              cursor: isAnswered ? 'pointer' : 'not-allowed',
              transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {stepIdx === QUIZ_SIZE - 1 ? 'Завершить' : 'Дальше'}
            {isAnswered && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </>
  )
}
