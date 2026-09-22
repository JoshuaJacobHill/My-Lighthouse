/**
 * Who a piece of content is for.
 *
 * One idea shared by stories and events, replacing the `churchOnly` /
 * `staffOnly` / `signedInOnly` booleans that grew one at a time. The booleans
 * are still written alongside this while the read paths move across; see
 * `flagsFromRule`.
 *
 * Deliberately free of Prisma and `next/navigation`, like `permissions-core.ts`,
 * so the admin picker can ask the same questions without dragging the database
 * driver into the browser bundle. The Prisma filters live in `audience.ts`.
 *
 * The shape mirrors the columns exactly: `audienceKinds`, `audienceMatch`,
 * `audienceGate`, `audiencePublic`. Anything derived is derived here, so there
 * is one place to read when the answer is surprising.
 */

/**
 * The audiences we can actually answer, each resolvable from how somebody is
 * connected to Lighthouse rather than from a list an admin maintains by hand.
 *
 * Shoppers and Santa's Little Helpers are deliberately absent. They are real
 * audiences — `PURPOSE.md` names both — but nothing in the database knows who
 * they are yet, and a tickbox that silently matches nobody reads as a promise
 * the app cannot keep. They belong here once they have a source of truth.
 */
export const AUDIENCE_KINDS = ['church', 'staff', 'volunteers', 'donors', 'partners'] as const

export type AudienceKind = (typeof AUDIENCE_KINDS)[number]

export function isAudienceKind(v: unknown): v is AudienceKind {
  return typeof v === 'string' && (AUDIENCE_KINDS as readonly string[]).includes(v)
}

/** What the admin picker shows, and what the audit trail says. */
export const AUDIENCE_LABELS: Record<AudienceKind, string> = {
  church: 'Church members',
  staff: 'Staff',
  volunteers: 'Volunteers',
  donors: 'Donors',
  partners: 'Corporate partners',
}

/** The one-liner under each tickbox, so the rule is legible without docs. */
export const AUDIENCE_HINTS: Record<AudienceKind, string> = {
  church: 'Anyone marked as a church member.',
  staff: 'Staff and trainees.',
  volunteers: 'Anyone with a volunteer profile.',
  donors: 'Anyone who has given.',
  partners: 'People from a partner organisation.',
}

export type AudienceMatch = 'ANY' | 'ALL'
/**
 * What somebody holding the link gets when they are outside the audience.
 *
 * SHOW is unlisted — the link works for anyone, signed in or not, but the thing
 * never appears on their dashboard. ASK makes them sign in first. HIDE 404s.
 */
export type AudienceGate = 'SHOW' | 'ASK' | 'HIDE'

/**
 * How somebody is connected to Lighthouse, as the audience rules ask about it.
 *
 * Built once per request from the viewer's row. Staff and trainees are one
 * audience on purpose: the rest of the app already treats them together, and
 * splitting them here would invent a distinction nobody asked for.
 */
export type ViewerConnections = {
  isChurchMember: boolean
  isStaff: boolean
  isTrainee: boolean
  isVolunteer: boolean
  hasGiven: boolean
  isPartner: boolean
}

export type AudienceRule = {
  /**
   * Visible to people who are not signed in.
   *
   * Events only. There is no public story page — one was built here and
   * removed, because publishing to the portal is not the same decision as
   * publishing to the world (`docs/features/STORIES.md`).
   */
  public: boolean
  /** Empty means any signed-in supporter. */
  kinds: AudienceKind[]
  /** ANY is what the picker produces; see the enum comment in the schema. */
  match: AudienceMatch
  /**
   * What somebody outside the audience gets when they open the link. Never
   * affects listing — that is what `kinds` and `public` are for.
   */
  gate: AudienceGate
}

/** A public event: anyone may read it. */
export const PUBLIC_RULE: AudienceRule = { public: true, kinds: [], match: 'ANY', gate: 'SHOW' }

/** Any signed-in supporter, and a sign-in prompt for everybody else. */
export const SIGNED_IN_RULE: AudienceRule = {
  public: false,
  kinds: [],
  match: 'ANY',
  gate: 'ASK',
}

