'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { notify } from '@/lib/notifications'
import { corporateDomain, uniqueSlug } from '@/lib/organisations'
import { OrgMemberRole, OrgMemberStatus, OrgRecognitionKind, OrgStatus } from '@prisma/client'

/**
 * Corporate partner administration — our side.
 *
 * Everything here is gated on `care.giving`: a partnership is a fundraising
 * relationship, and the people who look after giving are the people who should
 * decide who gets a page and what it says about them.
 *
 * Badges live here and nowhere else. A partner admin can change their logo,
 * their blurb and their team, but a recognition is a claim Lighthouse Care is
 * making about what a company did — and one a company could award itself
 * would be worth nothing to the companies who earned theirs.
 */

type Result = { success: boolean; error?: string; id?: string }

async function guard(): Promise<{ userId: string } | null> {
  const session = await getSession()
  if (!session) return null
  if (!(await hasCapability('care.giving'))) return null
  return { userId: session.userId }
}

function refresh(id?: string) {
  revalidatePath('/admin/partners')
  if (id) revalidatePath(`/admin/partners/${id}`)
  revalidatePath('/partners')
}

// ─── Who watches the queue ────────────────────────────────────────────────────

/** Changeable without a deploy, because the right person for this will change. */
const REVIEWER_SETTING = 'partners.reviewer_emails'
const DEFAULT_REVIEWERS = ['josh@lighthousecare.org.au']

/**
 * Tell whoever is watching that an application has arrived.
 *
 * An application form nobody is watching is worse than no form: people apply,
 * hear nothing, and conclude we are not interested — which is the opposite of
 * what the feature exists to do.
 *
 * Read from AppSetting rather than hard-coded, so handing this to somebody
 * else is a settings change and not a deploy. Falls back to a default so it
 * cannot quietly notify nobody.
 */
async function notifyReviewers(input: {
  title: string
  body: string
  href: string
  createdById?: string
}): Promise<void> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: REVIEWER_SETTING },
    select: { value: true },
  })

  const emails = (setting?.value ?? DEFAULT_REVIEWERS.join(','))
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const reviewers = await prisma.user.findMany({
    where: { email: { in: emails, mode: 'insensitive' }, isActive: true },
    select: { id: true },
  })

  if (reviewers.length === 0) {
    // Worth a log line rather than silence: the queue is now unwatched, and
    // nothing else in the system would say so.
    console.warn('[partners] no reviewer found for', emails.join(', '))
    return
  }

  await notify({
    audience: { kind: 'users', ids: reviewers.map((r) => r.id) },
    category: 'GENERAL',
    title: input.title,
    body: input.body,
    href: input.href,
    actionLabel: 'Review it',
    createdById: input.createdById,
  })
}

// ─── Applying ─────────────────────────────────────────────────────────────────

/**
 * Ask for a partner page.
 *
 * Open to any signed-in person, which is why so little of it is taken on
 * trust: the page is created PENDING, it is visible to nobody, and the badges
 * — the part that carries any weight — cannot be touched by the applicant at
 * all. Approval is the only gate that matters, and a person does that.
 */
export async function applyForOrgAction(input: {
  name: string
  website?: string
  logoUrl?: string
  position: string
  note?: string
}): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in first.' }

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, emailVerified: true },
  })
  if (!me) return { success: false, error: 'Please sign in first.' }

  // A domain claim is worthless from an address nobody has proved they own.
  if (!me.emailVerified) {
    return {
      success: false,
      error: 'Please confirm your email address first — check your inbox for our verification link.',
    }
  }

  const name = input.name?.trim()
  const position = input.position?.trim()
  if (!name) return { success: false, error: 'What is the company called?' }
  if (!position) return { success: false, error: 'What is your role there?' }

  const domain = corporateDomain(me.email)

  // Already on our books? Then this is a colleague asking to join, not a
  // second page for the same company — which is what keeps this from becoming
  // a list of near-duplicates within a year.
  if (domain) {
    const existing = await prisma.organisation.findUnique({
      where: { emailDomain: domain },
      select: { id: true, name: true },
    })
    if (existing) {
      await prisma.orgMember.upsert({
        where: { organisationId_userId: { organisationId: existing.id, userId: me.id } },
        create: {
          organisationId: existing.id,
          userId: me.id,
          role: OrgMemberRole.MEMBER,
          status: OrgMemberStatus.PENDING,
          position,
        },
        update: { position },
      })

      await notifyReviewers({
        title: `${me.name ?? me.email} wants to join ${existing.name}`,
        body: `${position} · ${me.email}`,
        href: `/admin/partners/${existing.id}`,
        createdById: me.id,
      })

      return {
        success: true,
        id: existing.id,
        error: undefined,
      }
    }
  }

  const org = await prisma.organisation.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      website: input.website?.trim() || null,
      logoUrl: input.logoUrl?.trim() || null,
      emailDomain: domain,
      requestedById: me.id,
      requestNote: input.note?.trim() || null,
      status: OrgStatus.PENDING,
      members: {
        create: {
          userId: me.id,
          role: OrgMemberRole.ADMIN,
          status: OrgMemberStatus.ACTIVE,
          position,
        },
      },
    },
    select: { id: true },
  })

  await notifyReviewers({
    title: `${name} has asked for a partner page`,
    body: `${me.name ?? me.email}, ${position}${domain ? ` · ${domain}` : ' · no company domain'}`,
    href: `/admin/partners/${org.id}`,
    createdById: me.id,
  })

  return { success: true, id: org.id }
}

