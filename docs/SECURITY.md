# Security: what we always do, and never do

This app holds donors' giving history, volunteers' contact details and home
suburbs, church members' records, children's names (Santa's Little Helpers),
and the store's takings. Most of it belongs to people who never chose to be in
a database — they just needed groceries, or gave $25.

So the rules below are not process for its own sake. **Read this before
anything that touches an account, a form, or a public route.**

---

## The one rule everything else follows from

**Proving control of an inbox is what unlocks data. Typing an address is not.**

That sentence is already in the code, in `signup.actions.ts`. Every other rule
here is a consequence of it.

## Accounts: always check the email first

**Never let anyone create a second account on an email that already has one,
and never let anyone claim existing history by typing an address.**

`checkSignupEmailAction` is the pattern. Three outcomes, and the difference
between them matters:

| What we find | What happens | Why |
|---|---|---|
| A **live account** (`passwordHash` and `isActive`) | Tell them on screen: sign in | Emailing a link would leave them waiting for something they do not need |
| A **record but no password** — past giving, or a row we created | **Email a setup link.** Nothing on screen | That history is only ever attached to somebody who controls the inbox |
| **Nothing** | Let them finish signing up on the spot | Nothing to protect |

### Use the shared helper, do not rewrite it

`src/lib/account-check.ts`. Every sign-up flow calls it — volunteers, corporate
partners, Santa's Little Helpers shoppers, whatever comes next.

```ts
import { lookupEmail, assertEmailFree } from '@/lib/account-check'

const found = await lookupEmail(email)
//   'account'  -> tell them on screen to sign in
//   'history'  -> email a setup link, say nothing else on screen
//   'new'      -> let them sign up here

// Immediately before the write, every time:
const taken = await assertEmailFree(email)
if (taken) return { success: false, error: taken }
```

Ten tests in `account-check.test.ts` cover it, including the one that matters
most: `assertEmailFree` must refuse a row **with no password**, because that row
is somebody's giving history.

**A hook watches for this.** `scripts/signup-guard.py` runs after every write
and, when a file creates a user or hashes a password without using this helper,
hands the rules back as context. It informs rather than blocks — a seed script
or an admin invite is a legitimate exception, and a hook that refuses to let you
save is a hook somebody turns off.

Two things about this that are easy to get wrong:

**Check in both places.** Step one checks; step two — the actual account
creation — checks again and refuses with *"This email has already been used.
Please sign in, or reset your password."* Never trust that step one ran. A form
posts to a server action, and a server action can be called directly.

**Apply it to every form that captures an email**, not just sign-up. A ticket
buyer, a contact form, a partner application, a Santa's Little Helpers shopper
— each should find an existing account rather than quietly creating a parallel
identity. Matching is by **verified** email only; an unverified address proves
nothing and must never link records.

## What is already in place

An audit of the codebase, so nobody rebuilds what exists:

### Sessions and passwords

- **bcrypt, cost 12** (`hashPassword`). Never anything home-made.
- **Session tokens are 32 random bytes** from `crypto.randomBytes`, stored in
  `UserSession` and **validated against the database on every request** — so
  deactivating an account or deleting a session takes effect immediately rather
  than when a token expires.
- Cookie is **`httpOnly`**, **`secure` in production**, **`sameSite: 'lax'`**.
- **Password reset tokens**: 32 random bytes, 48-hour default expiry, and
  **consumed** on use.
- **Account setup tokens** are keyed to the *email*, not a user id, because the
  account does not exist yet — and **no account is created until the person
  chooses a password**. Buying a ticket or giving a donation is not consent to
  being handed a login.

### Rate limiting, everywhere it matters

| Path | Limit |
|---|---|
| Login | 20/min per IP, 8/5min per email |
| Sign-up email check | 30/15min per IP, 5/15min per email |
| Public contact form | 3/hour per sender, 40/hour overall, counted from `EmailLog` |

**Under load, the email check returns the same "we've emailed you" answer it
gives a real record** — so hammering it reveals nothing.

### What we tell people when it fails

- Login says **"Invalid email or password"** for both a missing account and a
  wrong password. Never which.
- A deactivated account is told so, deliberately — that person needs to ring us,
  not guess.
- The contact form's real failure reason **goes to the log, not the sender**: it
  may name our mail provider or its configuration, and there is nothing they
  could do with it.
- A honeypot field on the public form is **silently accepted** rather than
  refused. Telling a bot it was detected only teaches whoever wrote it.

### The database is not reachable from outside

- **Supabase's REST API is deliberately shut off.** The app talks to Postgres
  directly as `postgres` via Prisma, and uses neither PostgREST nor Supabase
  Auth. The `anon` and `authenticated` roles have had **every grant revoked**,
  and **RLS is enabled on every public table** with no policies — two
  independent measures, either of which would do alone.
- **After any migration that creates a table, re-run the lockdown.** New tables
  arrive without RLS, which would expose them to a publishable anon key. See
  `docs/DATA.md` for the command.
- **`.env*` files are never committed.** Check staged files before every commit.

### Access control

- **Ask for a capability, never a role.** One map, in
  `src/lib/permissions-core.ts`. A role comparison written in seventy places is
  seventy places a new role silently gains access.
- **Per-row checks where access is per-row.** `canAdminOrg(organisationId)` asks
  whether *this* person may administer *that* company. A global "partner admin"
  capability would hand its holder every company's profile at once.
- **Every server action guards itself.** All 12 in `marketing.actions.ts` call
  `guard()`. A UI component carries no authority — the check belongs in the
  action, because the action is what can be called directly.
- Donor and finance data sits behind `canViewDonations` **and** the
  `admin/(finance)` route group. Don't move a finance page out of it.

### Not revealing what exists

- **`churchOnly` content 404s for anonymous visitors** rather than redirecting to
  login. A redirect says "this exists and you can't see it"; a 404 says nothing.
- **`getPublicPartner()` returns a deliberately narrow shape** — a partner's
  contact name and direct line are on the record and never in the response.
  Donation amounts are withheld unless the partner agreed to show them.
- Unapproved partner pages return `found` and nothing else, so the lookup cannot
  be used to read the pending queue.

### Uploads and published content

- **One upload path**, and it **sniffs magic bytes** rather than trusting the
  browser's content-type, which the caller controls. **SVG is refused** because
  it can carry script.
- **`avatars/` and `partner-logos/` are outside the media library**, enforced at
  the point of publishing rather than only in the listing. A volunteer's own
  face cannot become an advertisement.
- **Nothing in a chat or automation path may publish or spend.**
  `meta-write.ts` is imported only by the approval action. Proposals end at a
  DRAFT row and a person presses the button.
- **Limits are enforced server-side at the last moment.** The $500/day ad ceiling
  lives in `meta-write.ts`, not in the form — a limit in the UI is a limit the
  next caller does not have.

### Money and idempotency

- **Stripe webhooks are idempotent** on `providerTransactionId`, because Stripe
  retries. A double-delivered webhook must not double-charge or double-record.
- **Two Stripe accounts**, CARE and CHURCH, so tithes and charity donations never
  land in one ledger.
- Publishable keys are **non-Sensitive** in Vercel (build-time inlined); secret
  keys are Sensitive and never reach the browser.
- The approval queue **claims a proposal before executing it**, conditional on it
  still being unrun, so two people pressing approve cannot both publish.

### Third parties

- **The tool surface decides what leaves the building, not the prompt.** Every
  query in `marketing-tools.ts` reads aggregates; none can select a person. A
  prompt is a request; a query is a fact.
- The volunteer digest sends **first names only** to the Anthropic API — never
  surnames, emails, phone numbers or addresses — and says so in its own file.
- Tokens we issue are **narrow by design**. `FitnessLink` can add a step count
  for its owner and nothing else; it reads no data, so a leak means somebody
  could fudge one person's step tally, and it is regenerable.

---

## Never

- **Never** create an account for somebody who did not ask for one.
- **Never** link records on an unverified email.
- **Never** trust a client-side check. Re-check in the server action.
- **Never** add a public route without asking. `isPublished` means published to
  the *portal*; making something world-readable is a separate decision, and one
  that has already been made by accident here once.
- **Never** put a limit only in the form.
- **Never** return a raw error to a user when it names infrastructure.
- **Never** widen a capability to make a page work. Fix the page.
- **Never** log a password, a token, or a full card number. Not even once, not
  even temporarily.
- **Never** `git add` a `.env*` file.

## Where I would look first if something felt wrong

1. **Server actions without a guard** — `grep -c "export async function"` against
   `grep -c "guard()\|getSession()"` in the same file.
2. **Public routes** — anything under `(public)`, `/events`, `/fundraisers`,
   `/donate`, `/partners`. Does each query filter on the audience flags?
3. **New tables without RLS** — the query is in `docs/DATA.md`.
4. **Forms capturing an email** that do not run the existing-account check.
5. **`findFirst` on email without `mode: 'insensitive'`** — a case mismatch
   would create a duplicate account rather than finding the existing one.

## Known gaps, stated rather than hidden

- **Sign-up reveals whether an email has an account.** `existing_account` and
  `new` are different answers, which is account enumeration. It is a deliberate
  trade — telling somebody "you already have an account, sign in" is much
  better for a supporter than a vague "check your email" — and the rate limits
  plus the under-load behaviour blunt it. Worth revisiting if it is ever abused.
- **No two-factor authentication** on admin accounts, including those that can
  see donor data and move ad spend.
- **The Supabase database password has not been rotated** since early
  development, and credential files remain under `scripts/migrate/`. Rotate,
  then delete them.
- **`business.reports` gates both seeing the reports and approving a public post
  or an ad spend change.** Those are arguably different decisions.
