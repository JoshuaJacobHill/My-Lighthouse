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
  createAd,
  createAdCreative,
  createBoostCreative,
  setAdStatus,
  getAdPreview,
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
  revalidatePath('/admin/marketing/library')
  revalidatePath('/dashboard/business')
}

// ─── Running one proposal ─────────────────────────────────────────────────────

type PostPayload = { platforms: string[]; caption: string; imageUrl: string | null }
type BudgetPayload = { adSetId: string; adSetName: string; dailyBudgetCents: number }
type StatusPayload = { adSetId: string; adSetName: string; status: 'PAUSED' | 'ACTIVE' }
type CreatePayload = {
  adSetId: string
  adSetName: string
  name: string
  message: string
  imageUrl: string
  linkUrl?: string
  headline?: string
  callToAction?: string
}
type BoostPayload = { adSetId: string; adSetName: string; postId: string; name: string }

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

  if (kind === MarketingActionKind.AD_STATUS) {
    const p = payload as StatusPayload
    return { status: await setAdSetStatus(p.adSetId, p.status) }
  }

  if (kind === MarketingActionKind.AD_CREATE) {
    const p = payload as CreatePayload
    // Creative first, then the ad that points at it. Both are cheap and
    // neither spends anything — the ad is created paused, and going live is a
    // separate press after somebody has looked at the preview.
    const creative = await createAdCreative({
      name: p.name,
      message: p.message,
      imageUrl: p.imageUrl,
      linkUrl: p.linkUrl,
      headline: p.headline,
      callToAction: p.callToAction,
    })
    const ad = await createAd({ name: p.name, adSetId: p.adSetId, creativeId: creative.id })
    return { creativeId: creative.id, adId: ad.id, live: false }
  }

  if (kind === MarketingActionKind.AD_BOOST) {
    const p = payload as BoostPayload
    const creative = await createBoostCreative({ name: p.name, postId: p.postId })
    const ad = await createAd({ name: p.name, adSetId: p.adSetId, creativeId: creative.id })
    return { creativeId: creative.id, adId: ad.id, live: false }
  }

  // AD_ACTIVATE — the second half of a create, once the preview has been seen.
  const p = payload as { adId: string; adName: string }
  await setAdStatus(p.adId, 'ACTIVE')
  return { adId: p.adId, live: true }
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

// ─── Seeing it, and turning it on ─────────────────────────────────────────────

/**
 * Meta's own rendering of an ad it has created.
 *
 * Fetched on demand rather than stored, because a preview is a picture of the
 * ad as it is now — a stored copy would go stale the moment anything changed
 * and would then be the most misleading thing on the page.
 *
 * The returned HTML is a Meta iframe. Checked for that shape before it reaches
 * the DOM: this is markup from a third party going into our page, and the only
 * form it should ever take is one embedded frame.
 */
