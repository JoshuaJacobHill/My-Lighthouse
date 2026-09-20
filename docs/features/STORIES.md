# News stories and good news

Short posts on the dashboard: a family helped, an award won, solar panels
going on the roof. The thing that makes the portal feel alive rather than
administrative.

`/dashboard/news` · admin at `/admin/stories`

## The model

`Story` — `title`, `slug`, `category` ("Good news" / "Story" / "Update"),
`excerpt`, `imageUrl`, `externalUrl`, `publishedAt`, `sortOrder`, plus
`isPublished` and the audience rule:

| Column | Means |
|---|---|
| `isPublished` | Visible in the portal. **Not public** — there is no public story page. |
| `audienceKinds` | Who it is for: any of `church`, `staff`, `volunteers`, `donors`, `partners`. Empty = any signed-in supporter. |
| `audienceMatch` | `ANY`, or `ALL` for the church-*and*-staff stories that predate the picker. |

`churchOnly` and `staffOnly` are still written, and still filtered on, while the
backfill settles — but the rule is the thing to read. Full description in
`docs/USERS.md`; the code is `src/lib/audience-core.ts`.

**A story has no `audiencePublic` column, and that is deliberate.** Events have
one; stories cannot be public, and the absent column is what stops one being
made public by accident. See the last section.

**`externalUrl`** links to the full article on the main WordPress site. Where it
is set, the story is a card that leads off-site; where it is not, the excerpt
*is* the story.

## Who sees what

Filtered at the query, in `/dashboard/page.tsx` and `/dashboard/news` — which
must filter **identically**, or the two pages disagree about one story:

```ts
where: {
  isPublished: true,
  // The old flags, still applied until the backfill is confirmed…
  ...(user.isChurchMember ? {} : { churchOnly: false }),
  ...(isStaffOrTrainee   ? {} : { staffOnly: false }),
  // …and the rule. In AND, so it cannot collide with an OR above it.
  AND: [storyAudienceWhere(connectionsFromSession(user))],
}
```

So a church member sees church stories *in addition to* general ones, and staff
see staff updates as well. An audience widens who can read something; it does
not switch between silos — which is the app's whole pattern, and why `ANY` is
the default and most people match several audiences at once.

Comments follow the same rule: `canSeeStory()` refuses a comment on anything
that would not have been listed, and who may be @-mentioned resolves through
the same audience machinery as the notification fan-out — so offering somebody
as a mention never tells the author that a person can read something they
cannot.

## Comments

`Comment` rows with a nullable `storyId` and a nullable `taskId` — the same
table serves story comments and staff-task comments. `editedAt` is set when the
author changes one, so the UI can be honest that it was edited.
`CommentMention` handles @-mentions. Loaded in bulk by `commentsForStories()`
rather than per-card.

## There is no public story page

Stories live behind a sign-in. A story link shared on social media asks
strangers to log in, and where `externalUrl` is set the shareable link is the
WordPress one — whose preview WordPress controls, not us.

A public `/stories/<slug>` route **was built and then removed**: it made
published stories world-readable, which nobody had asked for, and "published to
the portal" is not the same decision as "published to the world".

**If shareable stories are wanted, the right shape is a per-story
"share publicly" flag defaulting to off** — so making one public is a decision
somebody takes, not a side effect of publishing it to the portal. Church-only
and staff-only stories must never be reachable that way.
