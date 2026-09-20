# The fitness challenge

A collective, staff-only challenge — "10 million steps in September". Everyone's
steps add to one shared total rather than competing individually, which is the
whole design: the goal is a team pulling together, not a leaderboard with
winners and losers.

`/dashboard/fitness`

## Who sees it

Staff and trainees (`isStaff` or `isTrainee`), plus admin roles. Everyone else
gets a **404** — not a redirect, because the challenge is an internal staff
thing and its existence is not public information.

A banner appears on the main dashboard for the same people, via
`ChallengeBanner`.

## The models

| Model | Holds |
|---|---|
| `FitnessChallenge` | Name, slug, unit (default "steps"), collective `goal`, start and end, optional `imageUrl` for re-skinning the banner without a deploy |
| `FitnessEntry` | **One row per person per day** — unique on `(challengeId, userId, day)`, so re-entering a day corrects it rather than double-counting |
| `FitnessLink` | An opt-in, write-only token letting a phone push step counts |
| `ChallengeCheer` | A note on the wall for today, deleted overnight |
| `WellbeingSession` | The recurring weekly health schedule |
| `WellbeingTip` | Rotating encouragement, one per day, cycled by date |

`day` is a `@db.Date` holding the Brisbane calendar day as midnight UTC. Use
the helpers in `src/lib/fitness-days.ts` — `brisbaneToday()`, `calendarDay()`,
`calendarDayString()` — rather than constructing dates by hand.

## Steps get in three ways

**By hand.** `LogStepsForm` on the fitness page. Deliberately supported as a
first-class path: device sync means per-provider OAuth, and **Apple Health has
no server API at all** — HealthKit is native-only — so hand entry is not a
fallback, it is the baseline.

**From a phone, by token.** `FitnessLink` is an opt-in row holding a token. An
iOS Shortcut reads today's step count and POSTs it:

```
POST /api/fitness/steps          Authorization: Bearer <token>    { "steps": 8421 }
POST /api/fitness/steps/<token>                                   { "steps": 8421 }
```

The second form exists because setting a custom header in the Shortcuts app is
where people get stuck; a personal link pasted into one field is a shorter
road. Both accept an optional `"day"`.

**The token is write-only by design.** It can add a step count for its owner
and nothing else — it reads no personal data. A leaked token means somebody
could fudge one person's tally, which is annoying rather than harmful, and it
can be regenerated from the fitness page. Set up at
`/dashboard/fitness/connect`; revoking is one row update (`revokedAt`).

## What the page shows

- Collective progress against the goal, with milestones (`fitness-milestones.ts`).
- **Pace** — whether the team is ahead or behind where it needs to be
  (`fitness-pace.ts`), including `walkingTime()` to express steps as minutes.
- Leaders for today, this week, this month (`LeaderWindow` in `fitness-data.ts`).
- Weekly winners (`fitness-weeks.ts`).
- The **cheer wall**: notes from today only. Yesterday's are deleted by the
  daily cron. A wall that accumulates goes stale and stops being read; one that
  empties every night stays worth looking at, and it lowers the stakes of
  posting.
- The weekly wellbeing schedule. Times are **plain strings** ("11:30") on
  purpose — these are wall-clock slots in a printed-on-the-fridge sense, not
  instants, and nobody wants "Tuesday 11:30" drifting through a timezone
  conversion.
- A tip of the day, cycled by date.
- Confetti and a celebration when a milestone lands.

## Things worth knowing before changing it

- **Entries are corrections, not additions.** The unique constraint means a
  second push for the same day replaces the figure. Anything that sums
  `FitnessEntry` rows for a person-day is already wrong.
- **There is no device integration to "finish".** Apple offers no server API.
  Do not add a provider OAuth flow expecting to replace hand entry.
- **Cheating warnings were deliberately removed.** An earlier version nagged
  about implausible step counts. Everyone got the message; it now trusts people.
