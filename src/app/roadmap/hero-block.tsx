'use client'

import { LESSONS } from '@/lib/course-data'
import { DailyQuestCard } from './quest/daily-quest-card'

interface HeroBlockProps {
  userName: string
  completed: Set<string>
  onOpenLesson: (lessonId: string) => void
}

export function HeroBlock({ userName, completed, onOpenLesson }: HeroBlockProps) {
  const lessonsDone = LESSONS.filter(l => completed.has(l.id)).length
  const lessonsTotal = LESSONS.length
  const firstName = userName.split(' ')[0] || userName

  // Stable key for DailyQuestCard effect — recomputed only when completed changes
  const completedKey = LESSONS
    .filter(l => completed.has(l.id))
    .map(l => l.id)
    .join(',')

  const firstUnlockedLessonId = LESSONS.find(l => !completed.has(l.id))?.id ?? null

  const nextIdx = LESSONS.findIndex(l => !completed.has(l.id))
  const safeNext = nextIdx === -1 ? LESSONS.length - 1 : nextIdx
  const windowStart = Math.max(0, Math.min(safeNext - 1, LESSONS.length - 5))
  const visibleLessons = LESSONS.slice(windowStart, windowStart + 5)

  return (
    <div
      className="welcome-grid"
      style={{
        width: '100%',
        background: 'var(--bg)',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        minHeight: 320,
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
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
                <span style={{ fontSize: 12.5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: done ? 'var(--ink-mute)' : isNext ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: isNext ? 600 : 400 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums', marginRight: 8, color: done ? 'var(--ink-mute)' : 'rgba(43,38,32,.25)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {lesson.title}
                </span>
                <span style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  {isNext ? 'Сейчас' : ''}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* ── RIGHT: quest ── */}
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
              <div style={{ marginTop: 2, fontSize: 12, color: 'var(--ink-soft)' }}>5 вопросов по последнему уроку</div>
            </div>
            <div style={{ padding: '5px 11px', borderRadius: 999, background: 'rgba(255,248,239,.55)', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--ink)', letterSpacing: '.04em', flexShrink: 0 }}>
              {lessonsDone === 0 ? 'Начнём' : '5 вопросов'}
            </div>
          </div>

          {/* Quest content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <DailyQuestCard
              completedKey={completedKey}
              firstUnlockedLessonId={firstUnlockedLessonId}
              onStartLesson={onOpenLesson}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
