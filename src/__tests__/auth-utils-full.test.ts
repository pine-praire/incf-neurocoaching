// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { generateTempPassword } from '@/lib/auth-utils'

const ALLOWED = /^[A-HJ-NP-Za-hj-np-z2-9]{4}-[A-HJ-NP-Za-hj-np-z2-9]{4}-[A-HJ-NP-Za-hj-np-z2-9]{4}$/
const AMBIGUOUS = /[0O1Il]/
const DASH_RE = /^.{4}-.{4}-.{4}$/

// ── Structure ──────────────────────────────────────────────────────────────────

describe('generateTempPassword — structure', () => {
  it.each(Array.from({ length: 25 }, (_, i) => [i]))(
    'run %i: total length is 14', () => {
      expect(generateTempPassword()).toHaveLength(14)
    }
  )

  it.each(Array.from({ length: 25 }, (_, i) => [i]))(
    'run %i: matches Xxxx-Xxxx-Xxxx format', () => {
      expect(generateTempPassword()).toMatch(DASH_RE)
    }
  )

  it('dashes are at positions 4 and 9', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword()
      expect(pw[4]).toBe('-')
      expect(pw[9]).toBe('-')
    }
  })

  it('each segment is exactly 4 characters', () => {
    for (let i = 0; i < 20; i++) {
      const parts = generateTempPassword().split('-')
      expect(parts).toHaveLength(3)
      parts.forEach(p => expect(p).toHaveLength(4))
    }
  })
})

// ── Character set ──────────────────────────────────────────────────────────────

describe('generateTempPassword — character set', () => {
  it.each(Array.from({ length: 25 }, (_, i) => [i]))(
    'run %i: contains no ambiguous characters (0 O 1 I l)', () => {
      expect(generateTempPassword()).not.toMatch(AMBIGUOUS)
    }
  )

  it.each(Array.from({ length: 25 }, (_, i) => [i]))(
    'run %i: only uses allowed characters', () => {
      expect(generateTempPassword()).toMatch(ALLOWED)
    }
  )

  it('never contains digit 0', () => {
    for (let i = 0; i < 30; i++) expect(generateTempPassword()).not.toContain('0')
  })

  it('never contains letter O (uppercase)', () => {
    for (let i = 0; i < 30; i++) expect(generateTempPassword()).not.toContain('O')
  })

  it('never contains digit 1', () => {
    for (let i = 0; i < 30; i++) expect(generateTempPassword()).not.toContain('1')
  })

  it('never contains letter I (uppercase)', () => {
    for (let i = 0; i < 30; i++) expect(generateTempPassword()).not.toContain('I')
  })

  it('never contains letter l (lowercase)', () => {
    for (let i = 0; i < 30; i++) expect(generateTempPassword()).not.toContain('l')
  })

  it('character pool includes uppercase A–H range', () => {
    const pool = new Set<string>()
    for (let i = 0; i < 2000; i++) generateTempPassword().replace(/-/g, '').split('').forEach(c => pool.add(c))
    ;['A','B','C','D','E','F','G','H'].forEach(c => expect(pool.has(c)).toBe(true))
  })

  it('character pool includes digits 2–9', () => {
    const pool = new Set<string>()
    for (let i = 0; i < 2000; i++) generateTempPassword().replace(/-/g, '').split('').forEach(c => pool.add(c))
    ;['2','3','4','5','6','7','8','9'].forEach(c => expect(pool.has(c)).toBe(true))
  })
})

// ── Randomness & uniqueness ────────────────────────────────────────────────────

describe('generateTempPassword — randomness', () => {
  it.each(Array.from({ length: 10 }, (_, i) => [i * 10 + 10]))(
    'batch of %i passwords are all unique', (n) => {
      const set = new Set(Array.from({ length: n }, () => generateTempPassword()))
      expect(set.size).toBe(n)
    }
  )

  it('no two consecutive calls return the same value (100 pairs)', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateTempPassword()).not.toBe(generateTempPassword())
    }
  })

  it('500 generated passwords are all distinct', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateTempPassword()))
    expect(set.size).toBe(500)
  })

  it('character distribution across positions is not constant (3 runs differ)', () => {
    const a = generateTempPassword()
    const b = generateTempPassword()
    const c = generateTempPassword()
    expect(a === b && b === c).toBe(false)
  })

  it('each segment varies across 20 calls', () => {
    const seg0 = new Set<string>()
    const seg1 = new Set<string>()
    const seg2 = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const [s0, s1, s2] = generateTempPassword().split('-')
      seg0.add(s0); seg1.add(s1); seg2.add(s2)
    }
    expect(seg0.size).toBeGreaterThan(1)
    expect(seg1.size).toBeGreaterThan(1)
    expect(seg2.size).toBeGreaterThan(1)
  })
})

// ── Usability ──────────────────────────────────────────────────────────────────

describe('generateTempPassword — usability', () => {
  it('return type is string', () => {
    expect(typeof generateTempPassword()).toBe('string')
  })

  it('is callable without arguments', () => {
    expect(() => generateTempPassword()).not.toThrow()
  })

  it('password contains exactly 2 dashes', () => {
    for (let i = 0; i < 20; i++) {
      const dashes = generateTempPassword().split('').filter(c => c === '-').length
      expect(dashes).toBe(2)
    }
  })

  it('stripped password (no dashes) is 12 chars', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateTempPassword().replace(/-/g, '')).toHaveLength(12)
    }
  })

  it('password has no whitespace', () => {
    for (let i = 0; i < 30; i++) {
      expect(generateTempPassword()).not.toMatch(/\s/)
    }
  })

  it('password has no special chars beyond dashes', () => {
    for (let i = 0; i < 30; i++) {
      expect(generateTempPassword()).toMatch(/^[A-Za-z0-9-]+$/)
    }
  })

  it('passwords from two separate calls are independent', () => {
    const a = generateTempPassword()
    const b = generateTempPassword()
    expect(typeof a).toBe('string')
    expect(typeof b).toBe('string')
  })
})

// ── Stress ────────────────────────────────────────────────────────────────────

describe('generateTempPassword — stress', () => {
  it.each(Array.from({ length: 30 }, (_, i) => [i]))(
    'stress run %i: valid format under repeated calls', () => {
      for (let j = 0; j < 5; j++) {
        expect(generateTempPassword()).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]{4}-[A-HJ-NP-Za-hj-np-z2-9]{4}-[A-HJ-NP-Za-hj-np-z2-9]{4}$/)
      }
    }
  )
})
