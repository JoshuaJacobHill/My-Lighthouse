<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions (permanent)

For current progress, open tasks, and handover, read **`docs/PROJECT_STATUS.md`**.

- **Deploy** = commit to `main` + push → Vercel auto-deploys. Prod = `my.lighthousecare.org.au` (Vercel + Supabase). Only commit/push when the user asks.
- **Never `git add` a `.env*` file.** Check staged files for `.env` before every commit. Secrets live in Vercel env, not the repo.
- **Prod schema changes are additive-only** (new nullable columns / tables / enum values — never drop/rename). Apply with `prisma db push --url "<session-pooler>"` (swap the `DATABASE_URL` port `6543`→`5432`). Then run **`npx prisma generate`** before `tsc` or types are stale.
- **Verify with `npx tsc --noEmit`** after edits. Vercel's build is the deploy safety net (a broken build won't promote). Local browser preview often drops login sessions — prefer prod verification.
- **Stripe**: two accounts (CARE/CHURCH) via `src/lib/stripe-accounts.ts`; per-fund `depositAccount`. Pin `apiVersion: '2024-06-20'` for subscription calls. Publishable keys must be **non-Sensitive** in Vercel (build-time inlined).
- **Permissions**: donor/finance data is gated by `User.canViewDonations` (`src/lib/permissions.ts`) + the `admin/(finance)` route group. Don't leak donation data to volunteer-only admins.
- **Voice**: Australian English; warm, dignified, hopeful; brand orange `#f97316`. Never pity language ("the needy"); use "families doing it tough".
- **Design**: new UI = white canvas, `rounded-[28px]` cards, two-weight headings, pill buttons, orange + black. Portal pages inside `PortalShell` use `-m-4 lg:-m-6 min-h-full bg-white`.
