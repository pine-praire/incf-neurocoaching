import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/app/actions/progress', () => ({
  markStepDone: vi.fn(),
  undoStep: vi.fn(),
  saveAnswer: vi.fn(),
  loadProgress: vi.fn(() => Promise.resolve({ completed: [], answers: {}, userName: '' })),
}))

vi.mock('@/lib/course-data', () => ({
  LESSONS: [
    { id: 'l1', n: 1, title: 'Урок 1', xp: 50, duration: 10, lecturer: 'Тест', subtitle: '', fact: '', factTag: '', blockId: 'b1', task: null },
    { id: 'l2', n: 2, title: 'Урок 2', xp: 60, duration: 12, lecturer: 'Тест', subtitle: '', fact: '', factTag: '', blockId: 'b1', task: null },
    { id: 'l3', n: 3, title: 'Урок 3', xp: 70, duration: 14, lecturer: 'Тест', subtitle: '', fact: '', factTag: '', blockId: 'b2', task: null },
  ],
  FINALS: [
    { id: 'test', type: 'test', title: 'Итоговый тест', xp: 150, subtitle: '' },
    { id: 'six', type: 'reflection', title: '6 вопросов', xp: 100, subtitle: '' },
  ],
  INTRO: { id: 'intro', title: 'Введение', xp: 20, duration: 3, desc: '' },
  LEVELS: [
    { min: 0, title: 'Любопытный новичок' },
    { min: 80, title: 'Исследователь мозга' },
    { min: 220, title: 'Практик' },
    { min: 400, title: 'Уверенный коуч' },
    { min: 620, title: 'Нейрокоуч' },
  ],
  computeXP: vi.fn(() => 0),
  computeLevel: vi.fn(() => ({ idx: 0, title: 'Любопытный новичок', ratio: 0, nextAt: 80 })),
  blockProgress: vi.fn(() => ({ done: 0, total: 2, ratio: 0 })),
}))

vi.mock('@/app/roadmap/hero-block', () => ({
  HeroBlock: () => React.createElement('div', { 'data-testid': 'hero-block' }),
}))

import { TopBar, WelcomeCard, BonusGrid } from '@/app/roadmap/roadmap-ui'

// ── Regression: page.tsx must not export non-route symbols ─────────────────────

describe('Regression: page.tsx exports', () => {
  it('page.tsx default export is the page component (no TopBar/WelcomeCard/BonusGrid exports)', async () => {
    const mod = await import('@/app/roadmap/page')
    expect(typeof mod.default).toBe('function')
    expect((mod as Record<string, unknown>).TopBar).toBeUndefined()
    expect((mod as Record<string, unknown>).WelcomeCard).toBeUndefined()
    expect((mod as Record<string, unknown>).BonusGrid).toBeUndefined()
  })
})

// ── TopBar ─────────────────────────────────────────────────────────────────────

describe('TopBar', () => {
  const defaultProps = { xp: 100, streak: 3, completed: new Set<string>() }

  it('XP chip is not hidden: no .mob-hide ancestor wraps "XP" label', () => {
    const { container } = render(<TopBar {...defaultProps} />)
    // Verify XP text is present at all
    expect(container.textContent).toContain('XP')
    // Verify no .mob-hide element contains the XP label
    const hiddenEls = Array.from(container.querySelectorAll('.mob-hide'))
    const xpIsHidden = hiddenEls.some(el => el.textContent?.includes('XP'))
    expect(xpIsHidden).toBe(false)
  })

  it('renders the streak chip with mob-hide class', () => {
    const { container } = render(<TopBar {...defaultProps} />)
    const chips = container.querySelectorAll('.mob-hide')
    const streakChip = Array.from(chips).find(el => el.textContent?.includes('дней'))
    expect(streakChip).toBeTruthy()
  })

  it('renders the level badge with mob-hide class', () => {
    const { container } = render(<TopBar {...defaultProps} />)
    const hiddenEls = container.querySelectorAll('.mob-hide')
    const levelBadge = Array.from(hiddenEls).find(el => el.textContent?.includes('уровень'))
    expect(levelBadge).toBeTruthy()
  })

  it('renders the progress bar', () => {
    const { container } = render(<TopBar {...defaultProps} />)
    const progressBars = container.querySelectorAll('div[style*="background: linear-gradient"]')
    expect(progressBars.length).toBeGreaterThan(0)
  })

  it('shows completed / total lesson count in progress label', () => {
    const { container } = render(
      <TopBar xp={0} streak={0} completed={new Set(['l1'])} />
    )
    expect(container.textContent).toMatch(/1\s*из\s*5/)
  })
})

// ── WelcomeCard ────────────────────────────────────────────────────────────────

describe('WelcomeCard', () => {
  const onStart = vi.fn()

  beforeEach(() => { onStart.mockClear() })

  it('outer grid div has welcome-grid className', () => {
    const { container } = render(<WelcomeCard onStart={onStart} />)
    const grid = container.querySelector('.welcome-grid')
    expect(grid).toBeTruthy()
  })

  it('photo container has mob-hide className', () => {
    const { container } = render(<WelcomeCard onStart={onStart} />)
    const photoDiv = container.querySelector('.mob-hide')
    expect(photoDiv).toBeTruthy()
  })

  it('renders the "Начать урок дня" button', () => {
    render(<WelcomeCard onStart={onStart} />)
    expect(screen.getByText(/Начать урок дня/)).toBeTruthy()
  })

  it('calls onStart when start button is clicked', () => {
    render(<WelcomeCard onStart={onStart} />)
    fireEvent.click(screen.getByText(/Начать урок дня/))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})

// ── BonusGrid ──────────────────────────────────────────────────────────────────

describe('BonusGrid', () => {
  it('outer grid div has bonus-grid className', () => {
    const { container } = render(<BonusGrid testDone={false} />)
    const grid = container.querySelector('.bonus-grid')
    expect(grid).toBeTruthy()
  })

  it('renders exactly 4 bonus cards', () => {
    const { container } = render(<BonusGrid testDone={false} />)
    const cards = container.querySelectorAll('.bonus-grid > div')
    expect(cards.length).toBe(4)
  })

  it('shows lock indicator on diagnostic card when testDone=false', () => {
    render(<BonusGrid testDone={false} />)
    const lockBadge = screen.getByText(/заблокировано/)
    expect(lockBadge).toBeTruthy()
  })

  it('no lock indicator on diagnostic card when testDone=true', () => {
    render(<BonusGrid testDone={true} />)
    const lockBadge = screen.queryByText(/заблокировано/)
    expect(lockBadge).toBeNull()
  })
})
