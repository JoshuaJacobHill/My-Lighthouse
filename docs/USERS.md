# Who uses this app, and what each of them sees

Read this before touching anything that decides what appears on a screen.

One app serves several groups who overlap heavily: the same person can be a
volunteer, a donor, a church member and a staff member at once. So access is
**not** a ladder from "public" up to "admin" — it is a set of independent
questions asked about one account.

## The golden rule

**Ask for a capability, never a role.** `can(user, 'care.giving')`, never
`user.role === 'ADMIN'`. Roles get added and re-scoped; a role comparison
written in seventy places is seventy places a new role silently gains or loses
access. The map lives in one file: `src/lib/permissions-core.ts`.

- `permissions-core.ts` — the rules. Deliberately free of Prisma and
  `next/navigation`, so client components can ask the same questions without
  dragging the database driver into the browser bundle.
- `permissions.ts` — the server guards (`requireCapability`, `hasCapability`,
  `assertCapability`). Re-exports everything from core.

## Roles

| Role | Holds |
|---|---|
| `SUPER_ADMIN` | Everything, always. `can()` short-circuits for it. |
| `ADMIN` | Everything except assigning roles — but giving and church contact details only when `canViewDonations` is ticked. |
| `CARE_MANAGER` | `care.people`, `care.tasks`, `care.stories`. No giving data of any kind, no church contact details. |
| `CHURCH_MANAGER` | `church.members`, `church.giving`, `church.stories`, `church.teams`. No volunteer management, no Care donor data. |
| `VOLUNTEER` | The default. No admin area. Sees the portal. |
| `KIOSK` | The on-site sign-in screen only. |

`isAdminRole()` decides who may open `/admin` at all. Middleware
(`src/middleware.ts`) enforces the coarse gate; the page enforces the specific
capability.

## The two per-person switches

These are **flags on the account, not roles**, and they are the exception to
the golden rule:

- **`canViewDonations`** — an `ADMIN` only gets `care.giving`,
  `church.members` and `church.giving` with this ticked. Deliberately does NOT
  apply to `CARE_MANAGER` or `CHURCH_MANAGER`: seeing tithes *is* the church
  manager's job, and a second checkbox would mean every new church manager
  arrives unable to do what they were created for.
- **`canViewBusinessReports`** — grants `business.reports` on its own, with no
  role at all. Store revenue and ad spend. Someone who should see the sales
  report does not thereby need admin over volunteers or church records.
  Granted from a person's page in `/admin/users/[id]` (SUPER_ADMIN only).

## Descriptive flags

Not permissions, but they change what a person is shown and how they are
addressed:

- `isChurchMember` — sees church-only stories and events.
- `isStaff` / `isTrainee` — sees staff-only stories, tasks and checklists.
  Staff are usually volunteers and donors too, which is exactly why these are
  flags and not roles.
- `isActive` — a deactivated account keeps its history.

## Content decides its own audience

Several models carry their own audience flags. **Check these before exposing
any record on a public route.**

| Flag | On | Means |
|---|---|---|
| `isPublished` | Story, Event | Visible in the portal at all. NOT the same as public. |
| `audienceKinds` | Story, Event | **Who it is for**, as a list. See below. |
| `isActive` | Fundraiser, Fund | Still accepting gifts. |

### The audience rule

`churchOnly`, `staffOnly` and `signedInOnly` grew one at a time and have been
replaced by one rule both models share. **Read it through
`src/lib/audience-core.ts` — never by testing the columns by hand.**

| Column | Means |
|---|---|
| `audienceKinds` | `church`, `staff`, `volunteers`, `donors`, `partners`. Empty = any signed-in supporter. |
| `audienceMatch` | `ANY` (in one of them) or `ALL` (in all at once). The picker only produces `ANY`; `ALL` exists to preserve stories that carried church *and* staff, which meant both. |
| `audienceGate` | What somebody outside it gets: `ASK` (sign-in prompt) or `HIDE` (404). |
| `audiencePublic` | Readable by somebody not signed in. **Event only** — Story has no such column, because there is no public story page. |

Two axes, on purpose. The list says *who*; the gate says whether a stranger may
know the thing exists. A church-only event `HIDE`s because its existence is not
public; a private one `ASK`s because it is usually a link emailed to supporters
and a 404 would look broken to the people it was sent to.

The audiences are the ones the database can answer from how somebody is
connected. **Shoppers and Santa's Little Helpers are deliberately absent** —
both are real audiences with nothing behind them yet, and a tickbox that
silently matches nobody reads as a promise the app cannot keep.

Asked in two places, which must agree: `canSee()` for one item, and
`storyAudienceWhere()` / `eventAudienceWhere()` for a list. `audience.test.ts`
runs every viewer against every rule and demands the same answer from both,
because two expressions of one rule is exactly where content leaks.

**The old booleans are still written and still filtered on.** Until the backfill
is confirmed everywhere, every read applies both — a row the backfill has not
reached defaults to "everyone", and that error points at leaking.

`isPublished` means "published to the portal", not "published to the world".
A published story is visible to signed-in users at `/dashboard/news` and has no
public page. Treating the two as the same is how private content leaks.

## Where login sends people

**Almost everyone lands on `/dashboard`** — the one portal, which adapts to
whether they give, volunteer, both, or neither. There is no "send a donor to
the donor app, a volunteer to the volunteer app" routing, and there must not be:
most people are more than one of those things, and a login that picks a lane
for them picks wrong.

```
admin roles  → /admin      a different application, not an audience
KIOSK        → /kiosk      a device screen, not a person
everyone else → /dashboard
```

The two exceptions are not audiences. `/admin` is the back office and `/kiosk`
is an iPad bolted to a bench.

## Route groups, and who can reach them

These are **feature areas reached from the dashboard**, not destinations people
are routed to. `/volunteer` is "Your volunteering" — shifts, roster,
availability, induction — the way `/give` is giving. A volunteer who also
donates uses both, from the same dashboard.

| Route group | Who |
|---|---|
| `(public)` | Anyone. Partners, contact, privacy, terms. |
| `(signup)` | Anyone. `/volunteer/apply`. Shows the portal shell when signed in and a slim app bar when not. |
| `/events/[slug]`, `/fundraisers/[slug]`, `/donate` | Anyone — subject to `churchOnly` and the `DONOR_PORTAL_ENABLED` flag. |
| `/funds/[slug]` | Anyone, subject to the fund being active. One appeal's own page. |
| `/dashboard` | Any signed-in supporter. Giving, news, notifications, account, tasks, tithes, fitness, business. |
| `/volunteer` | Signed-in volunteers. Shifts, roster, availability, induction, attendance. |
| `/give` | Signed-in giving flows — `again`, `resume`, `tithe`. |
| `/admin` | `isAdminRole()` only, then per-capability. |
| `/kiosk` | The `KIOSK` role, on the shop iPad. |

## Two accounts can share a person

`UserEmail` holds additional verified addresses. A donor who gave under a
personal address and volunteers under a work one is one person. Matching a
ticket order or a donation to an account is done **by verified email only** —
an unverified address proves nothing and must never link records.

## When adding anything that publishes or spends

Both of these were learned the hard way and are easy to undo by accident:

- **Nothing in a chat or automation path may publish or spend.**
  `src/lib/integrations/meta-write.ts` is imported only by
  `marketing.actions.ts`, behind a human approval. If you find it imported from
  the assistant, that is the bug.
- **A public route is a decision, not a side effect.** Adding one widens access
  even when the record was already "published". Ask first.
