# The volunteer kiosk

The sign-in screen on an iPad at the shop. A volunteer arrives, finds their
name, taps in; on the way out they tap out. It also handles guests — corporate
teams and one-off helpers who have no account.

`/kiosk`, with `/kiosk/login` in front of it.

## Who uses it

**The device, not a person.** A dedicated `KIOSK` role account signs in once
and stays signed in. That is why `KIOSK` exists as a role at all and why it can
reach nothing else in the app: the iPad sits unattended on a bench in a shop,
and whoever picks it up gets exactly the sign-in screen.

`/api/kiosk/open-attendance` accepts `KIOSK`, `ADMIN`, `SUPER_ADMIN` and
`CARE_MANAGER`, so a manager can drive the same flow from their own account.

## The screens

`KioskClient.tsx` is one component with a `Screen` state machine:

```
home → lookup-signin  → signin-confirm  → home
home → lookup-signout → signout-confirm → home
home → guest-signin                     → home
```

`home` also shows who is currently on site — volunteers and guests in separate
tables, with sign-in time and how long they have been there. Every screen
returns to `home` on a timer, because the previous person's name must not be
left on a screen in a public shop.

## What it writes

**`AttendanceRecord`** for someone with a `VolunteerProfile`: `signInAt`,
`signOutAt`, `durationMins`, plus `locationId`, `shiftId` where known, and
`kioskName` / `ipAddress` so a disputed record can be traced to a device.

**`GuestAttendanceRecord`** for everyone else, and it asks for more because we
know less: first and last name, mobile, email, volunteer area, organisation,
`isCorporateDay`, emergency contact, and `safetyAcknowledged`. A guest has done
no induction and signed nothing, so the emergency contact and the safety
acknowledgement are the record that they were briefed.

Guests are a separate table rather than thin `User` rows on purpose. Creating an
account for somebody who helped for one morning gives us a login nobody asked
for, no password, and an unverified address — and it would put them in
volunteer reporting as though they were rostered.

## Things worth knowing before changing it

- **Sign-out finds today's open record.** `open-attendance` looks for an
  `AttendanceRecord` for that volunteer with `signInAt` after local midnight and
  no `signOutAt`. Somebody who forgets to sign out leaves an open record that
  an admin closes by hand — deliberately, since guessing a departure time would
  put invented hours into attendance reports.
- **The default location** comes from an `AppSetting` set in admin settings, so
  the iPad does not have to be re-taught which shop it is in.
- **Kids Church check-in will look like this**, and is the obvious thing to
  reuse — but it involves children's data and child-safety obligations, so it
  needs its own consideration rather than this with the labels changed. See
  `docs/PURPOSE.md` § Where honesty is owed.
