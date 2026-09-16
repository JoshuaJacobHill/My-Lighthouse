'use server'

import { put } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { notify } from '@/lib/notifications'
import { canAdminOrg, corporateDomain, findOrgByName, uniqueSlug } from '@/lib/organisations'
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

type Result = {
  success: boolean
  error?: string
  id?: string
  /** What actually happened, where the form needs to say something different. */
  outcome?: 'applied' | 'joined'
}

/** A logo renders at 80px tall. Nobody needs megabytes of it. */
const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

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

  /**
   * Turn an application into a request to join the company already here.
   *
   * Always PENDING, never ACTIVE. Recognising a name is not the same as
   * knowing somebody works there — this only ever puts the request in front of
   * a person, with whatever they wrote attached.
   */
  const askToJoin = async (existing: { id: string; name: string }): Promise<Result> => {
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
      body: `${position} · ${me.email}${input.note?.trim() ? ` · ${input.note.trim()}` : ''}`,
      href: `/admin/partners/${existing.id}`,
      createdById: me.id,
    })

    return { success: true, id: existing.id, outcome: 'joined' }
  }

  // Already on our books? Then this is a colleague asking to join, not a
  // second page for the same company — which is what keeps this from becoming
  // a list of near-duplicates within a year.
  //
  // Two ways in. The domain is the strong one: an address at a domain we hold
  // is evidence. The name is the weak one, and catches the case the domain
  // cannot — somebody applying from a personal address for a company that is
  // already here. Both land in the same place, which is somebody's queue.
  if (domain) {
    const existing = await prisma.organisation.findUnique({
      where: { emailDomain: domain },
      select: { id: true, name: true },
    })
    if (existing) return askToJoin(existing)
  }

  const sameName = await findOrgByName(name)
  if (sameName) return askToJoin(sameName)

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

  return { success: true, id: org.id, outcome: 'applied' }
}

/**
 * Is this company already here?
 *
 * Asked as somebody types the name, so the form can say so before they write
 * a paragraph about a company that already has a page. Deliberately thin: a
 * name, whether it is public, and nothing else. It answers for any signed-in
 * person, so it must not become a way to read the pending queue — an
 * unapproved page returns `found` and nothing more.
 */
