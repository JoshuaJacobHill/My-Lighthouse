'use client'

import * as React from 'react'
import { Send, Loader2 } from 'lucide-react'
import {
  sendNotificationAction,
  countAudienceAction,
} from '@/lib/actions/notification.actions'
import type { Audience } from '@/lib/notifications'
import { useToast } from '@/components/ui/use-toast'

type AudienceKind =
  | 'everyone'
  | 'staffAndTrainees'
  | 'staff'
  | 'trainees'
  | 'church'
  | 'volunteers'
  | 'donors'
  | 'team'

const AUDIENCES: { kind: AudienceKind; label: string }[] = [
  { kind: 'everyone', label: 'Everyone' },
  { kind: 'staffAndTrainees', label: 'Staff and trainees' },
  { kind: 'staff', label: 'Staff' },
  { kind: 'trainees', label: 'Trainees' },
  { kind: 'volunteers', label: 'Volunteers' },
  { kind: 'church', label: 'Church members' },
  { kind: 'donors', label: 'Supporters who have given' },
  { kind: 'team', label: 'A serving team' },
]

const CATEGORIES = ['GENERAL', 'STORY', 'TASK', 'SHIFT', 'CHALLENGE', 'GIVING', 'ADMIN'] as const

const FIELD =
  'mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'

export function ComposeNotification({
  teams,
  initialCount,
}: {
  teams: { id: string; name: string }[]
  /** Count for the default audience, worked out on the server so the first
   *  render already knows it and no effect has to go and fetch it. */
  initialCount: number
}) {
  const { toast } = useToast()
  const [kind, setKind] = React.useState<AudienceKind>('staffAndTrainees')
  const [teamId, setTeamId] = React.useState(teams[0]?.id ?? '')
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number]>('GENERAL')
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [href, setHref] = React.useState('/dashboard')
  const [actionLabel, setActionLabel] = React.useState('')
  const [count, setCount] = React.useState<number | null>(initialCount)
  const [sending, setSending] = React.useState(false)

  const audience: Audience = React.useMemo(
    () => (kind === 'team' ? { kind: 'team', teamId } : ({ kind } as Audience)),
    [kind, teamId],
  )

  // How many people this covers, so nobody sends to 400 by accident. Refreshed
  // when the audience changes rather than from an effect.
  function refreshCount(next: Audience) {
    setCount(null)
    void countAudienceAction(next).then((r) => setCount(r.count))
  }

  async function send() {
    if (!title.trim() || !body.trim()) {
      toast.error('Not quite ready', 'Give it a title and a line of text.')
      return
    }
    setSending(true)
    const res = await sendNotificationAction({
      audience,
      category,
      title,
      body,
      href,
      actionLabel: actionLabel || undefined,
    })
    setSending(false)

    if (res.success) {
      toast.success(
        'Sent',
        `${res.sent} ${res.sent === 1 ? 'person has' : 'people have'} been notified.`,
      )
      setTitle('')
      setBody('')
      setActionLabel('')
    } else {
      toast.error('Not sent', res.error ?? 'Please try again.')
    }
  }

  return (
    <div className="space-y-5 rounded-[28px] border border-neutral-200 p-5">
      {/* A live preview, because the wording is the whole thing. */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Preview</p>
        <p className="mt-2 text-[15px] leading-snug text-neutral-950">
          <span className="font-bold">{title || 'Title'}</span>{' '}
          <span className="text-neutral-600">{body || 'What happened, in one line.'}</span>
        </p>
        <p className="mt-1 text-xs font-semibold text-orange-600">{actionLabel || 'View now'}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-neutral-700">
          Who gets it
          <select
            value={kind}
            onChange={(e) => {
              const next = e.target.value as AudienceKind
              setKind(next)
              refreshCount(next === 'team' ? { kind: 'team', teamId } : ({ kind: next } as Audience))
            }}
            className={FIELD}
          >
            {AUDIENCES.map((a) => (
              <option key={a.kind} value={a.kind}>
                {a.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-neutral-500">
            {count === null ? 'Counting…' : `${count} ${count === 1 ? 'person' : 'people'}`}
          </span>
        </label>

        {kind === 'team' && (
          <label className="block text-sm font-semibold text-neutral-700">
            Which team
            <select
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value)
                refreshCount({ kind: 'team', teamId: e.target.value })
              }}
              className={FIELD}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm font-semibold text-neutral-700">
          Kind
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            className={FIELD}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-neutral-500">Sets the icon.</span>
        </label>
      </div>

      <label className="block text-sm font-semibold text-neutral-700">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Pack shelves"
          className={FIELD}
        />
        <span className="mt-1 block text-xs font-normal text-neutral-500">
          The thing itself. Shown in bold.
        </span>
      </label>

      <label className="block text-sm font-semibold text-neutral-700">
        One line
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="You have one new task assigned to you"
          className={FIELD}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-neutral-700">
          Link
          <input value={href} onChange={(e) => setHref(e.target.value)} className={FIELD} />
          <span className="mt-1 block text-xs font-normal text-neutral-500">
            A path in the portal, e.g. /dashboard/tasks
          </span>
        </label>

        <label className="block text-sm font-semibold text-neutral-700">
          Button wording
          <input
            value={actionLabel}
            onChange={(e) => setActionLabel(e.target.value)}
            placeholder="View now"
            className={FIELD}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={send}
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
        {count === null ? 'Send' : `Send to ${count}`}
      </button>
    </div>
  )
}
