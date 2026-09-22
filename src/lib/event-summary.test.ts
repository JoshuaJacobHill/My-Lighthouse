import { describe, it, expect } from 'vitest'
import { eventSummaryLines, formatEventSummary } from '@/lib/utils'

/**
 * The line somebody reads on the payment page, right before they pay.
 *
 * Brisbane is UTC+10 with no daylight saving, so a 6:30pm start is stored as
 * 08:30Z. Every case here is written in UTC for that reason — a formatter that
 * quietly used the server's zone would pass a naive test and tell somebody in
 * Sydney the wrong evening.
 */

const at = (iso: string) => new Date(iso)

describe('formatEventSummary', () => {
  it('collapses a range inside one month the way a poster says it', () => {
    // GENERALZ: 16–17 October 2026, 6:30pm to 5:00pm.
    expect(
      formatEventSummary(
        at('2026-10-16T08:30:00Z'),
        at('2026-10-17T07:00:00Z'),
        'Lighthouse Family Church'
      )
    ).toBe(
      'Date: 16–17 October 2026 · Time: 6:30 pm – 5:00 pm · Location: Lighthouse Family Church'
    )
  })

  it('spells both dates out when the range crosses a month', () => {
    expect(formatEventSummary(at('2026-10-31T00:00:00Z'), at('2026-11-01T02:00:00Z'))).toContain(
      'Date: 31 October 2026 – 1 November 2026'
    )
  })

  it('gives one date and one time for a single-day event', () => {
    expect(formatEventSummary(at('2026-03-14T23:00:00Z'), null, 'Loganholme')).toBe(
      'Date: 15 March 2026 · Time: 9:00 am · Location: Loganholme'
    )
  })

  it('does not repeat a time when start and end match', () => {
    const t = at('2026-03-14T23:00:00Z')
    expect(formatEventSummary(t, t)).toBe('Date: 15 March 2026 · Time: 9:00 am')
  })

  it('says so when the date is still to be advised', () => {
    // startsAt is nullable on purpose — sponsors get collected before a date.
    expect(formatEventSummary(null, null, 'Logan Metro')).toBe(
      'Date: to be advised · Location: Logan Metro'
    )
  })

  it('leaves the location out rather than trailing an empty label', () => {
    expect(formatEventSummary(at('2026-03-14T23:00:00Z'))).not.toContain('Location')
  })
})

describe('eventSummaryLines', () => {
  it('gives one labelled line per field, so a break is optional not load-bearing', () => {
    expect(
      eventSummaryLines(
        at('2026-10-16T08:30:00Z'),
        at('2026-10-17T07:00:00Z'),
        'Lighthouse Family Church',
        'Saturday Only'
      )
    ).toEqual([
      'Date: 16–17 October 2026',
      'Time: 6:30 pm – 5:00 pm',
      'Location: Lighthouse Family Church',
      'Ticket: Saturday Only',
    ])
  })

  it('leaves out the ticket line when there is nothing to say', () => {
    const lines = eventSummaryLines(at('2026-10-16T08:30:00Z'), null, 'Crestmead')
    expect(lines.some((l) => l.startsWith('Ticket:'))).toBe(false)
  })
})
