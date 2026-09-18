'use client'

import * as React from 'react'
import Link from 'next/link'
import { Sparkles, Send, Loader2, Wrench, ChevronDown, History, Plus, ImageIcon } from 'lucide-react'
import {
  saveChatAction,
  listChatsAction,
  loadChatAction,
} from '@/lib/actions/marketing.actions'

/**
 * The marketing assistant, on the reports page.
 *
 * Collapsed until asked for, because the page's job is the numbers and a chat
 * box at the top would push them down for the people who just want to see
 * how the week went.
 *
 * Conversations are kept. Partly so one can be picked up later, but mostly so
 * a proposal that spent money is traceable to the exchange that produced it —
 * "why did we start running that ad" gets asked months afterwards, and the
 * rationale on the proposal is only half the answer.
 *
 * Each person sees their own. Somebody else's half-finished thinking about the
 * budget is not something a colleague needs in a list; the proposals that came
 * out of it are already shared, and those are the part that matters.
 */

type Turn = { role: 'user' | 'assistant'; content: string; tools?: string[] }

const TOOL_LABEL: Record<string, string> = {
  sales_summary: 'reading the sales figures',
  daily_sales_and_views: 'reading day by day',
  top_posts: 'checking the top posts',
  reach_by_channel: 'checking where views came from',
  email_campaigns: 'checking the email campaigns',
  list_ad_sets: 'looking up the live ad sets',
  feed_health: 'checking the feeds are up to date',
  list_assets: 'looking through the images',
  propose_post: 'drafting a post for approval',
  propose_ad_budget: 'drafting a budget change for approval',
  propose_ad_status: 'drafting a pause for approval',
  propose_new_ad: 'drafting a new ad for approval',
  propose_boost: 'drafting a boost for approval',
  list_ads: 'checking which ads are running',
}

const STARTERS = [
  'How did last week go, and what changed?',
  'Which ads are actually paying for themselves?',
  'What should we post this week?',
  'Is anything worth pausing?',
]

