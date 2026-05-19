import { describe, it, expect } from 'vitest'
import {
  getDisplayName,
  getInitials,
  countCompletedLessons,
  getProgressPercent,
} from '@/lib/profile-utils'

describe('getDisplayName', () => {
  it('returns metadata.name when present', () => {
    expect(getDisplayName({ name: 'Мария Иванова' }, 'maria@test.com')).toBe('Мария Иванова')
  })

  it('returns metadata.full_name when name is absent', () => {
    expect(getDisplayName({ full_name: 'Анна Сидорова' }, 'anna@test.com')).toBe('Анна Сидорова')
  })

  it('prefers name over full_name when both present', () => {
    expect(getDisplayName({ name: 'Маша', full_name: 'Мария Петрова' }, 'x@test.com')).toBe('Маша')
  })

  it('returns email prefix when metadata has no name fields', () => {
    expect(getDisplayName({}, 'alex.ivanov@gmail.com')).toBe('alex.ivanov')
  })

  it('returns "Участник" when all sources are absent', () => {
    expect(getDisplayName({}, undefined)).toBe('Участник')
  })
})

describe('getInitials', () => {
  it('returns single uppercase letter for one-word name', () => {
    expect(getInitials('Мария')).toBe('М')
  })

  it('returns two uppercase letters for two-word name', () => {
    expect(getInitials('Анна Сидорова')).toBe('АС')
  })

  it('takes only the first two words from longer names', () => {
    expect(getInitials('Александра Болдина Юрьевна')).toBe('АБ')
  })

  it('always returns uppercase regardless of input case', () => {
    expect(getInitials('alex')).toBe('A')
  })
})

describe('countCompletedLessons', () => {
  const lessonIds = ['l1', 'l2', 'l3']
  const finalIds = ['test', 'six']

  it('counts rows whose step_id matches a lesson id', () => {
    const rows = [{ step_id: 'l1' }, { step_id: 'l2' }]
    expect(countCompletedLessons(rows, lessonIds, finalIds)).toBe(2)
  })

  it('counts rows whose step_id matches a final id', () => {
    const rows = [{ step_id: 'test' }]
    expect(countCompletedLessons(rows, lessonIds, finalIds)).toBe(1)
  })

  it('ignores step_ids outside lessons and finals (e.g. "intro")', () => {
    const rows = [{ step_id: 'intro' }, { step_id: 'l1' }]
    expect(countCompletedLessons(rows, lessonIds, finalIds)).toBe(1)
  })
})

describe('getProgressPercent', () => {
  it('returns 0 when total is 0 (prevents division by zero)', () => {
    expect(getProgressPercent(0, 0)).toBe(0)
  })

  it('returns correct percentage', () => {
    expect(getProgressPercent(3, 9)).toBeCloseTo(33.33)
  })
})
