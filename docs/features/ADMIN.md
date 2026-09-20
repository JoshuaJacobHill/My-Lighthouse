# Admin settings and the admin area

`/admin` — reachable by `isAdminRole()` (`ADMIN`, `SUPER_ADMIN`,
`CARE_MANAGER`, `CHURCH_MANAGER`), then gated per page by capability.
Middleware enforces the coarse gate; each page enforces the specific one.

## Settings

`/admin/settings`, tabbed:

| Tab | Holds | Who |
|---|---|---|
| **Email** | From name and address, provider (Resend or SMTP) and its credentials, no-show grace period, inactivity reminder days | `system.settings` |
| **General** | Organisation name, app display name, default kiosk location, app URL | `system.settings` |
| **Availability** | The availability options volunteers choose from | `system.settings` |
| **Induction** | Induction sections and quiz questions | `system.settings` |
| **Admin Users** | Creating admins, assigning roles | `SUPER_ADMIN` only |

Values live in **`AppSetting`** — a key/value table, so changing the from-address
or the kiosk's default location is a settings change rather than a deploy.
Keys in use include `employment_hero_url`, `login_hero_image_url`,
`fitness_shortcut_url`, `partners.reviewer_emails`,
`partners.fundraiser_fund_id`, and `share.image.volunteer` / `.contact`.

**Adding a setting:** read it with a `findUnique` on the key and **always have a
fallback**. An unset key must never be a broken page — that is why
`shareImageSetting()` returns null and the caller falls back to the site banner.

## Email templates

`EmailTemplate` rows rendered by `renderTemplate()`, one per
`EmailTemplateType`. **Copy that belongs in a template does not belong in
code** — staff edit these. Variables are `{{double_braced}}`; the ticket email
injects a whole HTML table as `{{tickets}}` so the surrounding words stay
editable.

`EmailLog` records every send. It doubles as the rate limiter for the public
contact form — 3/hour per sender, 40/hour overall, counted from the log rather
than a new table.

## The rest of the admin area

`users` (volunteers folded in) · `volunteers` · `roster` · `attendance` ·
`on-site` · `tasks` · `teams` · `feedback` · `emails` · `notifications` ·
`partners` · `media` · `marketing` · `meta-scopes` · `ig-backfill` ·
and the `(finance)` group: `transactions`, `fundraisers`, `stories`, `events`.

The **`(finance)` route group** is the giving side and is gated by
`care.giving` — which a plain `ADMIN` only holds with `canViewDonations`
ticked. Do not move a finance page out of that group.

## Granting the sales report

`/admin/users/<id>` carries a **Sales and marketing report** panel, `SUPER_ADMIN`
only, setting `canViewBusinessReports`. It sits apart from the staff and trainee
flags on purpose: store takings, ad spend and campaign returns are a different
kind of decision from "is this person a trainee", and a toggle in a row with
"trainee" invites being flicked in passing.

## Notifications

`Notification` + `NotificationRecipient`, with a `NotificationCategory`.
`notify()` takes an audience — `{ kind: 'users', ids }` or a broader selector —
so a notification is addressed rather than broadcast.

**Address them narrowly.** An unfinished-tasks email once went to everyone
instead of the people assigned; the fix was counts rather than a full list, and
only to the staff it belonged to. A notification everyone receives is one
everyone learns to ignore.