// ─── Creating ─────────────────────────────────────────────────────────────────

/**
 * Add a partner ourselves.
 *
 * For the ones we already have — a company that has sponsored three festivals
 * should not have to apply for a page to be recognised for them. Created
 * ACTIVE, because we are the ones who would have approved it.
 */
export async function createOrgAction(input: {
  name: string
  website?: string
  about?: string
  contactName?: string
  contactEmail?: string
}): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const name = input.name?.trim()
  if (!name) return { success: false, error: 'A name is needed.' }

  const org = await prisma.organisation.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      website: input.website?.trim() || null,
      about: input.about?.trim() || null,
      contactName: input.contactName?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      // The domain is evidence for an application. Ours carry none, because
      // nobody had to prove anything to us.
      emailDomain: corporateDomain(input.contactEmail),
      status: OrgStatus.ACTIVE,
      reviewedById: me.userId,
      reviewedAt: new Date(),
    },
    select: { id: true },
  })

  refresh(org.id)
  return { success: true, id: org.id }
}

// ─── Reviewing an application ─────────────────────────────────────────────────

export async function approveOrgAction(id: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const org = await prisma.organisation.update({
    where: { id },
    data: { status: OrgStatus.ACTIVE, reviewedById: me.userId, reviewedAt: new Date() },
    select: { id: true, name: true, requestedById: true, slug: true },
  })

  // Tell whoever asked. An application answered in silence is the same as one
  // that was never read.
  if (org.requestedById) {
    await notify({
      audience: { kind: 'users', ids: [org.requestedById] },
      category: 'GENERAL',
      title: `${org.name} is approved`,
      body: 'You can finish the page and publish it when you are ready.',
      href: '/dashboard/account',
      actionLabel: 'Open it',
      createdById: me.userId,
    })
  }

  refresh(id)
  return { success: true }
}

export async function declineOrgAction(id: string, note: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }
  if (!note?.trim()) {
    // Required rather than optional: somebody has to read this, and "declined"
    // with no reason is a support conversation we will have anyway.
    return { success: false, error: 'Give a reason — the applicant will be told it.' }
  }

  const org = await prisma.organisation.update({
    where: { id },
    data: {
      status: OrgStatus.DECLINED,
      reviewNote: note.trim(),
      reviewedById: me.userId,
      reviewedAt: new Date(),
      isPublished: false,
    },
    select: { id: true, name: true, requestedById: true },
  })

  if (org.requestedById) {
    await notify({
      audience: { kind: 'users', ids: [org.requestedById] },
      category: 'GENERAL',
      title: `About your request for ${org.name}`,
      body: note.trim().slice(0, 200),
      href: '/dashboard/account',
      createdById: me.userId,
    })
  }

  refresh(id)
  return { success: true }
}

/**
 * Publish or unpublish.
 *
 * Separate from approval on purpose: approving says this really is Fulton
 * Hogan, publishing says the page is ready to be seen. Refuses to publish an
 * organisation that is not approved — the two gates are independent, and one
 * should not be able to route around the other.
 */
