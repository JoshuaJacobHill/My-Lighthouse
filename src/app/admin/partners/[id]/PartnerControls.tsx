'use client'

import * as React from 'react'
import Link from 'next/link'
import { Loader2, Trash2 } from 'lucide-react'
import { LogoUpload } from '@/components/partners/LogoUpload'
import {
  addOrgMemberAction,
  addRecognitionAction,
  approveOrgAction,
  declineOrgAction,
  removeOrgMemberAction,
  removeRecognitionAction,
  setFundraiserOrganisationAction,
  setOrgPublishedAction,
  setPostApprovedAction,
  updateOrgAction,
} from '@/lib/actions/organisation.actions'
import type { OrgMemberRole, OrgRecognitionKind } from '@prisma/client'

/**
 * Everything we can do to a partner, on one screen.
 *
 * Approving and publishing are kept visibly separate because they answer
 * different questions — "is this really Fulton Hogan" and "is the page ready"
 * — and running them together is how a half-written page reaches the public.
 */

type Org = {
  id: string
  name: string
  slug: string
  website: string | null
  about: string | null
  address: string | null
  logoUrl: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  status: string
  isPublished: boolean
}

type Recognition = {
  id: string
  kind: string
  year: number | null
  tier: string | null
  label: string
  detail: string | null
  amountCents: number | null
  showAmount: boolean
}

type Member = {
  id: string
  role: string
  status: string
  position: string | null
  name: string | null
  email: string
}

/** A fundraiser, as this screen needs it. */
type Fundraiser = {
  id: string
  title: string
  slug: string
  isActive: boolean
  /** Null on the ones not yet attached to anybody. */
  organisationId: string | null
  raisedCents: number
}

