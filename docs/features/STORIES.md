# News stories and good news

Short posts on the dashboard: a family helped, an award won, solar panels
going on the roof. The thing that makes the portal feel alive rather than
administrative.

`/dashboard/news` · admin at `/admin/stories`

## The model

`Story` — `title`, `slug`, `category` ("Good news" / "Story" / "Update"),
`excerpt`, `imageUrl`, `externalUrl`, `publishedAt`, `sortOrder`, and three
flags that decide the audience:

| Flag | Means |
|---|---|
| `isPublished` | Visible in the portal. **Not public** — there is no public story page. |
| `churchOnly` | Church members only |
| `staffOnly` | Staff and trainees only — internal updates |

**`externalUrl`** links to the full article on the main WordPress site. Where it
is set, the story is a card that leads off-site; where it is not, the excerpt
*is* the story.

## Who sees what

Filtered at the query, in `/dashboard/page.tsx` and `/dashboard/news`:

```ts
where: {
  isPublished: true,
  ...(user.isChurchMember ? {} : { churchOnly: false }),
  ...(isStaffOrTrainee   ? {} : { staffOnly: false }),
}
```

So a church member sees church stories *in addition to* general ones, and staff
see staff updates as well. The flags widen an audience, they do not switch
between silos — which is the app's whole pattern.

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
