/**
 * Catching an email typo while somebody is still looking at the screen.
 *
 * Pure and Prisma-free so the form can call it on every keystroke. This is a
 * **hint, not a gate**: it never blocks a save, because the cost of being
 * wrong in each direction is not symmetric. A mistyped address means a family
 * silently never hears from us; a refused address means somebody with an
 * unusual but perfectly good domain cannot be helped at all. The first is
 * recoverable by asking again, the second turns people away.
 *
 * Nothing here proves an address exists. Only sending to it does that — see
 * `account-check.ts`, which is what actually gates access.
 */

export type EmailHint =
  /** Nothing typed, or too early to have an opinion. Say nothing. */
  | { kind: 'quiet' }
  /** Definitely malformed. */
  | { kind: 'invalid'; message: string }
  /** Probably a slip, with the address we think they meant. */
  | { kind: 'suggestion'; suggestion: string; message: string }
  /** Looks fine. */
  | { kind: 'ok' }

/**
 * The domains our families actually use.
 *
 * Australian providers sit beside the global ones deliberately: bigpond and
 * optusnet turn up constantly in Logan and would otherwise be flagged as
 * near-misses for something else.
 */
const COMMON_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'yahoo.com.au',
  'icloud.com',
  'me.com',
  'live.com',
  'live.com.au',
  'msn.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'bigpond.com',
  'bigpond.net.au',
  'optusnet.com.au',
  'iinet.net.au',
  'tpg.com.au',
  'dodo.com.au',
  'internode.on.net',
  'westnet.com.au',
  'hotmail.com.au',
  'outlook.com.au',
]

/** Endings people reach for that are never right. */
const TLD_FIXES: Record<string, string> = {
  con: 'com',
  cmo: 'com',
  ocm: 'com',
  comm: 'com',
  cim: 'com',
  vom: 'com',
  xom: 'com',
  co: 'com',
  nte: 'net',
  ner: 'net',
  orgg: 'org',
}

/**
 * Edit distance, capped, counting a swapped pair as **one** mistake.
 *
 * That last part is the whole reason this is not plain Levenshtein: "gmial"
 * for "gmail" is two substitutions by that measure and one transposition by
 * this one — and transposing adjacent letters is the most common typo there
 * is. Without it the single most likely misspelling of the most common domain
 * in the country sails through unflagged.
 */
function distance(a: string, b: string, max = 3): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1

  // Optimal string alignment: three rows, because a transposition needs to
  // look two back as well as one.
  let twoBack: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoBack[j - 2] + 1)
      }
      row[j] = value
      if (value < best) best = value
    }
    if (best > max) return max + 1
    twoBack = prev
    prev = row
  }
  return prev[b.length]
}

/**
 * Tidy an address the way a person means it.
 *
 * Lowercases, trims, drops a pasted `mailto:` and strips the spaces phones
 * love to add. Not a correction — just the form the rest of this file reasons
 * about, and what should be saved.
 */
export function normaliseEmail(raw: string): string {
  return raw.trim().replace(/^mailto:/i, '').replace(/\s+/g, '').toLowerCase()
}

/**
 * The domain we think they meant, or null if this one looks fine.
 *
 * Tries the whole domain first, then the ending on its own — "gmail.con" is a
 * TLD slip while "gmial.com" is a finger slip, and they need different
 * comparisons. An exact match short-circuits, so a real domain is never
 * "corrected" into a more common one.
 */
export function suggestDomain(domain: string): string | null {
  if (!domain || COMMON_DOMAINS.includes(domain)) return null

  // "gmail.com.au" and friends: a real provider with a country code bolted on.
  if (domain.endsWith('.au')) {
    const without = domain.slice(0, -3)
    if (COMMON_DOMAINS.includes(without) && !COMMON_DOMAINS.includes(domain)) return without
  }

  // Fix a hopeless ending first, but do NOT stop there: "gmial.con" is two
  // mistakes in one address, and suggesting "gmial.com" corrects the half
  // nobody would have noticed while leaving the half they would.
  let working = domain
  const parts = domain.split('.')
  const tld = parts[parts.length - 1]
  if (TLD_FIXES[tld]) {
    working = [...parts.slice(0, -1), TLD_FIXES[tld]].join('.')
    if (COMMON_DOMAINS.includes(working)) return working
  }

  // Near-miss on the whole domain. One edit for short domains, two for longer
  // ones — "one letter out of six" is a much bolder guess than one out of
  // fifteen, so the tolerance scales rather than being a flat number.
  let best: { domain: string; score: number } | null = null
  for (const candidate of COMMON_DOMAINS) {
    const limit = candidate.length <= 9 ? 1 : 2
    const score = distance(working, candidate, limit)
    if (score <= limit && (!best || score < best.score)) best = { domain: candidate, score }
  }
  if (best) return best.domain

  // No provider matched, but the ending was still wrong — worth saying.
  return working !== domain ? working : null
}

/**
 * Permissive on purpose.
 *
 * Not an RFC implementation — those accept things no mail server will and
 * reject things that work. This asks the only questions worth asking: is there
 * exactly one `@`, is there something either side of it, and does the domain
 * have a dot with a plausible ending.
 */
function shapeProblem(email: string): string | null {
  const at = email.split('@')
  if (at.length > 2) return 'That has more than one @.'
  if (at.length < 2) return null

  const [local, domain] = at
  if (!local) return 'Add the part before the @.'
  if (/[,;:\s"()[\]<>\\]/.test(local)) return 'That has a character an email cannot contain.'
  if (!domain) return null
  if (domain.startsWith('.') || domain.startsWith('-')) return 'The domain cannot start like that.'
  if (domain.includes('..') || local.includes('..')) return 'That has two dots together.'
  if (domain.endsWith('.')) return null
  if (!domain.includes('.')) return null

  const tld = domain.slice(domain.lastIndexOf('.') + 1)
  if (tld.length < 2) return null
  if (!/^[a-z]{2,}$/.test(tld)) return 'The ending after the last dot looks wrong.'
  return null
}

/** True once the address is complete enough to have an opinion about. */
function looksFinished(email: string): boolean {
  const [, domain] = email.split('@')
  if (!domain || !domain.includes('.')) return false
  const tld = domain.slice(domain.lastIndexOf('.') + 1)
  return tld.length >= 2
}

/**
 * What to tell somebody about the address they are typing.
 *
 * Deliberately quiet until they have finished: complaining about "j@" while
 * they are still mid-word trains people to ignore the message that matters.
 * Genuine structural errors — two @ signs, a comma — are called out straight
 * away, because more typing will not fix those.
 */
export function emailHint(raw: string): EmailHint {
  const email = normaliseEmail(raw)
  if (!email) return { kind: 'quiet' }

  const problem = shapeProblem(email)
  if (problem) return { kind: 'invalid', message: problem }

  if (!looksFinished(email)) return { kind: 'quiet' }

  const domain = email.slice(email.lastIndexOf('@') + 1)
  const suggestion = suggestDomain(domain)
  if (suggestion) {
    const fixed = `${email.slice(0, email.lastIndexOf('@'))}@${suggestion}`
    return { kind: 'suggestion', suggestion: fixed, message: `Did you mean ${fixed}?` }
  }

  return { kind: 'ok' }
}
