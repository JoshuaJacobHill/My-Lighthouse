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
| `signedInOnly` | **Private.** Signed-in supporters only. |
| `churchOnly` | Church members only. Anonymous visitors get a **404**. |
| `allowVolunteers` | Adds volunteer sign-up, capped by `volunteerCapacity` |
| `allowDonations` | Adds a give option, into `fundId` |
| `allowSponsors` | Adds the sponsor flow |

**`startsAt` is nullable on purpose** — an event can exist with the date "to be
advised" while sponsors are being collected, which is how the Festival is
actually run.

Around it: `TicketType` (name, `price`, `quantityAvailable`, `maxPerOrder`,
sales window), `TicketOrder` → `Ticket`, `EventVolunteer`, `EventSponsor`.

## Three levels of visibility, and how each refuses

| | Who can read it | What a stranger gets |
|---|---|---|
| Public | Anyone | The event |
| `signedInOnly` | Any signed-in supporter | **A page saying to sign in or create an account** — with the event's name, and `?next=` so they come back to it |
| `churchOnly` | Church members | **A 404** |

The difference between the last two is deliberate and worth keeping.

A **private** event is usually a link emailed to supporters. A 404 there would
make the link look broken to exactly the people it was sent to, so the page
asks instead. That means a private event's **name is not secret** — it is in
the link. Its description, photo, venue and tickets are: `generateMetadata`
returns the title and a generic line for a private event, so a scraper or a
group chat preview gets no more than the name.

A **church-only** event 404s because its existence is not public information.
If something must not be known to exist, that is the flag — or leave it
unpublished.

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

`TicketOrder.userId` is matched by email, and `Ticket.attendeeName` is separate
from `TicketOrder.purchaserName` — one person commonly buys for a family.

## Check-in

`Ticket.checkedInAt` plus the printed `reference`. Same idea as the volunteer
kiosk but a different table; attendees are not volunteers.

## Who sees what

| | |
|---|---|
| **The public** | Published, non-church events. Preview image comes from the event's own `imageUrl`. |
| **Church members** | Also `churchOnly` events — on the dashboard and on the public page. |
| **Signed-in supporters** | The event inside the portal shell, with nav; anonymous visitors get the standalone public page. Same route, different chrome. |
| **Admins** | `care.giving` — events sit in the finance route group because they take money. |

## Things worth knowing before changing it

- **`isPublished` means published to the portal, not to the world.** Check
  `churchOnly` before exposing anything on a public route. GENERALZ is
  published *and* church-only, and correctly 404s for strangers — a 404 rather
  than a login prompt, so it does not reveal the event exists.
- The page runs one query for the event (cached, identical for everyone) and one
  for the session, **in parallel** — every database round-trip crosses
  Sydney→Tokyo, so two sequential reads are two crossings.
- Some `imageUrl` values point at `scontent-*.fbcdn.net`. Those are signed and
  expire; upload to the media library instead.
