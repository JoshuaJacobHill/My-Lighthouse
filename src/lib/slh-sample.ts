/**
 * Santa's Little Helpers — sample data for the preview.
 *
 * **Nothing here is real.** No schema exists yet: the program, the referring
 * organisations, the families and the wish lists are all still a design, and
 * this file is what lets the design be walked through on a phone instead of in
 * an artifact. It is deliberately the only place the fiction lives, so that
 * swapping it for Prisma queries later is one file and not a hunt.
 *
 * The shape is the one the mockup settled on, and the one the real schema
 * should follow:
 *
 *   program        the year, its dates, what a shopper is asked to spend
 *   organisation   who nominated the child, and where the gifts are taken
 *   wish list      one child, four gifts, interests, and their own words
 *   steps          the chain a shopper works through, per child
 *
 * The child fields stop where the mockup stopped: a first name, an age, sizes,
 * interests and an approved story. Anything that identifies a family — a
 * surname, a guardian, an address — is not here, because a shopper never sees
 * it and a preview should not be the thing that first pretends otherwise.
 */

export type WishStep = {
  key: 'received' | 'shopped' | 'wrapped' | 'labels' | 'dropoff' | 'delivered'
  title: string
  hint: string
}

/**
 * Every step is something the program needs to know: that the list is in safe
 * hands, what was bought, what it looks like wrapped, and when it is coming in.
 */
export const WISH_STEPS: WishStep[] = [
  { key: 'received', title: 'Wish list received', hint: 'Confirm you have this list' },
  { key: 'shopped', title: 'Wish list fulfilled', hint: 'A photo of the gifts before wrapping' },
  { key: 'wrapped', title: 'Gifts wrapped', hint: 'A photo of them wrapped' },
  { key: 'labels', title: 'Ready for delivery', hint: 'Print the gift tags' },
  { key: 'dropoff', title: 'Drop-off booked', hint: 'Pick a time to bring them in' },
  { key: 'delivered', title: 'Delivered', hint: 'Scanned in at drop-off' },
]

export const WISH_KINDS = [
  ['want', 'Something they want'],
  ['need', 'Something they need'],
  ['wear', 'Something to wear'],
  ['read', 'Something to read'],
] as const

export type SampleOrg = {
  id: string
  name: string
  suburb: string
  postcode: string
  address: string
  window: string
  /** When the drop-off window shuts, as a Brisbane calendar day. */
  closes: string
}

export type SampleChild = {
  id: string
  name: string
  age: number
  gender: 'girl' | 'boy'
  orgId: string
  colour: string
  clothes: string
  shoes: string
  interests: string[]
  /** Only ever shown once somebody at Lighthouse has approved it. */
  story: { text: string; approved: boolean }
  want: string
  need: string
  wear: string
  read: string
  /** How far the shopper has got, in `WISH_STEPS` order. */
  done: WishStep['key'][]
}

export const SAMPLE_ORG: SampleOrg = {
  id: 'village',
  name: 'Village Connect',
  suburb: 'Beenleigh',
  postcode: '4207',
  address: '12 George Street, Beenleigh QLD 4207',
  window: 'Mon 1 – Thu 4 December',
  closes: '2026-12-04',
}

