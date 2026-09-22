// Log or correct step entries for one person, for days they missed.
//
//   node scripts/migrate/log-steps.mjs someone@example.com 2026-09-16=4189 2026-09-17=3604
//   node scripts/migrate/log-steps.mjs someone@example.com 2026-09-16=4189 --apply
//
// The fitness page is the normal way in; this exists for catching up somebody
// else's missed days, or your own from a phone screenshot, without signing in
// as them.
//
// Entries are corrections, not additions: the table is unique on
// (challengeId, userId, day), so a second figure for a day replaces the first.
// The report prints what is already there next to what would replace it, so a
// typo in a date shows up as an unexpected overwrite rather than landing
// silently.
//
// `day` is a @db.Date holding the Brisbane calendar day as midnight UTC —
// building it any other way shifts every entry back a day. See
// src/lib/fitness-days.ts, which says the same thing at more length.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const email = args.find((a) => a.includes('@'))
const pairs = args
  .filter((a) => /^\d{4}-\d{2}-\d{2}=\d+$/.test(a))
  .map((a) => {
    const [day, amount] = a.split('=')
    return { day, amount: Number(amount) }
  })

if (!email || pairs.length === 0) {
  console.log('Usage: log-steps.mjs <email> <yyyy-mm-dd>=<steps> [...] [--apply]')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: fs.readFileSync(path.join(here, '.sydney'), 'utf8').trim(),
})
await client.connect()

const { rows: users } = await client.query(
  `SELECT id, name, email, "isStaff", "isTrainee" FROM "User" WHERE lower(email) = lower($1)`,
  [email]
)
if (users.length !== 1) {
  console.log(`Expected one account for ${email}, found ${users.length}.`)
  await client.end()
  process.exit(1)
}
const user = users[0]

const { rows: challenges } = await client.query(
  `SELECT id, name, goal, "startsAt", "endsAt" FROM "FitnessChallenge"
   WHERE "isActive" = true ORDER BY "startsAt" DESC LIMIT 1`
)
if (challenges.length === 0) {
  console.log('No active challenge.')
  await client.end()
  process.exit(1)
}
const challenge = challenges[0]

console.log(`${user.name ?? user.email} <${user.email}>`)
if (!user.isStaff && !user.isTrainee) {
  console.log('⚠  Not marked staff or trainee — they would not see the challenge page.')
}
console.log(`Challenge: ${challenge.name}\n`)

const { rows: existing } = await client.query(
  `SELECT to_char(day, 'YYYY-MM-DD') AS day, amount FROM "FitnessEntry"
   WHERE "challengeId" = $1 AND "userId" = $2 AND day = ANY($3::date[])`,
  [challenge.id, user.id, pairs.map((p) => p.day)]
)
const already = new Map(existing.map((r) => [r.day, r.amount]))

const start = challenge.startsAt.toISOString().slice(0, 10)
const end = challenge.endsAt.toISOString().slice(0, 10)

console.table(
  pairs.map((p) => ({
    day: p.day,
    current: already.has(p.day) ? already.get(p.day) : '—',
    new: p.amount,
    action: !(p.day >= start && p.day <= end)
      ? 'SKIP — outside the challenge'
      : already.has(p.day)
        ? already.get(p.day) === p.amount
          ? 'no change'
          : 'REPLACES the figure above'
        : 'add',
  }))
)

const writable = pairs.filter((p) => p.day >= start && p.day <= end)

if (!apply) {
  console.log('\nReport only. Re-run with --apply to write.')
  await client.end()
  process.exit(0)
}

await client.query('BEGIN')
try {
  for (const p of writable) {
    await client.query(
      `INSERT INTO "FitnessEntry" (id, "challengeId", "userId", day, amount, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3::date, $4, now(), now())
       ON CONFLICT ("challengeId", "userId", day)
       DO UPDATE SET amount = EXCLUDED.amount, "updatedAt" = now()`,
      [challenge.id, user.id, p.day, p.amount]
    )
  }
  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK')
  throw err
}

const { rows: after } = await client.query(
  `SELECT to_char(day, 'YYYY-MM-DD') AS day, amount FROM "FitnessEntry"
   WHERE "challengeId" = $1 AND "userId" = $2 ORDER BY day`,
  [challenge.id, user.id]
)
console.log(`\nApplied ${writable.length} day(s). Their whole challenge now:`)
console.table(after)
console.log(`Their total: ${after.reduce((n, r) => n + r.amount, 0).toLocaleString()} steps`)

await client.end()