/** Which audiences this viewer belongs to. Somebody is usually several. */
export function heldKinds(v: ViewerConnections): AudienceKind[] {
  const held: AudienceKind[] = []
  if (v.isChurchMember) held.push('church')
  if (v.isStaff || v.isTrainee) held.push('staff')
  if (v.isVolunteer) held.push('volunteers')
  if (v.hasGiven) held.push('donors')
  if (v.isPartner) held.push('partners')
  return held
}

/** The audiences this viewer does *not* belong to. Used by the ALL filter. */
export function missingKinds(v: ViewerConnections): AudienceKind[] {
  const held = new Set(heldKinds(v))
  return AUDIENCE_KINDS.filter((k) => !held.has(k))
}

/**
 * Does this appear on their dashboard? `null` is somebody not signed in.
 *
 * Listing only. The SQL in `audience.ts` expresses this same rule for a page of
 * rows — change one, change both, and the tests compare them against each other
 * on every combination.
 */
export function isListedFor(rule: AudienceRule, viewer: ViewerConnections | null): boolean {
  if (!viewer) return rule.public
  if (rule.kinds.length === 0) return true
  const held = new Set(heldKinds(viewer))
  return rule.match === 'ALL'
    ? rule.kinds.every((k) => held.has(k))
    : rule.kinds.some((k) => held.has(k))
}

/**
 * May this viewer open the link?
 *
 * A wider question than listing, and deliberately so. An event promoted to one
 * group is routinely forwarded to somebody outside it, and refusing them makes
 * a link we sent look broken. `SHOW` is that case: never on their dashboard,
 * but the link works.
 */
export function canOpen(rule: AudienceRule, viewer: ViewerConnections | null): boolean {
  if (rule.gate === 'SHOW') return true
  return isListedFor(rule, viewer)
}

/**
 * The rule a row's old booleans describe.
 *
 * Used for the backfill and, until the read paths move over, to derive a rule
 * from a row that has not been saved since the columns landed.
 *
 * The both-flags case is the one to be careful with. A story marked
 * `churchOnly` *and* `staffOnly` was visible only to people who were both —
 * the dashboard applied the two filters one after the other. Mapping it to
 * ANY would widen it to every church member and every staff member, so it
 * becomes ALL instead.
 */
export function ruleFromFlags(flags: {
  churchOnly?: boolean
  staffOnly?: boolean
  signedInOnly?: boolean
  /** Stories are never public; events are unless a flag says otherwise. */
  canBePublic?: boolean
}): AudienceRule {
  const kinds: AudienceKind[] = []
  if (flags.churchOnly) kinds.push('church')
  if (flags.staffOnly) kinds.push('staff')

  // Exactly today's behaviour, so the backfill changes nothing: church-only and
  // staff-only 404ed, private asked, and an unflagged event opened for anybody.
  const gate: AudienceGate =
    flags.churchOnly || flags.staffOnly ? 'HIDE' : flags.signedInOnly ? 'ASK' : 'SHOW'

  const restricted = kinds.length > 0 || flags.signedInOnly === true
  return {
    public: flags.canBePublic === true && !restricted,
    kinds,
    match: kinds.length > 1 ? 'ALL' : 'ANY',
    gate,
  }
}

/**
 * The old booleans a rule implies, for dual-writing while the read paths still
 * consult them. Lossy on purpose — `partners`, `volunteers` and `donors` have
 * no boolean to land in, so a rule using them looks unrestricted to the old
 * readers. That is why the columns ship before the picker does.
 */
export function flagsFromRule(rule: AudienceRule): {
  churchOnly: boolean
  staffOnly: boolean
  signedInOnly: boolean
} {
  return {
    churchOnly: rule.kinds.includes('church'),
    staffOnly: rule.kinds.includes('staff'),
    signedInOnly: !rule.public && rule.kinds.length === 0,
  }
}

