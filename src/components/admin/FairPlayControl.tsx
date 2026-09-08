'use client'

import * as React from 'react'
import { ShieldAlert, Loader2, Check } from 'lucide-react'
import {
  sendFairPlayNoticeAction,
  clearFairPlayNoticeAction,
} from '@/lib/actions/fairplay.actions'
import { useToast } from '@/components/ui/use-toast'

/**
 * Sending one person the fair-play notice.
 *
 * Behind a confirm step on purpose. This tells someone we think they may be
 * cheating, and in a team of twenty an unfair one is remembered — it should
 * not be one careless tap away from a page an admin is skimming.
 */
export function FairPlayControl({
  userId,
  name,
  sentAt,
  ackAt,
}: {
  userId: string
  name: string
  sentAt: Date | null
  ackAt: Date | null
}) {
  const { toast } = useToast()
  const [pending, startTransition] = React.useTransition()
  const [confirming, setConfirming] = React.useState(false)

  const when = (d: Date) =>
    new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(d))

  const outstanding = sentAt != null && (ackAt == null || new Date(ackAt) < new Date(sentAt))

  return (
    <div className="rounded-[28px] border border-neutral-200 p-5">
      <h3 className="flex items-center gap-2 font-bold tracking-tight">
        <ShieldAlert className="h-4 w-4 text-orange-600" aria-hidden="true" />
        Fair play notice
      </h3>

      {sentAt ? (
        <p className="mt-2 text-sm text-neutral-600">
          Sent {when(sentAt)}.{' '}
          {ackAt && new Date(ackAt) >= new Date(sentAt) ? (
            <span className="inline-flex items-center gap-1 font-semibold text-lime-700">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Read {when(ackAt)}
            </span>
          ) : (
            <span className="font-semibold text-orange-700">Not read yet.</span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-sm text-neutral-600">
          Shows {name.split(/\s+/)[0]} a note on the challenge page about steps being earned by
          walking, and sends them a notification. They have to acknowledge it, and that is
          recorded.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await sendFairPlayNoticeAction(userId)
                  setConfirming(false)
                  if (res.success) toast.success('Sent', `${name} will see it on the challenge page.`)
                  else toast.error('Not sent', res.error ?? 'Please try again.')
                })
              }
              className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Yes, send it to {name.split(/\s+/)[0]}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              {sentAt ? 'Send again' : 'Send the notice'}
            </button>
            {sentAt && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await clearFairPlayNoticeAction(userId)
                    if (res.success) toast.success('Withdrawn', 'The note no longer shows.')
                    else toast.error('Could not withdraw', res.error ?? 'Please try again.')
                  })
                }
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-500 transition-colors hover:bg-neutral-50"
              >
                Withdraw
              </button>
            )}
          </>
        )}
      </div>

      {outstanding && (
        <p className="mt-3 text-xs text-neutral-400">
          Withdraw it if this was sent by mistake — it removes the note and the record of it.
        </p>
      )}
    </div>
  )
}
