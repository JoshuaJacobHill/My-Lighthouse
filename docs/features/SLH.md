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

Plus a card on `/dashboard` that leads to it. All three are behind
`canPreviewSlh()`, which asks for **SUPER_ADMIN** — a role rather than a
capability, deliberately. A capability answers "may this person do this job";
this answers "is this finished enough to show anybody", and it disappears once
the program has real data.

**No schema, no writes, no emails.** Nothing here touches the database.

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
20 December is a child without a present.

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