export async function setOrgPublishedAction(id: string, published: boolean): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const org = await prisma.organisation.findUnique({ where: { id }, select: { status: true } })
  if (!org) return { success: false, error: 'Not found.' }
  if (published && org.status !== OrgStatus.ACTIVE) {
    return { success: false, error: 'Approve it first — an unapproved page cannot go public.' }
  }

  await prisma.organisation.update({
    where: { id },
    data: { isPublished: published, publishedAt: published ? new Date() : null },
  })

  refresh(id)
  return { success: true }
}

// ─── The profile ──────────────────────────────────────────────────────────────

export async function updateOrgAction(
  id: string,
  input: {
    name?: string
    website?: string
    about?: string
    logoUrl?: string
    contactName?: string
    contactEmail?: string
    contactPhone?: string
  },
): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const name = input.name?.trim()
  if (input.name !== undefined && !name) return { success: false, error: 'A name is needed.' }

  await prisma.organisation.update({
    where: { id },
    data: {
      ...(name ? { name, slug: await uniqueSlug(name, id) } : {}),
      ...(input.website !== undefined ? { website: input.website.trim() || null } : {}),
      ...(input.about !== undefined ? { about: input.about.trim() || null } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl.trim() || null } : {}),
      ...(input.contactName !== undefined ? { contactName: input.contactName.trim() || null } : {}),
      ...(input.contactEmail !== undefined
        ? { contactEmail: input.contactEmail.trim() || null }
        : {}),
      ...(input.contactPhone !== undefined
        ? { contactPhone: input.contactPhone.trim() || null }
        : {}),
    },
  })

  refresh(id)
  return { success: true }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export async function addRecognitionAction(input: {
  organisationId: string
  kind: OrgRecognitionKind
  label: string
  year?: number | null
  tier?: string
  detail?: string
  amountCents?: number | null
  showAmount?: boolean
}): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const label = input.label?.trim()
  if (!label) return { success: false, error: 'Say what it was for.' }

  await prisma.orgRecognition.create({
    data: {
      organisationId: input.organisationId,
      kind: input.kind,
      label,
      year: input.year ?? null,
      tier: input.tier?.trim() || null,
      detail: input.detail?.trim() || null,
      amountCents: input.amountCents ?? null,
      showAmount: Boolean(input.showAmount && input.amountCents),
    },
  })

  refresh(input.organisationId)
  return { success: true }
}

export async function removeRecognitionAction(id: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }
  const row = await prisma.orgRecognition.delete({
    where: { id },
    select: { organisationId: true },
  })
  refresh(row.organisationId)
  return { success: true }
}

// ─── Posts ────────────────────────────────────────────────────────────────────

/**
 * Let a photo onto the public page, or take it down.
 *
 * Ours, not the partner's. The people in the picture are their staff and the
 * page carries their employer's name; publishing first and checking later is
 * the wrong way round for both reputations.
 */
export async function setPostApprovedAction(id: string, approved: boolean): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const post = await prisma.orgPost.update({
    where: { id },
    data: {
      isApproved: approved,
      approvedAt: approved ? new Date() : null,
      approvedById: approved ? me.userId : null,
    },
    select: { organisationId: true },
  })

  refresh(post.organisationId)
  return { success: true }
}

// ─── Team ─────────────────────────────────────────────────────────────────────

/** Attach someone to an organisation, by the email they already sign in with. */
export async function addOrgMemberAction(input: {
  organisationId: string
  email: string
  role: OrgMemberRole
  position?: string
}): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const email = input.email?.trim().toLowerCase()
  if (!email) return { success: false, error: 'An email is needed.' }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  })
  if (!user) {
    // Deliberately not creating one. An account made on someone's behalf has
    // no password, no verified address and nobody expecting it.
    return { success: false, error: 'No account with that email — ask them to sign up first.' }
  }

  await prisma.orgMember.upsert({
    where: { organisationId_userId: { organisationId: input.organisationId, userId: user.id } },
    create: {
      organisationId: input.organisationId,
      userId: user.id,
      role: input.role,
      status: OrgMemberStatus.ACTIVE,
      position: input.position?.trim() || null,
      addedById: me.userId,
    },
    update: { role: input.role, status: OrgMemberStatus.ACTIVE },
  })

  refresh(input.organisationId)
  return { success: true }
}

export async function removeOrgMemberAction(id: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }
  const row = await prisma.orgMember.delete({
    where: { id },
    select: { organisationId: true },
  })
  refresh(row.organisationId)
  return { success: true }
}
