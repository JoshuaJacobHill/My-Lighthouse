// Change the fitness challenge's collective goal, and its name if it says the
// old number out loud.
//
//   node scripts/migrate/set-challenge-goal.mjs
//   node scripts/migrate/set-challenge-goal.mjs 5000000 --apply
//   node scripts/migrate/set-challenge-goal.mjs 5000000 --name "5 million steps in September" --apply
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
const nameIdx = args.indexOf('--name')
const name = nameIdx >= 0 ? args[nameIdx + 1] : null

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

if (!goalArg) {
  console.log('\nPass a goal to change it, e.g. 5000000, then --apply to write.')
  await client.end()
  process.exit(0)
}

const goal = Number(goalArg)
const target = before[0]

console.log(`\n${target.name}: goal ${target.goal.toLocaleString()} → ${goal.toLocaleString()}`)
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

const { rowCount } = await client.query(
  name
    ? `UPDATE "FitnessChallenge" SET goal = $1, name = $2 WHERE id = $3`
    : `UPDATE "FitnessChallenge" SET goal = $1 WHERE id = $2`,
  name ? [goal, name, target.id] : [goal, target.id]
)

console.log(`\nApplied to ${rowCount} row.`)
console.table(
  (await client.query(`SELECT id, name, goal FROM "FitnessChallenge" WHERE id = $1`, [target.id]))
    .rows
)

await client.end()
