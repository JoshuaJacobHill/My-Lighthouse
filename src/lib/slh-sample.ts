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
    wear: 'A purple singlet and shorts set',
    read: 'Bluey picture books',
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
