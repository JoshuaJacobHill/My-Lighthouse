# What My Lighthouse is for

Read this before `USERS.md`, `DATA.md` or `INTEGRATIONS.md`. Those describe how
the app works. This describes what it is *for*, and a session that knows the
schema but not this will make reasonable-looking decisions that are wrong for
where the app is going.

---

## The one idea

**One account per person. What someone sees is a property of how they are
connected to Lighthouse, not of which app they opened.**

Everything else follows from that sentence. If a change would require a person
to have two accounts, or would put one audience in a box the others cannot
reach, it is going the wrong way.

## Why that matters more here than it would elsewhere

Lighthouse's people overlap constantly. A woman volunteers on Thursdays, gives
monthly, her husband is at the church, their son bought a conference ticket,
and she shops at Loganholme. That is one family and five relationships.

A normal charity runs four subscriptions for that: volunteer software, a donor
CRM, church management, an online store. Four systems means four records of one
family and no way to see that they are the same people. **The whole point of
this app is that it does not do that.**

And people **move between groups without warning**. A church member becomes a
volunteer. A donor asks to help pack hampers. A volunteer joins the staff. When
that happens, what they can see and do must follow automatically — no second
sign-up, no new account, no admin re-keying their details. The flags and
capabilities exist so that becoming a staff member is a change to one record,
not a migration.

## The five-year intent

**Replace the admin subscriptions, and be the one place every group interacts
with Lighthouse.** Staff, volunteers, shoppers and customers, donors and
supporters, corporate partners, church members.

This is a direction, not a deadline. But it is the reason to prefer a general
mechanism over a quick specific one, even when the specific one is less work
today — every shortcut that assumes a single audience is a wall somebody has to
knock down later.

## Who comes here, and what they come for

Different groups want almost entirely different things. Some overlap. **No
feature should assume the person using it belongs to only one of these.**

| Group | Mostly here for | Barely cares about |
|---|---|---|
| **Staff** | To-do lists and checklists, annual leave, rosters, contracts and payslips, internal news | Donation appeals |
| **Volunteers** | Shifts and roster, availability, induction, attendance | Payroll, tithing |
| **Donors and supporters** | Appeals, fundraisers, receipts, recurring giving — and sometimes volunteering | Rosters, church groups |
| **Shoppers and customers** | Online store, orders, delivery, the $25 Trolley | Internal tasks |
| **Church members** | Tithing and giving plans, social groups, church-specific serving teams, church news | Care volunteer rosters, store reports |
| **Corporate partners** | Their profile, their team's posts, their sponsorship history, their fundraisers | Everything internal |
| **Managers** | Sales and marketing performance, approvals, the state of the operation | — |

Two consequences worth holding onto:

- **The dashboard is not one page for one audience.** It assembles from what a
  person is connected to. A feature that only makes sense for one group belongs
  behind that connection, not on everyone's screen.
- **Overlap is normal, not an edge case.** Staff are usually volunteers and
  donors too. That is exactly why `isStaff` and `isChurchMember` are flags on
  the account rather than roles that replace each other.

## The roadmap

Grouped by where things stand, because the useful question is usually "does
this already exist in some form" rather than "is it on the list".

**Working now**

- Giving — appeals, funds, fundraisers, receipts, recurring, two Stripe accounts
- Volunteering — shifts, roster, availability, induction, attendance, kiosk
- Tasks — staff tasks, cleaning and maintenance checklists
- Events — ticketing, sponsors, registration, check-in references
- Corporate partner profiles — public pages, company admins, badges
- Sales and marketing reporting — both stores, in-store and online, ads, socials, email
- The marketing assistant — analysis, drafting, approval-gated posting and ad changes
- Emails and notifications — admin-editable templates, per-user notification tabs

**Being built**

- Santa's Little Helpers — wish lists, partner organisations, shopper matching,
  progress tracking, scannable gift tags. Mockup exists; not built.
- Campaigns — a layer above fundraisers and appeals
- AI content creation centre — grows out of the marketing assistant: social
  posts, emails, event copy, fundraiser copy from one place

**Next**

- **Staff HR** — payroll, contracts, rosters, annual leave, complaints
- **Kids Church check-in** — closely related to the volunteer kiosk, and should
  reuse it rather than duplicate it
