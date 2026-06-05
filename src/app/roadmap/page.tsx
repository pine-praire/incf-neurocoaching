'use client'

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import {
  LESSONS, FINALS, INTRO,
  computeXP, blockProgress,
  type Lesson,
} from '@/lib/course-data'
import { markStepDone, undoStep, saveAnswer, loadProgress } from '@/app/actions/progress'
import { createClient } from '@/lib/supabase/client'
import { HeroBlock } from './hero-block'
import { TopBar, BonusGrid } from './roadmap-ui'
import { FinalTestModal } from './final-test-modal'
import { QUEST_LESSON_IDS } from '@/lib/quest-meta'

const questLessonIds = new Set<string>(QUEST_LESSON_IDS)

// ─── Types ────────────────────────────────────────────────────────────────────

type StampKind = 'intro' | 'lesson' | 'badge' | 'final' | 'cert'
type StampStatus = 'done' | 'next' | 'open' | 'locked'

interface Stamp {
  id: string
  x: number
  y: number
  kind: StampKind
  label?: string
  blockId?: string
}

type OpenLesson = Lesson | {
  id: string; title: string; n: number | string; lecturer: string
  duration: number; xp: number; subtitle: string
  fact: string; factTag: string; task?: string | null
  pre?: string; nativePitch?: string
}

type AnnotationType = 'fact' | 'alumni' | 'l1' | 'diagnostic'

interface Annotation {
  id: string
  stampId: string
  preferredSide: 'left' | 'right'
  type: AnnotationType
  content: React.ReactNode
  compactIcon: string
  compactLabel: string
}

const W = 1080, H = 1700
const CARD_WIDTH = 230
const CARD_GAP = 28
const SAFE = 12

const STAMPS: Stamp[] = [
  { id: 'intro',  x: 540, y: 70,   kind: 'intro' },
  { id: 'l1',     x: 380, y: 180,  kind: 'lesson' },
  { id: 'l2',     x: 700, y: 300,  kind: 'lesson' },
  { id: 'l3',     x: 380, y: 420,  kind: 'lesson' },
  { id: 'badge1', x: 540, y: 540,  kind: 'badge', label: 'Введение освоено', blockId: 'b1' },
  { id: 'l4',     x: 700, y: 660,  kind: 'lesson' },
  { id: 'l5',     x: 380, y: 780,  kind: 'lesson' },
  { id: 'badge2', x: 540, y: 900,  kind: 'badge', label: 'Решения изучены', blockId: 'b2' },
  { id: 'l6',     x: 700, y: 1020, kind: 'lesson' },
  { id: 'l7',     x: 380, y: 1140, kind: 'lesson' },
  { id: 'badge3', x: 540, y: 1260, kind: 'badge', label: 'Практика — рулит', blockId: 'b3' },
  { id: 'test',   x: 700, y: 1380, kind: 'final', label: 'Итоговый тест' },
  { id: 'six',    x: 380, y: 1500, kind: 'final', label: '6 вопросов' },
  { id: 'cert',   x: 540, y: 1620, kind: 'cert',  label: 'Сертификат' },
]

function getSideCardLeft(markerX: number, mapWidth: number, preferred: 'left' | 'right'): number {
  const leftCandidate  = markerX - CARD_WIDTH - CARD_GAP
  const rightCandidate = markerX + CARD_GAP
  const fitsLeft  = leftCandidate >= SAFE
  const fitsRight = rightCandidate + CARD_WIDTH <= mapWidth - SAFE
  if (preferred === 'left'  && fitsLeft)  return leftCandidate
  if (preferred === 'right' && fitsRight) return rightCandidate
  if (fitsLeft)  return leftCandidate
  if (fitsRight) return rightCandidate
  return Math.max(SAFE, Math.min(markerX - CARD_WIDTH / 2, mapWidth - CARD_WIDTH - SAFE))
}

function pathBetween(a: Stamp, b: Stamp): string {
  const mx = (a.x + b.x) / 2 + (b.y > a.y ? Math.sign(b.x - a.x) * 28 : 0)
  const my = (a.y + b.y) / 2
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
}

function Eyebrow({ children, color = 'var(--terra-2)' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color }}>{children}</span>
}

function MonoChip({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-mute)', background: 'rgba(0,0,0,.04)', padding: '2px 7px', borderRadius: 4 }}>{children}</span>
}

