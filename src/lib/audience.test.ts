import { describe, it, expect, vi } from 'vitest'

/**
 * The audience rules, and the one property that actually protects anybody:
 * the single-item check and the list filter must agree.
 *
 * They are written twice — `canSee` in TypeScript for one item, `audienceWhere`
 * as SQL for a list — because a page reads one row and a dashboard reads a
 * page of them. Two expressions of one rule is exactly where private content
 * leaks: the item page refuses and the list quietly includes it, or the other
 * way round. So the last block runs every viewer against every rule and
 * demands the same answer from both.
 */

vi.mock('@/lib/prisma', () => ({ default: {} }))

const {
  AUDIENCE_KINDS,
  canSee,
  ruleFromFlags,
  flagsFromRule,
  describeAudienceRule,
  ruleFromRow,
  PUBLIC_RULE,
  SIGNED_IN_RULE,
} = await import('@/lib/audience-core')
const { eventAudienceWhere, storyAudienceWhere } = await import('@/lib/audience')

type Kind = (typeof AUDIENCE_KINDS)[number]

const NOBODY = {
  isChurchMember: false,
  isStaff: false,
  isTrainee: false,
  isVolunteer: false,
  hasGiven: false,
  isPartner: false,
}

const connections = (...kinds: Kind[]) => ({
  isChurchMember: kinds.includes('church'),
  isStaff: kinds.includes('staff'),
  isTrainee: false,
  isVolunteer: kinds.includes('volunteers'),
  hasGiven: kinds.includes('donors'),
  isPartner: kinds.includes('partners'),
})

describe('canSee', () => {
  it('lets a stranger read a public event and nothing else', () => {
    expect(canSee(PUBLIC_RULE, null)).toBe(true)
    expect(canSee(SIGNED_IN_RULE, null)).toBe(false)
    expect(canSee({ ...PUBLIC_RULE, public: false, kinds: ['church'] }, null)).toBe(false)
  })

  it('lets any signed-in supporter read one with no audiences listed', () => {
    expect(canSee(SIGNED_IN_RULE, NOBODY)).toBe(true)
  })

  it('ANY means any one of them is enough', () => {
    const rule = { public: false, kinds: ['church', 'staff'] as Kind[], match: 'ANY' as const, gate: 'HIDE' as const }
    expect(canSee(rule, connections('church'))).toBe(true)
    expect(canSee(rule, connections('staff'))).toBe(true)
    expect(canSee(rule, connections('donors'))).toBe(false)
  })

  it('ALL means all of them at once', () => {
    const rule = { public: false, kinds: ['church', 'staff'] as Kind[], match: 'ALL' as const, gate: 'HIDE' as const }
    expect(canSee(rule, connections('church'))).toBe(false)
    expect(canSee(rule, connections('staff'))).toBe(false)
    expect(canSee(rule, connections('church', 'staff'))).toBe(true)
  })

  it('counts a trainee as staff', () => {
    const rule = { public: false, kinds: ['staff'] as Kind[], match: 'ANY' as const, gate: 'HIDE' as const }
    expect(canSee(rule, { ...NOBODY, isTrainee: true })).toBe(true)
  })
})

describe('ruleFromFlags', () => {
  it('keeps church-only hidden rather than asking', () => {
    const r = ruleFromFlags({ churchOnly: true, canBePublic: true })
    expect(r).toMatchObject({ public: false, kinds: ['church'], match: 'ANY', gate: 'HIDE' })
  })

  it('keeps a private event asking rather than hiding', () => {
    const r = ruleFromFlags({ signedInOnly: true, canBePublic: true })
    expect(r).toMatchObject({ public: false, kinds: [], gate: 'ASK' })
  })

  it('does not widen a story that was church AND staff', () => {
    // The dashboard applied both filters in series, so this was visible only
    // to people who were both. ANY here would hand it to every church member.
    const r = ruleFromFlags({ churchOnly: true, staffOnly: true, canBePublic: false })
    expect(r.match).toBe('ALL')
    expect(canSee(r, connections('church'))).toBe(false)
    expect(canSee(r, connections('church', 'staff'))).toBe(true)
  })

  it('never makes a story public', () => {
    expect(ruleFromFlags({ canBePublic: false }).public).toBe(false)
  })

  it('leaves an unflagged event public', () => {
    expect(ruleFromFlags({ canBePublic: true }).public).toBe(true)
  })
})

describe('flagsFromRule', () => {
  it('round-trips the cases the booleans can express', () => {
    for (const flags of [
      { churchOnly: true, staffOnly: false, signedInOnly: false },
      { churchOnly: false, staffOnly: true, signedInOnly: false },
      { churchOnly: false, staffOnly: false, signedInOnly: true },
    ]) {
      const rule = ruleFromFlags({ ...flags, canBePublic: true })
      expect(flagsFromRule(rule)).toMatchObject(flags)
    }
  })

  it('marks an audience the booleans cannot express as signed-in only', () => {
    // No boolean means "donors". Old readers must at least not treat it as
    // public — narrower is survivable, wider is a leak.
    const rule = { public: false, kinds: ['donors'] as Kind[], match: 'ANY' as const, gate: 'ASK' as const }
    const flags = flagsFromRule(rule)
    expect(flags.churchOnly).toBe(false)
    expect(flags.staffOnly).toBe(false)
  })
})