export function AssistantPanel() {
  const [open, setOpen] = React.useState(false)
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [proposed, setProposed] = React.useState(false)
  const endRef = React.useRef<HTMLDivElement>(null)

  // The conversation is kept now, so it can be picked up later and so a
  // proposal that spent money is traceable to the exchange that produced it.
  const chatId = React.useRef<string | null>(null)
  const [history, setHistory] = React.useState<
    { id: string; title: string; updatedAt: string; turns: number }[] | null
  >(null)
  const [showHistory, setShowHistory] = React.useState(false)

  React.useEffect(() => {
    if (busy || turns.length) endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [turns, busy])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return

    setError('')
    setInput('')
    const history: Turn[] = [...turns, { role: 'user', content: q }]
    setTurns([...history, { role: 'assistant', content: '', tools: [] }])
    setBusy(true)

    try {
      const res = await fetch('/api/marketing/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((t) => ({ role: t.role, content: t.content })),
        }),
      })
      if (!res.ok || !res.body) throw new Error(await res.text().catch(() => 'Request failed'))

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE frames are separated by a blank line; a partial frame stays in
        // the buffer until the rest of it arrives.
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          let event: { type: string; text?: string; name?: string; message?: string }
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (event.type === 'text' && event.text) {
            setTurns((t) => {
              const next = [...t]
              const last = next[next.length - 1]
              next[next.length - 1] = { ...last, content: last.content + event.text }
              return next
            })
          } else if (event.type === 'tool' && event.name) {
            if (event.name.startsWith('propose_')) setProposed(true)
            setTurns((t) => {
              const next = [...t]
              const last = next[next.length - 1]
              next[next.length - 1] = { ...last, tools: [...(last.tools ?? []), event.name!] }
              return next
            })
          } else if (event.type === 'error' && event.message) {
            setError(event.message)
          }
        }
      }
    } catch (e) {
      setError((e as Error).message || 'Could not reach the assistant.')
    } finally {
      setBusy(false)
      // An answer that produced nothing readable is worse than no bubble.
      setTurns((t) => {
        const kept = t.filter(
          (turn, i) => i < t.length - 1 || turn.content.trim() || turn.tools?.length,
        )
        // Saved after the stream finishes rather than during it, so a
        // half-written answer never becomes the stored one. Best effort: a
        // failure here must not cost anyone the reply they just read.
        void saveChatAction({
          chatId: chatId.current,
          messages: kept.map((x) => ({ role: x.role, content: x.content })),
        }).then((res) => {
          if (res.success && res.chatId) chatId.current = res.chatId
        })
        return kept
      })
    }
  }

  async function openHistory() {
    setShowHistory((v) => !v)
    if (history === null) setHistory(await listChatsAction())
  }

  async function resume(id: string) {
    const chat = await loadChatAction(id)
    if (!chat) return
    chatId.current = chat.id
    setTurns(chat.messages.map((m) => ({ role: m.role, content: m.content })))
    setShowHistory(false)
    setProposed(false)
  }

  function startFresh() {
    chatId.current = null
    setTurns([])
    setProposed(false)
    setError('')
    setShowHistory(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 flex w-full items-center gap-3 rounded-[28px] border border-neutral-200 p-5 text-left transition-colors hover:border-orange-300 hover:bg-orange-50/40"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-600">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-neutral-900">Ask about these numbers</span>
          <span className="block text-sm text-neutral-500">
            What moved, what the ads returned, what to post next. It can draft posts and ad changes
            for you to approve.
          </span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />
      </button>
    )
  }

  return (
    <section className="mb-6 rounded-[28px] border border-neutral-200 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-600">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-neutral-900">Marketing assistant</h2>
          <p className="text-xs text-neutral-500">
            Reads the figures on this page. Cannot post or spend without your approval.
          </p>
        </div>
        <button
          onClick={() => void openHistory()}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-neutral-500 hover:bg-neutral-100"
        >
          <History className="h-4 w-4" aria-hidden="true" /> Past chats
        </button>
        {turns.length > 0 && (
          <button
            onClick={startFresh}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-neutral-500 hover:bg-neutral-100"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> New
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className="rounded-full px-3 py-2 text-sm font-semibold text-neutral-500 hover:bg-neutral-100"
        >
          Hide
        </button>
      </div>

      {showHistory && (
        <div className="mt-4 rounded-2xl border border-neutral-200 p-3">
          {history === null ? (
            <p className="p-2 text-sm text-neutral-400">Loading…</p>
          ) : history.length === 0 ? (
            <p className="p-2 text-sm text-neutral-500">
              Nothing yet — conversations are kept from now on.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => void resume(h.id)}
                    className="w-full rounded-xl px-2 py-2.5 text-left hover:bg-neutral-50"
                  >
                    <span className="block truncate text-sm font-medium text-neutral-800">
                      {h.title}
                    </span>
                    <span className="block text-xs text-neutral-400">
                      {new Intl.DateTimeFormat('en-AU', {
                        timeZone: 'Australia/Brisbane',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(h.updatedAt))}{' '}
                      · {h.turns} messages
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {turns.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {turns.length > 0 && (
        <div className="mt-4 max-h-[26rem] space-y-4 overflow-y-auto pr-1">
          {turns.map((t, i) => (
            <div key={i}>
              {t.role === 'user' ? (
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-sm text-white">
                  {t.content}
                </p>
              ) : (
                <div className="max-w-[92%]">
                  {(t.tools ?? []).length > 0 && (
                    <ul className="mb-2 space-y-1">
                      {[...new Set(t.tools)].map((name) => (
                        <li key={name} className="flex items-center gap-2 text-xs text-neutral-400">
                          <Wrench className="h-3 w-3" aria-hidden="true" />
                          {TOOL_LABEL[name] ?? name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {t.content ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                      {t.content}
                    </div>
                  ) : busy && i === turns.length - 1 ? (
                    <span className="inline-flex items-center gap-2 text-sm text-neutral-400">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Thinking
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {proposed && (
        <p className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm leading-relaxed text-orange-900">
          Something is waiting for you in the{' '}
          <Link href="/admin/marketing" className="font-bold underline">
            approval queue
          </Link>
          . Nothing has been posted or changed.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-700">
          {error}
        </p>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(input)
        }}
      >
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the sales, the ads, or what to post"
          className="min-w-0 flex-1 rounded-full border border-neutral-300 px-5 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Ask
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-neutral-100 pt-4">
        <Link
          href="/admin/media"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> Media library
        </Link>
        <Link
          href="/admin/marketing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Approval queue
        </Link>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-400">
        Figures on this page are sent to the Anthropic API to answer your question. Customer, donor
        and volunteer records are not — the assistant has no way to read them.
      </p>
    </section>
  )
}
