'use client'

import { Circle, Star } from 'lucide-react'
import { useEffect, useState } from 'react'

const STEPS = [
  { id: 'l1', label: 'Урок 1', title: 'Что такое нейрокоучинг',              duration: '22 мин', xp: '+50 XP' },
  { id: 'l2', label: 'Урок 2', title: 'Уточнение цели и результата',          duration: '17 мин', xp: '+60 XP' },
  { id: 'l3', label: 'Урок 3', title: 'Демо-сессии',                          duration: '43 мин', xp: '+50 XP' },
  { id: 'l4', label: 'Урок 4', title: 'Как мозг принимает решения',           duration: '11 мин', xp: '+70 XP' },
  { id: 'l5', label: 'Урок 5', title: 'Коучинг изменений',                    duration: '26 мин', xp: '+70 XP' },
  { id: 'l6', label: 'Урок 6', title: 'Построение эффективного общения',      duration: '18 мин', xp: '+70 XP' },
  { id: 'l7', label: 'Урок 7', title: 'Стресс и управление эмоциями',        duration: '12 мин', xp: '+80 XP' },
  { id: 'final', label: 'Финал', title: 'Тест + сертификат + звонок',         duration: '15 мин', xp: '+20 XP', highlight: true },
]

export function CourseTimeline() {
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    if (visible >= STEPS.length) return
    const t = setTimeout(() => setVisible(v => v + 1), 120)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <div className="flex flex-col gap-3 py-2">
      {STEPS.map((step, i) => (
        <div
          key={step.id}
          className={`flex items-start gap-3 transition-all duration-300 ${
            i < visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          {step.highlight
            ? <Star className="mt-0.5 shrink-0 text-[var(--terra)]" size={16} />
            : <Circle className="mt-0.5 shrink-0 text-[var(--ink-mute)]" size={16} />
          }
          <div className="flex flex-1 items-baseline justify-between gap-2">
            <div>
              <span className={`font-mono text-xs ${step.highlight ? 'text-[var(--terra)]' : 'text-[var(--ink-soft)]'}`}>
                {step.label}
              </span>
              <span className="ml-2 text-sm text-[var(--ink)]">{step.title}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-xs text-[var(--ink-mute)]">{step.duration}</span>
              <span className="font-mono text-xs text-[var(--sage)]">{step.xp}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
