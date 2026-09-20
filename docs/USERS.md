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
| `churchOnly` | Story, Event | Church members only. An anonymous visitor gets a **404**, not a login prompt — it does not reveal that the thing exists. |
| `staffOnly` | Story | Staff and trainees only. |
| `isActive` | Fundraiser, Fund | Still accepting gifts. |

`isPublished` means "published to the portal", not "published to the world".
A published story is visible to signed-in users at `/dashboard/news` and has no
public page. Treating the two as the same is how private content leaks.

## Where each person lands

| Route group | Who |
|---|---|
| `(public)` | Anyone. Partners, contact, privacy, terms. |
| `(signup)` | Anyone. `/volunteer/apply`. Shows the portal shell when signed in and a slim app bar when not. |
| `/events/[slug]`, `/fundraisers/[slug]`, `/donate` | Anyone — subject to `churchOnly` and the `DONOR_PORTAL_ENABLED` flag. |
| `/dashboard` | Any signed-in supporter. Giving, news, notifications, account. |
| `/volunteer` | Signed-in volunteers. Shifts, roster, availability, induction. |
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
