# Santa's Little Helpers

Christmas gifts for children who would otherwise go without. Local
organisations nominate the children, supporters take their wish lists, buy and
wrap four gifts each, and deliver them back to the organisation.

`/dashboard/slh` · **super admins only, real data**

## The pages

| Page | Who | Shows |
|---|---|---|
| `/dashboard/slh/join` | A supporter | Onboarding: welcome, pick an organisation, how many lists, drop-off acknowledgement |
| `/dashboard/slh` | A shopper | Countdown to drop-off, their wish lists, progress per child |
| `/dashboard/slh/[id]` | A shopper | One child: interests, their own words, sizes, four gifts, six steps to tick |
| `/dashboard/slh/org` | Lighthouse | Who is approved to refer, their allocation, and who can be added |
| `/dashboard/slh/org/[id]` | The organisation | Allocation, families, who is outstanding |
| `/dashboard/slh/org/[id]/family` | The organisation | Nominating a family: guardian, consent, their children |

Plus a card on `/dashboard`. Everything is behind `canPreviewSlh()`, which asks
for **SUPER_ADMIN** — a role rather than a capability, deliberately. A
capability answers "may this person do this job"; this answers "is this
finished enough to show anybody", and it comes out when the program opens.

**There is no sample data.** `slh-sample.ts` is gone. Every name, child and
family on these pages is a row somebody entered.

## The shape

Five tables, and the relationships between them are the whole design.

| Table | Is |
|---|---|
| `GiftProgram` | A year. Name, slug, `year`, `nominationsCloseAt`, `isActive`. One active at a time. |
| `GiftProgramPartner` | **An organisation's approval to refer.** Program × organisation, unique, plus `allocation`, `dropOffAddress` and the drop-off window. |
| `GiftShopper` | **A supporter's sign-up.** Program × user, unique, plus which organisation, how many lists, preferences, and when they acknowledged the drop-off. |
| `GiftFamily` | A nominated household: guardian name, email, phone, consent. |
| `GiftChild` | One child, one wish list. Assigned to a `GiftShopper` when a list is handed out. |

### Approval is a row, not a flag

Having an account does not make an organisation a referrer. **Good Food is a
corporate partner and has no business nominating children** — that was the bug
this started from: every organisation appeared as a referrer because the code
had no concept of approval at all.

The row *is* the decision. Creating it approves, deleting it withdraws, and its
absence is why an organisation does not appear. `canOpenSlhOrg` checks for it
**before** it checks who is asking, so a super admin previewing still cannot
open a program area for an organisation nobody enrolled.

The same shape holds for shoppers: a `GiftShopper` row is somebody who has been
through onboarding, and its absence is what sends them there.

### Why the allocation lives on the join table

Not on `Organisation` — a corporate partner has no drop-off window — and not on
the program, because every organisation's ceiling and address differ. It belongs
to the pairing. Same reasoning for a shopper's preferences: somebody who shops
two years running has two rows, and last year's choices do not quietly become
this year's.

### Everything is scoped to a program

Families and children carry `programId` as well as `organisationId`. Next
December starts empty without deleting anything, and "what did 2026 actually
do" stays answerable.

## Decisions worth keeping

**A shopper sees a first name, an age, sizes, interests and an approved story.**
Nothing else. No surname, no guardian, no address, and **no photographs of
children** — the avatars are silhouettes on a gradient and should stay that way.
The identifying details live on `GiftFamily`, which no shopper page reads. That
split is deliberate; keep it.

**Stories are approved before a shopper sees them.** A child writing freely may
include something identifying or distressing. `storyApproved` defaults to false
and the wish list page checks it, so unapproved means unseen.

**Date of birth, not age.** An age entered in October is wrong by December.
`@db.Date`, read with `ageOn()` in UTC — reading it in Brisbane shifts the day
back and lands a birthday early. See `docs/DATA.md`.

**Families are the unit, not children.** Siblings share a guardian, a phone
number and a household. It is also the duplicate key: the same guardian plus
the same child is a double nomination, the same guardian with a different child
is a sibling. A child with no family is expected — residential and kinship care
— so `familyId` is optional and the form has a path for it.

**Consent is a timestamp, not a boolean.** We email and sometimes ring these
families. "The organisation said it was fine" is not the same as recording when,
and who said so.