type Post = {
  id: string
  caption: string | null
  imageUrl: string | null
  isApproved: boolean
  authorName: string | null
  createdAt: string
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
    .format(cents / 100)

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-[28px] border border-neutral-200 p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

const input =
  'w-full rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500'

export function PartnerControls({
  org,
  recognitions,
  members,
  posts,
  fundraisers,
  kindLabels,
}: {
  org: Org
  recognitions: Recognition[]
  members: Member[]
  posts: Post[]
  /** This partner's fundraisers, plus every one attached to nobody. */
  fundraisers: Fundraiser[]
  kindLabels: Record<string, string>
}) {
  const [pending, startTransition] = React.useTransition()
  const [message, setMessage] = React.useState('')

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) =>
    startTransition(async () => {
      setMessage('')
      const res = await fn()
      if (!res.success) setMessage(res.error ?? 'That did not work.')
    })

  // ── profile fields ──
  const [name, setName] = React.useState(org.name)
  const [website, setWebsite] = React.useState(org.website ?? '')
  const [logoUrl, setLogoUrl] = React.useState(org.logoUrl ?? '')
  const [about, setAbout] = React.useState(org.about ?? '')
  const [address, setAddress] = React.useState(org.address ?? '')
  const [contactName, setContactName] = React.useState(org.contactName ?? '')
  const [contactEmail, setContactEmail] = React.useState(org.contactEmail ?? '')

  // ── new badge ──
  const [kind, setKind] = React.useState<OrgRecognitionKind>('SPONSOR' as OrgRecognitionKind)
  const [label, setLabel] = React.useState('')
  const [year, setYear] = React.useState('')
  const [tier, setTier] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [showAmount, setShowAmount] = React.useState(false)

  // ── new member ──
  const [memberEmail, setMemberEmail] = React.useState('')
  const [linkId, setLinkId] = React.useState('')
  const [memberRole, setMemberRole] = React.useState<OrgMemberRole>('MEMBER' as OrgMemberRole)
  const [declineNote, setDeclineNote] = React.useState('')

  const mine = fundraisers.filter((f) => f.organisationId === org.id)
  const spare = fundraisers.filter((f) => f.organisationId === null)

  return (
    <div>
      {message && (
        <p className="mt-5 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{message}</p>
      )}

      {/* ── Approval and publishing ── */}
      <Card title="Status">
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {org.status === 'PENDING' ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => approveOrgAction(org.id))}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Approve
              </button>
              <input
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                placeholder="Reason, if declining"
                className={input + ' max-w-xs'}
              />
              <button
                type="button"
                disabled={pending || !declineNote.trim()}
                onClick={() => run(() => declineOrgAction(org.id, declineNote))}
                className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-40"
              >
                Decline
              </button>
            </>
          ) : (
            <>
              <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-lime-800">
                {org.status.toLowerCase()}
              </span>
              <button
                type="button"
                disabled={pending || org.status !== 'ACTIVE'}
                onClick={() => run(() => setOrgPublishedAction(org.id, !org.isPublished))}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {org.isPublished ? 'Unpublish' : 'Publish the page'}
              </button>
              <span className="text-xs text-neutral-500">
                {org.isPublished
                  ? `Live at /partners/${org.slug}`
                  : 'Approved, but not visible to anyone yet.'}
              </span>
            </>
          )}
        </div>
      </Card>

      {/* ── The profile ── */}
      <Card title="Profile">
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-neutral-700">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-neutral-700">Website</span>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className={input} />
          </label>
          <div className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-neutral-700">Logo</span>
            <LogoUpload organisationId={org.id} value={logoUrl} onChange={setLogoUrl} />
          </div>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-neutral-700">About</span>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-neutral-700">Address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, suburb, state and postcode"
              className={input}
            />
            <span className="mt-1 block text-xs text-neutral-400">
              Where they are. Gift drop-off is set separately below, since it is often somewhere
              else.
            </span>
          </label>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-wide text-neutral-400">
          Contact — never shown publicly
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact name"
            className={input}
          />
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Contact email"
            className={input}
          />
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              updateOrgAction(org.id, {
                name,
                website,
                about,
                address,
                logoUrl,
                contactName,
                contactEmail,
              }),
            )
          }
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
      </Card>

      {/* ── Badges ── */}
      <Card title="Badges">
        <p className="mt-1 text-sm text-neutral-500">
          Ours to award. A partner admin can change their logo and blurb but never this — a
          recognition anyone could grant themselves would be worth nothing to the companies who
          earned one.
        </p>

        {recognitions.length > 0 && (
          <ul className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
            {recognitions.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <span className="w-12 shrink-0 text-sm font-extrabold tabular-nums text-neutral-900">
                  {r.year ?? '—'}
                </span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold uppercase text-neutral-600">
                  {kindLabels[r.kind] ?? r.kind}
                </span>
                <span className="min-w-0 flex-1 text-sm text-neutral-900">
                  {r.tier ? `${r.tier} — ` : ''}
                  {r.label}
                  {r.amountCents !== null && (
                    <span className={r.showAmount ? 'ml-2 font-bold text-orange-600' : 'ml-2 text-neutral-400'}>
                      {money(r.amountCents)}
                      {!r.showAmount && ' (private)'}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeRecognitionAction(r.id))}
                  className="shrink-0 rounded-full p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${r.label}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as OrgRecognitionKind)}
            className={input}
          >
            {Object.entries(kindLabels).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Year"
            inputMode="numeric"
            className={input}
          />
          <input
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            placeholder="Tier, e.g. Gold"
            className={input}
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount $"
            inputMode="numeric"
            className={input}
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What it was for, e.g. Good Food Festival"
            className={input + ' sm:col-span-3'}
          />
          <button
            type="button"
            disabled={pending || !label.trim()}
            onClick={() =>
              run(async () => {
                const res = await addRecognitionAction({
                  organisationId: org.id,
                  kind,
                  label,
                  year: year ? Number(year) : null,
                  tier,
                  amountCents: amount ? Math.round(Number(amount) * 100) : null,
                  showAmount,
                })
                if (res.success) {
                  setLabel('')
                  setTier('')
                  setAmount('')
                  setYear('')
                }
                return res
              })
            }
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add badge
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={showAmount}
            onChange={(e) => setShowAmount(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
          />
          Show the amount publicly — off by default, since not every partner wants the figure on a
          public page
        </label>
      </Card>

      {/* ── Fundraisers ── */}
      <Card title="Fundraisers">
        <p className="mt-1 text-sm text-neutral-500">
          Shown on their public page with a live total. A company admin can propose one from their
          account; it arrives switched off, and stays that way until it is given the right fund and
          turned on in{' '}
          <Link href="/admin/fundraisers" className="font-semibold text-orange-600 hover:underline">
            Fundraisers
          </Link>
          .
        </p>

        {mine.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
            {mine.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/admin/fundraisers/${f.id}/edit`}
                    className="font-semibold text-neutral-900 hover:underline"
                  >
                    {f.title}
                  </Link>
                  <span className="block text-xs text-neutral-400">
                    {money(f.raisedCents)} raised
                  </span>
                </span>
                <span
                  className={
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ' +
                    (f.isActive ? 'bg-lime-100 text-lime-800' : 'bg-amber-100 text-amber-800')
                  }
                >
                  {f.isActive ? 'live' : 'not live yet'}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setFundraiserOrganisationAction(f.id, null))}
                  className="shrink-0 rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold text-neutral-700 disabled:opacity-40"
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">None attached to this company yet.</p>
        )}

        {spare.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              className={input + ' max-w-sm'}
            >
              <option value="">Attach an existing fundraiser…</option>
              {spare.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                  {f.isActive ? '' : ' (not live)'}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending || !linkId}
              onClick={() =>
                run(async () => {
                  const res = await setFundraiserOrganisationAction(linkId, org.id)
                  if (res.success) setLinkId('')
                  return res
                })
              }
              className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Attach
            </button>
          </div>
        )}
      </Card>

      {/* ── Team ── */}
      <Card title="Their team">
        {members.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-neutral-900">{m.name ?? m.email}</span>
                  {m.position && <span className="ml-2 text-neutral-500">{m.position}</span>}
                  <span className="block truncate text-xs text-neutral-400">{m.email}</span>
                </span>
                <span
                  className={
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ' +
                    (m.role === 'ADMIN'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600')
                  }
                >
                  {m.role.toLowerCase()}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeOrgMemberAction(m.id))}
                  className="shrink-0 rounded-full p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${m.email}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">Nobody attached yet.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            placeholder="Their sign-in email"
            className={input + ' max-w-xs'}
          />
          <select
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value as OrgMemberRole)}
            className={input + ' max-w-[10rem]'}
          >
            <option value="MEMBER">Member — can post</option>
            <option value="ADMIN">Admin — can edit</option>
          </select>
          <button
            type="button"
            disabled={pending || !memberEmail.trim()}
            onClick={() =>
              run(async () => {
                const res = await addOrgMemberAction({
                  organisationId: org.id,
                  email: memberEmail,
                  role: memberRole,
                })
                if (res.success) setMemberEmail('')
                return res
              })
            }
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          They need an account already — one made on someone&rsquo;s behalf has no password, no
          verified address and nobody expecting it.
        </p>
      </Card>

      {/* ── Posts awaiting approval ── */}
      {posts.length > 0 && (
        <Card title="Photos and posts">
          <p className="mt-1 text-sm text-neutral-500">
            Nothing appears on the public page until it is approved here. The people in the
            photographs are their staff and the page carries their employer&rsquo;s name.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {posts.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-2xl border border-neutral-200">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-40 w-full object-cover" />
                )}
                <div className="p-3">
                  {p.caption && <p className="text-sm text-neutral-700">{p.caption}</p>}
                  <p className="mt-1 text-xs text-neutral-400">{p.authorName ?? 'Their team'}</p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setPostApprovedAction(p.id, !p.isApproved))}
                    className={
                      'mt-2 rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50 ' +
                      (p.isApproved
                        ? 'border border-neutral-300 text-neutral-700'
                        : 'bg-neutral-900 text-white')
                    }
                  >
                    {p.isApproved ? 'Take down' : 'Approve'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
