'use server'

import { put, list, del } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import {
  publishFacebookPost,
  publishInstagramPost,
  setAdSetBudget,
  setAdSetStatus,
} from '@/lib/integrations/meta-write'
import { MarketingActionKind, MarketingActionStatus } from '@prisma/client'

/**
 * Approving and running what the assistant proposed.
 *
 * This is the only path in the application that publishes to social media or
 * changes ad spend, and it cannot be reached without a person pressing a
 * button on a proposal they can see in full.
 *
 * Three properties worth keeping if this file is ever edited:
 *
 *   Approval and execution are one action, not two. A proposal that is
 *   "approved but not yet run" is a state nobody monitors, and an approval
 *   that silently did nothing is worse than a failure.
 *
 *   The row is marked EXECUTED only after the platform confirms. A crash
 *   mid-flight leaves it APPROVED with an error, which reads as "check this",
 *   rather than EXECUTED with nothing behind it.
 *
 *   A failure can be retried. Meta refuses for recoverable reasons — a missing
 *   scope, a rate limit — and re-approving after granting the scope should
 *   work rather than requiring a fresh proposal.
 */

type Result = { success: boolean; error?: string; id?: string }

/** Approving a public post is a `care.giving` decision, like the reports. */
async function guard(): Promise<{ userId: string } | null> {
  const session = await getSession()
  if (!session) return null
  if (!(await hasCapability('business.reports'))) return null
  return { userId: session.userId }
}

function refresh() {
  revalidatePath('/admin/marketing')
  revalidatePath('/businesses')
}

// ─── Running one proposal ─────────────────────────────────────────────────────

type PostPayload = { platforms: string[]; caption: string; imageUrl: string | null }
type BudgetPayload = { adSetId: string; adSetName: string; dailyBudgetCents: number }
type StatusPayload = { adSetId: string; adSetName: string; status: 'PAUSED' | 'ACTIVE' }

async function execute(
  kind: MarketingActionKind,
  payload: unknown,
): Promise<Record<string, unknown>> {
  if (kind === MarketingActionKind.ORGANIC_POST) {
    const p = payload as PostPayload
    const out: Record<string, unknown> = {}
    // Sequential, and Instagram first. If the second platform fails we want the
    // record to show exactly which one went out — a Promise.all here would
    // leave both outcomes uncertain.
    if (p.platforms.includes('INSTAGRAM')) {
      out.instagram = await publishInstagramPost(p.caption, p.imageUrl ?? '')
    }
    if (p.platforms.includes('FACEBOOK')) {
      out.facebook = await publishFacebookPost(p.caption, p.imageUrl ?? undefined)
    }
    return out
  }

  if (kind === MarketingActionKind.AD_BUDGET) {
    const p = payload as BudgetPayload
    return { budget: await setAdSetBudget(p.adSetId, p.dailyBudgetCents) }
  }

  const p = payload as StatusPayload
  return { status: await setAdSetStatus(p.adSetId, p.status) }
}

/**
 * Approve a proposal and carry it out.
 *
 * The one place in the app that acts on the outside world on Claude's
 * suggestion, and it takes a person's click to get here.
 */
export async function approveProposalAction(id: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const row = await prisma.marketingProposal.findUnique({
    where: { id },
    select: { id: true, kind: true, status: true, payload: true },
  })
  if (!row) return { success: false, error: 'That proposal no longer exists.' }
  if (row.status === MarketingActionStatus.EXECUTED) {
    return { success: false, error: 'That one has already run.' }
  }
  if (row.status === MarketingActionStatus.DECLINED) {
    return { success: false, error: 'That one was declined. Ask for a fresh proposal.' }
  }

  // Claimed before the call, so two people pressing approve at the same moment
  // cannot both publish. The update is conditional on it still being unrun.
  const claimed = await prisma.marketingProposal.updateMany({
    where: { id, status: { in: [MarketingActionStatus.DRAFT, MarketingActionStatus.FAILED] } },
    data: {
      status: MarketingActionStatus.APPROVED,
      approvedByUserId: me.userId,
      approvedAt: new Date(),
      error: null,
    },
  })
  if (claimed.count === 0) {
    return { success: false, error: 'Someone else is already approving that one.' }
  }

  try {
    const result = await execute(row.kind, row.payload)
    await prisma.marketingProposal.update({
      where: { id },
      data: {
        status: MarketingActionStatus.EXECUTED,
        executedAt: new Date(),
        result: result as object,
      },
    })
    refresh()
    return { success: true, id }
  } catch (e) {
    const message = (e as Error).message
    // Meta's own words, kept verbatim — they name the missing scope, and a
    // softened message would send someone looking in the wrong place.
    await prisma.marketingProposal.update({
      where: { id },
      data: { status: MarketingActionStatus.FAILED, error: message.slice(0, 2000) },
    })
    refresh()
    return { success: false, error: message }
  }
}