function FunFact({ tag, text, tone = 'sage', compact = false }: { tag: string; text: string; tone?: 'sage' | 'gold' | 'terra'; compact?: boolean }) {
  const tones = {
    sage:  { bg: 'var(--sage-tint)',  ink: 'var(--sage-2)',  line: 'var(--sage-soft)' },
    gold:  { bg: 'var(--gold-tint)',  ink: 'var(--gold-2)',  line: 'var(--gold-soft)' },
    terra: { bg: 'var(--terra-tint)', ink: 'var(--terra-2)', line: 'var(--terra-soft)' },
  }
  const t = tones[tone]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: compact ? '10px 12px' : '14px 16px', background: t.bg, border: `1px solid ${t.line}`, borderRadius: 12 }}>
      <div style={{ flexShrink: 0, width: compact ? 28 : 32, height: compact ? 28 : 32, borderRadius: 999, background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,.06)' }}>
        <span style={{ fontSize: compact ? 16 : 18 }}>💡</span>
      </div>
      <div>
        <Eyebrow color={t.ink}>{tag}</Eyebrow>
        <p style={{ fontSize: compact ? 12 : 13, color: 'var(--ink-2)', lineHeight: 1.45, margin: '2px 0 0' }}>{text}</p>
      </div>
    </div>
  )
}

function NativeMention({ moduleRef }: { moduleRef: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px', background: 'rgba(255,255,255,.75)', backdropFilter: 'blur(4px)', border: '1px dashed var(--line)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--terra-tint)', color: 'var(--terra-2)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 15 }}>🎓</div>
        <p style={{ flex: 1, fontSize: 12, color: 'var(--ink-2)', margin: 0, lineHeight: 1.4 }}>
          Эта тема — глубже в <strong style={{ color: 'var(--ink)' }}>Нейрокоучинг L1</strong>, модуль {moduleRef}.
        </p>
      </div>
      <button style={{ background: 'none', border: 'none', color: 'var(--terra-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' }}>Подробнее →</button>
    </div>
  )
}

function AlumniCard({ name, role, quote }: { name: string; role: string; quote: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 999, background: 'repeating-linear-gradient(135deg,oklch(0.92 0.012 75) 0 5px,oklch(0.96 0.01 75) 5px 10px)', border: '1px solid var(--line)', flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{name} <span style={{ fontWeight: 500, color: 'var(--ink-mute)' }}>· {role}</span></div>
        <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 1 }}>💬 {quote}</div>
      </div>
    </div>
  )
}

function DiagnosticCard() {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--terra-soft)', background: 'var(--terra-tint)' }}>
      <Eyebrow>📅 Откроется после теста</Eyebrow>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 6 }}>Бесплатная диагностика 30 мин</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 3 }}>С Александрой. Разбираем вашу точку А и план из 3 шагов.</div>
    </div>
  )
}

const ANNOTATIONS: Annotation[] = [
  { id: 'a1', stampId: 'l1', preferredSide: 'right', type: 'fact', compactIcon: '💡', compactLabel: 'Этимология', content: <FunFact tag="Этимология" text='Слово «коучинг» — из венгерского "kocsi szekér". Дословно — то, что довозит до цели.' tone="sage" compact /> },
  { id: 'a2', stampId: 'l2', preferredSide: 'left', type: 'alumni', compactIcon: '💬', compactLabel: 'Татьяна', content: <AlumniCard name="Татьяна Азарова" role="скрам-мастер → коуч" quote="Полгода назад прошла этот же курс. 8 клиентов в месяц." /> },
  { id: 'a3', stampId: 'l4', preferredSide: 'left', type: 'fact', compactIcon: '💡', compactLabel: 'Нейронаука', content: <FunFact tag="Нейронаука" text="До 95% решений мы принимаем неосознанно. Кора рационализирует уже принятое — постфактум." tone="gold" compact /> },
  { id: 'a4', stampId: 'l5', preferredSide: 'right', type: 'l1', compactIcon: '🎓', compactLabel: 'L1', content: <NativeMention moduleRef="«Когнитивные искажения» (4 неделя)" /> },
  { id: 'a5', stampId: 'l7', preferredSide: 'right', type: 'alumni', compactIcon: '💬', compactLabel: 'Анастасия', content: <AlumniCard name="Анастасия Тарунтаева" role="врач → нейрокоуч" quote="«Стресс и эмоции» — урок, после которого всё изменилось." /> },
  { id: 'a6', stampId: 'test', preferredSide: 'left', type: 'diagnostic', compactIcon: '📅', compactLabel: 'Диагностика', content: <DiagnosticCard /> },
]

