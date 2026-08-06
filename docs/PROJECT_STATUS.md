# Project Status — My Lighthouse Portal

Handover for a fresh Claude Code session. Last updated during the donor-portal +
unification work. Read this, then `git log --oneline -20`, `git status`, `git diff`.

## What the project does
A Next.js 16 (App Router, Turbopack) web app for **Lighthouse Care** (QLD charity).
Originally a **volunteer management portal**; now also a **donor & fundraising
portal**, being unified into one **"My Lighthouse Portal"** for all non-admin users.
Three areas today:
- **/admin** — staff admin (volunteers→"Users" tab, funds, fundraisers, events, Good News/stories, transactions, donors folded into Users, email templates, settings).
- **/donor** — donor/unified dashboard, giving, receipts, recurring management, account, appeals, Good News.
- **/volunteer** — volunteer dashboard, shifts (book/cancel), availability, profile, induction.
- Public: **/donate** (Stripe), **/fundraisers/[slug]**, **/events/[slug]**.

## Production / deploy
- **Deploy = push to `main`** → Vercel auto-builds & deploys. No other step.
- Prod domain: **https://my.lighthousecare.org.au** (primary). `volunteer.lighthousecare.org.au` 308-redirects to it. DNS is external (name-server.io); zone SOA negative-cache TTL is 24h (stale "doesn't exist" answers linger — test via `dig @1.1.1.1` or a phone).
- Host: **Vercel** (project `lighthouse-care-volunteers`) + **Supabase Postgres**.
- Env vars live in **Vercel** (Production). Secret Stripe keys are marked *Sensitive*; the two **NEXT_PUBLIC_STRIPE_*_PUBLISHABLE_KEY** must NOT be Sensitive (they're build-time inlined). `NEXT_PUBLIC_APP_URL=https://my.lighthousecare.org.au`. `DONOR_PORTAL_ENABLED=true`.
- Vercel CLI is authed here (`npx vercel …`). `.env.production.local` is a `vercel env pull` dump containing the prod `DATABASE_URL` (Supabase **transaction** pooler, port 6543).

## Prod DB migrations (IMPORTANT)
- `DATABASE_URL` = transaction pooler (`…pooler.supabase.com:6543`). For DDL / `prisma db push`, use the **session pooler**: swap port `6543`→`5432`, then `npx prisma db push --url "<session-url>"`. All schema changes so far are **additive** (new nullable cols / tables / enum values) — never destructive.
- After ANY schema change, run **`npx prisma generate`** before `npx tsc --noEmit`, or tsc fails on a stale client (recurring gotcha this session).
- Direct DB scripts: `NODE_PATH="$(pwd)/node_modules" node script.js` with `pg` Client. (Supabase connectivity from this env is intermittent — writes sometimes ETIMEDOUT; retry or do it via the admin UI.)

## Stripe (two accounts)
- Two accounts: **CARE** and **CHURCH**. Registry: `src/lib/stripe-accounts.ts` maps each to env keys (`STRIPE_CARE_SECRET_KEY`/`STRIPE_CARE_WEBHOOK_SECRET`/`NEXT_PUBLIC_STRIPE_CARE_PUBLISHABLE_KEY`, and `STRIPE_CHURCH_*`). Each **Fund** has `depositAccount` (CARE/CHURCH) → routes gifts to the right account/bank.
- Payments: **Payment Element (on-page)** for both one-off (PaymentIntent) and recurring (subscription with `default_incomplete` first invoice, confirmed inline). No hosted-checkout redirect for donations. Tickets still use hosted Checkout.
- **Subscription calls MUST pin `apiVersion: '2024-06-20'`** (const `SUB_API_VERSION`) — the account default API version is old and rejects modern subscription params. See `donation.actions.ts` and `recurring.actions.ts`.
- Webhook `src/app/api/webhooks/stripe/route.ts` verifies against each account's secret; handles `checkout.session.completed` (tickets), `payment_intent.succeeded` (one-off donations), `invoice.payment_succeeded` (recurring). Records `Donation` rows (idempotent on `providerTransactionId`). Stripe webhook endpoints (both accounts) must have these events enabled — already done by the user.
- Email: **Resend** (provider=resend in AppSetting; domain `volunteer.lighthousecare.org.au` verified). Donor emails are now editable templates (`DONATION_RECEIPT`, `DONOR_ACCOUNT_SETUP`, `TICKET_CONFIRMATION`) via Admin→Emails→Donors tab; volunteer templates in the Volunteers tab.

## Key architecture decisions
- **Capability-based unified portal**: `src/components/layout/PortalShell.tsx` is one left-sidebar layout used by both `/donor` and `/volunteer` layouts. Menu composes from capability flags (`isVolunteer`, `hasGiven`; future `isPartner`). Dashboard (`/donor/page.tsx`) shows each module in an **active** state (data) or **invitation** state (CTA). Designed so a 3rd type — **corporate partners** (sponsorship level, contribution, team volunteer-day bookings, agreement) — slots in as another capability module with no rework.
- **Admin donations permission**: `User.canViewDonations` + `src/lib/permissions.ts` (`canSeeDonations`, `getDonationsAccess`, `requireDonationsAccess`). SUPER_ADMIN always; ADMIN only if granted. Gates the finance route group `src/app/admin/(finance)/*` and donor data in the Users tab.
- **Users tab**: `/admin/users` unified list (All/Volunteers/Donors filters), `/admin/users/[id]` profile. Every volunteer is a `User` (`VolunteerProfile.userId` unique+required). `/admin/donors` redirects into Users; Transactions kept.
- **Appeals = Funds** with `showOnDashboard=true` (+ optional `imageUrl`, `tagline`, `goalAmount`). Dashboard `AppealsCarousel` shows them; raised = sum of donations per fund.
- **Good News = Story model** (admin CRUD at `/admin/stories`, Good News nav). Dashboard shows published stories in a scrollable popup (`StoriesGrid`).
- Design language (new): white canvas, `rounded-[28px]` cards, two-weight headings, orange (`#f97316`) + black + pill buttons. Pages inside `PortalShell` use `-m-4 lg:-m-6 min-h-full bg-white` to fill the shell's grey main.

## Recently changed (this session, newest first)
- **Fast "give again" flow** for logged-in donors at `/give/again` (`GiveAgainFlow.tsx`) — immersive orange amount screen ("Giving as {name}" + change link, big `$` blinking-cursor input, scrolling faint impact facts, Once/Weekly/Fortnightly/Monthly pills, NEXT) → light payment screen (Stripe Payment Element, PAY). Defaults to Lighthouse Care (CARE). Wired from the dashboard "Give again"/GivingStrip CTAs + PortalShell "Give". Reuses `createDonationIntentAction` / `createDonationSubscriptionIntentAction` with session name/email. **Follow-up:** literal card-on-file tile (saved VISA) needs a reusable Stripe customer per user + saved PaymentMethods + CustomerSession — not built yet (Payment Element gives Link + wallets for now).
- **Donor migration (Shout for Good).** `MigrationIntent` model + `Donation.migratedFrom`. Admin importer at `/admin/migrations` (finance-gated): paste CSV (name,email,company,amount,frequency), preview/validate, create intents, send/resend/bulk-send the tokenised "re-confirm your card" email (`DONOR_MIGRATION` template, Donors tab). Public `/give/resume/[token]` pre-fills name/company/amount/frequency (confirmed + editable), donor just re-enters card → `createDonationSubscriptionIntentAction({migrationIntentId})` → subscription (charge on confirm). Webhook tags `migratedFrom` + marks intent COMPLETED. Account-setup email fires automatically after. **Operational rule for the user: cancel the Shout for Good recurring the moment a donor re-confirms, to avoid double-charging.**
- Role-ordered unified dashboard: volunteers get full volunteer dashboard up top (induction/stats/upcoming shifts/quick actions), giving+appeals minimal below; donors get giving up top, volunteer invite at the bottom.
- `recurring.actions.ts`, `CancelRecurringButton.tsx`, `/donor/recurring` — view/cancel recurring gifts (live Stripe lookup by email; cancel verifies ownership). Linked from `/donor/giving`.
- `/donor/page.tsx` — giving module always shows (data or invitation).
- `PortalShell.tsx` + `/donor/layout.tsx` + `/volunteer/layout.tsx` — shared capability sidebar.
- `StoriesGrid.tsx` — modal scroll fix.
- Donate form on-page recurring + `apiVersion` fix + white bg + prefill name/email for logged-in users (`DonateForm.tsx`, `donation.actions.ts`, `donate/page.tsx`).
- Volunteer dashboard + shifts + availability restyled to new design.
- Rebrand "Volunteer Portal" → "My Lighthouse Portal"; donor account settings + volunteer-signup CTA.
- Admin Emails Volunteers/Donors tabs + editable donor email templates.

## Current bugs / unfinished (EXACT next steps)
1. **Appeals not visible on dashboard** — root cause: **no Fund has `showOnDashboard=true`** (all false in prod). Fix: in Admin → Funds → edit each of Disaster Relief / Christmas Appeal / Good Food Festival → tick **"Feature as an appeal on the donor dashboard"** (and ideally add a goal amount + tagline + image for a nicer card) → Save. (Tried to enable via DB script but Supabase writes were timing out from the dev env.) Verify the toggle actually persists (form → `fund.actions.ts` update → `Fund.showOnDashboard`).
2. **Prefill volunteer signup** — ✅ DONE. Signup prefills name/email/mobile/address for logged-in donors (`SignupClient` `prefill` prop + `signup/page.tsx`).
3. **Optional company field on donation forms** — ✅ DONE. `Donation.donorCompany` column added; captured on one-off + recurring via metadata → webhook. (Not yet surfaced in admin Transactions or the fundraiser donor wall — nice follow-up.)
4. **Step 4 of unification** — ✅ DONE. `loginAction` sends all non-admin/non-kiosk users to `/donor`; `/volunteer` redirects to `/donor`; the volunteer dashboard content (induction alert + next shifts + stats) is folded into the `/donor` volunteering module. `/volunteer/shifts`, `/availability`, `/profile`, `/induction` remain as sub-pages under the shared sidebar.
5. **Recurring "edit amount"** — currently cancel-and-resetup; add in-place amount change (Stripe subscription item price update). Not started.
6. **Appeals cards** — after enabling `showOnDashboard` (item 1), add goal/tagline/image per fund for nicer cards.

## Build / test / deploy status
- `npx tsc --noEmit` — **clean** as of last commit.
- No automated tests run here; verification is tsc + Vercel build (a failed build won't promote, so main stays safe) + manual prod checks. Local browser preview repeatedly drops login sessions, so most UI verification is done on prod by the user.
- Latest deploys all green. Recurring giving **confirmed working** by the user.

## Do NOT accidentally change
- `.env*` files — never `git add` them (repo `.gitignore` covers `.env*`; `.env.example` is also ignored). Always check staged files for `.env` before committing.
- The Stripe `SUB_API_VERSION` pin — removing it breaks recurring on the old account API version.
- Publishable keys' non-Sensitive status in Vercel.
- The additive-only rule for prod schema changes.
- Booking/availability logic in `ShiftsClient.tsx` / `AvailabilityEditorClient.tsx` (restyles were class-only; keep it that way).
- The donations-permission gating on `admin/(finance)/*` and donor data.
