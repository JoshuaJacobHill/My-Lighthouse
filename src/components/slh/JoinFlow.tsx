'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check } from 'lucide-react'
import { SantaMark } from '@/components/slh/SantaMark'
import { joinAsShopperAction } from '@/lib/actions/slh.actions'
import {
  AGE_BANDS,
  GENDERS,
  WISHLIST_COUNTS,
  canSubmit,
  type AgeBand,
  type Gender,
} from '@/lib/slh-onboarding'

/**
 * Signing up to shop for children.
 *
 * Four screens, held in component state rather than four routes: nothing is
 * saved until the last one, so a half-finished sign-up should not survive a
 * refresh as a row nobody meant to create.
 *
 * It takes over the whole viewport — solid colour, snow, white type — because
 * this is the one moment in the app where somebody is being welcomed into
 * something rather than filling in a form. Everything after it is the ordinary
 * white portal.
 */
export type JoinOrg = {
  id: string
  name: string
  logoUrl: string | null
  waiting: number
  /** Wish lists still to be promised. */
  available: number
  /** False when no allocation is set — "not open yet", not "all taken". */
  open: boolean
  dropOffAddress: string | null
  window: string | null
}

type Step = 'welcome' | 'organisation' | 'lists' | 'done'

/** Fixed flakes, so the same screen looks the same every time. */
const FLAKES = [
  [6, 3, 11, 0], [18, 2, 14, 2], [29, 4, 9, 1], [41, 2.5, 13, 4], [52, 3.5, 10, 2.5],
  [63, 2, 15, 0.5], [74, 4, 12, 3], [85, 2.5, 10, 1.5], [93, 3, 14, 4.5], [12, 2, 16, 5],
  [36, 3, 11, 6], [58, 2.5, 13, 5.5], [80, 3.5, 9, 6.5], [47, 2, 17, 3.5],
] as const

function Snow() {
  return (
    <div className="slh-snow pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {FLAKES.map(([left, size, dur, delay], i) => (
        <i
          key={i}
          style={{
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            animationDuration: `${dur}s`,
            animationDelay: `-${delay}s`,
          }}
        />
      ))}
    </div>
  )
}

