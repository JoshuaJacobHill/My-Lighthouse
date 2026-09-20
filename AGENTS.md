<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions (permanent)

## Read these first

**`docs/PURPOSE.md` before anything else**, on any session that will make a
design decision. It is what the app is *for*; the rest is how it works, and
knowing the mechanism without the purpose produces reasonable-looking choices
that are wrong for where this is going.

The one idea, so it is never lost: **one account per person, and what someone
sees is a property of how they are connected to Lighthouse.** People move
between groups — a church member becomes a volunteer, a donor joins the staff —
and access must follow by ticking something, never by making a second account.
The five-year intent is to replace the admin subscriptions and be the single
place staff, volunteers, customers, supporters, partners and church members all
deal with Lighthouse.

This file is the short list of laws. The detail lives in `docs/`, and a session
starting cold should read the one that matches the work:

| File | When |
|---|---|
| **`docs/PURPOSE.md`** | First. Purpose, the audiences, the roadmap, and the rules for deciding things against it. |
| **`docs/SECURITY.md`** | Before anything touching an account, a form, or a public route. What we always do, never do, and the known gaps. |
| **`docs/USERS.md`** | Anything deciding what a person can see or do. Roles, capabilities, the two per-person switches, and the audience flags on content. |
| **`docs/INTEGRATIONS.md`** | Stripe, Gap/EMC, Meta, Mailchimp, TikTok, Anthropic, Blob, email — and the specific ways each one has misled us. |
| **`docs/DATA.md`** | The schema: money in two representations, Brisbane dates, migrations, the RLS lockdown, how to query production without psql. |
| **`docs/PROJECT_STATUS.md`** | Current progress, open tasks, handover. |
| **`docs/features/`** | One file per area — how it works, who sees it, and the traps. Read the one you are touching. |

Feature docs, in `docs/features/`:

| File | Covers |
|---|---|
| `WIDGETS.md` | **Read before building any interactive panel or chart.** The pattern the fitness and sales trackers share, so new ones match. |
| `GIVING.md` | Appeals (`Fund`) vs fundraisers, donations, recurring, tithes, the two Stripe accounts |
| `EVENTS.md` | Events, ticketing, sponsors, volunteer sign-up, check-in |
| `STORIES.md` | News and good news, the audience flags, why there is no public story page |
| `DASHBOARD.md` | How `/dashboard` assembles itself from a person's connections |
| `REPORTS.md` | Sales and marketing, the data feeds, the marketing assistant |
| `MEDIA.md` | The one media library and the one upload path |
| `FITNESS.md` | The staff steps challenge, and how phones push to it |
| `KIOSK.md` | The shop iPad: volunteer and guest sign-in |
| `ADMIN.md` | Settings, email templates, notifications, the finance route group |

These files are re-read automatically after a compaction, by the PostCompact
hook (`scripts/reload-instructions.py`). **If you are reading them because a
summary handed them to you, they are authoritative** — prefer them over
anything recalled from the summarised conversation.

A second hook, `scripts/signup-guard.py`, hands back the account rules when a
file creates a user without the shared check.

**Hooks live in two places on purpose.** `.claude/settings.json` here is
committed, for anyone who opens this repo as their project. But a session
rooted at the *parent* folder (`Volunteer App`) reads
`../.claude/settings.local.json` instead and never sees this one — which is how
both hooks sat silently unloaded for a while. If a hook is not firing, check
which directory the session is actually rooted at before assuming the hook
itself is wrong.

Probe before you build. Every integration assumption taken from documentation
has been wrong at least once; the fix each time came from printing what the API
actually returned.