- **Replace Planning Center** — church admin: groups, serving teams, rosters
- **Public landing pages and sites** — Lighthouse Care, Lighthouse Family
  Church, Good Food. A CRM feeding public pages rather than three separate
  WordPress installs

**Later, and largest**

- **E-commerce store** — eventually replacing MyFoodLink
- **Stock and POS management** — eventually replacing Gap Solutions
- **Accounting** — eventually replacing Xero

## How to decide things

The rules that actually matter when building against this vision:

1. **Widen, don't parallel.** When something already exists in a narrower form,
   broaden it. Two upload paths and two media libraries were built here before
   somebody noticed; the same mistake in a bigger area is much more expensive.
   Ask "does a version of this exist for another audience?" first.

2. **Domain, not audience.** Name things after what they *are*, not who uses
   them. The capability namespace already gets this right — `care.people`,
   `church.giving`, `business.reports`. A capability called `volunteer.*` would
   have aged badly the moment staff needed the same screen.

3. **Anything replacing a subscription gets an interface first.** MyFoodLink,
   Gap, Xero and Planning Center will all be replaced eventually and none of
   them soon. Integrate behind our own shape — `src/lib/integrations/gap.ts` is
   the pattern — so that swapping the source later is a new adapter and not a
   rewrite of everything that reads from it.

4. **Never let one audience's feature close a door for another.** If a new
   table has a `volunteerId` where it could have a `userId`, that is a door
   closing.

5. **Movement between groups must never need a migration.** Granting access is
   a flag or a capability, not a new record. Test the thought: "if this person
   joined the staff tomorrow, what would have to happen?" If the answer is more
   than ticking something, reconsider the design.

## The volunteer-era foundation

This began as a volunteer app and grew. Worth knowing honestly, because the
name suggests more debt than there actually is:

**Already general.** `User` is the spine and `VolunteerProfile` is a satellite
hanging off it, not the centre. The capability map is domain-shaped. The
audience flags (`isStaff`, `isChurchMember`, `isTrainee`) are flags rather than
mutually exclusive roles. `UserEmail` already lets one person hold several
verified addresses. Nothing here needs tearing up.

**Volunteer-shaped residue**, to widen when the relevant feature arrives — not
before, and **not** as a speculative refactor:

- The repo and package are named `lighthouse-care-volunteers`. Cosmetic, and
  renaming touches deploys, so leave it unless there is a reason.
- `care.people` is described as covering "volunteer, staff and trainee
  records". HR will stretch that; it may want to split.
- `EmailTemplateType` leans volunteer-heavy. New audiences will add values —
  additive, so harmless.
- `/volunteer/*` as a route group is fine: it is a domain area, not an audience
  silo, the same way `/give` and `/admin` are.

**Do not pre-emptively refactor any of this.** Widen it when a feature needs it
widened, and do it in that feature's change so the reason is visible in the
history.

## Where honesty is owed

Four items on the roadmap carry risk that has nothing to do with how hard the
code is. Say so plainly rather than cheerfully building them:

- **Payroll.** Single Touch Payroll reporting to the ATO, superannuation
  guarantee, PAYG withholding, award interpretation. Getting it wrong has legal
  consequences for the organisation and financial ones for staff. Leave and
  rosters and contracts are safely ours. **Payroll calculation and STP
  lodgement should integrate with something certified rather than be rebuilt**,
  unless there is a very deliberate decision otherwise.
- **Accounting.** A charity at $6.49M revenue has ACNC reporting and external
  audit obligations, and an auditor needs a ledger they recognise. Replacing
  Xero is the last thing on this list for good reason.
- **POS and stock.** Replacing Gap means owning the till at two shops. An hour
  of downtime is an hour of no trade, and the trade funds the mission.
- **Kids Church check-in.** Children's data and child-safety obligations. This
  deserves the same seriousness as Blue Card handling, not a copy of the
  volunteer kiosk with the labels changed.

None of that is a reason not to build them. It is a reason to build them
deliberately, and for a future session not to treat "replace Xero" as a
week's work because it appears in a list next to "campaigns".

## What this app is protecting

Read from the code rather than the brief, and worth keeping: **dignity, built
into the structure.** The $25 Trolley is a purchase, not a handout. The voice
rules forbid pity language and are loaded every session. Partner pages let a
company's own staff post rather than us writing about them. Donation amounts
stay off public pages unless the partner agreed. The marketing assistant cannot
publish without a person approving it.

Those are not decorations on the product. They are the product.
