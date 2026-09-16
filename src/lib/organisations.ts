/**
 * Corporate partner profiles.
 *
 * Two audiences read the same organisation and must not see the same thing:
 *
 *   The public   — name, logo, blurb, badges, approved photos.
 *   Their admin  — all of that, plus the team and the contact details.
 *
 * So the public reader gets a deliberately narrow shape rather than the row.
 * A partner's contact name and direct line live on this record, and the whole
 * point of a public page is that nobody signs in to see it.
 */

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { OrgMemberRole, OrgMemberStatus, OrgStatus } from '@prisma/client'

// ─── Slugs ────────────────────────────────────────────────────────────────────

/** "Fulton Hogan" → "fulton-hogan". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * A slug nothing else is using.
 *
 * Two companies can share a trading name, and a collision would take the
 * second one to the first one's page — which is worse than an ugly URL.
 */
export async function uniqueSlug(name: string, exceptId?: string): Promise<string> {
  const base = slugify(name) || 'partner'
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`
    const clash = await prisma.organisation.findUnique({ where: { slug }, select: { id: true } })
    if (!clash || clash.id === exceptId) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

// ─── Email domains ────────────────────────────────────────────────────────────

/**
 * Providers anybody can sign up to, which therefore evidence nothing.
 *
 * Not a blocklist for applications — a small business running on Gmail is
 * still a supporter, and refusing them would shut out a great many of the
 * people who back us. It decides only whether the domain is worth *recording*
 * as evidence, and whether a later applicant on the same domain should be
 * treated as a colleague. Two strangers both on gmail.com are not colleagues.
 */
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'live.com',
  'live.com.au',
  'msn.com',
  'yahoo.com',
  'yahoo.com.au',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'bigpond.com',
  'bigpond.net.au',
  'optusnet.com.au',
  'iinet.net.au',
  'tpg.com.au',
  'internode.on.net',
])

/** The domain of an address, or null when it proves nothing. */
export function corporateDomain(email: string | null | undefined): string | null {
  const at = email?.trim().toLowerCase().split('@')
  if (!at || at.length !== 2 || !at[1]) return null
  const domain = at[1]
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) return null
  if (!domain.includes('.')) return null
  return domain
}

// ─── Membership ───────────────────────────────────────────────────────────────

export type Membership = { organisationId: string; role: OrgMemberRole; status: OrgMemberStatus }

/** Every organisation the signed-in person belongs to. */
export async function myMemberships(): Promise<Membership[]> {
  const session = await getSession()
  if (!session) return []
  return prisma.orgMember.findMany({
    where: { userId: session.userId, status: OrgMemberStatus.ACTIVE },
    select: { organisationId: true, role: true, status: true },
  })
}

/**
 * Whether the signed-in person may administer this one organisation.
 *
 * The per-row check the whole feature turns on. Deliberately not a capability:
 * a global "partner admin" would hand its holder every company's profile at
 * once, and Amy at Fulton Hogan has no business editing anyone else's.
 */
export async function canAdminOrg(organisationId: string): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  const member = await prisma.orgMember.findUnique({
    where: { organisationId_userId: { organisationId, userId: session.userId } },
    select: { role: true, status: true },
  })
  return member?.status === OrgMemberStatus.ACTIVE && member.role === OrgMemberRole.ADMIN
}

// ─── Public reading ───────────────────────────────────────────────────────────

export type PublicBadge = {
  id: string
  kind: string
  year: number | null
  tier: string | null
  label: string
  detail: string | null
  /** Only where the partner agreed to show it. */
  amountCents: number | null
}

export type PublicPartner = {
  name: string
  slug: string
  logoUrl: string | null
  website: string | null
  about: string | null
  /** Newest first, standing relationships before dated ones. */
  badges: PublicBadge[]
  posts: {
    id: string
    caption: string | null
    imageUrl: string | null
    happenedAt: Date | null
    /** First name only — a public page does not need anyone's surname. */
    authorFirstName: string | null
  }[]
}

/**
 * One partner, as the public sees them.
 *
 * Published only. An approved-but-unpublished organisation is one whose admin
 * is still writing it, and a half-finished page about a real company is worse
 * than no page.
 */
export async function getPublicPartner(slug: string): Promise<PublicPartner | null> {
  const org = await prisma.organisation.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      logoUrl: true,
      website: true,
      about: true,
      status: true,
      isPublished: true,
      recognitions: {
        orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          kind: true,
          year: true,
          tier: true,
          label: true,
          detail: true,
          amountCents: true,
          showAmount: true,
        },
      },
      posts: {
        where: { isApproved: true },
        orderBy: [{ happenedAt: 'desc' }, { createdAt: 'desc' }],
        take: 12,
        select: {
          id: true,
          caption: true,
          imageUrl: true,
          happenedAt: true,
          author: { select: { name: true } },
        },
      },
    },
  })

  if (!org || org.status !== OrgStatus.ACTIVE || !org.isPublished) return null

  return {
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    website: org.website,
    about: org.about,
    badges: org.recognitions.map((r) => ({
      id: r.id,
      kind: r.kind,
      year: r.year,
      tier: r.tier,
      label: r.label,
      detail: r.detail,
      // Withheld unless the partner said otherwise — some would rather the
      // figure were not on a public page, and it is not ours to publish.
      amountCents: r.showAmount ? r.amountCents : null,
    })),
    posts: org.posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      imageUrl: p.imageUrl,
      happenedAt: p.happenedAt,
      authorFirstName: p.author?.name?.trim().split(/\s+/)[0] ?? null,
    })),
  }
}

/** Everyone with a live page, for the index. */
export async function listPublicPartners(): Promise<
  { name: string; slug: string; logoUrl: string | null; topBadge: string | null }[]
> {
  const orgs = await prisma.organisation.findMany({
    where: { status: OrgStatus.ACTIVE, isPublished: true },
    orderBy: { name: 'asc' },
    select: {
      name: true,
      slug: true,
      logoUrl: true,
      recognitions: {
        orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
        select: { tier: true, label: true, year: true },
      },
    },
  })

  return orgs.map((o) => {
    const r = o.recognitions[0]
    return {
      name: o.name,
      slug: o.slug,
      logoUrl: o.logoUrl,
      topBadge: r ? [r.year, r.tier, r.label].filter(Boolean).join(' ') : null,
    }
  })
}

// ─── Admin reading ────────────────────────────────────────────────────────────

/** Everything about one organisation, for our own admin screens. */
export async function getOrgForAdmin(id: string) {
  return prisma.organisation.findUnique({
    where: { id },
    include: {
      recognitions: { orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }] },
      members: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      posts: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { author: { select: { name: true } } },
      },
    },
  })
}

/** The admin list: applications first, since those are waiting on us. */
export async function listOrgsForAdmin() {
  return prisma.organisation.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      status: true,
      isPublished: true,
      emailDomain: true,
      createdAt: true,
      _count: { select: { members: true, recognitions: true, posts: true } },
    },
  })
}

/** How many applications are sitting unanswered. */
export async function pendingOrgCount(): Promise<number> {
  return prisma.organisation.count({ where: { status: OrgStatus.PENDING } })
}
