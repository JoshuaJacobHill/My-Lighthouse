'use client'

import * as React from 'react'
import Link from 'next/link'
import { Info, Loader2 } from 'lucide-react'
import { applyForOrgAction, lookupPartnerNameAction } from '@/lib/actions/organisation.actions'
import { LogoUpload } from '@/components/partners/LogoUpload'

const input =
  'w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500'

/**
 * Ask for a partner page.
 *
 * Four fields and a note. Everything else about the profile — the blurb, the
 * team, the badges — comes after approval, because asking a stranger to write
 * a page before we have said yes wastes their time if the answer is no.
 */
export function ApplyForm({ hasCompanyDomain }: { hasCompanyDomain: boolean }) {
  const [pending, startTransition] = React.useTransition()
  const [done, setDone] = React.useState<'applied' | 'joined' | null>(null)
  const [error, setError] = React.useState('')

  const [name, setName] = React.useState('')
  const [website, setWebsite] = React.useState('')
  const [logoUrl, setLogoUrl] = React.useState('')
  const [position, setPosition] = React.useState('')
  const [note, setNote] = React.useState('')

  /**
   * Whether the company they are typing is already here.
   *
   * Checked as they type rather than on submit, because the useful moment to
   * say "Fulton Hogan already has a page" is before somebody writes a
   * paragraph about why theirs should exist. Sending it still works — it
   * becomes a request to be added to that page — but they should know that
   * before they send it, not after.
   */
  const [already, setAlready] = React.useState<{ name?: string; slug?: string } | null>(null)

  React.useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      const typed = name.trim()
      // Two letters is not a company name yet, and asking on every keystroke
      // would have us checking "F", "Fu", "Ful" all the way down.
      const res = typed.length < 3 ? { found: false } : await lookupPartnerNameAction(typed)
      if (live) setAlready(res.found ? { name: res.name, slug: res.slug } : null)
    }, 400)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [name])

  if (done) {
    return (
      <div className="rounded-[28px] bg-lime-50 p-6">
        <p className="text-lg font-extrabold tracking-tight text-lime-900">
          {done === 'joined' ? 'Request sent' : "Thanks — we'll take a look"}
        </p>
        <p className="mt-2 leading-relaxed text-lime-800">
          {done === 'joined'
            ? 'Your company already has a page, so we have asked them to add you to it.'
            : 'Someone will review it and let you know here. Nothing is visible publicly until then.'}
        </p>
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError('')
        startTransition(async () => {
          const res = await applyForOrgAction({ name, website, logoUrl, position, note })
          if (res.success) setDone(res.outcome === 'joined' ? 'joined' : 'applied')
          else setError(res.error ?? 'Something went wrong.')
        })
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-neutral-700">Company name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input}
        />
      </label>

      {already && (
        <div className="flex gap-3 rounded-[20px] bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {already.name ?? 'That company'} already has a page with us. Sending this will ask to
            add you to it rather than starting a second one.
            {already.slug && (
              <>
                {' '}
                <Link
                  href={`/partners/${already.slug}`}
                  target="_blank"
                  className="font-semibold underline"
                >
                  Have a look
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-neutral-700">Your role there</span>
        <input
          required
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className={input}
        />
      </label>

      <div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-neutral-700">
            Website <span className="font-normal text-neutral-400">(optional)</span>
          </span>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://..."
            className={input}
          />
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-neutral-700">
          Logo <span className="font-normal text-neutral-400">(optional)</span>
        </span>
        <LogoUpload value={logoUrl} onChange={setLogoUrl} />
      </div>

      {/* Where there is no company domain, the note is the only evidence we
          have — so it is required rather than optional. */}
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-neutral-700">
          {hasCompanyDomain ? (
            <>
              Anything else? <span className="font-normal text-neutral-400">(optional)</span>
            </>
          ) : (
            'Tell us a little about the company and your part in it'
          )}
        </span>
        <textarea
          required={!hasCompanyDomain}
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={input}
        />
      </label>

      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending || !name.trim() || !position.trim()}
        className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {already ? 'Ask to be added' : 'Send the request'}
      </button>
    </form>
  )
}
