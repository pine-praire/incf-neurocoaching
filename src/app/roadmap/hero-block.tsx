'use client'

import { useState } from 'react'
import { LESSONS } from '@/lib/course-data'

// ─── Placeholder questions (replace when copywriter delivers) ─────────────────

const PLACEHOLDER_QUESTIONS = [
  {
    q: 'Что в нейробиологии называют нейропластичностью?',
    options: [
      'Скорость передачи нервных импульсов',
      'Способность мозга перестраивать связи под действием опыта',
      'Особенности строения коры в зрелом возрасте',
    ],
    correct: 1,
    note: 'Нейропластичность — пожизненная способность мозга формировать новые связи в ответ на опыт и обучение.',
  },
  {
    q: 'Сколько дней в среднем требуется для закрепления новой привычки?',
    options: ['21 день', 'Около 66 дней', 'Ровно 100 дней'],
    correct: 1,
    note: 'Исследование Phillippa Lally (UCL, 2009) даёт медиану около 66 дней — цифра «21 день» давно опровергнута.',
  },
  {
    q: 'Какая область мозга отвечает за осознанный выбор и саморегуляцию?',
    options: ['Миндалевидное тело', 'Мозжечок', 'Префронтальная кора'],
    correct: 2,
    note: 'Префронтальная кора отвечает за планирование, торможение импульса и удержание цели.',
  },
  {
    q: 'Что сильнее всего укрепляет новую нейронную связь?',
    options: [
      'Однократная интенсивная практика',
      'Чтение теории без действия',
      'Повторение с эмоциональной вовлечённостью',
    ],
    correct: 2,
    note: 'Правило Хебба: нейроны, которые активируются вместе, связываются вместе. Эмоция усиливает закрепление.',
  },
  {
    q: 'Какой подход НЕ относится к нейрокоучингу?',
    options: [
      'Работа с автоматическими реакциями клиента',
      'Внушение в изменённом состоянии сознания',
      'Формирование новых поведенческих паттернов',
    ],
    correct: 1,
    note: 'Нейрокоучинг работает в осознанном диалоге и опирается на доказательные данные.',
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  q: string
  options: string[]
  correct: number
  note: string
}

interface HeroBlockProps {
  userName: string
  completed: Set<string>
  onOpenLesson: (lessonId: string) => void
}

// ─── Mini Quiz ────────────────────────────────────────────────────────────────

function MiniQuiz({ questions, nextLessonTitle, nextLessonId, onOpenLesson }: {
  questions: Question[]
  nextLessonTitle: string
  nextLessonId: string
  onOpenLesson: (id: string) => void
}) {
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const total = questions.length
  const q = questions[step]
  const answered = picked !== null
  const isCorrect = answered && picked === q.correct

  const pick = (i: number) => {
    if (answered) return
    setPicked(i)
    if (i === q.correct) setScore(s => s + 1)
  }

  const next = () => {
    if (step + 1 >= total) {
      setDone(true)
    } else {
      setStep(s => s + 1)
      setPicked(null)
    }
  }

  const restart = () => {
    setStep(0); setPicked(null); setScore(0); setDone(false)
  }

  const scoreNote = score >= 4
    ? 'Уверенно — материал закреплён.'
    : score >= 2
    ? 'Хорошее начало. Пробегитесь по конспекту перед следующим уроком.'
    : 'Видим пробелы — стоит вернуться к предыдущему уроку на пару минут.'

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{score}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-mute)' }}>из {total}</span>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', margin: '4px 0 0' }}>{scoreNote}</p>

        <div style={{ marginTop: 'auto', padding: '14px 16px', borderRadius: 12, background: 'var(--bg)', border: '1px solid rgba(43,38,32,.1)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--terra-tint)', color: 'var(--terra-2)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
            {String(LESSONS.findIndex(l => l.id === nextLessonId) + 1).padStart(2, '0')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Дальше</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextLessonTitle}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <button
              onClick={() => onOpenLesson(nextLessonId)}
              style={{ padding: '9px 18px', borderRadius: 999, background: 'var(--terra-2)', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: '0 8px 18px -10px rgba(181,82,58,.7)', whiteSpace: 'nowrap' }}>
              Начать урок →
            </button>
            <button onClick={restart} style={{ padding: '2px 8px', background: 'transparent', border: 'none', color: 'var(--ink-mute)', fontSize: 10.5, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              ↺ Пройти ещё раз
            </button>
          </div>
        </div>

        {/* Step bar */}
        <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: 'var(--terra-2)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Question */}
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, lineHeight: 1.25, letterSpacing: '-0.015em', color: 'var(--ink)', margin: 0, maxWidth: 540 }}>
        {q.q}
      </p>

      {/* Options */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
        {q.options.map((opt, i) => {
          const isAnswer = i === q.correct
          const isPicked = picked === i
          let bg = 'transparent'
          let color = 'var(--ink)'
          let markBg = 'transparent'
          let markColor = 'var(--ink-soft)'
          let markBorder = '1.5px solid rgba(43,38,32,.35)'

          if (answered) {
            if (isAnswer) {
              markBg = 'var(--sage-2)'; markColor = '#fff'; markBorder = 'none'
              color = 'var(--sage-2)'
            } else if (isPicked) {
              markBg = 'var(--terra-2)'; markColor = '#fff'; markBorder = 'none'
              color = 'var(--terra-2)'
            } else {
              color = 'var(--ink-mute)'
            }
          }

          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={answered}
              style={{
                textAlign: 'left', padding: '8px 4px',
                background: bg, border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid rgba(43,38,32,.1)',
                fontSize: 13.5, color, fontFamily: 'var(--font-body)',
                display: 'grid', gridTemplateColumns: '24px 1fr 18px',
                alignItems: 'center', gap: 12,
                cursor: answered ? 'default' : 'pointer',
                transition: 'color .15s',
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 999, border: markBorder, background: markBg, color: markColor, fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)' }}>
                {answered && isAnswer ? '✓' : answered && isPicked ? '×' : String.fromCharCode(65 + i)}
              </span>
              <span style={{ lineHeight: 1.35 }}>{opt}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>{answered && (isAnswer || isPicked) ? '→' : ''}</span>
            </button>
          )
        })}
      </div>

      {/* Feedback */}
      <div style={{ marginTop: 'auto', paddingTop: 10 }}>
        {answered && (
          <div style={{ display: 'flex', gap: 10, fontSize: 12.5, lineHeight: 1.5, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,248,239,.6)', borderLeft: `3px solid ${isCorrect ? 'var(--sage-2)' : 'var(--terra-2)'}`, marginBottom: 10 }}>
            <span style={{ flexShrink: 0, fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: isCorrect ? 'var(--sage-2)' : 'var(--terra-2)' }}>
              {isCorrect ? 'Верно' : 'Мимо'}
            </span>
            <span style={{ color: 'var(--ink-soft)' }}>{q.note}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
            {answered ? '' : 'Подсказок нет — доверяйте интуиции.'}
          </span>
          <button
            onClick={next}
            disabled={!answered}
            style={{
              padding: '8px 16px', borderRadius: 999,
              background: answered ? 'var(--ink)' : 'transparent',
              color: answered ? 'var(--bg)' : 'rgba(43,38,32,.3)',
              border: answered ? 'none' : '1px solid rgba(43,38,32,.2)',
              fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font-body)',
              cursor: answered ? 'pointer' : 'not-allowed',
              transition: 'all .16s',
            }}
          >
            {step === total - 1 ? 'Подвести итог' : 'Дальше'} →
          </button>
        </div>
      </div>

      {/* Step bar */}
      <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
        {questions.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i < step ? 'var(--terra-2)' : i === step ? 'var(--gold-2)' : 'rgba(43,38,32,.12)', transition: 'background .2s' }} />
        ))}
      </div>
    </div>
  )
}