/** Plain English, for the admin list and the audit trail. */
export function describeAudienceRule(rule: AudienceRule): string {
  if (rule.public && rule.kinds.length === 0) return 'Everyone'
  if (rule.kinds.length === 0) return 'Anyone signed in'
  const names = rule.kinds.map((k) => AUDIENCE_LABELS[k])
  const joined =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} ${rule.match === 'ALL' ? 'and' : 'or'} ${names[names.length - 1]}`
  return rule.match === 'ALL' ? `Both ${joined}` : joined
}

/**
 * Read a rule off a row, tolerating rows written before the columns existed.
 *
 * The columns are non-null with defaults, so a row saved since the migration
 * always has one. A row that predates the backfill would carry the default
 * "everyone", which is wider than its booleans — so the booleans win whenever
 * they say something narrower and the columns say nothing.
 */
export function ruleFromRow(
  row: {
    audienceKinds?: string[] | null
    audienceMatch?: string | null
    audienceGate?: string | null
    audiencePublic?: boolean | null
    churchOnly?: boolean
    staffOnly?: boolean
    signedInOnly?: boolean
  },
  opts: { canBePublic: boolean }
): AudienceRule {
  const kinds = (row.audienceKinds ?? []).filter(isAudienceKind)
  const fromFlags = ruleFromFlags({
    churchOnly: row.churchOnly,
    staffOnly: row.staffOnly,
    signedInOnly: row.signedInOnly,
    canBePublic: opts.canBePublic,
  })

  // An un-backfilled row: nothing in the columns, restriction in the booleans.
  //
  // The test is `!fromFlags.public`, not "the flags name an audience". A
  // private event names no audience at all — it is `signedInOnly` with empty
  // kinds — and `audiencePublic` defaults to true, so a narrower test would
  // have read an un-backfilled private event as public. The flags win whenever
  // they say anything narrower than the columns do.
  if (kinds.length === 0 && row.audiencePublic !== false && !fromFlags.public) {
    return fromFlags
  }

  return {
    public: opts.canBePublic && (row.audiencePublic ?? fromFlags.public),
    kinds,
    match: row.audienceMatch === 'ALL' ? 'ALL' : 'ANY',
    gate:
      row.audienceGate === 'HIDE' || row.audienceGate === 'ASK' || row.audienceGate === 'SHOW'
        ? row.audienceGate
        : fromFlags.gate,
  }
}

/**
 * The rule a submitted form describes.
 *
 * A payload carrying `audience` came from the picker. One without it came from
 * a form still using the old checkboxes, so the flags decide — which is what
 * keeps both kinds of form working while they are being replaced.
 */
export function ruleFromInput(
  input: {
    audience?: { public?: boolean; kinds?: string[]; match?: string; gate?: string }
    churchOnly?: boolean
    staffOnly?: boolean
    signedInOnly?: boolean
  },
  opts: { canBePublic: boolean }
): AudienceRule {
  if (!input.audience) {
    return ruleFromFlags({
      churchOnly: input.churchOnly,
      staffOnly: input.staffOnly,
      signedInOnly: input.signedInOnly,
      canBePublic: opts.canBePublic,
    })
  }
  const a = input.audience
  const kinds = (a.kinds ?? []).filter(isAudienceKind)
  return {
    public: opts.canBePublic && a.public === true && kinds.length === 0,
    kinds,
    match: a.match === 'ALL' ? 'ALL' : 'ANY',
    gate: a.gate === 'HIDE' || a.gate === 'SHOW' ? a.gate : 'ASK',
  }
}

/**
 * Columns for an Event write: the rule, plus the old booleans kept in step.
 *
 * Both are written until every read path has moved across. Writing only the
 * rule would leave the old readers seeing a row as unrestricted; writing only
 * the booleans would lose any audience they cannot express.
 */
export function eventAudienceColumns(rule: AudienceRule) {
  const flags = flagsFromRule(rule)
  return {
    audiencePublic: rule.public,
    audienceKinds: rule.kinds,
    audienceMatch: rule.match,
    audienceGate: rule.gate,
    churchOnly: flags.churchOnly,
    signedInOnly: flags.signedInOnly,
  }
}

/**
 * The same for a Story, which has neither `signedInOnly` nor `audiencePublic` —
 * stories live behind a sign-in and the missing column is deliberate.
 */
export function storyAudienceColumns(rule: AudienceRule) {
  const flags = flagsFromRule(rule)
  return {
    audienceKinds: rule.kinds,
    audienceMatch: rule.match,
    audienceGate: rule.gate,
    churchOnly: flags.churchOnly,
    staffOnly: flags.staffOnly,
  }
}