export async function getAdPreviewAction(
  adId: string,
): Promise<{ success: boolean; html?: string; error?: string }> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }
  if (!/^\d+$/.test(adId)) return { success: false, error: 'That is not an ad id.' }

  try {
    const html = await getAdPreview(adId)
    if (!html) return { success: false, error: 'Meta returned no preview for that ad.' }
    if (!html.trim().startsWith('<iframe')) {
      // Never seen in practice, but rendering whatever came back would be a
      // hole in the page, and refusing is free.
      return { success: false, error: 'The preview came back in an unexpected form.' }
    }
    return { success: true, html }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Turn on an ad this queue created.
 *
 * Deliberately only reachable from a proposal that produced an ad, so the
 * thing being switched on is one somebody drafted, approved and previewed
 * here — not an arbitrary id typed into a form.
 */
export async function activateAdAction(proposalId: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const row = await prisma.marketingProposal.findUnique({
    where: { id: proposalId },
    select: { id: true, status: true, result: true, summary: true },
  })
  if (!row) return { success: false, error: 'That proposal no longer exists.' }
  if (row.status !== MarketingActionStatus.EXECUTED) {
    return { success: false, error: 'That ad has not been created yet.' }
  }

  const result = (row.result ?? {}) as { adId?: string; live?: boolean }
  if (!result.adId) return { success: false, error: 'There is no ad attached to that one.' }
  if (result.live) return { success: false, error: 'That ad is already live.' }

  try {
    await setAdStatus(result.adId, 'ACTIVE')
    await prisma.marketingProposal.update({
      where: { id: proposalId },
      data: { result: { ...result, live: true, liveAt: new Date().toISOString() } },
    })
    refresh()
    return { success: true, id: result.adId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Pause an ad this queue created, without leaving the page. */
export async function pauseAdAction(proposalId: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }

  const row = await prisma.marketingProposal.findUnique({
    where: { id: proposalId },
    select: { result: true },
  })
  const result = (row?.result ?? {}) as { adId?: string; live?: boolean }
  if (!result.adId) return { success: false, error: 'There is no ad attached to that one.' }

  try {
    await setAdStatus(result.adId, 'PAUSED')
    await prisma.marketingProposal.update({
      where: { id: proposalId },
      data: { result: { ...result, live: false } },
    })
    refresh()
    return { success: true, id: result.adId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Conversations ────────────────────────────────────────────────────────────

/**
 * Keep the conversation.
 *
 * Called at the end of each exchange with the whole thread, which is simpler
 * than appending and cannot get out of order. Saving is best-effort: a failure
 * here must never cost somebody the answer they just read, so it is caught and
 * logged rather than thrown.
 */
export async function saveChatAction(input: {
  chatId?: string | null
  messages: { role: 'user' | 'assistant'; content: string }[]
}): Promise<{ success: boolean; chatId?: string }> {
  const me = await guard()
  if (!me) return { success: false }

  const messages = input.messages
    .filter((m) => m.content?.trim())
    .slice(-40)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 20_000) }))
  if (messages.length === 0) return { success: false }

  const first = messages.find((m) => m.role === 'user')?.content ?? 'Conversation'
  const title = first.replace(/\s+/g, ' ').slice(0, 80)

  try {
    if (input.chatId) {
      const owned = await prisma.marketingChat.findFirst({
        where: { id: input.chatId, userId: me.userId },
        select: { id: true },
      })
      if (owned) {
        await prisma.marketingChat.update({
          where: { id: owned.id },
          data: { messages, updatedAt: new Date() },
        })
        return { success: true, chatId: owned.id }
      }
    }
    const row = await prisma.marketingChat.create({
      data: { userId: me.userId, title, messages },
      select: { id: true },
    })
    return { success: true, chatId: row.id }
  } catch (e) {
    console.error('[marketing] could not save the conversation', e)
    return { success: false }
  }
}

/**
 * Past conversations.
 *
 * Yours, not everyone's. Somebody else's half-finished thinking about the ad
 * budget is not something a colleague needs in a list — the proposals that
 * came out of it are already shared, and those are the part that matters.
 */
export async function listChatsAction(): Promise<
  { id: string; title: string; updatedAt: string; turns: number }[]
> {
  const me = await guard()
  if (!me) return []
  const rows = await prisma.marketingChat.findMany({
    where: { userId: me.userId },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: { id: true, title: true, updatedAt: true, messages: true },
  })
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
    turns: Array.isArray(r.messages) ? r.messages.length : 0,
  }))
}

export async function loadChatAction(
  chatId: string,
): Promise<{ id: string; messages: { role: 'user' | 'assistant'; content: string }[] } | null> {
  const me = await guard()
  if (!me) return null
  const row = await prisma.marketingChat.findFirst({
    where: { id: chatId, userId: me.userId },
    select: { id: true, messages: true },
  })
  if (!row) return null
  const messages = Array.isArray(row.messages)
    ? (row.messages as { role: 'user' | 'assistant'; content: string }[])
    : []
  return { id: row.id, messages }
}

export async function deleteChatAction(chatId: string): Promise<Result> {
  const me = await guard()
  if (!me) return { success: false, error: 'Not allowed.' }
  await prisma.marketingChat.deleteMany({ where: { id: chatId, userId: me.userId } })
  return { success: true }
}
