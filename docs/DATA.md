# The database, and its conventions

Supabase Postgres in Sydney, reached directly as `postgres` via Prisma. There
is no PostgREST and no Supabase Auth — see the RLS note at the bottom, which is
not optional.

## Money is stored two different ways

This is the single easiest thing to get wrong, and nothing will tell you.

| Style | Where | Example |
|---|---|---|
| **Integer cents** | Anything counted or reported: `SalesFact.revenueCents`, `GapSale.totalCents`, `AdDayStat.spendCents`, `OrgRecognition.amountCents`, `MarketingProposal` payloads | `7194` is $71.94 |
| **`Decimal(10,2)` dollars** | Anything Stripe touches: `Donation.amount`, `Fundraiser.goalAmount`, `TicketType.price`, `TicketOrder.amountTotal`, `Sponsorship.amount` | `71.94` is $71.94 |

The split is not an accident — money that moves through a payment provider
keeps the provider's representation; money we aggregate for a report is an
integer so summing it cannot drift. But a `Decimal` from Prisma is an object,
not a number: `Number(d)` before arithmetic, and never mix the two in one
expression without converting.

## Dates and times

**Brisbane is UTC+10 all year. There is no daylight saving.** That makes most
things easy and one thing subtle.

- **`@db.Date` columns (`day`) hold a Brisbane calendar day as midnight UTC.**
  `SalesFact.day`, `GapSale.day`, `AdDayStat.day`, `FitnessEntry.day`. Helpers
  live in `src/lib/fitness-days.ts` — `brisbaneToday()`, `calendarDay()`,
  `calendarDayString()`. Use them rather than constructing dates by hand.
- **`DateTime` columns hold UTC in a naive column.** Prisma maps `DateTime` to
  `timestamp` without a time zone and writes UTC into it. So to read a local
  hour you add 10; applying `AT TIME ZONE 'Australia/Brisbane'` in raw SQL
  converts the wrong way and silently shifts everything.
- Format for people with `Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane' })`.

## Schema rules

**Production changes are additive only.** New nullable columns, new tables, new
enum values. Never drop or rename — a deploy is not atomic with a migration,
and the old code runs against the new schema for a minute or two.

```bash
./scripts/push-schema.sh     # absolute paths, so npx cannot pull a newer major
npx prisma generate          # BEFORE tsc, or the types are stale
```

**After any push that creates a table, re-run the RLS lockdown.** New tables
arrive without row-level security, and Supabase would otherwise expose them
over REST to a publishable anon key. `psql` is not installed on this machine —
run it with node:

```bash
node --input-type=module -e "
import fs from 'node:fs'; import { Client } from 'pg'
const c = new Client({ connectionString: fs.readFileSync('scripts/migrate/.sydney','utf8').trim() })
await c.connect(); await c.query(fs.readFileSync('scripts/migrate/lockdown.sql','utf8'))
console.log((await c.query(\"select tablename from pg_tables where schemaname='public' and not rowsecurity\")).rows)
await c.end()"
```

The same pattern is how to query production for anything — `scripts/migrate/.sydney`
holds the session-pooler URL. **`.env.local` points at a local database**, so a
script run against `DATABASE_URL` will silently return zeros.

## The shape of the data

**People.** `User` is the spine. `VolunteerProfile`, `DonorProfile`,
`OrgMember` hang off it; `UserEmail` holds additional verified addresses.
Matching anything to a person is by **verified** email only.

**Giving.** `Fund` (where money goes, and which Stripe account) → `Donation`.
`Fundraiser` is a campaign pointing at a Fund. `Sponsorship` and `TicketOrder`
→ `Ticket` cover events.

**Volunteering.** `Shift` → `ShiftAssignment` → `AttendanceRecord`, plus
`RecurringBooking`, `VolunteerAvailability` and the induction tables.

**Business reporting.** `SalesFact` is the daily rollup — unique on
`(day, store, channel, source)`, so two feeds reporting the same day cannot
overwrite each other. `GapSale` holds individual sales for the Meta bridge only
and does not go back far. `SocialPost` covers organic posts, ads and Mailchimp
campaigns; `AdDayStat` holds per-day ad performance, because an ad made in July
can be September's biggest spender and filtering paid by publish date answers
the wrong question.

**`IngestRun`** records every feed attempt. Check it before concluding a number
is low — a failed pull and a genuinely quiet week look identical otherwise.

**Marketing assistant.** `MarketingProposal` is anything Claude suggested,
waiting on a person; `MarketingChat` keeps the conversation that produced it.

## Verifying a change

In this order, every time:

```bash
npx tsc --noEmit      # necessary, not sufficient
npx eslint <paths>    # the React rules here are strict — see below
npm run build         # the only thing that catches client/server boundary errors
npx vitest run
```

`tsc` does **not** catch a Client Component importing a module that
transitively imports Prisma. That fails only in `npm run build`, as
"Can't resolve 'dns'". Run the build before pushing anything touching a
`'use client'` component or a lib one imports.

Two lint rules that have bitten repeatedly:

- **No synchronous `setState` inside an effect.** Seed the state from props, or
  set it inside the async callback.
- `e.target.files` is a **live FileList**. Clearing `input.value` empties it —
  copy with `Array.from()` first, or the upload silently never starts.

## Platform limits

Vercel **Hobby**: functions are killed at **60 seconds** and crons may only run
**daily**. A `*/10 * * * *` schedule makes the whole deployment invalid. Long
jobs must be resumable — see `/api/admin/ig-backfill`, which works to a time
budget and hands back a cursor.