function Dots({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all ${
            n <= step ? 'w-6 bg-white' : 'w-1.5 bg-white/35'
          }`}
        />
      ))}
    </div>
  )
}

function Takeover({ tone, children }: { tone: 'red' | 'green'; children: React.ReactNode }) {
  return (
    <div
      className={`relative -m-4 flex min-h-[100dvh] flex-col overflow-hidden text-white lg:-m-6 ${
        tone === 'red' ? 'bg-[#c8102e]' : 'bg-[#1a7a45]'
      }`}
    >
      <Snow />
      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10 sm:px-8">
        {children}
      </div>
    </div>
  )
}

/** A pill choice. Used for counts, ages and genders — same shape, same feel. */
function Choice({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
        on ? 'bg-white text-neutral-900' : 'border border-white/35 text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function WhiteButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-white py-3.5 text-base font-bold text-neutral-900 transition-opacity hover:bg-white/90 disabled:opacity-45"
    >
      {children}
    </button>
  )
}

export function JoinFlow({ orgs, year }: { orgs: JoinOrg[]; year: number }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [orgId, setOrgId] = useState<string | null>(null)
  const [count, setCount] = useState<number>(1)
  const [age, setAge] = useState<AgeBand>('any')
  const [gender, setGender] = useState<Gender>('any')
  const [ack, setAck] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const org = orgs.find((o) => o.id === orgId) ?? null

  function submit() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('organisationId', orgId ?? '')
      fd.set('requested', String(count))
      fd.set('preferredAge', age)
      fd.set('preferredGender', gender)
      fd.set('acknowledged', String(ack))
      const result = await joinAsShopperAction(fd)
      if (result.success) {
        // Deliberately NOT router.refresh(). This route redirects to
        // /dashboard/slh the moment a sign-up exists, so refreshing here
        // re-runs that guard and throws the person off the confirmation
        // screen before they can read it. The push below fetches fresh data
        // anyway, when they choose to leave.
        setStep('done')
      } else {
        setError(result.error ?? 'Could not save your sign-up.')
      }
    })
  }

  if (step === 'welcome') {
    return (
      <Takeover tone="red">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/70">
          Christmas {year}
        </p>
        <div className="flex-1" />
        <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight">
          Welcome to
          <br />
          Santa&rsquo;s Little
          <br />
          Helpers
        </h1>
        <div className="mt-5 space-y-3.5 text-[15px] leading-relaxed text-white/85">
          <p>
            You&rsquo;re making Christmas brighter. Because of your generosity, a child going
            through an incredibly difficult time will wake up on Christmas morning knowing someone
            thought of them.
          </p>
          <p>
            More than a gift, you&rsquo;re giving them a moment of joy, excitement and hope when
            they need it most.
          </p>
          <p>
            Thank you for being one of Santa&rsquo;s Little Helpers and helping make Christmas feel
            special again.
          </p>
        </div>
        <div className="flex-1" />
        <div className="mt-8">
          <WhiteButton onClick={() => setStep('organisation')}>Get started</WhiteButton>
        </div>
      </Takeover>
    )
  }

  if (step === 'organisation') {
    return (
      <Takeover tone="green">
        <Dots step={1} />
        <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
          Select your organisation
        </h2>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/85">
          Each organisation has been carefully vetted and is trusted by Santa&rsquo;s Little
          Helpers. They work directly on the frontline with children and families experiencing
          incredibly difficult circumstances.
        </p>

        {orgs.length === 0 ? (
          <p className="mt-6 rounded-[22px] border border-dashed border-white/40 p-6 text-center text-sm text-white/85">
            No organisations are taking shoppers just yet. Please check back soon.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {orgs.map((o) => {
              const on = orgId === o.id
              // Nothing to promise: either Lighthouse has not set an allocation
              // yet, or other shoppers have taken all of it. Different reasons,
              // different sentences — "come back later" is not "all gone".
              const closed = !o.open || o.available === 0
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    if (closed) return
                    setOrgId(o.id)
                    // Going back and picking a smaller organisation must not
                    // carry the larger request across.
                    setCount((c) => Math.min(c, o.available))
                  }}
                  aria-pressed={on}
                  aria-disabled={closed}
                  className={`rounded-[22px] p-4 text-left transition-colors ${
                    on
                      ? 'bg-white text-neutral-900'
                      : closed
                        ? 'cursor-not-allowed border border-white/15 opacity-55'
                        : 'border border-white/30 hover:bg-white/10'
                  }`}
                >
                  <span className="block text-lg font-extrabold leading-tight">{o.name}</span>
                  <span
                    className={`mt-1 block text-[13px] ${on ? 'text-neutral-500' : 'text-white/70'}`}
                  >
                    {/* Always the allocation still going spare — never the
                        number of wish lists parents have got around to
                        filling in. An organisation allocated 100 with 12
                        filled has 88 children a shopper can still take on,
                        and saying "12" would turn people away from work that
                        exists. */}
                    {!o.open
                      ? 'Not open for shoppers yet'
                      : o.available === 0
                        ? 'Every wish list has been taken'
                        : `${o.available} ${o.available === 1 ? 'child' : 'children'} still need a shopper`}
                  </span>
                  {o.window && (
                    <span
                      className={`mt-2 flex items-center gap-1.5 text-[13px] font-semibold ${
                        on ? 'text-neutral-700' : 'text-white/85'
                      }`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      Drop off {o.window}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex-1" />
        <div className="mt-8">
          <WhiteButton disabled={!orgId} onClick={() => setStep('lists')}>
            Continue
          </WhiteButton>
        </div>
      </Takeover>
    )
  }

  if (step === 'lists' && org) {
    const ready =
      canSubmit({ organisationId: orgId, acknowledged: ack }) && count > 0 && count <= org.available
    return (
      <Takeover tone="red">
        <Dots step={2} />
        <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
          How many children would you like to shop for?
        </h2>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/85">
          We ask that around <b className="text-white">$200</b> is spent on each child so every
          child receives a similar level of care and generosity.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {WISHLIST_COUNTS.filter((n) => n <= org.available).map((n) => (
            <Choice key={n} on={count === n} onClick={() => setCount(n)}>
              {n}
            </Choice>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-white/70">
          {org.name} has {org.available} wish {org.available === 1 ? 'list' : 'lists'} left this
          year. You can change this later.
        </p>

        <hr className="my-7 border-white/20" />

        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/70">
          Preferred age
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {AGE_BANDS.map(([value, label]) => (
            <Choice key={value} on={age === value} onClick={() => setAge(value)}>
              {label}
            </Choice>
          ))}
        </div>

        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/70">
          A boy or a girl?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {GENDERS.map(([value, label]) => (
            <Choice key={value} on={gender === value} onClick={() => setGender(value)}>
              {label}
            </Choice>
          ))}
        </div>

        <hr className="my-7 border-white/20" />

        {/* The one commitment on this screen. Everything above it is a preference. */}
        <button
          type="button"
          onClick={() => setAck(!ack)}
          aria-pressed={ack}
          className="flex items-start gap-3 text-left"
        >
          <span
            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-colors ${
              ack ? 'border-white bg-white text-[#c8102e]' : 'border-white/50'
            }`}
          >
            {ack && <Check className="h-4 w-4" aria-hidden="true" />}
          </span>
          <span className="text-[14.5px] leading-relaxed">
            I can get the gifts to <b>{org.name}</b>
            {org.dropOffAddress ? <>, {org.dropOffAddress}</> : null}
            {org.window ? (
              <>
                , between <b>{org.window}</b>
              </>
            ) : null}
          </span>
        </button>

        <div className="flex-1" />
        <div className="mt-8 space-y-2.5">
          <WhiteButton disabled={!ready || pending} onClick={submit}>
            {pending
              ? 'Saving…'
              : `Assign me ${count} wish list${count === 1 ? '' : 's'}`}
          </WhiteButton>
          {error ? (
            <p role="alert" className="text-center text-[13px] font-semibold text-white">
              {error}
            </p>
          ) : !ready ? (
            <p className="text-center text-[13px] text-white/70">
              Confirm the drop-off to continue.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setStep('organisation')}
            className="w-full py-1 text-[13px] font-semibold text-white/70 hover:text-white"
          >
            Back
          </button>
        </div>
      </Takeover>
    )
  }

  if (step === 'done' && org) {
    return (
      <Takeover tone="green">
        <Dots step={3} />
        <div className="flex-1" />
        <div className="grid justify-items-center gap-5 text-center">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-white/15">
            <SantaMark className="h-14 w-14" />
          </span>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
            You&rsquo;re all signed up
          </h2>
          <p className="text-[15px] leading-relaxed text-white/85">
            You&rsquo;ve asked to shop for {count} {count === 1 ? 'child' : 'children'} from{' '}
            <b className="text-white">{org.name}</b>. We&rsquo;ll let you know the moment your wish{' '}
            {count === 1 ? 'list is' : 'lists are'} ready.
          </p>
        </div>
        <div className="flex-1" />
        <div className="mt-8 space-y-4">
          <WhiteButton onClick={() => router.push('/dashboard/slh')}>
            Go to my wish lists
          </WhiteButton>
          <p className="text-[13px] leading-relaxed text-white/70">
            If for any reason you&rsquo;re unable to complete your shopping, please let us know as
            soon as possible so we can reassign the wish {count === 1 ? 'list' : 'lists'} and make
            sure no child misses out this Christmas.
          </p>
        </div>
      </Takeover>
    )
  }

  // Lost the organisation somehow (it was withdrawn mid-flow) — start again
  // rather than render a screen that talks about nobody.
  return (
    <Takeover tone="green">
      <div className="flex-1" />
      <p className="text-center text-[15px] text-white/85">
        That organisation is no longer taking shoppers.
      </p>
      <div className="flex-1" />
      <WhiteButton
        onClick={() => {
          setOrgId(null)
          setStep('organisation')
        }}
      >
        Choose another
      </WhiteButton>
    </Takeover>
  )
}