function AnnotationCard({ annotation, stamp, mapWidth, isCompact }: { annotation: Annotation; stamp: Stamp; mapWidth: number; isCompact: boolean }) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const markerX = (stamp.x / W) * mapWidth
  const topPct = (stamp.y / H) * 100

  useEffect(() => {
    if (!popoverOpen) return
    const handler = () => setPopoverOpen(false)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [popoverOpen])

  if (isCompact) {
    if (mapWidth < 480) return null
    const rawIconLeft = annotation.preferredSide === 'right' ? markerX + 56 : markerX - 56 - 40
    const iconLeft = Math.max(SAFE, Math.min(rawIconLeft, mapWidth - 40 - SAFE))
    return (
      <div style={{ position: 'absolute', left: iconLeft, top: `calc(${topPct}% - 20px)`, zIndex: 5 }}>
        <button onClick={e => { e.stopPropagation(); setPopoverOpen(p => !p) }} aria-label={annotation.compactLabel}
          style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--surface)', border: '2px solid var(--line)', boxShadow: 'var(--shadow-md)', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 20, transition: 'transform .15s' }}>
          {annotation.compactIcon}
        </button>
        {popoverOpen && (
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', left: '50%', top: 48, transform: 'translateX(-50%)', width: 'min(260px, calc(100vw - 48px))', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', zIndex: 20, padding: 4 }}>
            {annotation.content}
          </div>
        )}
      </div>
    )
  }

  const leftPx = getSideCardLeft(markerX, mapWidth, annotation.preferredSide)
  const connectorSide = leftPx < markerX ? 'right' : 'left'
  return (
    <div style={{ position: 'absolute', left: leftPx, top: `calc(${topPct}% - 22px)`, width: CARD_WIDTH, zIndex: 2 }}>
      <div style={{ position: 'absolute', top: 28, [connectorSide]: '100%', width: Math.abs(markerX - leftPx - (connectorSide === 'right' ? CARD_WIDTH : 0)), height: 1.5, background: 'repeating-linear-gradient(90deg, var(--ink-mute) 0 4px, transparent 4px 8px)', opacity: 0.4 }} />
      {annotation.content}
    </div>
  )
}