describe('ruleFromRow', () => {
  it('trusts the booleans on a row the backfill has not reached', () => {
    const r = ruleFromRow({ churchOnly: true, audienceKinds: [], audiencePublic: true }, { canBePublic: true })
    expect(r.kinds).toEqual(['church'])
    expect(r.public).toBe(false)
  })

  it('does not read an un-backfilled private event as public', () => {
    // audiencePublic defaults to true, and signedInOnly names no audience — so
    // a row the backfill has not reached must still fall back to the flags.
    const r = ruleFromRow(
      { signedInOnly: true, audienceKinds: [], audiencePublic: true },
      { canBePublic: true }
    )
    expect(r.public).toBe(false)
    expect(canSee(r, null)).toBe(false)
    expect(r.gate).toBe('ASK')
  })

  it('still reads a genuinely public event as public', () => {
    const r = ruleFromRow({ audienceKinds: [], audiencePublic: true }, { canBePublic: true })
    expect(r.public).toBe(true)
  })

  it('reads a signed-in-only event saved by the picker', () => {
    const r = ruleFromRow({ audienceKinds: [], audiencePublic: false }, { canBePublic: true })
    expect(r.public).toBe(false)
  })

  it('ignores an audience kind it does not recognise', () => {
    const r = ruleFromRow({ audienceKinds: ['church', 'shoppers'], audiencePublic: false }, { canBePublic: true })
    expect(r.kinds).toEqual(['church'])
  })

  it('never returns public for a story', () => {
    const r = ruleFromRow({ audiencePublic: true, audienceKinds: [] }, { canBePublic: false })
    expect(r.public).toBe(false)
  })
})

describe('describeAudienceRule', () => {
  it('says what the picker set', () => {
    expect(describeAudienceRule(PUBLIC_RULE)).toBe('Everyone')
    expect(describeAudienceRule(SIGNED_IN_RULE)).toBe('Anyone signed in')
    expect(
      describeAudienceRule({ public: false, kinds: ['church', 'staff'], match: 'ANY', gate: 'HIDE' })
    ).toBe('Church members or Staff')
    expect(
      describeAudienceRule({ public: false, kinds: ['church', 'staff'], match: 'ALL', gate: 'HIDE' })
    ).toBe('Both Church members and Staff')
  })
})

/**
 * Evaluate the `where` fragment the way Postgres would, so the list filter can
 * be compared against the single-item check without a database.
 */
type Row = { audienceKinds: string[]; audienceMatch: 'ANY' | 'ALL'; audiencePublic: boolean }

function matches(where: Record<string, unknown>, row: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return (value as Record<string, unknown>[]).some((w) => matches(w, row))
    if (key === 'AND') return (value as Record<string, unknown>[]).every((w) => matches(w, row))
    if (key === 'NOT') return !matches(value as Record<string, unknown>, row)
    if (key === 'audiencePublic') return row.audiencePublic === value
    if (key === 'audienceMatch') return row.audienceMatch === value
    if (key === 'audienceKinds') {
      const f = value as { isEmpty?: boolean; hasSome?: string[] }
      if (f.isEmpty !== undefined) return (row.audienceKinds.length === 0) === f.isEmpty
      if (f.hasSome !== undefined) return f.hasSome.some((k) => row.audienceKinds.includes(k))
    }
    throw new Error(`unhandled filter key: ${key}`)
  })
}

describe('the list filter agrees with the single-item check', () => {
  const subsets: Kind[][] = []
  for (let mask = 0; mask < 1 << AUDIENCE_KINDS.length; mask++) {
    subsets.push(AUDIENCE_KINDS.filter((_, i) => mask & (1 << i)))
  }

  it('on every audience, for every viewer, either way round', () => {
    let checked = 0
    for (const viewerKinds of subsets) {
      const viewer = connections(...viewerKinds)
      const where = eventAudienceWhere(viewer) as Record<string, unknown>

      for (const kinds of subsets) {
        for (const match of ['ANY', 'ALL'] as const) {
          const row: Row = { audienceKinds: kinds, audienceMatch: match, audiencePublic: false }
          const rule = { public: false, kinds, match, gate: 'HIDE' as const }
          expect(matches(where, row), `${match} [${kinds}] vs viewer [${viewerKinds}]`).toBe(
            canSee(rule, viewer)
          )
          checked++
        }
      }
    }
    expect(checked).toBe(subsets.length * subsets.length * 2)
  })

  it('shows a stranger only what is marked public', () => {
    const where = eventAudienceWhere(null) as Record<string, unknown>
    expect(matches(where, { audienceKinds: [], audienceMatch: 'ANY', audiencePublic: true })).toBe(true)
    expect(matches(where, { audienceKinds: [], audienceMatch: 'ANY', audiencePublic: false })).toBe(false)
    expect(
      matches(where, { audienceKinds: ['church'], audienceMatch: 'ANY', audiencePublic: false })
    ).toBe(false)
  })

  it('shows a stranger no story at all', () => {
    // Not "the unrestricted ones" — nothing. There is no public story page.
    const where = storyAudienceWhere(null)
    expect(where).toEqual({ id: { in: [] } })
  })
})
