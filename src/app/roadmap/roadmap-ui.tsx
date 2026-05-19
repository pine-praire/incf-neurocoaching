'use client'

import { useState } from 'react'
import { LESSONS, FINALS } from '@/lib/course-data'

function Eyebrow({ children, color = 'var(--terra-2)' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color }}>{children}</span>
}

export function TopBar({ xp, streak, completed }: { xp: number; streak: number; completed: Set<string> }) {
  const level = (() => {
    const levels = [
      { min: 0, title: 'Любопытный новичок' }, { min: 80, title: 'Исследователь мозга' },
      { min: 220, title: 'Практик' }, { min: 400, title: 'Уверенный коуч' }, { min: 620, title: 'Нейрокоуч' },
    ]
    let idx = 0
    for (let i = 0; i < levels.length; i++) if (xp >= levels[i].min) idx = i
    return { idx, title: levels[idx].title }
  })()
  const done = LESSONS.filter(l => completed.has(l.id)).length + FINALS.filter(f => completed.has(f.id)).length
  const total = LESSONS.length + FINALS.length
  const overall = total > 0 ? done / total : 0
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40, backdropFilter: 'blur(8px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--terra-2)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>i</div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.55, color: 'var(--ink)' }}>INCF · Курс</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, lineHeight: 1.15, color: 'var(--ink)' }}>Введение в нейрокоучинг</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 80, maxWidth: 300, marginLeft: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.5, color: 'var(--ink)', marginBottom: 4 }}>
          <span>Прогресс</span><span>{done} из {total}</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'oklch(0.92 0.012 75)', overflow: 'hidden' }}>
          <div style={{ width: `${overall * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--terra-2), var(--gold-2))', borderRadius: 999, transition: 'width .35s ease' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {[{ emoji: '⚡', val: xp, label: 'XP', mobHide: false }, { emoji: '🔥', val: streak, label: 'дней', mobHide: true }].map(s => (
          <div key={s.label} className={s.mobHide ? 'mob-hide' : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px 5px 9px', background: 'var(--bg-deep)', borderRadius: 999, whiteSpace: 'nowrap' }}>
            <span>{s.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{s.val}</span>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--ink-mute)' }}>{s.label}</span>
          </div>
        ))}
        <div className="mob-hide" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 7px', background: 'var(--sage-tint)', borderRadius: 999, border: '1px solid var(--sage-soft)', whiteSpace: 'nowrap' }}>
          <span style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--sage-2)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>{level.idx + 1}</span>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, fontSize: 11.5, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{level.title}</div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.5, color: 'var(--ink)' }}>уровень</div>
          </div>
        </div>
      </div>
      <div style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--bg-deep)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-display)', color: 'var(--ink)', flexShrink: 0 }}>А</div>
    </header>
  )
}

export function WelcomeCard({ onStart }: { onStart: () => void }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="welcome-grid" style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 18, padding: 18, alignItems: 'center', background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)', border: '1px solid var(--line)', borderRadius: 18, boxShadow: 'var(--shadow-md)' }}>
      <div className="mob-hide" style={{ position: 'relative', width: 120, height: 120 }}>
        <div style={{ width: 120, height: 120, borderRadius: 999, background: 'repeating-linear-gradient(135deg,oklch(0.92 0.012 75) 0 6px,oklch(0.96 0.01 75) 6px 12px)', border: '1px solid var(--line)' }} />
        <button onClick={() => setPlaying(p => !p)} aria-label="Послушать приветствие"
          style={{ position: 'absolute', inset: 0, margin: 'auto', width: 48, height: 48, borderRadius: 999, border: 'none', background: 'var(--terra-2)', color: '#fff', boxShadow: '0 8px 24px -8px rgba(0,0,0,.4)', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 22 }}>
          {playing ? '⏸' : '▶'}
        </button>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Eyebrow>Голосовое от лектора · 1:18</Eyebrow>
          {playing && (
            <span style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end', height: 14 }}>
              {[0, 1, 2, 3].map(i => (
                <span key={i} style={{ width: 2, background: 'var(--terra-2)', borderRadius: 1, animationName: 'bar', animationDuration: `${0.6 + i * 0.1}s`, animationDelay: `${i * 0.08}s`, animationIterationCount: 'infinite', animationDirection: 'alternate', height: 6 + i * 2 }} />
              ))}
            </span>
          )}
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: '0 0 6px', color: 'var(--ink)' }}>Здравствуйте, я Александра. Рада, что Вы здесь.</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, margin: 0 }}>Сегодня — 3 минуты. Короткий тест, который определит Ваш стиль принятия решений. С него начнётся всё дальнейшее.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={onStart} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--terra-2)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 999, fontWeight: 600, fontSize: 12.5, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)', whiteSpace: 'nowrap' }}>
          ▶ Начать урок дня
        </button>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', padding: '9px 14px', borderRadius: 10, fontWeight: 600, fontSize: 12.5, fontFamily: 'var(--font-body)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          🔊 Слушать приветствие
        </button>
      </div>
    </div>
  )
}

export function BonusGrid({ testDone }: { testDone: boolean }) {
  const cards = [
    { emoji: '⚡', tag: 'Бонус за раннее решение', title: 'Примите решение о L1 до конца курса', body: 'Личная 30-минутная сессия с Александрой + 5% к любому тарифу.', tone: 'terra' as const, cta: 'Узнать подробнее', locked: false },
    { emoji: '📅', tag: 'После итогового теста', title: 'Бесплатная диагностика 30 минут', body: 'Разбор вашей точки А и плана из 3 шагов. Открывается после прохождения теста.', tone: 'sage' as const, cta: 'Забронировать слот', locked: !testDone },
    { emoji: '💬', tag: 'Кейс выпускника', title: 'Татьяна, скрам-мастер → нейрокоуч', body: 'Прошла курс в апреле, сейчас ведёт 8 клиентов в месяц по 50 €.', tone: 'gold' as const, cta: 'Читать историю', locked: false },
    { emoji: '📚', tag: 'Дополнительные материалы', title: 'Пять препятствий на пути коуча', body: 'Лекция Александры Болдиной + чек-листы + статья про компетенции INCF.', tone: 'sage' as const, cta: 'Открыть материалы', locked: false },
  ]
  const tones = { terra: { bg: 'var(--terra-tint)', ink: 'var(--terra-2)' }, sage: { bg: 'var(--sage-tint)', ink: 'var(--sage-2)' }, gold: { bg: 'var(--gold-tint)', ink: 'var(--gold-2)' } }
  return (
    <div className="bonus-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
      {cards.map((c, i) => {
        const t = tones[c.tone]
        return (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 15, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 145, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: t.bg, color: t.ink, display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 16 }}>{c.emoji}</div>
              <Eyebrow color={t.ink}>{c.tag}</Eyebrow>
              {c.locked && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-mute)', background: 'rgba(0,0,0,.04)', padding: '2px 6px', borderRadius: 4 }}>🔒 заблокировано</span>}
            </div>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{c.title}</h4>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0, flex: 1 }}>{c.body}</p>
            <button style={{ background: 'none', border: 'none', color: c.locked ? 'var(--ink-mute)' : t.ink, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: c.locked ? 'not-allowed' : 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
              {c.cta} →
            </button>
          </div>
        )
      })}
    </div>
  )
}
