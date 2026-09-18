import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/lib/prisma'
import { READ_TOOLS } from '@/lib/marketing-tools'
import { getAdSet, MAX_DAILY_BUDGET_CENTS } from '@/lib/integrations/meta-write'
import { MarketingActionKind } from '@prisma/client'
import { isPublishableMedia } from '@/lib/media-library'

/**
 * The marketing assistant.
 *
 * Claude reads our own sales and marketing figures and says what it makes of
 * them. When it wants to act — post something, move a budget, pause an ad —
 * it cannot. It writes a proposal, and a person approves it. Every tool that
 * looks like an action in this file ends at a DRAFT row in the database.
 *
 * `meta-write.ts` is deliberately not imported here for anything but reading
 * an ad set's current values. Nothing in the chat path can publish or spend.
 *
 * Two prompt rules do most of the work, and both exist because of specific
 * ways this goes wrong:
 *
 *   Never state a figure that a tool did not return. Carried over from
 *   `digest-narrative.ts` — a confidently wrong number in a report is worse
 *   than no report, because it gets repeated in a meeting.
 *
 *   Never describe an image. The asset tool returns filenames, not pictures.
 *   Without this it will happily tell you what is in `hamper-pack-3.jpg`.
 */

const MODEL = 'claude-opus-5'

const SYSTEM = `You are the marketing assistant inside My Lighthouse, the staff portal for Lighthouse Care — a Queensland charity that runs two discount grocery stores (Loganholme and Hillcrest), an online store, and food relief programs. Profit from the stores funds the relief work, so ad spend and store takings are the same conversation.

You are talking to staff who know the business. Be direct and useful.

ABSOLUTE RULES — these override everything else:
- Never state a number, percentage, date or name that a tool did not return to you. Never estimate, extrapolate, or round a returned figure into a new one. If you need a figure you do not have, call a tool or say you do not have it.
- Before concluding that something performed badly, call feed_health. A number that was never fetched looks identical to a bad week, and that mistake has already cost this team five days of ad data once.
- You cannot see images. The asset tool gives you filenames and URLs only. Never describe what is in an image, and say plainly that you are going by the filename.
- You cannot post anything or change any spend. Your propose_* tools write a draft that a person reads and approves. Never tell anyone something has been posted, paused or changed — say it is waiting for approval.
- Paid and organic view counts overlap, because a boosted post is counted by both. When you use total views, say the change is meaningful and the absolute number is not a headcount.
- An ad's image and words cannot be changed once the ad exists — Meta creatives are immutable. When an offer ends or changes, the answer is a NEW ad plus pausing the old one, never "update the existing ad". Never offer to change an ad's picture.

HOW TO WORK:
- Lead with the answer, then the evidence. Staff are reading this between other jobs.
- Prefer a comparison to a bare number. "$63k, up 9% on the same days last week" beats "$63k".
- When you propose something, say what you expect it to do and what would tell us it worked.
- One proposal at a time unless asked for more. A queue of eleven drafts gets approved without being read, which defeats the point of it.

VOICE: Australian English. Warm, plain, practical — a colleague, not a consultant. Short sentences. Never corporate, never self-congratulatory. Never pity language ("the needy", "the less fortunate"); people are "families doing it tough" or "community members in crisis". Copy you write for posts follows the same rules — lead with a person or a moment, use figures to support a story rather than replace it.`

// ─── Tools that propose ───────────────────────────────────────────────────────

/**
 * Only an image from our own library may be published.
 *
 * Exported for its test. This is the check between "the assistant picked
 * something from the library" and "the assistant published a URL it was
 * handed", and a regression is invisible until something wrong is public.
 *
 * The rule itself lives in `media-library.ts`, with the list of what is in the
 * library and what is deliberately not — volunteers' own avatars, in
 * particular, which are not stock for an advertisement.
 */