// ─── Hero Block ───────────────────────────────────────────────────────────────

export function HeroBlock({ userName, completed, onOpenLesson }: HeroBlockProps) {
  const lessonsDone = LESSONS.filter(l => completed.has(l.id)).length
  const lessonsTotal = LESSONS.length

  // Find the last completed lesson for quiz context
  const lastDoneIdx = (() => {
    for (let i = LESSONS.length - 1; i >= 0; i--) {
      if (completed.has(LESSONS[i].id)) return i
    }
    return -1
  })()

  // Next lesson to study
  const nextLesson = LESSONS.find(l => !completed.has(l.id)) ?? LESSONS[LESSONS.length - 1]

  // Quiz subtitle
  const questSub = lastDoneIdx >= 0
    ? `По уроку ${lastDoneIdx + 1}. ${LESSONS[lastDoneIdx].title}`
    : 'Проверьте свои знания'

  const firstName = userName.split(' ')[0] || userName

  const nextIdx = LESSONS.findIndex(l => !completed.has(l.id))
  const safeNext = nextIdx === -1 ? LESSONS.length - 1 : nextIdx
  const windowStart = Math.max(0, Math.min(safeNext - 1, LESSONS.length - 5))
  const visibleLessons = LESSONS.slice(windowStart, windowStart + 5)

  return (
    <div style={{
      width: '100%',
      background: 'var(--bg)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: '420px 1fr',
      minHeight: 320,
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-md)',
    }}>
      {/* ── LEFT: greeting + outline ── */}
      <div style={{ padding: '32px 32px 24px 40px', display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid var(--line)' }}>
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)', letterSpacing: '.16em' }}>INCF</span>
          <span style={{ width: 18, height: 1, background: 'rgba(43,38,32,.14)' }} />
          <span>Курс · Введение</span>
        </div>

        {/* Greeting + progress */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 24, lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>
            Добро пожаловать,<br />
            <span style={{ color: 'var(--terra-2)', fontStyle: 'italic', fontWeight: 500 }}>{firstName}</span>
          </h2>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {lessonsDone}<span style={{ color: 'var(--ink-mute)', fontSize: 19 }}> / {lessonsTotal}</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 3 }}>пройдено</div>
          </div>
        </div>

        {/* Lesson outline */}
        <ol style={{ marginTop: 20, flex: 1, display: 'flex', flexDirection: 'column', listStyle: 'none', padding: 0 }}>
          {visibleLessons.map((lesson) => {
            const i = LESSONS.indexOf(lesson)
            const done = completed.has(lesson.id)
            const isNext = !done && (i === 0 || completed.has(LESSONS[i - 1].id))
            return (
              <li key={lesson.id} style={{
                display: 'grid', gridTemplateColumns: '20px 1fr auto',
                alignItems: 'center', gap: 10, padding: '4px 0',
                borderBottom: i < LESSONS.length - 1 ? '1px solid rgba(43,38,32,.08)' : 'none',
                flex: 1, minHeight: 0,
              }}>
                {/* Bullet */}
                <span style={{
                  width: 14, height: 14, borderRadius: 999, justifySelf: 'center',
                  background: done ? 'var(--terra-2)' : 'transparent',
                  border: done ? 'none' : isNext ? '1.5px solid var(--gold-2)' : '1.5px solid rgba(43,38,32,.14)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 8, fontWeight: 700, color: '#fff8ef',
                }}>
                  {done && '✓'}
                  {isNext && !done && <span style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--gold-2)' }} />}
                </span>
                {/* Title */}
                <span style={{ fontSize: 12.5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: done ? 'var(--ink-mute)' : isNext ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: isNext ? 600 : 400 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums', marginRight: 8, color: done ? 'var(--ink-mute)' : 'rgba(43,38,32,.25)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {lesson.title}
                </span>
                {/* Tag */}
                <span style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  {isNext ? 'Сейчас' : ''}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* ── RIGHT: mini quiz ── */}
      <div style={{ padding: '32px 40px 24px 24px', display: 'flex', alignItems: 'stretch' }}>
        <div style={{
          flex: 1, background: 'var(--sage-tint)', borderRadius: 16,
          padding: '20px 24px 18px', position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 1px 0 rgba(43,38,32,.04), 0 30px 60px -50px rgba(43,38,32,.4)',
          minWidth: 0,
        }}>
          {/* Gold left accent */}
          <div style={{ position: 'absolute', left: 0, top: 22, bottom: 20, width: 3, background: 'var(--gold-2)', borderRadius: '0 2px 2px 0' }} />

          {/* Quest header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--sage-2)', fontWeight: 600 }}>Квест дня</div>
              <div style={{ marginTop: 2, fontSize: 12, color: 'var(--ink-soft)' }}>{questSub}</div>
            </div>
            <div style={{ padding: '5px 11px', borderRadius: 999, background: 'rgba(255,248,239,.55)', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--ink)', letterSpacing: '.04em', flexShrink: 0 }}>
              {lessonsDone === 0 ? 'Начнём' : `${PLACEHOLDER_QUESTIONS.length} вопросов`}
            </div>
          </div>

          {/* Quiz */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {lessonsDone === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <p style={{ fontSize: 16, color: 'var(--ink)', fontFamily: 'var(--font-display)', margin: 0 }}>Пройдите первый урок —<br />квест дня откроется после него.</p>
                <button
                  onClick={() => onOpenLesson(nextLesson.id)}
                  style={{ padding: '10px 20px', borderRadius: 999, background: 'var(--terra-2)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: '0 8px 18px -10px rgba(181,82,58,.7)' }}>
                  Начать первый урок →
                </button>
              </div>
            ) : (
              <MiniQuiz
                questions={PLACEHOLDER_QUESTIONS}
                nextLessonTitle={nextLesson.title}
                nextLessonId={nextLesson.id}
                onOpenLesson={onOpenLesson}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
