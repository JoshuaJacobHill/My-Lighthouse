// Company-name matching for corporate volunteering. Real company names are
// messy (case, "Pty Ltd", "&"/"and"), so we normalise to a key and match
// bidirectionally. Plain module — safe to import from client or server.

/** Normalise a company name to a comparable key. */
export function companyKeyOf(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pty|ltd|limited|inc|incorporated|the|jv)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Do two company names refer to the same organisation? */
export function companiesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = companyKeyOf(a)
  const kb = companyKeyOf(b)
  if (!ka || !kb) return false
  if (ka === kb) return true
  // Bidirectional containment, but only on a substantial key to avoid false hits.
  if (ka.length >= 5 && kb.includes(ka)) return true
  if (kb.length >= 5 && ka.includes(kb)) return true
  return false
}
