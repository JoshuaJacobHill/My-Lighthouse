'use client'

import * as React from 'react'
import { Loader2, Check, X, Pencil } from 'lucide-react'
import {
  approveProposalAction,
  declineProposalAction,
  editDraftCaptionAction,
} from '@/lib/actions/marketing.actions'

/**
 * One proposal, with everything needed to judge it.
 *
 * The approve button says what it will do — "Post to Instagram", "Set
 * $45.00/day" — rather than "Approve". Someone clicking through a queue should
 * not be able to do so without reading what the click does.
 */

export type Proposal = {
  id: string
  kind: 'ORGANIC_POST' | 'AD_BUDGET' | 'AD_STATUS'
  status: 'DRAFT' | 'APPROVED' | 'EXECUTED' | 'FAILED' | 'DECLINED'
  summary: string
  rationale: string | null
  payload: Record<string, unknown>
  before: Record<string, unknown> | null
  createdAt: string
  executedAt: string | null
  error: string | null
  proposedByName: string | null
  approvedByName: string | null
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

const STATUS_STYLE: Record<Proposal['status'], string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  EXECUTED: 'bg-lime-100 text-lime-800',
  FAILED: 'bg-red-100 text-red-700',
  DECLINED: 'bg-neutral-100 text-neutral-500',
}

const STATUS_WORD: Record<Proposal['status'], string> = {
  DRAFT: 'waiting on you',
  APPROVED: 'running',
  EXECUTED: 'done',
  FAILED: 'failed',
  DECLINED: 'declined',
}

function when(iso: string) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function ProposalCard({ p }: { p: Proposal }) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState('')
  const [editing, setEditing] = React.useState(false)
  const [caption, setCaption] = React.useState(String(p.payload.caption ?? ''))
  const [declineNote, setDeclineNote] = React.useState('')

  const open = p.status === 'DRAFT' || p.status === 'FAILED'
  const isPost = p.kind === 'ORGANIC_POST'
  const platforms = Array.isArray(p.payload.platforms) ? (p.payload.platforms as string[]) : []
  const imageUrl = typeof p.payload.imageUrl === 'string' ? p.payload.imageUrl : null

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) =>
    startTransition(async () => {
      setError('')
      const res = await fn()
      if (!res.success) setError(res.error ?? 'That did not work.')
    })

  /** What the approve button will actually do, said in full. */
  const actionLabel = () => {
    if (isPost) return `Post to ${platforms.join(' and ').toLowerCase()}`
    if (p.kind === 'AD_BUDGET') {
      return `Set ${money(Number(p.payload.dailyBudgetCents ?? 0))}/day`
    }
    return p.payload.status === 'PAUSED' ? 'Pause this ad set' : 'Resume this ad set'
  }

  return (
    <li className="rounded-[28px] border border-neutral-200 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[p.status]}`}>
          {STATUS_WORD[p.status]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-neutral-900">{p.summary}</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            Drafted {when(p.createdAt)}
            {p.proposedByName ? ` from ${p.proposedByName}'s chat` : ''}
            {p.approvedByName && p.status !== 'DRAFT' ? ` · ${p.status === 'DECLINED' ? 'declined' : 'approved'} by ${p.approvedByName}` : ''}
            {p.executedAt ? ` · ran ${when(p.executedAt)}` : ''}
          </p>
        </div>
      </div>

      {p.rationale && (
        <p className="mt-4 border-l-2 border-orange-200 pl-4 text-sm leading-relaxed text-neutral-600">
          {p.rationale}
        </p>
      )}

      {/* The post itself, as it would go out. */}
      {isPost && (
        <div className="mt-4 flex flex-wrap gap-4">
          {imageUrl && (
            // The one place a human sees the image — Claude only ever saw a
            // filename, so this is the check that matters.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-40 w-40 shrink-0 rounded-2xl border border-neutral-200 object-cover"
            />
          )}
          <div className="min-w-[16rem] flex-1">
            {editing ? (
              <>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={6}
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const res = await editDraftCaptionAction(p.id, caption)
                        if (res.success) setEditing(false)
                        return res
                      })
                    }
                    className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Save wording
                  </button>
                  <button
                    onClick={() => {
                      setCaption(String(p.payload.caption ?? ''))
                      setEditing(false)
                    }}
                    className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold text-neutral-600"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap rounded-2xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-800">
                  {String(p.payload.caption ?? '')}
                </p>
                {open && (
                  <button
                    onClick={() => setEditing(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900"
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" /> Reword it
                  </button>
                )}
              </>
            )}
            {!imageUrl && platforms.includes('FACEBOOK') && (
              <p className="mt-2 text-xs text-neutral-400">Text only — no image attached.</p>
            )}
          </div>
        </div>
      )}

      {/* Before and after, for anything that changes a live setting. */}
      {!isPost && p.before && (
        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3 rounded-2xl bg-neutral-50 p-4 text-sm">
          <div>
            <dt className="text-xs text-neutral-500">Now</dt>
            <dd className="font-semibold text-neutral-900">
              {p.kind === 'AD_BUDGET'
                ? p.before.dailyBudgetCents === null
                  ? 'Campaign-level budget'
                  : money(Number(p.before.dailyBudgetCents))
                : String(p.before.status ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Would become</dt>
            <dd className="font-semibold text-orange-700">
              {p.kind === 'AD_BUDGET'
                ? money(Number(p.payload.dailyBudgetCents ?? 0))
                : String(p.payload.status ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Ad set</dt>
            <dd className="font-medium text-neutral-700">{String(p.payload.adSetName ?? '—')}</dd>
          </div>
        </dl>
      )}

      {p.error && (
        <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-700">
          {p.status === 'DECLINED' ? p.error : `Meta refused: ${p.error}`}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {open && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <button
            disabled={pending || editing}
            onClick={() => run(() => approveProposalAction(p.id))}
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            {p.status === 'FAILED' ? `Try again — ${actionLabel()}` : actionLabel()}
          </button>

          <input
            value={declineNote}
            onChange={(e) => setDeclineNote(e.target.value)}
            placeholder="Why not? (optional)"
            className="min-w-0 flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-neutral-400 focus:outline-none sm:max-w-xs"
          />
          <button
            disabled={pending}
            onClick={() => run(() => declineProposalAction(p.id, declineNote))}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-600 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" /> No
          </button>
        </div>
      )}
    </li>
  )
}
