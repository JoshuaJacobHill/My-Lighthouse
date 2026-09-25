# Families we support

A record of the households Lighthouse walks alongside, and what they have
received. `/admin/families` · **`care.families`, SUPER_ADMIN only**

> Status: schema and vocabulary built. The screens are next — see
> **What is not built yet**.

## The one decision everything else follows from

**This is not a list of recipients.** `PURPOSE.md` opens with the woman who
volunteers on Thursdays, gives monthly, has a husband at the church and shops
at Loganholme — one family, five relationships — and says the whole point of
this app is that it does not keep four separate records of her.

A household here is the same idea. The mum collecting a free trolley may also
be a $25 Trolley customer; her son may have an account; she may end up
volunteering. `HouseholdMember.userId` is what keeps those the same person, and
it is set **deliberately** rather than guessed from a name.

It is also why nothing here is called a client, a case file or a beneficiary.
PURPOSE.md says the dignity rules are structural rather than decorative, and a
schema that sorts people into helpers and helped is where that starts to rot.

## The shape

| Table | Is |
|---|---|
| `Household` | The family. Name, address, contact, status, consent, standing notes. |
| `HouseholdMember` | A person in it, optionally linked to a `User`. |
| `SupportGiven` | One thing given, on one day: trolley, hamper, Christmas hamper, SLH, emergency relief. |
| `CaseNote` | A dated note. **Append-only.** |
| `Referral` | Sent out to another service, and what came of it. |

`GiftFamily.householdId` links a Santa's Little Helpers nomination to a
household once somebody matches them — optional, because a referring
organisation nominates families we may never have met.

## Decisions worth keeping

**Append-only case notes.** A note is what somebody believed on a day.
Rewriting it silently turns a history into an opinion, so a correction is a new
note. That is also how a team stays honest with each other.

**No dollar values on `SupportGiven`.** A quantity, not a cost. What a family
received should not be recorded as what it cost us — that is a reporting
question, answered from the kinds and counts, not from a price against a
person's name.

**`phoneKey()` exists for duplicate checking and is never stored.** An
Australian mobile gets written half a dozen ways, and a duplicate check that
misses `+61412884221` against `0412 884 221` does nothing. What somebody typed
is what gets shown back to them.

**`daysSince()` is a prompt, not a rule.** Whether to give a second trolley
this fortnight is a judgement for a person who can see the family. The app's
job is to make sure that judgement is made with the fact in hand rather than
after the trolley has gone out.

**Dates of birth, not ages.** An age entered in March is wrong by December.

**`care.families` is deliberately not bundled with `care.people`.** Knowing
the roster is not a reason to read a case note.

## Before this holds real families

- **Consent.** `consentAt` exists and the form must ask. A family came to us
  for food, not to be catalogued, and they should know a record exists.
- **Retention.** Crisis circumstances, children's dates of birth and a home
  address are not ours to keep indefinitely. Decide a period, anonymise
  `CLOSED` households past it, keep the aggregate. This needs a human
  decision before the first record is entered, not after.
- **Safeguarding notes** (`NoteCategory.SAFEGUARDING`) may contain
  disclosures. Who may read them is a policy question, and right now the
  answer is "anybody with `care.families`" — which is fine for a team of one
  and wrong for a team of ten.
- **New tables need the RLS lockdown re-run** after `prisma db push` — see
  `docs/DATA.md`.

## What is not built yet

Everything above the database: the list and search, the household profile, the
form that records support given, notes, referrals, and matching a household to
an existing `User` or to a Santa's Little Helpers nomination. The schema and
`households-core.ts` are the foundation those sit on.
