'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { sendContactMessageAction } from '@/lib/actions/contact.actions'

const input =
  'w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500'

export function ContactForm() {
  const [pending, startTransition] = React.useTransition()
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState('')

  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [organisation, setOrganisation] = React.useState('')
  const [message, setMessage] = React.useState('')
  /** Hidden from people; most bots fill it in. */
  const [website, setWebsite] = React.useState('')

  // When the form appeared, so a submission faster than a person can type is
  // recognisable. Set on mount rather than on the server, which has no idea
  // how long the page has been open — and in an effect rather than inline,
  // because reading the clock during render is not pure and React says so.
  const loadedAt = React.useRef(0)
  React.useEffect(() => {
    loadedAt.current = Date.now()
  }, [])

  if (sent) {
    return (
      <div className="rounded-[28px] bg-lime-50 p-8 text-center">
        <p className="text-xl font-extrabold tracking-tight text-lime-900">Thanks — that&rsquo;s with us.</p>
        <p className="mt-2 leading-relaxed text-lime-800">
          Someone will come back to you. If it&rsquo;s urgent, the stores are open six days a week.
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
          const res = await sendContactMessageAction({
            name,
            email,
            organisation,
            message,
            website,
            loadedAt: loadedAt.current,
          })
          if (res.success) setSent(true)
          else setError(res.error ?? 'Something went wrong.')
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-neutral-700">Your name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={input}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-neutral-700">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={input}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-neutral-700">
          Business or organisation <span className="font-normal text-neutral-400">(optional)</span>
        </span>
        <input
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          autoComplete="organization"
          className={input}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-neutral-700">
          How can we help?
        </span>
        <textarea
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={input}
        />
      </label>

      {/* Honeypot. Hidden from people and from screen readers; bots fill it in
          because it looks like a field worth completing. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Send
      </button>
    </form>
  )
}