export function assertOurAsset(url: string): void {
  if (!/^https?:\/\//.test(url)) {
    throw new Error('That is not a URL. Use one exactly as list_assets gave it to you.')
  }
  if (!isPublishableMedia(url)) {
    throw new Error(
      'Images must come from the media library. Call list_assets and use one of those URLs exactly.',
    )
  }
}

const PLATFORMS = ['FACEBOOK', 'INSTAGRAM'] as const
type PostPlatform = (typeof PLATFORMS)[number]

async function proposePost(
  input: { platforms?: unknown; caption?: unknown; imageUrl?: unknown; rationale?: unknown },
  userId: string,
): Promise<string> {
  const caption = typeof input.caption === 'string' ? input.caption.trim() : ''
  if (caption.length < 10) throw new Error('A post needs a caption of at least a sentence.')
  if (caption.length > 2200) throw new Error('That caption is longer than Instagram allows (2,200).')

  const platforms = Array.isArray(input.platforms)
    ? (input.platforms.filter((p) => PLATFORMS.includes(p as PostPlatform)) as PostPlatform[])
    : []
  if (platforms.length === 0) throw new Error('Say which platforms: FACEBOOK, INSTAGRAM, or both.')

  const imageUrl = typeof input.imageUrl === 'string' && input.imageUrl ? input.imageUrl : null
  if (imageUrl) assertOurAsset(imageUrl)
  if (platforms.includes('INSTAGRAM') && !imageUrl) {
    throw new Error('Instagram will not take a post without an image. Pick one with list_assets.')
  }

  const row = await prisma.marketingProposal.create({
    data: {
      kind: MarketingActionKind.ORGANIC_POST,
      summary: `Post to ${platforms.join(' and ')}: ${caption.replace(/\s+/g, ' ').slice(0, 70)}${caption.length > 70 ? '…' : ''}`,
      rationale: typeof input.rationale === 'string' ? input.rationale : null,
      payload: { platforms, caption, imageUrl },
      proposedByUserId: userId,
    },
    select: { id: true },
  })

  return `Drafted. It is in the approval queue as ${row.id} and nothing is public. Tell the person you are talking to that someone needs to approve it at /admin/marketing before it goes anywhere.`
}

async function proposeAdBudget(
  input: { adSetId?: unknown; dailyBudgetDollars?: unknown; rationale?: unknown },
  userId: string,
): Promise<string> {
  const adSetId = String(input.adSetId ?? '').trim()
  if (!adSetId) throw new Error('Which ad set? Call list_ad_sets and use the id exactly.')

  const dollars = Number(input.dailyBudgetDollars)
  if (!Number.isFinite(dollars) || dollars < 1) throw new Error('A daily budget of at least $1.')
  const cents = Math.round(dollars * 100)
  if (cents > MAX_DAILY_BUDGET_CENTS) {
    throw new Error(
      `$${dollars}/day is above the $${MAX_DAILY_BUDGET_CENTS / 100}/day ceiling this tool can propose. Suggest it in words instead and let someone do it in Ads Manager.`,
    )
  }

  // Read the live value, so the queue shows a real before rather than a claim.
  const current = await getAdSet(adSetId)

  const row = await prisma.marketingProposal.create({
    data: {
      kind: MarketingActionKind.AD_BUDGET,
      summary: `"${current.name}" daily budget → $${dollars.toFixed(2)}${
        current.dailyBudgetCents !== null
          ? ` (now $${(current.dailyBudgetCents / 100).toFixed(2)})`
          : ''
      }`,
      rationale: typeof input.rationale === 'string' ? input.rationale : null,
      payload: { adSetId, adSetName: current.name, dailyBudgetCents: cents },
      before: {
        dailyBudgetCents: current.dailyBudgetCents,
        status: current.status,
        adSetName: current.name,
      },
      proposedByUserId: userId,
    },
    select: { id: true },
  })

  return `Drafted as ${row.id}. Nothing has changed — "${current.name}" is still at ${
    current.dailyBudgetCents === null
      ? 'its campaign-level budget'
      : `$${(current.dailyBudgetCents / 100).toFixed(2)}/day`
  } until someone approves it at /admin/marketing.`
}

