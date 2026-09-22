# Events, tickets and sponsors

The Good Food Festival, the GENERALZ conference, a golf day. One model covers
free registration, paid ticketing, volunteer sign-up and corporate sponsorship,
because a real event is usually several of those at once.

`/events/<slug>` · admin at `/admin/events`

## The model

`Event` — `title`, `slug`, `description`, `imageUrl`, `venue`, `startsAt`,
`endsAt`, `capacity`, optional `fundId`, and five switches that decide what the
page actually offers:

| Switch | Effect |
|---|---|
| `isPublished` | Visible at all. **Not** the same as public — see below. |
| `audienceKinds` + `audienceGate` + `audiencePublic` | Who may read it, and what everybody else gets. |
| `allowVolunteers` | Adds volunteer sign-up, capped by `volunteerCapacity` |
| `allowDonations` | Adds a give option, into `fundId` |
| `allowSponsors` | Adds the sponsor flow |

`signedInOnly` and `churchOnly` are still written and still checked, but the
audience rule is the thing to read — full description in `docs/USERS.md`, code
in `src/lib/audience-core.ts`.

**`startsAt` is nullable on purpose** — an event can exist with the date "to be
advised" while sponsors are being collected, which is how the Festival is
actually run.

Around it: `TicketType` (name, `price`, `quantityAvailable`, `maxPerOrder`,
sales window), `TicketOrder` → `Ticket`, `EventVolunteer`, `EventSponsor`.

## Three levels of visibility, and how each refuses

**Listing and access are separate questions.** `audienceKinds` and
`audiencePublic` decide whose dashboard the event appears on; `audienceGate`
decides what somebody who already has the link gets.

| `audienceGate` | Somebody outside the audience, holding the link |
|---|---|
| **`SHOW`** | The event. The default: an event is open unless somebody says otherwise. |
| **`ASK`** | A page saying to sign in or create an account, with the event's name and `?next=` so they come back to it. This is the admin form's **Private** tick. |
| **`HIDE`** | A 404, and no link preview. |

`SHOW` is the ordinary case: GENERALZ is a church event whose link gets
forwarded far beyond the church, and refusing those people makes a link we
published look broken. The audience still keeps it off everyone else's
dashboard.

**`HIDE` has no control on the form.** It was the old church-only 404, and
leaving an event unpublished does the same job — one way to say a thing rather
than two. Rows that already carry it keep working; a row saved from the form
becomes `ASK` instead, which shows the name rather than nothing.

Under `ASK`, somebody **already signed in** but outside the audience gets the
404 rather than the prompt — they have nothing left to do, and "sign in" to a
person who just did reads as broken.

A **private** event is usually a link emailed to supporters. A 404 there would
make the link look broken to exactly the people it was sent to, so the page
asks instead. That means a private event's **name is not secret** — it is in
the link. Its description, photo, venue and tickets are: `generateMetadata`
returns the title and a generic line for a private event, so a scraper or a
group chat preview gets no more than the name.

A **hidden** event 404s because its existence is not public information. If
something must not be known to exist, that is the gate — or leave it
unpublished. `generateMetadata` gives away exactly what the page would: the real
preview under `SHOW`, the name and a generic line under `ASK`, and the fallback
title alone under `HIDE`, because a preview naming a hidden event would undo the
404. (Until the audience work it returned the full description and photo for a
church-only event while 404ing the page.)

`SignInToView` renders the prompt. `safeNext` validates the return path,
because an unchecked `?next=` is an open redirect on the one page where
somebody has just typed a password.

## Buying tickets

1. `/events/<slug>` — pick types and quantities.
2. Stripe Checkout, with the selections in session metadata.
3. Webhook → `recordTicketOrder` → `createOrderWithTickets`, **idempotent on
   `providerTransactionId`** because Stripe retries.
4. One `Ticket` row per ticket, each with a unique `reference` — that is the
   check-in code.
5. `sendTicketConfirmationEmailForOrder` emails the e-tickets, rendering the
   ticket table into the admin-editable `TICKET_CONFIRMATION` template.
6. `inviteTicketPurchaserToAccount` invites them to set up an account — unless
   the order already belongs to one, a **verified** account exists on that
   email, or one was sent to that address in the last fortnight.

**Availability is deliberately uncached** while the event read is cached. A
stale count could oversell.

`Ticket.attendeeName` is separate from `TicketOrder.purchaserName` — one person
commonly buys for a family.

## Whose order is it

`TicketOrder.userId` is set three ways, and never on an unverified address:

1. **Signed in at checkout** — the session's user id rides through Stripe
   metadata, so the order is on the account from the moment it exists.
2. **Signed out** — the webhook calls `findTicketOwnerByEmail`, which matches
   only a **verified** address, primary or one of the extras on the account.
3. **Later** — `claimTicketOrdersForUser` runs when somebody opens their
   tickets, so an order bought before they had a password follows them in. The
   ticket half of `claimDonationsForUser`, and for the same reason.

Typing an address never links anything. A ticket order carries a name and an
event somebody attended, and handing that to whoever guessed the email is the
failure these guard against — `tickets.test.ts` asserts the *queries* filter on
verification, because that is the line somebody removes while tidying.

**`/dashboard/account/tickets`** shows them, reached from Account rather than
the main nav: most people here never buy a ticket, and a permanent tab for
something used twice a year is clutter on a phone. With no tickets it says so
and lists what is coming up — filtered by the same audience rule, so it never
advertises an event the person could not open.

## Check-in

`Ticket.checkedInAt` plus the printed `reference`. Same idea as the volunteer
kiosk but a different table; attendees are not volunteers.

## Who sees what

| | |
|---|---|
| **The public** | Published events with `audiencePublic`. Preview image comes from the event's own `imageUrl`. |
| **Church members** | Also events whose audience includes `church` — on the dashboard and on the public page. |
| **Signed-in supporters** | The event inside the portal shell, with nav; anonymous visitors get the standalone public page. Same route, different chrome. |
| **Admins** | `care.giving` — events sit in the finance route group because they take money. |

## Things worth knowing before changing it

- **`isPublished` means published to the portal, not to the world.** Check the
  audience before exposing anything on a public route. GENERALZ is published
  *and* church-only, and correctly 404s for strangers — a 404 rather than a
  login prompt, so it does not reveal the event exists. **It is also the usual
  answer to "why does this event 404 for me?"**: there is no admin bypass, so a
  hidden event 404s for a SUPER_ADMIN who is not a church member. If the link is
  meant to work for anyone, the event wants `SHOW`, not a wider audience.
- The page runs one query for the event (cached, identical for everyone) and one
  for the session, **in parallel** — every database round-trip crosses
  Sydney→Tokyo, so two sequential reads are two crossings.
- Some `imageUrl` values point at `scontent-*.fbcdn.net`. Those are signed and
  expire; upload to the media library instead.