function LessonModal({ lesson, completed, answers, onClose, onMarkDone, onUndo, onSetAnswer, hasQuest }: {
  lesson: OpenLesson; completed: Set<string>; answers: Record<string, string>
  onClose: () => void; onMarkDone: (id: string) => void; onUndo: (id: string) => void; onSetAnswer: (id: string, v: string) => void
  hasQuest: boolean
}) {
  const done = completed.has(lesson.id)
  const answer = answers[lesson.id] ?? ''

  useEffect(() => {
    if (!done && !hasQuest) {
      onMarkDone(lesson.id)
    }
  }, [lesson.id, done, hasQuest, onMarkDone])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={`Урок: ${lesson.title}`}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,18,16,.55)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 740, maxHeight: '92vh', background: 'var(--surface)', borderRadius: 18, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <Eyebrow>{typeof lesson.n === 'number' && lesson.n > 0 ? `Урок ${lesson.n}` : 'Финал'} · {lesson.lecturer}</Eyebrow>
          <MonoChip>{lesson.duration} мин · +{lesson.xp} XP</MonoChip>
          <button onClick={onClose} aria-label="Закрыть" style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: 5, cursor: 'pointer', color: 'var(--ink-mute)', display: 'grid', placeItems: 'center', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)', margin: 0 }}>{lesson.title}</h2>
          {lesson.subtitle && <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, margin: '-6px 0 0' }}>{lesson.subtitle}</p>}
          <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: 12, overflow: 'hidden' }}>
            {'youtubeId' in lesson && lesson.youtubeId ? (
              <iframe
                src={`https://www.youtube.com/embed/${lesson.youtubeId}`}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'oklch(0.18 0.02 250)', backgroundImage: 'repeating-linear-gradient(135deg,oklch(0.18 0.02 250) 0 8px,oklch(0.22 0.02 250) 8px 16px)', display: 'grid', placeItems: 'center', color: '#f5f1e8' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 999, background: '#fff', display: 'grid', placeItems: 'center', fontSize: 28, color: '#1a1a1a' }}>▶</div>
                  <MonoChip>YOUTUBE · {lesson.id.toUpperCase()} · {lesson.duration}:00</MonoChip>
                </div>
              </div>
            )}
          </div>
          <FunFact tag={lesson.factTag} text={lesson.fact} tone="sage" />
          {lesson.task && (
            <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ color: 'var(--terra-2)', fontSize: 18 }}>✏️</span>
                <Eyebrow color="var(--ink-2)">Задание · 1 предложение</Eyebrow>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--ink)', marginBottom: 10 }}>{lesson.task}</p>
              <textarea value={answer} onChange={e => onSetAnswer(lesson.id, e.target.value)} placeholder="Напишите одним предложением"
                style={{ width: '100%', minHeight: 64, resize: 'vertical', padding: 10, fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, fontSize: 11.5, color: 'var(--ink-mute)' }}>
                <span>{answer.length} симв.</span>
              </div>
            </div>
          )}
          {lesson.pre && (
            <div style={{ display: 'flex', gap: 10, padding: '11px 13px', border: '1px dashed var(--terra-2)', borderRadius: 12, background: 'var(--terra-tint)' }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>🕐</span>
              <div>
                <Eyebrow color="var(--terra-2)">До следующего урока</Eyebrow>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '2px 0 0' }}>{lesson.pre}</p>
              </div>
            </div>
          )}
          {'nativePitch' in lesson && lesson.nativePitch && <NativeMention moduleRef={lesson.nativePitch} />}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
            {!done ? (
              <button onClick={() => onMarkDone(lesson.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--terra-2)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)' }}>
                ✓ Готово — +{lesson.xp} XP
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sage-2)', fontWeight: 600, fontSize: 13.5 }}>
                ✅ Урок засчитан · +{lesson.xp} XP
                <button onClick={() => onUndo(lesson.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}>отменить</button>
              </div>
            )}
            <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', padding: '9px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// TopBar, WelcomeCard, BonusGrid live in ./roadmap-ui (exported from there for tests)

