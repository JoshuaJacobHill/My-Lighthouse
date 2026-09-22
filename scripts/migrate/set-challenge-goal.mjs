// Change the fitness challenge's collective goal, and its name if it says the
// old number out loud.
//
//   node scripts/migrate/set-challenge-goal.mjs
//   node scripts/migrate/set-challenge-goal.mjs 5000000 --apply
//   node scripts/migrate/set-challenge-goal.mjs 5000000 --name "5 million steps in September" --apply
//   node scripts/migrate/set-challenge-goal.mjs --starts 2026-08-31T14:00:00Z --ends 2026-09-30T13:59:59Z --apply
//
// The dates are stored as UTC and Brisbane is UTC+10 all year, so midnight on
// 1 September is 2026-08-31T14:00:00Z, and the last second of 30 September is
// 2026-09-30T13:59:59Z. Getting this wrong by ten hours is the documented trap
// in docs/DATA.md, and it decides when step entry closes — the window is what
// `entriesOpen()` reads.
//
// The goal is a column rather than a constant so it can move without a deploy,
// but there is no admin screen for it yet — so this is the way to move it.
// Everything on the page derives from the column: the milestones are fractions
// of it, the pace maths divides by it, and the prose runs through goalPhrase().
//
// The name is separate and does not derive from anything. If it reads
// "10 million steps in September", changing the goal alone leaves the heading
// contradicting the bar underneath it, which is why this prints it.
//
// Reads the production URL from scripts/migrate/.sydney — `.env.local` points
// at a local database and would silently report nothing.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const goalArg = args.find((a) => /^\d+$/.test(a))
const flag = (f) => {
  const i = args.indexOf(f)
  return i >= 0 ? args[i + 1] : null
}
const name = flag('--name')
const startsAt = flag('--starts')
const endsAt = flag('--ends')

const client = new pg.Client({
  connectionString: fs.readFileSync(path.join(here, '.sydney'), 'utf8').trim(),
})
await client.connect()

const { rows: before } = await client.query(
  `SELECT id, name, slug, goal, "startsAt", "endsAt" FROM "FitnessChallenge" ORDER BY "startsAt" DESC`
)

console.log('Challenges:')
console.table(before)

if (before.length === 0) {
  console.log('\nNothing to change.')
  await client.end()
  process.exit(0)
}

if (!goalArg && !name && !startsAt && !endsAt) {
  console.log('\nPass a goal, --name, --starts or --ends to change something, then --apply.')
  await client.end()
  process.exit(0)
}

const target = before[0]
const goal = goalArg ? Number(goalArg) : target.goal

const bne = (d) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(d)

if (goalArg) {
  console.log(`\n${target.name}: goal ${target.goal.toLocaleString()} → ${goal.toLocaleString()}`)
}
if (startsAt) console.log(`starts: ${bne(target.startsAt)} → ${bne(new Date(startsAt))} (Brisbane)`)
if (endsAt) console.log(`ends:   ${bne(target.endsAt)} → ${bne(new Date(endsAt))} (Brisbane)`)
if (name) console.log(`name: "${target.name}" → "${name}"`)
else if (/\b\d+(\.\d+)?\s*(m|million)\b/i.test(target.name)) {
  console.log(`\n⚠  The name still says a number: "${target.name}"`)
  console.log('   Pass --name "…" to change it too, or the heading will contradict the bar.')
}

if (!apply) {
  console.log('\nReport only. Re-run with --apply to write.')
  await client.end()
  process.exit(0)
}

const sets = []
const values = []
const add = (col, value) => {
  values.push(value)
  sets.push(`"${col}" = $${values.length}`)
}
if (goalArg) add('goal', goal)
if (name) add('name', name)
if (startsAt) add('startsAt', new Date(startsAt))
if (endsAt) add('endsAt', new Date(endsAt))
values.push(target.id)

const { rowCount } = await client.query(
  `UPDATE "FitnessChallenge" SET ${sets.join(', ')} WHERE id = $${values.length}`,
  values
)

console.log(`\nApplied to ${rowCount} row.`)
console.table(
  (
    await client.query(
      `SELECT name, goal, "startsAt", "endsAt" FROM "FitnessChallenge" WHERE id = $1`,
      [target.id]
    )
  ).rows
)

await client.end()
