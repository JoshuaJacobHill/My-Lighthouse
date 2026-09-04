'use client'

import * as React from 'react'
import { Loader2, Trash2, AtSign, Send } from 'lucide-react'
import { MentionInput, type Person } from './MentionInput'
import {
  postCommentAction,
  deleteCommentAction,
  taggableUsersAction,
} from '@/lib/actions/comment.actions'
import type { CommentView } from '@/lib/comments'

function ago(then: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(then).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Australia/Brisbane',
  }).format(new Date(then))
}

/**
 * Renders a comment with the tagged names picked out.
 *
 * Matched against the mentions stored with the comment rather than by hunting
 * for "@" in the text, so someone writing an email address does not light up
 * as a mention.
 */
function Body({ text, names }: { text: string; names: string[] }) {
  if (names.length === 0) return <>{text}</>
  // Longest first, so "Sarah Bennett" wins over "Sarah".
  const ordered = [...names].sort((a, b) => b.length - a.length)
  const escaped = ordered.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'))
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') && ordered.some((n) => part === `@${n}`) ? (
          <span key={i} className="font-semibold text-orange-600">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

export function CommentThread({
  storyId,
  taskId,
  comments,
  compact = false,
}: {
  storyId?: string
  taskId?: string
  comments: CommentView[]
  /** Tighter spacing, for a comment thread sitting inside a task row. */
  compact?: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  const [body, setBody] = React.useState('')
  const [error, setError] = React.useState('')
  const [removed, setRemoved] = React.useState<Set<string>>(new Set())

  // Tagged people are tracked by id as they are chosen, not parsed back out of
  // the text, so an edited name cannot silently break the mention.
  const [tagged, setTagged] = React.useState<Person[]>([])
  const [people, setPeople] = React.useState<Person[] | null>(null)

  const visible = comments.filter((c) => !removed.has(c.id))

  function loadPeople() {
    if (people === null) void taggableUsersAction({ storyId, taskId }).then(setPeople)
  }

  // The button is for thumbs: it types the @ for you and the same menu opens.
  function startTag() {
    loadPeople()
    setBody((prev) => (prev && !prev.endsWith(' ') ? `${prev} @` : `${prev}@`))
  }

  function submit() {
    const text = body.trim()
    if (!text) return
    setError('')
    startTransition(async () => {
      const res = await postCommentAction({
        storyId,
        taskId,
        body: text,
        // Only those still named in the text — removing the @name un-tags them.
        mentionedIds: tagged.filter((t) => text.includes(`@${t.name}`)).map((t) => t.id),
      })
      if (!res.success) {
        setError(res.error ?? 'Could not post that.')
        return
      }
      setBody('')
      setTagged([])
    })
  }

  function remove(id: string) {
    setRemoved((prev) => new Set(prev).add(id))
    startTransition(async () => {
      const res = await deleteCommentAction(id)
      if (!res.success) {
        setRemoved((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        setError(res.error ?? 'Could not remove that.')
      }
    })
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((c) => (
            <li key={c.id} className="group flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">
                {c.authorName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-neutral-950">
                  <span className="font-bold">{c.authorName}</span>{' '}
                  <span className="text-neutral-400">{ago(c.createdAt)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700">
                  <Body text={c.body} names={c.mentions.map((m) => m.name)} />
                </p>
              </div>
              {c.canDelete && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label="Remove comment"
                  className="rounded-full p-1.5 text-neutral-300 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-neutral-600 focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <MentionInput
          value={body}
          onChange={setBody}
          people={people}
          tagged={tagged}
          onTag={(p) => setTagged((prev) => (prev.some((t) => t.id === p.id) ? prev : [...prev, p]))}
          onLoadPeople={loadPeople}
          rows={compact ? 2 : 3}
          placeholder={visible.length === 0 ? 'Say something kind…' : 'Add a comment…'}
        />

        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !body.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            Post
          </button>
          <button
            type="button"
            onClick={startTag}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <AtSign className="h-4 w-4" aria-hidden="true" />
            Tag
          </button>
        </div>
      </div>
    </div>
  )
}