async function proposeAdStatus(
  input: { adSetId?: unknown; status?: unknown; rationale?: unknown },
  userId: string,
): Promise<string> {
  const adSetId = String(input.adSetId ?? '').trim()
  if (!adSetId) throw new Error('Which ad set? Call list_ad_sets and use the id exactly.')
  const status = input.status === 'ACTIVE' ? 'ACTIVE' : input.status === 'PAUSED' ? 'PAUSED' : null
  if (!status) throw new Error('status must be PAUSED or ACTIVE.')

  const current = await getAdSet(adSetId)
  if (current.status === status) {
    return `"${current.name}" is already ${status}. Nothing to propose.`
  }

  const row = await prisma.marketingProposal.create({
    data: {
      kind: MarketingActionKind.AD_STATUS,
      summary: `${status === 'PAUSED' ? 'Pause' : 'Resume'} "${current.name}"`,
      rationale: typeof input.rationale === 'string' ? input.rationale : null,
      payload: { adSetId, adSetName: current.name, status },
      before: { status: current.status, adSetName: current.name },
      proposedByUserId: userId,
    },
    select: { id: true },
  })

  return `Drafted as ${row.id}. "${current.name}" is still ${current.status} until someone approves it at /admin/marketing.`
}

/**
 * A new ad inside an existing ad set.
 *
 * Existing ad set on purpose. That is where the audience, the placements, the
 * schedule and the budget live, and all four are decisions with more behind
 * them than a chat message — inheriting them means a new ad is a creative
 * decision rather than a media-buying one.
 */
async function proposeNewAd(
  input: {
    adSetId?: unknown
    name?: unknown
    message?: unknown
    imageUrl?: unknown
    headline?: unknown
    linkUrl?: unknown
    rationale?: unknown
  },
  userId: string,
): Promise<string> {
  const adSetId = String(input.adSetId ?? '').trim()
  if (!adSetId) throw new Error('Which ad set? Call list_ad_sets and use the id exactly.')

  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (message.length < 10) throw new Error('The ad needs words — at least a sentence.')
  if (message.length > 2000) throw new Error('That is too long for an ad body.')

  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl : ''
  if (!imageUrl) throw new Error('An ad needs an image. Call list_assets and pick one.')
  assertOurAsset(imageUrl)

  const name = (typeof input.name === 'string' && input.name.trim()) || message.slice(0, 40)
  const current = await getAdSet(adSetId)

  const row = await prisma.marketingProposal.create({
    data: {
      kind: MarketingActionKind.AD_CREATE,
      summary: `New ad in "${current.name}": ${name.replace(/\s+/g, ' ').slice(0, 60)}`,
      rationale: typeof input.rationale === 'string' ? input.rationale : null,
      payload: {
        adSetId,
        adSetName: current.name,
        name,
        message,
        imageUrl,
        ...(typeof input.headline === 'string' && input.headline ? { headline: input.headline } : {}),
        ...(typeof input.linkUrl === 'string' && input.linkUrl ? { linkUrl: input.linkUrl } : {}),
      },
      before: { adSetName: current.name, status: current.status },
      proposedByUserId: userId,
    },
    select: { id: true },
  })

  return `Drafted as ${row.id}. Approving it builds the ad PAUSED — Meta's own preview then appears on the card, and turning it on is a second, separate press. Nothing spends until then. Say so rather than implying the ad is running.`
}

