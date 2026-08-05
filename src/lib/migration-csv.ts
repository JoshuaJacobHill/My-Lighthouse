/**
 * CSV parsing for the donor-migration importer. Kept separate from the server
 * actions (and free of any server-only imports like prisma) so the admin UI
 * can import it into a Client Component for a live preview before submitting.
 */

export type MigrationFrequency = 'weekly' | 'fortnightly' | 'monthly'

export function isMigrationFrequency(v: string): v is MigrationFrequency {
  return v === 'weekly' || v === 'fortnightly' || v === 'monthly'
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface ParsedRow {
  ok: boolean
  name: string
  email: string
  company: string
  amountCents: number
  frequency: string
  error?: string
}

export function normaliseFrequency(raw: string): MigrationFrequency | null {
  const v = raw.trim().toLowerCase()
  if (v.startsWith('week')) return 'weekly'
  if (v.startsWith('fort') || v.includes('2 week') || v.includes('two week')) return 'fortnightly'
  if (v.startsWith('month')) return 'monthly'
  if (isMigrationFrequency(v)) return v
  return null
}

/** Parse a pasted CSV (header row optional) into validated rows. */
export function parseMigrationCsv(csv: string): ParsedRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []

  // Detect + map a header row so column order is flexible.
  let order = ['name', 'email', 'company', 'amount', 'frequency']
  const first = lines[0].toLowerCase()
  const hasHeader = first.includes('email')
  if (hasHeader) {
    order = lines[0].split(',').map((h) => h.trim().toLowerCase())
    lines.shift()
  }

  const idx = (key: string) => order.findIndex((h) => h.includes(key))
  const iName = idx('name')
  const iEmail = idx('email')
  const iCompany = idx('company') >= 0 ? idx('company') : idx('org')
  const iAmount = idx('amount')
  const iFreq = idx('freq')

  return lines.map((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const name = iName >= 0 ? cells[iName] ?? '' : ''
    const email = (iEmail >= 0 ? cells[iEmail] ?? '' : '').toLowerCase()
    const company = iCompany >= 0 ? cells[iCompany] ?? '' : ''
    const amountRaw = iAmount >= 0 ? cells[iAmount] ?? '' : ''
    const freqRaw = iFreq >= 0 ? cells[iFreq] ?? '' : ''

    const amount = Number(amountRaw.replace(/[$,\s]/g, ''))
    const amountCents = Math.round(amount * 100)
    const freq = normaliseFrequency(freqRaw)

    let error: string | undefined
    if (!EMAIL_RE.test(email)) error = 'Invalid email'
    else if (!Number.isFinite(amount) || amount <= 0) error = 'Invalid amount'
    else if (!freq) error = 'Invalid frequency (use weekly / fortnightly / monthly)'

    return {
      ok: !error,
      name,
      email,
      company,
      amountCents: Number.isFinite(amountCents) ? amountCents : 0,
      frequency: freq ?? freqRaw,
      error,
    }
  })
}
