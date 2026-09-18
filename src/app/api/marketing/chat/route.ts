import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { streamMarketingChat, type ChatTurn } from '@/lib/marketing-assistant'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/marketing/chat
 *
 * Streams the assistant's reply as server-sent events. Streaming rather than
 * one JSON response for two reasons: a question needing several tool calls
 * takes long enough that a silent page reads as broken, and this platform
 * kills a request at sixty seconds — so text the user has already read is text
 * that survives being cut off.
 *
 * Gated on `business.reports`, the same capability as the page itself. The
 * assistant can see everything that page can see, so anything looser here
 * would be a way around that gate.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || !(await hasCapability('business.reports'))) {
    return new Response('Unauthorised', { status: 401 })
  }

  let body: { messages?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response('Expected JSON', { status: 400 })
  }

  // The client holds the conversation, so it is validated rather than trusted:
  // shape, roles, length, and a cap on how much history one request can carry.
  const raw = Array.isArray(body.messages) ? body.messages : []
  const history: ChatTurn[] = raw
    .filter(
      (m): m is ChatTurn =>
        !!m &&
        typeof m === 'object' &&
        ((m as ChatTurn).role === 'user' || (m as ChatTurn).role === 'assistant') &&
        typeof (m as ChatTurn).content === 'string' &&
        (m as ChatTurn).content.trim().length > 0,
    )
    .slice(-24)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return new Response('The last message must be from the user', { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      try {
        for await (const event of streamMarketingChat(history, session.userId)) {
          send(event)
        }
      } catch (e) {
        console.error('[marketing/chat]', e)
        send({ type: 'error', message: 'Something went wrong part way through.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Vercel's proxy buffers by default, which holds the whole reply until
      // the end and defeats the point of streaming it.
      'X-Accel-Buffering': 'no',
    },
  })
}
