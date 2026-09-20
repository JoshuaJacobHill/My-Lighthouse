# The dashboard

`/dashboard` — where a signed-in person lands. **It is not one page for one
audience; it assembles from what that person is connected to.** This is the
clearest expression of the app's core idea, so it is worth understanding before
adding anything to it.

## How it assembles

`/dashboard/page.tsx` reads the account once, then builds conditionally:

```ts
select: { isChurchMember: true, isStaff: true, isTrainee: true,
          volunteerProfile: { … }, … }

const isStaffOrTrainee = user.isStaff || user.isTrainee
```

Then, in one `Promise.all`:

| Block | Appears when |
|---|---|
| Giving summary, recent gifts | They have donations (`claimDonationsForUser` first, so a new account finds its history) |
| Volunteer status, next shift | `volunteerProfile` exists |
| Fitness challenge banner | `isStaffOrTrainee` |
| Employment Hero link | `isStaffOrTrainee`, from the `employment_hero_url` AppSetting |
| Stories | Always — filtered by `churchOnly` / `staffOnly` |
| Upcoming events | Always — filtered by `churchOnly` |

Note **`claimDonationsForUser`** runs here: gifts given before the account
existed are matched by verified email on arrival. Somebody who donated last
year and signs up today finds their giving waiting rather than an empty page.

## The sub-pages

```
account   business   fitness   give   giving   news
notifications   receipts   recurring   tasks   tithes
```

Each carries its own gate rather than trusting the nav — `business` needs
`business.reports`, `fitness` needs staff, `tithes` is church giving. A nav
item that is hidden is a courtesy; the page's own check is the control.

## Adding to it

1. **Ask which connection earns it a place.** If the answer is "everyone",
   be sure — most things belong behind a flag, a profile, or a capability.
2. **Fetch it in the existing `Promise.all`.** Every round-trip crosses
   Sydney→Tokyo; sequential reads are sequential crossings.
3. **Never let a block fail the page.** A missing AppSetting, an empty feed and
   a failed integration should each remove a card, not the dashboard.
4. **The empty state is the common case** for a new person. A dashboard with
   nothing on it should read as a welcome, not as a broken page.

## Who sees what

Everyone signed in sees *this* route; almost nobody sees the same *page*. A
volunteer who has never given sees no giving block. A donor who has never
volunteered sees no shifts. A staff member sees both plus the challenge and
the internal updates. That is working as intended — see `docs/PURPOSE.md`.