/** Money behind a post that is already working. */
async function proposeBoost(
  input: { adSetId?: unknown; postId?: unknown; name?: unknown; rationale?: unknown },
  userId: string,
): Promise<string> {
  const adSetId = String(input.adSetId ?? '').trim()
  const postId = String(input.postId ?? '').trim()
  if (!adSetId) throw new Error('Which ad set? Call list_ad_sets and use the id exactly.')
  if (!postId) throw new Error('Which post? top_posts gives each one as [post <id>].')

  const current = await getAdSet(adSetId)
  const name =
    (typeof input.name === 'string' && input.name.trim()) || `Boost ${postId.slice(-8)}`

  const row = await prisma.marketingProposal.create({
    data: {
      kind: MarketingActionKind.AD_BOOST,
      summary: `Boost post ${postId} through "${current.name}"`,
      rationale: typeof input.rationale === 'string' ? input.rationale : null,
      payload: { adSetId, adSetName: current.name, postId, name },
      before: { adSetName: current.name, status: current.status },
      proposedByUserId: userId,
    },
    select: { id: true },
  })

  return `Drafted as ${row.id}. Boosting keeps the post's existing likes and comments, which a fresh creative would start without. Built PAUSED; someone previews it and turns it on.`
}

const PROPOSE_TOOLS = [
  {
    name: 'propose_post',
    description:
      'Draft a post for approval. It is NOT published — it goes into a queue for a person to read. Instagram requires an image; Facebook does not. Use an imageUrl exactly as list_assets returned it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        platforms: {
          type: 'array',
          items: { type: 'string', enum: PLATFORMS },
          description: 'FACEBOOK, INSTAGRAM, or both.',
        },
        caption: { type: 'string', description: 'The post text, in Lighthouse voice.' },
        imageUrl: { type: 'string', description: 'A URL from list_assets. Required for Instagram.' },
        rationale: {
          type: 'string',
          description: 'Why this post, now. Shown to whoever approves it.',
        },
      },
      required: ['platforms', 'caption'],
    },
  },
  {
    name: 'propose_ad_budget',
    description: `Draft a daily budget change for approval. NOT applied. Ceiling $${MAX_DAILY_BUDGET_CENTS / 100}/day. Call list_ad_sets first for the id.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        adSetId: { type: 'string' },
        dailyBudgetDollars: { type: 'number', description: 'In dollars, e.g. 45.50' },
        rationale: { type: 'string', description: 'What you expect it to do, and how we would know.' },
      },
      required: ['adSetId', 'dailyBudgetDollars'],
    },
  },
  {
    name: 'propose_new_ad',
    description:
      'Draft a NEW ad inside an existing ad set, with an image from the asset folder. NOT created and NOT live — approving builds it paused, and a person previews it and turns it on separately. Use this when an offer changes: a Meta creative cannot be edited once it exists, so a new offer means a new ad, and the old one gets paused.',
    input_schema: {
      type: 'object' as const,
      properties: {
        adSetId: { type: 'string', description: 'From list_ad_sets. Its audience and budget are inherited.' },
        name: { type: 'string', description: 'A short internal name, so it is findable later.' },
        message: { type: 'string', description: 'The ad body, in Lighthouse voice.' },
        imageUrl: { type: 'string', description: 'A URL from list_assets, exactly as given.' },
        headline: { type: 'string', description: 'Optional short headline under the image.' },
        linkUrl: { type: 'string', description: 'Where the button goes. Defaults to the online store.' },
        rationale: { type: 'string', description: 'Why this ad, now, and how we would know it worked.' },
      },
      required: ['adSetId', 'message', 'imageUrl'],
    },
  },
  {
    name: 'propose_boost',
    description:
      'Draft putting ad money behind a post that already exists, keeping its likes and comments. Use top_posts to find one worth boosting — the id is shown as [post <id>]. NOT live; built paused for a person to preview and turn on.',
    input_schema: {
      type: 'object' as const,
      properties: {
        adSetId: { type: 'string' },
        postId: { type: 'string', description: 'The [post <id>] from top_posts.' },
        name: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['adSetId', 'postId'],
    },
  },
  {
    name: 'propose_ad_status',
    description:
      'Draft a pause or resume for approval. NOT applied. Call list_ad_sets first for the id.',
    input_schema: {
      type: 'object' as const,
      properties: {
        adSetId: { type: 'string' },
        status: { type: 'string', enum: ['PAUSED', 'ACTIVE'] },
        rationale: { type: 'string' },
      },
      required: ['adSetId', 'status'],
    },
  },
]

export const ALL_TOOLS: Anthropic.Tool[] = [
  ...READ_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool['input_schema'],
  })),
  ...PROPOSE_TOOLS,
]

async function runTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
): Promise<string> {
  const read = READ_TOOLS.find((t) => t.name === name)
  if (read) return read.run(input)
  if (name === 'propose_post') return proposePost(input, userId)
  if (name === 'propose_ad_budget') return proposeAdBudget(input, userId)
  if (name === 'propose_ad_status') return proposeAdStatus(input, userId)
  if (name === 'propose_new_ad') return proposeNewAd(input, userId)
  if (name === 'propose_boost') return proposeBoost(input, userId)
  throw new Error(`No tool called ${name}.`)
}

// ─── The loop ─────────────────────────────────────────────────────────────────

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

/**
 * One exchange, streamed.
 *
 * A manual loop rather than the SDK's tool runner, because the text has to
 * reach the browser as it is written — a question that needs four tool calls
 * takes long enough that a silent wait reads as a broken page. Yields typed
 * events the route turns into SSE.
 *
 * `maxTurns` is a guard, not a limit anyone should hit: without it a model
 * that keeps calling tools would run until the platform kills the request, and
 * on this plan that is sixty seconds with nothing to show.
 */
export async function* streamMarketingChat(
  history: ChatTurn[],
  userId: string,
  maxTurns = 8,
): AsyncGenerator<
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'error'; message: string }
  | { type: 'done' }
> {
  if (!process.env.ANTHROPIC_API_KEY) {
    yield { type: 'error', message: 'The assistant is not configured — no ANTHROPIC_API_KEY set.' }
    return
  }

  const client = new Anthropic()
  const messages: Anthropic.MessageParam[] = history.map((h) => ({
    role: h.role,
    content: h.content,
  }))

  for (let turn = 0; turn < maxTurns; turn++) {
    let assistant: Anthropic.Message
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 8000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: ALL_TOOLS,
        messages,
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta' &&
          event.delta.text
        ) {
          yield { type: 'text', text: event.delta.text }
        }
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          yield { type: 'tool', name: event.content_block.name }
        }
      }
      assistant = await stream.finalMessage()
    } catch (e) {
      const err = e as Error
      console.error('[marketing-assistant]', err)
      yield {
        type: 'error',
        message:
          e instanceof Anthropic.RateLimitError
            ? 'Too many requests at once — give it a moment and ask again.'
            : `The assistant could not answer: ${err.message}`,
      }
      return
    }

    messages.push({ role: 'assistant', content: assistant.content })

    const calls = assistant.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (calls.length === 0) {
      yield { type: 'done' }
      return
    }

    // Every result goes back in one user message. Splitting them teaches the
    // model to stop making parallel calls.
    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      calls.map(async (call) => {
        try {
          const out = await runTool(call.name, (call.input ?? {}) as Record<string, unknown>, userId)
          return { type: 'tool_result' as const, tool_use_id: call.id, content: out }
        } catch (e) {
          // Handed back as an error result rather than thrown: the model can
          // often recover by calling something else, and a thrown error ends
          // the conversation for a mistake it could have fixed.
          return {
            type: 'tool_result' as const,
            tool_use_id: call.id,
            content: (e as Error).message,
            is_error: true,
          }
        }
      }),
    )
    messages.push({ role: 'user', content: results })
  }

  yield {
    type: 'error',
    message: 'That took more steps than expected and I stopped. Try asking something narrower.',
  }
}