export async function lookupPartnerNameAction(name: string): Promise<{
  found: boolean
  name?: string
  /** Only where there is a live page to link to. */
  slug?: string
}> {
  const session = await getSession()
  if (!session || !name?.trim()) return { found: false }

  const org = await findOrgByName(name)
  if (!org) return { found: false }

  const live = org.status === OrgStatus.ACTIVE && org.isPublished
  return { found: true, name: live ? org.name : undefined, slug: live ? org.slug : undefined }
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

  // The same check the application form makes, for the same reason: two pages
  // for one company split its history across both, and nothing here would
  // ever tell us that had happened.
  const already = await findOrgByName(name)
  if (already) {
    return {
      success: false,
      id: already.id,
      error: `${already.name} is already here — open that one rather than adding a second.`,
    }
  }

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

// ─── Logos ────────────────────────────────────────────────────────────────────

/**
 * Upload a company logo.
 *
 * Its own narrow door rather than reusing uploadImageAction, which is
 * admin-only because it also handles story artwork — relaxing that guard to
 * cover logos would have opened story uploads to anyone who could apply for a
 * partner page.
 *
 * Two callers, two rules. Someone applying may upload before an organisation
 * exists, so there is nothing to check them against beyond being signed in and
 * verified; the file is only ever attached to the application they are in the
 * middle of making. Once an organisation exists, only its admins — or we —
 * may replace its logo.
 */
export async function uploadOrgLogoAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in first.' }

  const organisationId = formData.get('organisationId')
  if (typeof organisationId === 'string' && organisationId) {
    const mine = await canAdminOrg(organisationId)
    const ours = await hasCapability('care.giving')
    if (!mine && !ours) return { success: false, error: 'Not allowed.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Choose a file first.' }
  }
  if (!LOGO_TYPES.includes(file.type)) {
    return { success: false, error: 'That needs to be a PNG, JPEG, WebP or SVG.' }
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { success: false, error: 'That file is over 2MB — please pick a smaller one.' }
  }

  try {
    const blob = await put(`partner-logos/${organisationId || session.userId}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    })

    if (typeof organisationId === 'string' && organisationId) {
      await prisma.organisation.update({
        where: { id: organisationId },
        data: { logoUrl: blob.url },
      })
      refresh(organisationId)
    }

    return { success: true, id: blob.url }
  } catch (err) {
    console.error('uploadOrgLogoAction failed', err)
    return { success: false, error: 'Could not upload that. Please try again.' }
  }
}

// ─── Fundraisers a partner is running ─────────────────────────────────────────

/**
 * A partner's fundraisers are ordinary fundraisers with a company attached.
 *
 * Deliberately not a second kind of fundraiser. One donation path, one public
 * page, one place the money lands — the organisation link only decides whose
 * partner page it also appears on. Anything else would mean a second set of
 * receipting and reconciliation rules for the same gift.
 *
 * Which fund it pays into stays ours to set, and so does whether it goes live.
 * A company can write the appeal; they cannot point it at an account.
 */

/** Where a proposed fundraiser's gifts land until somebody here says otherwise. */
const DEFAULT_FUND_SETTING = 'partners.fundraiser_fund_id'

async function defaultFundId(): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: DEFAULT_FUND_SETTING },
    select: { value: true },
  })
  if (setting?.value) {
    const chosen = await prisma.fund.findUnique({
      where: { id: setting.value },
      select: { id: true },
    })
    if (chosen) return chosen.id
  }
  const fallback = await prisma.fund.findFirst({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  return fallback?.id ?? null
}

/** A fundraiser slug nothing else is using. */
async function uniqueFundraiserSlug(title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .trim()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'fundraiser'
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`
    const clash = await prisma.fundraiser.findUnique({ where: { slug }, select: { id: true } })
    if (!clash) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

/**
 * A partner admin proposes a fundraiser.
 *
 * Created switched off. Nothing about it is public — not the page, not the
 * link on their profile — until somebody here reads it, sets the fund and
 * turns it on in /admin/fundraisers. A live public appeal in our name,
 * created by someone outside the organisation without review, is not a thing
 * we should be able to build by accident.
 */
export async function proposeFundraiserAction(input: {
  organisationId: string
  title: string
  story: string
  goalAmount?: number | null
}): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in first.' }
  if (!(await canAdminOrg(input.organisationId))) {
    return { success: false, error: 'Only a company admin can do that.' }
  }

  const org = await prisma.organisation.findUnique({
    where: { id: input.organisationId },
    select: { id: true, name: true, status: true },
  })
  if (!org || org.status !== OrgStatus.ACTIVE) {
    return { success: false, error: 'This company page has not been approved yet.' }
  }

  const title = input.title.trim()
  const story = input.story.trim()
  if (title.length < 3) return { success: false, error: 'Please give it a title.' }
  if (story.length < 40) {
    return { success: false, error: 'Please tell us a bit more about what it is for.' }
  }
  if (story.length > 8000) return { success: false, error: 'That is a little long — could you trim it?' }

  const goal =
    input.goalAmount && Number.isFinite(input.goalAmount) && input.goalAmount > 0
      ? Math.min(Math.round(input.goalAmount), 10_000_000)
      : null

  const fundId = await defaultFundId()
  if (!fundId) {
    // Nothing the person on the form can do about this one, so it says so
    // plainly rather than pretending the request failed on their account.
    console.error('[partners] no fund available for a proposed fundraiser')
    return { success: false, error: 'We cannot accept this just now — please contact us directly.' }
  }

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  })

  const fr = await prisma.fundraiser.create({
    data: {
      title,
      slug: await uniqueFundraiserSlug(title),
      story,
      goalAmount: goal,
      organiserName: org.name,
      organiserEmail: me?.email ?? null,
      fundId,
      organisationId: org.id,
      isActive: false,
    },
    select: { id: true },
  })

  await notifyReviewers({
    title: `${org.name} proposed a fundraiser`,
    body: `${title}${goal ? ` · goal $${goal.toLocaleString('en-AU')}` : ''} · from ${me?.name ?? me?.email ?? 'their admin'}`,
    href: `/admin/fundraisers/${fr.id}/edit`,
    createdById: me?.id,
  })

  revalidatePath('/admin/fundraisers')
  refresh(org.id)
  return { success: true, id: fr.id }
}

/**
 * Attach an existing fundraiser to a partner, or detach it.
 *
 * Ours, not theirs — the link decides which company's name sits above a public
 * appeal, and that is a claim about who ran it.
 */
export async function setFundraiserOrganisationAction(
  fundraiserId: string,
  organisationId: string | null,
): Promise<Result> {
  const admin = await guard()
  if (!admin) return { success: false, error: 'Not allowed.' }

  const fr = await prisma.fundraiser.findUnique({
    where: { id: fundraiserId },
    select: { id: true, organisationId: true },
  })
  if (!fr) return { success: false, error: 'That fundraiser no longer exists.' }

  await prisma.fundraiser.update({ where: { id: fundraiserId }, data: { organisationId } })

  // Both pages: the one it is joining and, on a move, the one it is leaving.
  if (organisationId) refresh(organisationId)
  if (fr.organisationId && fr.organisationId !== organisationId) refresh(fr.organisationId)
  revalidatePath('/admin/fundraisers')
  return { success: true, id: fundraiserId }
}
