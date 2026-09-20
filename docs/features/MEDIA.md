# The media library

One place for every image the organisation publishes. Events, stories,
fundraisers, appeals, sponsors, and anything uploaded for marketing — in one
grid, so a good photo from the Good Food Festival can go into an ad without
being uploaded twice.

`/admin/media`

## Who sees it

`business.reports` — so Josh plus anyone with the sales-report switch on. The
old marketing-only URL `/admin/marketing/library` redirects here.

## One upload path, and only one

**All images go through `uploadImageAction` in
`src/lib/actions/upload.actions.ts`.** Never write a second uploader. That path:

- **Sniffs the file's magic bytes** rather than trusting the browser's
  content-type, which the caller controls.
- **Refuses SVG**, because SVG can carry script and every image we host is a
  photo or a logo.
- Caps at 5MB, keeps a readable filename, and adds a random suffix so an upload
  can never guess or overwrite another.
- Takes a `folder` parameter.

This rule exists because it was broken once: a second uploader was written for
the marketing assistant that trusted `file.type`, meaning the *weaker* check
guarded the images going into public advertisements. That is backwards, and it
is why the rule is in `AGENTS.md`.

## What is in the library, and what is not

`src/lib/media-library.ts` reads across these folders:

```
media  uploads  events  fundraisers  funds  sponsors  stories  marketing-assets
```

**Deliberately outside it:**

- `avatars/` — volunteers' own profile photos. A picture somebody uploaded of
  themselves is not stock for an advertisement.
- `partner-logos/` — a company's mark, managed on their own page, theirs rather
  than ours to place.

`isPublishableMedia()` enforces that **at the point of publishing**, not only in
the listing. The listing decides what a person is shown; that function decides
what can actually go out, and there are tests on both exclusions.

## Filenames carry more weight than they look like they should

The marketing assistant can read filenames but **cannot see the pictures**. So
`trolley-mangoes-sept.jpg` gets suggested sensibly and `IMG_4471.jpg` never
does. The assistant is instructed never to describe what is in an image, and a
person always sees the real picture on the approval card before anything is
published.

## Things worth knowing before changing it

- **`e.target.files` is a live FileList.** Clearing `input.value` empties that
  same object, so copy with `Array.from()` *before* the reset. Getting this
  wrong makes uploads do nothing at all — no spinner, no error — and it has
  already happened once here.
- **Instagram and Meta fetch the image themselves** from a public URL; they will
  not accept an upload. That is why these live in Blob storage and why anything
  put here should be fine to be public.
- **Event images pasted from Facebook will break.** Some records point at
  `scontent-*.fbcdn.net` URLs, which are signed and expire. When they do, the
  page image and the share preview both go blank. Upload properly instead.
