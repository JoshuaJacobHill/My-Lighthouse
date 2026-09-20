import { describe, it, expect } from 'vitest'
import { safeNext } from '@/lib/safe-next'

/**
 * An unchecked `?next=` is an open redirect, and the moment it matters is
 * immediately after somebody has typed their password. Each rejection below is
 * a real shape attackers use.
 */
describe('safeNext', () => {
  it('allows a path in this app', () => {
    expect(safeNext('/events/good-food-festival-2026')).toBe('/events/good-food-festival-2026')
    expect(safeNext('/dashboard?tab=giving')).toBe('/dashboard?tab=giving')
    expect(safeNext('/events/x#tickets')).toBe('/events/x#tickets')
  })

  it('refuses an absolute URL', () => {
    expect(safeNext('https://evil.test/login')).toBeNull()
    expect(safeNext('http://evil.test')).toBeNull()
  })

  it('refuses a protocol-relative URL, which is the one people forget', () => {
    // Browsers read "//evil.test" as "https://evil.test".
    expect(safeNext('//evil.test/path')).toBeNull()
  })

  it('refuses a backslash, which some browsers normalise to a slash', () => {
    expect(safeNext('/\\evil.test')).toBeNull()
    expect(safeNext('\\\\evil.test')).toBeNull()
  })

  it('refuses javascript: and data: schemes', () => {
    expect(safeNext('javascript:alert(1)')).toBeNull()
    expect(safeNext('data:text/html,<script>')).toBeNull()
  })

  it('refuses newlines and tabs used to smuggle past a naive check', () => {
    expect(safeNext('/ok\nhttps://evil.test')).toBeNull()
    expect(safeNext('/ok\thttps://evil.test')).toBeNull()
  })

  it('returns null for nothing at all', () => {
    expect(safeNext(null)).toBeNull()
    expect(safeNext(undefined)).toBeNull()
    expect(safeNext('')).toBeNull()
    expect(safeNext('   ')).toBeNull()
  })

  it('refuses a bare path with no leading slash', () => {
    expect(safeNext('dashboard')).toBeNull()
  })
})