function PathRoad({ completed }: { completed: Set<string> }) {
  const isStampDone = (s: Stamp): boolean => {
    if (s.kind === 'badge') return blockProgress(s.blockId!, completed).ratio >= 1
    if (s.kind === 'cert') return FINALS.every(f => completed.has(f.id))
    return completed.has(s.id)
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <pattern id="dots" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="oklch(0.86 0.012 75)" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#dots)" opacity="0.4" />
      {STAMPS.slice(0, -1).map((_, i) => {
        const a = STAMPS[i], b = STAMPS[i + 1]
        const aDone = isStampDone(a), bDone = isStampDone(b)
        const d = pathBetween(a, b)
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="oklch(0.92 0.012 75)" strokeWidth="14" strokeLinecap="round" />
            <path d={d} fill="none" stroke="oklch(0.98 0.008 75)" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 10" />
            {aDone && bDone && <path d={d} fill="none" stroke="var(--terra-2)" strokeWidth="14" strokeLinecap="round" opacity="0.85" />}
            {aDone && !bDone && (
              <>
                <path d={d} fill="none" stroke="var(--terra-2)" strokeWidth="14" strokeLinecap="round" opacity="0.4" strokeDasharray="14 14">
                  <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="1.4s" repeatCount="indefinite" />
                </path>
                <path d={d} fill="none" stroke="oklch(0.98 0.008 75)" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 10" opacity="0.9" />
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function RoadmapStamp({ stamp, completed, nextId, isLocked, onOpen, onFinalTest, mapWidth }: {
  stamp: Stamp; completed: Set<string>; nextId: string | null
  isLocked: (id: string) => boolean; onOpen: (lesson: OpenLesson) => void; onFinalTest?: () => void
  mapWidth: number
}) {
  const [hovered, setHovered] = useState(false)
  const { id, x, y, kind } = stamp

  const getStatus = (): StampStatus => {
    if (kind === 'badge') {
      const p = blockProgress(stamp.blockId!, completed)
      if (p.ratio >= 1) return 'done'; if (p.done > 0) return 'next'; return 'locked'
    }
    if (kind === 'cert') {
      if (FINALS.every(f => completed.has(f.id))) return 'done'
      if (completed.has('test')) return 'next'; return 'locked'
    }
    if (completed.has(id)) return 'done'
    if (id === nextId) return 'next'
    if (kind === 'lesson' && isLocked(id)) return 'locked'
    return 'open'
  }

  const status = getStatus()
  const isReward = kind === 'badge' || kind === 'cert'
  const sc = mapWidth > 0 ? Math.min(1, mapWidth / 720) : 1
  const size = Math.max(40, Math.round((isReward ? 96 : (kind === 'intro' || kind === 'final') ? 84 : 76) * sc))
  const fs = (base: number) => Math.max(11, Math.round(base * sc))
  const showLabel = sc > 0.55

  const palette = (() => {
    if (status === 'done' && !isReward) return { fill: 'var(--terra-2)', ink: '#fff', ring: 'oklch(0.45 0.16 30)' }
    if (status === 'done' && isReward)  return { fill: 'var(--gold)', ink: 'var(--navy-2)', ring: 'var(--gold-2)' }
    if (status === 'next' && !isReward) return { fill: '#fff', ink: 'var(--terra-2)', ring: 'var(--terra-2)' }
    if (status === 'next' && isReward)  return { fill: 'var(--gold-tint)', ink: 'var(--gold-2)', ring: 'var(--gold)' }
    if (status === 'locked') return { fill: 'oklch(0.95 0.012 75)', ink: 'var(--ink-mute)', ring: 'var(--line)' }
    return { fill: '#fff', ink: 'var(--ink-2)', ring: 'var(--ink-mute)' }
  })()

  const lesson = LESSONS.find(l => l.id === id)
  const final = FINALS.find(f => f.id === id)

  const getLessonForModal = (): OpenLesson | null => {
    if (kind === 'lesson' && lesson) return lesson
    if (kind === 'intro') return { id: 'intro', title: INTRO.title, n: 0, lecturer: 'INCF', duration: INTRO.duration, xp: INTRO.xp, subtitle: INTRO.desc, fact: 'Курс задуман как разминка к L1. Если дойдёте до конца — получите сертификат и подарок.', factTag: 'О курсе' }
    if (kind === 'final' && final) return { id: final.id, title: final.title, n: '★', lecturer: 'INCF', duration: 10, xp: final.xp, subtitle: final.subtitle, fact: 'Финал — это не оценка, а способ закрепить пройденное.', factTag: 'Финал', task: final.id === 'six' ? 'Какой урок отозвался сильнее всего и почему?' : null }
    return null
  }

  const rot = kind === 'badge' ? 'rotate(-4deg)' : kind === 'cert' ? 'rotate(2deg)' : 'none'
  const label = kind === 'lesson' && lesson ? (lesson.title.length > 26 ? lesson.title.slice(0, 24) + '…' : lesson.title) : stamp.label ?? ''

  return (
    <button
      onClick={() => { if (status === 'locked') return; if (id === 'test') { onFinalTest?.(); return; } const l = getLessonForModal(); if (l) onOpen(l) }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      aria-label={`${label}, ${status === 'done' ? 'пройдено' : status === 'next' ? 'следующее' : status === 'locked' ? 'заблокировано' : 'доступно'}`}
      style={{
        position: 'absolute',
        left: `calc(${(x / W) * 100}% - ${size / 2}px)`,
        top:  `calc(${(y / H) * 100}% - ${size / 2}px)`,
        width: size, height: size,
        borderRadius: kind === 'badge' ? 18 : kind === 'cert' ? 22 : 999,
        transform: hovered && status !== 'locked' ? `${rot} scale(1.05)` : rot,
        background: palette.fill, color: palette.ink, border: `3px solid ${palette.ring}`,
        boxShadow: status === 'next' ? `0 0 0 4px color-mix(in oklch, var(--terra-2) 20%, transparent), 0 8px 18px -8px rgba(0,0,0,.25)` : '0 6px 14px -8px rgba(0,0,0,.25)',
        display: 'grid', placeItems: 'center', padding: 0,
        cursor: status === 'locked' ? 'not-allowed' : 'pointer',
        transition: 'transform .15s, box-shadow .15s',
        opacity: status === 'locked' ? 0.72 : 1, zIndex: 3,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {status === 'done' && !isReward && <span style={{ fontSize: fs(28) }}>✓</span>}
        {status === 'locked' && <span style={{ fontSize: fs(20) }}>🔒</span>}
        {status !== 'done' && status !== 'locked' && kind === 'lesson' && lesson && (
          <>{sc > 0.6 && <span style={{ fontSize: fs(9.5), fontWeight: 700, opacity: 0.55, letterSpacing: '.1em' }}>УРОК</span>}
          <span style={{ fontFamily: 'var(--font-display)', fontSize: fs(22), fontWeight: 700, lineHeight: 1 }}>{lesson.n}</span></>
        )}
        {status !== 'done' && status !== 'locked' && kind === 'intro' && <span style={{ fontSize: fs(26) }}>🚀</span>}
        {status !== 'done' && status !== 'locked' && kind === 'badge' && <span style={{ fontSize: fs(30) }}>🏆</span>}
        {status === 'done' && isReward && <span style={{ fontSize: fs(34) }}>🏆</span>}
        {status !== 'done' && status !== 'locked' && kind === 'final' && <span style={{ fontSize: fs(26) }}>{id === 'test' ? '📝' : '💬'}</span>}
        {kind === 'cert' && status !== 'locked' && <span style={{ fontSize: fs(status === 'done' ? 34 : 26) }}>🎓</span>}
      </div>
      {showLabel && (
        <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translate(-50%, 5px)', whiteSpace: 'nowrap', fontFamily: 'var(--font-display)', fontSize: Math.max(9, Math.round(11 * sc)), fontWeight: 600, color: 'var(--ink)', background: 'rgba(255,255,255,.88)', backdropFilter: 'blur(2px)', padding: '2px 9px', borderRadius: 999, border: '1px solid var(--line)', zIndex: 4 }}>
          {label}
        </span>
      )}
      {status === 'next' && (kind === 'lesson' || kind === 'final') && (
        <span style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%, -5px)', whiteSpace: 'nowrap', fontFamily: 'var(--font-display)', fontSize: Math.max(9, Math.round(10.5 * sc)), fontWeight: 700, color: 'var(--navy-2)', background: 'var(--gold)', padding: '2px 9px', borderRadius: 999, zIndex: 4 }}>
          сейчас · +{lesson?.xp ?? final?.xp} XP
        </span>
      )}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [openLesson, setOpenLesson] = useState<OpenLesson | null>(null)
  const [showFinalTest, setShowFinalTest] = useState(false)
  const [mapWidth, setMapWidth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [streak, setStreak] = useState(0)
  const mapRef = useRef<HTMLDivElement>(null)

  const xp = computeXP(completed)

  const handleSignOut = useCallback(async () => {
    sessionStorage.removeItem('incf_active')
    await createClient().auth.signOut()
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('session') === 'start') {
      sessionStorage.setItem('incf_active', '1')
      window.history.replaceState({}, '', '/roadmap')
    } else if (!sessionStorage.getItem('incf_active')) {
      createClient().auth.signOut().then(() => {
        window.location.href = '/login'
      })
      return
    }

    loadProgress()
      .then(({ completed: c, answers: a, userName: n, streak: s }) => {
        setCompleted(new Set(c))
        setAnswers(a)
        setUserName(n)
        setStreak(s)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const markDone = useCallback(async (id: string) => {
    setCompleted(prev => { const s = new Set(prev); s.add(id); return s })
    await markStepDone(id)
  }, [])

  const undo = useCallback(async (id: string) => {
    setCompleted(prev => { const s = new Set(prev); s.delete(id); return s })
    await undoStep(id)
  }, [])

  const setAnswer = useCallback(async (id: string, v: string) => {
    setAnswers(prev => ({ ...prev, [id]: v }))
    await saveAnswer(id, v)
  }, [])

  useLayoutEffect(() => {
    const el = mapRef.current
    if (!el) return
    const update = () => setMapWidth(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading])

  const isCompact = mapWidth > 0 && mapWidth < 1100

  const firstUndoneIdx = LESSONS.findIndex(l => !completed.has(l.id))
  const isLocked = (id: string) => {
    const idx = LESSONS.findIndex(l => l.id === id)
    if (idx === -1 || firstUndoneIdx === -1) return false
    return idx > firstUndoneIdx + 1
  }

  const nextLesson: OpenLesson | null = (LESSONS.find(l => !completed.has(l.id)) ?? FINALS.find(f => !completed.has(f.id)) ?? null) as OpenLesson | null
  const testDone = completed.has('test')

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#ece9e2', display: 'grid', placeItems: 'center' }}>
      <div style={{ color: 'var(--ink-mute)', fontSize: 14 }}>Загружаем ваш прогресс...</div>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes bar { from { height: 4px } to { height: 14px } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.5); opacity: 0; } }
        @media (max-width: 480px) {
          .mob-hide { display: none !important; }
          .welcome-grid { grid-template-columns: 1fr !important; }
          .bonus-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ background: '#ece9e2', minHeight: '100vh', padding: '20px 14px 56px' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', background: 'var(--bg)', borderRadius: 20, overflow: 'clip', boxShadow: '0 24px 60px -20px rgba(20,18,16,.18), 0 0 0 1px rgba(20,18,16,.05)' }}>
          <TopBar xp={xp} streak={streak} completed={completed} userName={userName} onSignOut={handleSignOut} />
          <div style={{ padding: '24px 32px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
<HeroBlock
userName={userName}
  completed={completed}
  onOpenLesson={(id) => {
    const lesson = [...LESSONS, ...FINALS].find(l => l.id === id)
    if (lesson) setOpenLesson(lesson as OpenLesson)
  }}
/>
            <section style={{ background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 85%)', borderRadius: 18, border: '1px solid var(--line)', boxShadow: 'var(--shadow-md)', padding: '18px 18px 24px', position: 'relative' }}>
              <header style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', marginBottom: 14, padding: '0 4px', fontSize: 11, color: 'var(--ink-mute)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 999, background: 'var(--terra-2)', display: 'inline-block' }} /> Пройдено</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 999, border: '2px solid var(--terra-2)', display: 'inline-block' }} /> Сейчас</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--gold)', transform: 'rotate(-6deg)', display: 'inline-block' }} /> Бейдж</span>
              </header>
              <div ref={mapRef} style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}` }}>
                <PathRoad completed={completed} />
                {STAMPS.map(stamp => (
                  <RoadmapStamp key={stamp.id} stamp={stamp} completed={completed} nextId={nextLesson?.id ?? null} isLocked={isLocked} onOpen={setOpenLesson} onFinalTest={() => setShowFinalTest(true)} mapWidth={mapWidth} />
                ))}
                {mapWidth > 0 && ANNOTATIONS.map(annotation => {
                  const stamp = STAMPS.find(s => s.id === annotation.stampId)
                  if (!stamp) return null
                  return <AnnotationCard key={annotation.id} annotation={annotation} stamp={stamp} mapWidth={mapWidth} isCompact={isCompact} />
                })}
              </div>
            </section>
            <BonusGrid testDone={testDone} />
          </div>
        </div>
      </div>

      {openLesson && (
        <LessonModal key={openLesson.id} lesson={openLesson} completed={completed} answers={answers}
          onClose={() => setOpenLesson(null)} onMarkDone={markDone} onUndo={undo} onSetAnswer={setAnswer}
          hasQuest={questLessonIds.has(openLesson.id)} />
      )}

      {showFinalTest && (
        <FinalTestModal
          onClose={() => setShowFinalTest(false)}
          onPass={() => { markDone('test'); setShowFinalTest(false) }}
        />
      )}

      <a href="https://t.me/incf_team" target="_blank" rel="noopener noreferrer"
        aria-label="Написать в поддержку" className="tg-btn"
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 45, width: 52, height: 52, borderRadius: 999, background: '#29A8E0', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 4px 16px -4px rgba(41,168,224,.6)', textDecoration: 'none', transition: 'transform .15s, box-shadow .15s' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.93 6.686l-1.68 7.92c-.126.558-.456.694-.924.432l-2.556-1.883-1.233 1.187c-.136.136-.25.25-.513.25l.183-2.596 4.722-4.267c.205-.183-.045-.284-.318-.1L8.078 13.94l-2.513-.785c-.546-.171-.557-.546.114-.808l9.81-3.783c.455-.165.853.11.441.122z" fill="white" />
        </svg>
      </a>
    </>
  )
}
