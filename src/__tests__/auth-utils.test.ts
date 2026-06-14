// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { generateTempPassword } from '@/lib/auth-utils'

const AMBIGUOUS = /[0O1Il]/

describe('generateTempPassword', () => {
  it('returns a string of length 14 (4-4-4 + 2 dashes)', () => {
    expect(generateTempPassword()).toHaveLength(14)
  })

  it('matches the Xxxx-Xxxx-Xxxx format', () => {
    expect(generateTempPassword()).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/)
  })

  it('never contains ambiguous characters (0, O, 1, I, l)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTempPassword()).not.toMatch(AMBIGUOUS)
    }
  })

  it('produces unique values (no two passwords are the same across 100 runs)', () => {
    const passwords = new Set(Array.from({ length: 100 }, () => generateTempPassword()))
    expect(passwords.size).toBe(100)
  })

  it('only contains allowed characters', () => {
    for (let i = 0; i < 100; i++) {
      const pw = generateTempPassword().replace(/-/g, '')
      expect(pw).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]+$/)
    }
  })
})