**Capacity is measured against the allocation, not against nominated children.**
Shoppers sign up in October and organisations nominate through November, so
counting real children would tell an early shopper an organisation has nothing
for them when it has forty coming. `shopperCapacity()` sums what every shopper
has asked for and subtracts it from the allocation. A shopper changing their
own request is excluded from that sum, so they are not competing with
themselves.

**An organisation with no allocation is closed, not full.** Nothing can be
promised against a number nobody has set. The screens say those two things
differently — "not open for shoppers yet" versus "every wish list has been
taken" — because they need different responses.

**Changing your mind is one button, and it does not apologise.** The onboarding
screen asks people to tell us early if they cannot finish, so `ManageLists`
sits on the page they already look at and `ReleaseList` is one confirmation
naming the child. A shopper who quietly cannot manage is how a child ends up
without a present; a button that makes somebody feel judged is one they avoid
until December.

**Giving a list back clears its steps.** The next shopper has not shopped or
wrapped anything, and inheriting someone else's ticks would tell them they had.
The request drops by one at the same time, so the list is not handed straight
back.

**Lists in hand are the floor.** The counter cannot go below what has already
been assigned — dropping those is the separate, deliberate act above.

**Progress is per wish list.** An overall "8 of 18 steps" bar was removed: it
measured nothing a shopper acts on. Six timestamps on `GiftChild` rather than a
status column, so "when did this happen" is answerable; `slh-steps.ts` turns
them into an ordered list with a next step.

**Steps untick.** People tick the wrong row, and a shopper who cannot undo
"delivered" will either leave it wrong or ring somebody.

**Only the assigned shopper may tick.** A super admin can *read* any list while
this is in preview; reading is not writing, and the steps are a record of what
one person did.

**The allocation is checked when nominating, not just displayed.** The form's
copy of the count can be minutes out of date, so `addFamilyAction` re-counts.

**An allocation of 0 means "approved, ceiling not set yet"** — not "none left".
The organisation's page says so in words rather than drawing a full bar.

**Deadlines count backwards from the organisation's own window.** Each
organisation takes gifts at its own address inside its own dates, so a list
released for reassignment on 25 November is fine and the same list released on
20 December is a child without a present. That is why the window sits on
`GiftProgramPartner` rather than the program.

**Onboarding is a takeover, not a form.** Solid colour, snow, white type —
the one moment in the app where somebody is being welcomed into something.
Nothing saves until the last screen, so a half-finished sign-up does not
survive a refresh as a row nobody meant to create. Snow is decorative, behind
`aria-hidden`, and stops entirely under `prefers-reduced-motion`.

## Not built yet

- **Handing lists out.** `GiftChild.shopperId` exists, every read respects it
  and a shopper can give one back, but nothing *assigns* it — matching a
  shopper's request to waiting children is the next piece.
- **The child's own form.** `storyText`, `interests` and the four gifts have
  columns and are read everywhere; only an organisation typing them in is
  missing, along with the "let the family fill it in" link.
- **Reminder emails.** `FamilyList` shows the confirm-before-send dialog and
  does not send. Wiring it needs an email template — see `docs/features/ADMIN.md`.
- **Gift tags and scanning at drop-off.** The `labels` and `delivered` steps are
  ticked by hand for now.
- **Shopper onboarding is super-admin gated** like everything else here.

## Before this opens to the public

- **Child safety.** `PURPOSE.md` puts this beside Kids Church check-in:
  children's data, deserving the same seriousness as Blue Card handling. Whether
  warehouse volunteers or organisation staff need screening is a question for
  people, not code.
- **Retention.** A child's first name, date of birth and a guardian's mobile is
  an identifying record of a family in crisis. Delete or anonymise at the end of
  each program year, keeping the aggregate.
- **The two organisation pages are not super-admin gated.** `canOpenSlhOrg`
  lets an admin of an approved organisation open their own area. Nothing links
  them there, but unlinked is not locked — decide deliberately before this opens.
- **New tables need the RLS lockdown re-run** after `prisma db push` — see
  `docs/DATA.md`. Supabase exposes new tables over REST otherwise.
- **The Santa mark is a placeholder**, drawn inline in
  `src/components/slh/SantaMark.tsx`. Swap in the real artwork.
