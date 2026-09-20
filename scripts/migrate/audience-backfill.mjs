// Backfill the audience columns on Story and Event from the old flags.
//
//   node scripts/migrate/audience-backfill.mjs            # report only
//   node scripts/migrate/audience-backfill.mjs --apply    # write
//
// Reads the production URL from scripts/migrate/.sydney, like push-schema.sh.
// `.env.local` points at a local database, so taking DATABASE_URL here would
// silently report zeros against the wrong place.
//
// Idempotent: it derives the columns from the booleans every time, so running
// it twice is the same as running it once. Safe to re-run after a later push.
//
// The case worth watching is a story carrying churchOnly AND staffOnly. The
// dashboard applied those filters one after the other, so it was visible only
// to people who were both. Mapped to ANY it would become visible to every
// church member and every staff member, so those rows get ALL instead — and
// the report lists them, because a silent widening is exactly what this is
// meant to prevent.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const apply = process.argv.includes('--apply')
const url = process.argv[2]?.startsWith('postgres')
  ? process.argv[2]
  : fs.readFileSync(path.join(here, '.sydney'), 'utf8').trim()

const client = new pg.Client({ connectionString: url })
await client.connect()

const q = async (sql, params) => (await client.query(sql, params)).rows

console.log('Before:')
console.table(
  await q(`
    SELECT 'Event' AS model, count(*)::int AS rows,
           count(*) FILTER (WHERE "churchOnly")::int    AS church_only,
           count(*) FILTER (WHERE "signedInOnly")::int  AS private,
           0 AS staff_only,
           0 AS both
    FROM "Event"
    UNION ALL
    SELECT 'Story', count(*)::int,
           count(*) FILTER (WHERE "churchOnly")::int,
           0,
           count(*) FILTER (WHERE "staffOnly")::int,
           count(*) FILTER (WHERE "churchOnly" AND "staffOnly")::int
    FROM "Story"
  `)
)

const both = await q(
  `SELECT id, slug, title FROM "Story" WHERE "churchOnly" AND "staffOnly" ORDER BY "createdAt"`
)
if (both.length) {
  console.log(`\n${both.length} story/stories are church AND staff — kept narrow as ALL:`)
  console.table(both)
} else {
  console.log('\nNo story carries both flags, so nothing can widen.')
}

if (!apply) {
  console.log('\nReport only. Re-run with --apply to write.')
  await client.end()
  process.exit(0)
}

// A one-time migration, and re-running it is not free.
//
// It derives every column from the old booleans, which is right exactly once.
// Afterwards the picker can set audiences no boolean carries — donors,
// volunteers, partners, or a church event switched from "not found" to "sign
// in" — and a second run would reset those to whatever the booleans still say,
// silently and with no error to notice.
const [{ touched }] = await q(`
  SELECT (
    (SELECT count(*) FROM "Event"
      WHERE array_length("audienceKinds", 1) > 0 OR "audienceGate" = 'HIDE' OR NOT "audiencePublic")
    +
    (SELECT count(*) FROM "Story"
      WHERE array_length("audienceKinds", 1) > 0 OR "audienceGate" = 'HIDE')
  )::int AS touched
`)

if (touched > 0 && !process.argv.includes('--force')) {
  console.log(`
${touched} row(s) already carry an audience, so this has run before.

Running it again rebuilds every rule from the old booleans. Anything chosen
in the admin picker that no boolean can express — donors, volunteers,
partners, or a church event set to ask rather than hide — would be reset
without a word.

If that is genuinely what you want, add --force.`)
  await client.end()
  process.exit(1)
}

await client.query('BEGIN')
try {
  const ev = await client.query(`
    UPDATE "Event" SET
      "audienceKinds"  = CASE WHEN "churchOnly" THEN ARRAY['church'] ELSE ARRAY[]::text[] END,
      "audienceMatch"  = 'ANY'::"AudienceMatch",
      "audienceGate"   = CASE WHEN "churchOnly" THEN 'HIDE' ELSE 'ASK' END::"AudienceGate",
      "audiencePublic" = NOT ("churchOnly" OR "signedInOnly")
  `)

  const st = await client.query(`
    UPDATE "Story" SET
      "audienceKinds"  =
        CASE WHEN "churchOnly" THEN ARRAY['church'] ELSE ARRAY[]::text[] END
        || CASE WHEN "staffOnly" THEN ARRAY['staff'] ELSE ARRAY[]::text[] END,
      "audienceMatch"  = CASE WHEN "churchOnly" AND "staffOnly" THEN 'ALL' ELSE 'ANY' END::"AudienceMatch",
      "audienceGate"   = CASE WHEN "churchOnly" OR "staffOnly" THEN 'HIDE' ELSE 'ASK' END::"AudienceGate"
  `)

  await client.query('COMMIT')
  console.log(`\nApplied. Event ${ev.rowCount} rows, Story ${st.rowCount} rows.`)
} catch (err) {
  await client.query('ROLLBACK')
  throw err
}

console.log('\nAfter:')
console.table(
  await q(`
    SELECT 'Event' AS model, "audienceKinds"::text AS kinds, "audienceMatch"::text AS match,
           "audienceGate"::text AS gate, "audiencePublic" AS is_public, count(*)::int AS rows
    FROM "Event" GROUP BY 1,2,3,4,5
    UNION ALL
    -- Story has no audiencePublic column on purpose: there is no public story
    -- page. Reported as false so the two halves line up.
    SELECT 'Story', "audienceKinds"::text, "audienceMatch"::text,
           "audienceGate"::text, false, count(*)::int
    FROM "Story" GROUP BY 1,2,3,4
    ORDER BY 1, 2
  `)
)

await client.end()