/** Say no, and keep the record of having said it. */
export async function declineProposalAction(id: string, note?: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const done = await prisma.marketingProposal.updateMany({
    where: { id, status: { in: [MarketingActionStatus.DRAFT, MarketingActionStatus.FAILED] } },
    data: {
      status: MarketingActionStatus.DECLINED,
      approvedByUserId: me.userId,
      approvedAt: new Date(),
      error: note?.trim() || null,
    },
  })
  if (done.count === 0) return { success: false, error: 'That one cannot be declined now.' }
  refresh()
  return { success: true, id }
}

/**
 * Edit a draft before approving it.
 *
 * Deliberately only the caption. Changing which ad set or what budget would
 * make the proposal a different thing from the one Claude explained, and the
 * rationale beside it would then be describing something else. Reword the
 * copy, yes; redirect the money, no.
 */
export async function editDraftCaptionAction(id: string, caption: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const text = caption.trim()
  if (text.length < 10) return { success: false, error: 'A caption needs at least a sentence.' }
  if (text.length > 2200) return { success: false, error: 'Longer than Instagram allows (2,200).' }

  const row = await prisma.marketingProposal.findUnique({
    where: { id },
    select: { kind: true, status: true, payload: true },
  })
  if (!row) return { success: false, error: 'That proposal no longer exists.' }
  if (row.kind !== MarketingActionKind.ORGANIC_POST) {
    return { success: false, error: 'Only a post has a caption.' }
  }
  if (row.status !== MarketingActionStatus.DRAFT && row.status !== MarketingActionStatus.FAILED) {
    return { success: false, error: 'That one is past editing.' }
  }

  const payload = row.payload as unknown as PostPayload
  await prisma.marketingProposal.update({
    where: { id },
    data: { payload: { ...payload, caption: text } },
  })
  refresh()
  return { success: true, id }
}

// ─── The asset folder ─────────────────────────────────────────────────────────

const ASSET_MAX_BYTES = 8 * 1024 * 1024
const ASSET_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Add an image the assistant can offer for a post.
 *
 * Instagram fetches the image from a public URL itself rather than accepting an
 * upload, which is why these live in Blob storage and not in the database.
 */
export async function uploadMarketingAssetAction(formData: FormData): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { success: false, error: 'No file came through.' }
  if (!ASSET_TYPES.includes(file.type)) {
    return { success: false, error: 'PNG, JPEG or WebP only — Instagram will not take anything else.' }
  }
  if (file.size > ASSET_MAX_BYTES) {
    return { success: false, error: 'That is over 8MB. Please resize it first.' }
  }

  // The name is kept, because the name is all Claude gets to go on when it
  // suggests one. "hamper-pack-loganholme.jpg" is useful; a random id is not.
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80)
  const blob = await put(`marketing-assets/${safe}`, file, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.type,
  })
  refresh()
  return { success: true, id: blob.url }
}

export async function deleteMarketingAssetAction(url: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }
  if (!url.includes('/marketing-assets/')) {
    return { success: false, error: 'That is not an asset.' }
  }
  await del(url)
  refresh()
  return { success: true }
}

/** Assets for the picker and the queue thumbnails. */
export async function listMarketingAssetsAction(): Promise<
  { url: string; name: string; size: number }[]
> {
  const me = await guard()
  if (!me) return []
  const res = await list({ prefix: 'marketing-assets/', limit: 100 })
  return res.blobs.map((b) => ({
    url: b.url,
    name: b.pathname.replace('marketing-assets/', ''),
    size: b.size,
  }))
}
