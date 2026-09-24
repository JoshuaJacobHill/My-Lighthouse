import { describe, expect, it } from 'vitest'
import {
  datesBetween,
  describeDay,
  formatDay,
  parseDay,
  parseDays,
  timeLabel,
  withinWindow,
} from './slh-dropoff'

describe('parseDay', () => {
  it('reads a bare date written before times existed', () => {
    expect(parseDay('2026-12-01')).toEqual({ date: '2026-12-01', from: null, to: null })
  })

  it('reads a day with hours', () => {
    expect(parseDay('2026-12-01|09:00|12:00')).toEqual({
      date: '2026-12-01',
      from: '09:00',
      to: '12:00',
    })
  })

  it('keeps the day but drops hours that make no sense', () => {
    // An end before its start, or half a range, says nothing useful — but the
    // day itself is still real and must not disappear.
    expect(parseDay('2026-12-01|15:00|09:00')?.from).toBeNull()
    expect(parseDay('2026-12-01|09:00')?.from).toBeNull()
    expect(parseDay('2026-12-01|nine|noon')?.from).toBeNull()
    expect(parseDay('2026-12-01|25:00|26:00')?.from).toBeNull()
    expect(parseDay('2026-12-01|15:00|09:00')?.date).toBe('2026-12-01')
  })

  it('refuses anything that is not a day', () => {
    expect(parseDay('')).toBeNull()
    expect(parseDay('sometime in December')).toBeNull()
    expect(parseDay('26-12-01')).toBeNull()
  })

  it('round-trips', () => {
    for (const entry of ['2026-12-01', '2026-12-01|09:00|17:30']) {
      expect(formatDay(parseDay(entry)!)).toBe(entry)
    }
  })
})

describe('parseDays', () => {
  it('drops the unreadable and sorts the rest', () => {
    expect(parseDays(['2026-12-03', 'rubbish', '2026-12-01|09:00|12:00']).map((d) => d.date)).toEqual(
      ['2026-12-01', '2026-12-03'],
    )
  })

  it('copes with nothing at all', () => {
    expect(parseDays(null)).toEqual([])
    expect(parseDays([])).toEqual([])
  })
})

describe('labels', () => {
  it('says times the way a person would', () => {
    expect(timeLabel('09:00')).toBe('9am')
    expect(timeLabel('09:30')).toBe('9:30am')
    expect(timeLabel('12:00')).toBe('12pm')
    expect(timeLabel('00:00')).toBe('12am')
    expect(timeLabel('13:15')).toBe('1:15pm')
  })

  it('describes a day with and without hours', () => {
    expect(describeDay({ date: '2026-12-01', from: '09:00', to: '12:00' })).toBe(
      'Tue 1 Dec, 9am–12pm',
    )
    expect(describeDay({ date: '2026-12-01', from: null, to: null })).toBe('Tue 1 Dec')
  })
})

describe('datesBetween', () => {
  it('is inclusive of both ends', () => {
    expect(datesBetween('2026-12-01', '2026-12-03')).toEqual([
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
    ])
  })

  it('returns nothing for a backwards or malformed range', () => {
    expect(datesBetween('2026-12-03', '2026-12-01')).toEqual([])
    expect(datesBetween('', '2026-12-01')).toEqual([])
  })

  it('caps a mistyped year rather than building thousands of rows', () => {
    expect(datesBetween('2026-01-01', '2126-01-01').length).toBe(60)
  })
})

describe('withinWindow', () => {
  it('drops days a shortened window no longer covers', () => {
    const days = parseDays(['2026-11-30', '2026-12-01', '2026-12-10'])
    expect(withinWindow(days, '2026-12-01', '2026-12-05').map((d) => d.date)).toEqual([
      '2026-12-01',
    ])
  })
})
