# Santa's Little Helpers

Christmas gifts for children who would otherwise go without. Local
organisations nominate the children, supporters take their wish lists, buy and
wrap four gifts each, and deliver them back to the organisation.

`/dashboard/slh` · **preview only, super admins, sample data**

## What exists right now

A walkthrough, not a feature. Two pages render **fiction** from
`src/lib/slh-sample.ts` — one organisation, three children, a wish list each:

| Page | Shows |
|---|---|
| `/dashboard/slh` | Countdown to drop-off, the shopper's wish lists, progress per child |
| `/dashboard/slh/[id]` | One child: interests, their own words, sizes, four gifts, six steps |
| `/dashboard/slh/org` | **Real.** Who is approved to refer, their allocation, and who can be added |
| `/dashboard/slh/org/[id]` | Real allocation and drop-off address; sample families and event |
| `/dashboard/slh/org/[id]/family` | Nominating a family: guardian, consent, a child |

Plus a card on `/dashboard` that leads to it. All of them are behind
`canPreviewSlh()`, which asks for **SUPER_ADMIN** — a role rather than a
capability, deliberately. A capability answers "may this person do this job";
this answers "is this finished enough to show anybody", and it disappears once
the program has real data.

**No writes and no emails** for the families and children themselves.

**The organisations and their approvals are real.** A referring agency is not a
new kind of thing: `Organisation` already holds a name, a logo, a blurb and
members who sign in, which is exactly what a referrer needs. `src/lib/slh.ts`
reads them through the same per-row rule the partner pages use — `canAdminOrg`,
because a global "partner admin" would hand its holder every company at once.

## Approval is a row, not a flag

Having an account does not make an organisation a referrer. **Good Food is a
corporate partner and has no business nominating children** — that was the bug
this fixed: every organisation appeared as a referrer because the code had no
concept of approval at all.

Two tables carry it:

| Table | Is |
|---|---|
| `GiftProgram` | A year. Name, slug, `year`, `nominationsCloseAt`, `isActive`. One active at a time. |
| `GiftProgramPartner` | **The approval.** Program × organisation, unique, plus `allocation`, `dropOffAddress` and the drop-off window. |

The row *is* the decision — there is no `approved` boolean to forget to set.
Creating it approves, deleting it withdraws, and its absence is why an
organisation does not appear. `canOpenSlhOrg` checks for it **before** it checks
who is asking, so a super admin previewing still cannot open a program area for
an organisation nobody enrolled.

This is also the answer to "where does the allocation live". Not on
`Organisation` — a corporate partner has no drop-off window — and not on the
program either, because every organisation's ceiling and address differ. It
belongs to the pairing, which is exactly what the join table is.

Approving is Lighthouse's call: `/dashboard/slh/org` is super-admin only, and
every action in `src/lib/actions/slh.actions.ts` re-checks for itself rather
than trusting that the page hid the button.

The families, children and wish lists are still `slh-sample.ts`.

## The design it came from

The interactive mockup covers far more than the pages above — onboarding,
the organisation's side, the child's own form, gift tags, badges. Read it
before building the next piece; every decision below was argued out there.

## Decisions worth keeping

**A shopper sees a first name, an age, sizes, interests and an approved story.**
Nothing else. No surname, no guardian, no address, and **no photographs of
children** — the avatars are silhouettes on a gradient and should stay that way.

**Stories are approved before a shopper sees them.** A child writing freely may
include something identifying or distressing. `story.approved` gates it, and
the child's form says plainly that somebody reads it first.

**Interests are chips, not a text box.** A nine-year-old taps six and writes
nothing; the shopper still learns more than an empty field would have told
them. Specific brands sit beside broad categories on purpose — "Spider-Man"
buys a better present than "superheroes".

**Families are the unit, not children.** Siblings share a guardian, a phone
number and a household. It is also the duplicate key: the same guardian plus
the same child is a double nomination, the same guardian with a different child
is a sibling. A child with no family is expected — residential and kinship care
— so the link is optional.

**Progress is per wish list.** An overall "8 of 18 steps" bar was removed: it
measured nothing a shopper acts on. Six segments per child, and the next step
named, is the whole of it.

**Deadlines count backwards from the organisation's own window.** Each
organisation takes gifts at its own address inside its own dates, so a list
released for reassignment on 25 November is fine and the same list released on
20 December is a child without a present. That is why the window sits on
`GiftProgramPartner` rather than the program.

**An allocation of 0 means "approved, ceiling not set yet"** — not "none left".
The organisation's page says so in words rather than drawing a full bar.

## Before this becomes real

- **Child safety.** `PURPOSE.md` puts this beside Kids Church check-in:
  children's data, deserving the same seriousness as Blue Card handling. Whether
  warehouse volunteers or organisation staff need screening is a question for
  people, not code, and it should be answered before the schema is final.
- **Retention.** A child's first name, date of birth and a guardian's mobile is
  an identifying record of a family in crisis. Delete or anonymise at the end of
  each program year, keeping the aggregate.
- **New tables need the RLS lockdown re-run** after `prisma db push` — see
  `docs/DATA.md`. Supabase exposes new tables over REST otherwise.
- **The Santa mark is a placeholder**, drawn inline in
  `src/components/slh/SantaMark.tsx`. Swap in the real artwork.