export const SAMPLE_CHILDREN: SampleChild[] = [
  {
    id: '123-LIG',
    name: 'Amira',
    age: 7,
    gender: 'girl',
    orgId: 'village',
    colour: 'Red',
    clothes: 'Size 7',
    shoes: 'Size 12',
    interests: ['Drawing', 'Horses', 'Arts & crafts', 'Animals'],
    story: {
      text: 'I like drawing horses. My brother is 3 and I help Mum look after him. I want to be a vet.',
      approved: true,
    },
    want: 'A big set of textas and a sketchbook',
    need: 'A drink bottle and a lunch box for school',
    wear: 'A summer dress — she loves red',
    read: 'A chapter book about horses',
    done: ['received', 'shopped'],
  },
  {
    id: '124-LIG',
    name: 'Jayden',
    age: 11,
    gender: 'boy',
    orgId: 'village',
    colour: 'Blue',
    clothes: 'Size 12',
    shoes: 'Size 4 youth',
    interests: ['Minecraft', 'Gaming', 'LEGO', 'Footy', 'Skating'],
    story: {
      text: 'I play Minecraft with my cousin. I got player of the week at footy.',
      approved: true,
    },
    want: 'Minecraft Lego — anything Minecraft',
    need: 'A school backpack, his has a broken strap',
    wear: 'Broncos shorts and a t-shirt',
    read: 'Diary of a Wimpy Kid, he has the first two',
    done: ['received'],
  },
  {
    id: '125-LIG',
    name: 'Tia',
    age: 4,
    gender: 'girl',
    orgId: 'village',
    colour: 'Purple',
    clothes: 'Size 4',
    shoes: 'Size 9',
    interests: ['Bluey', 'Animals', 'Dancing'],
    // Not every child writes one, and an empty story is not a missing feature.
    story: { text: '', approved: false },
    want: 'A Bluey playset',
    need: 'A swimming towel and bathers for summer',
    // Half-filled on purpose: this is what the organisation chases.
    wear: '',
    read: '',
    done: [],
  },
]

export const childById = (id: string) => SAMPLE_CHILDREN.find((c) => c.id === id) ?? null

/** Whole days from today to a yyyy-mm-dd, in Brisbane's calendar. */
export function daysUntil(day: string, now: Date = new Date()): number {
  const [y, m, d] = day.split('-').map(Number)
  const bne = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [ny, nm, nd] = bne.split('-').map(Number)
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(ny, nm - 1, nd)) / 86_400_000
  )
}

/* ── The organisation's side ───────────────────────────────────────────────
   Families are the unit an organisation works with: one guardian, one phone
   number, and however many children. A child with no family is allowed and
   expected — residential care, a kinship placement — so `familyId` is optional
   on the child rather than required.

   The guardian's details are the part a shopper must never see. They are here
   because the organisation and Lighthouse both need them: to chase an unfilled
   list, and to ring a family directly when the organisation goes quiet. */

export type SampleFamily = {
  id: string
  /** Parent, guardian, grandparent, kinship carer — whoever holds the family. */
  guardian: string
  email: string
  phone: string
  childIds: string[]
  /** Recorded, not assumed: they know, and they agreed we may contact them. */
  consentedOn: string
}

export const SAMPLE_FAMILIES: SampleFamily[] = [
  {
    id: 'f1',
    guardian: 'Leila M.',
    email: 'leila.m@example.com',
    phone: '0412 884 221',
    childIds: ['123-LIG', '125-LIG'],
    consentedOn: '4 November 2026',
  },
  {
    id: 'f2',
    guardian: 'Dave R.',
    email: 'dave.r@example.com',
    phone: '0431 550 118',
    childIds: ['124-LIG'],
    consentedOn: '6 November 2026',
  },
]

/** Lighthouse sets the ceiling. An organisation cannot nominate past it. */
export const SAMPLE_ALLOCATION = 62

/** Children this organisation has nominated, beyond the shopper's three. */
export const SAMPLE_NOMINATED = 41

export const SAMPLE_EVENT = {
  on: true,
  name: 'Village Connect Christmas Party',
  when: 'Saturday 13 December, 10:00am – 1:00pm',
  where: '12 George Street, Beenleigh',
  note: 'Lunch, a jumping castle and a visit from Santa. Bring the whole family.',
  rsvps: 4,
}

export const familyOf = (childId: string) =>
  SAMPLE_FAMILIES.find((f) => f.childIds.includes(childId)) ?? null

/** Children with no family attached — nominated on their own. */
export const unfamiliedChildren = () =>
  SAMPLE_CHILDREN.filter((c) => !familyOf(c.id))

/**
 * Whether a child's wish list is finished.
 *
 * All four gifts named. A half-filled list is the thing the reminder button
 * exists to chase, so "done" has to mean the same thing everywhere.
 */
export const listComplete = (child: SampleChild) =>
  Boolean(child.want && child.need && child.wear && child.read)