- **Deploy** = commit to `main` + push → Vercel auto-deploys. Prod = `my.lighthousecare.org.au` (Vercel + Supabase). Only commit/push when the user asks.
- **Never `git add` a `.env*` file.** Check staged files for `.env` before every commit. Secrets live in Vercel env, not the repo.
- **Prod schema changes are additive-only** (new nullable columns / tables / enum values — never drop/rename). Apply with `prisma db push --url "<session-pooler>"` (swap the `DATABASE_URL` port `6543`→`5432`). Then run **`npx prisma generate`** before `tsc` or types are stale.
- **Verify with `npx tsc --noEmit`** after edits — but `tsc` is NOT enough before deploying. It does **not** catch Turbopack client/server boundary errors (e.g. a Client Component importing a plain module that transitively imports `@/lib/prisma` → "Module not found: Can't resolve 'dns'/'fs'/'net'/'tls'"). **Run `npm run build` locally before pushing anything that touches a `'use client'` component or a shared lib it imports.** Keep client-imported helpers free of server-only imports (prisma, node built-ins); `'use server'` action files are safe to import from client. Vercel's build is the last safety net (a broken build won't promote) — but a failed build means prod silently stays on the last good deploy, so check `npx vercel ls` after pushing.
- **Stripe**: two accounts (CARE/CHURCH) via `src/lib/stripe-accounts.ts`; per-fund `depositAccount`. Pin `apiVersion: '2024-06-20'` for subscription calls. Publishable keys must be **non-Sensitive** in Vercel (build-time inlined).
- **Supabase REST is deliberately shut off.** This app talks to Postgres directly as `postgres` via Prisma and does not use PostgREST or Supabase Auth. The `anon` and `authenticated` roles have had every grant revoked and RLS is enabled on all public tables, because Supabase otherwise exposes every table over a REST API to a publishable anon key. **After any `prisma db push` that creates a table, re-run `scripts/migrate/lockdown.sql`** — new tables arrive without RLS. `postgres` owns every table and owners bypass RLS, so the app is unaffected.
- **Permissions**: donor/finance data is gated by `User.canViewDonations` (`src/lib/permissions.ts`) + the `admin/(finance)` route group. Don't leak donation data to volunteer-only admins.
- **Voice**: Australian English; warm, dignified, hopeful; brand orange `#f97316`. Never pity language ("the needy"); use "families doing it tough".
- **Design**: new UI = white canvas, `rounded-[28px]` cards, two-weight headings, pill buttons, orange + black. Portal pages inside `PortalShell` use `-m-4 lg:-m-6 min-h-full bg-white`.
- **Ask for a capability, never a role.** `can(user, 'care.giving')`, not `user.role === 'ADMIN'`. The map is in `src/lib/permissions-core.ts`; `permissions.ts` has the server guards. See `docs/USERS.md`.
- **One upload path, one media library.** All images go through `uploadImageAction` (`src/lib/actions/upload.actions.ts`) — it sniffs magic bytes and refuses SVG. Never write a second uploader. `avatars/` and `partner-logos/` are outside the library on purpose.
- **Nothing in a chat or automation path may publish or spend.** `src/lib/integrations/meta-write.ts` is imported only by `marketing.actions.ts`, behind a human approval. Proposals end at a DRAFT row.
- **Check the email before creating an account — with `src/lib/account-check.ts`, never a fresh implementation.** An email that already has a live account goes to sign-in; one with history but no password gets an emailed setup link; only a genuinely new address signs up on the spot. Check again in the action that creates the account — never trust that the first step ran. Applies to every form that captures an email, not just sign-up. Proving control of an inbox is what unlocks data; typing an address is not.
- **A public route is a decision, not a side effect.** `isPublished` means published *to the portal*, not to the world. Check `churchOnly` / `staffOnly` before exposing any record, and ask before adding a public page.
- **Vercel Hobby**: functions die at **60 seconds**, crons are **daily only** (a `*/10` schedule invalidates the whole deployment). Long jobs must be resumable.
- **Widen, don't parallel.** Before building something for one audience, check whether a narrower version already exists for another and broaden that instead. Two upload paths and two media libraries got built here before anyone noticed. Name things after the domain, never the audience.
- **Anything that will replace a subscription gets an interface first.** MyFoodLink, Gap, Xero and Planning Center are all eventual replacements. Integrate behind our own shape (`src/lib/integrations/gap.ts` is the pattern) so a swap is a new adapter, not a rewrite of everything reading from it.
- **`npx` will offer a newer major version** when the local one is missing — it has served a Prisma 8 release candidate against this Prisma 7 project. Use `./scripts/push-schema.sh` or `./node_modules/.bin/…`; never accept an unexpected install prompt.
