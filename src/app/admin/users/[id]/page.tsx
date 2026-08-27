import * as React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Clock,
  CalendarCheck,
  HandHeart,
  ArrowRight,
  Repeat,
} from 'lucide-react'
import prisma from '@/lib/prisma'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/volunteer/StatusBadge'
import { formatDate } from '@/lib/utils'
import { getDonationsAccess } from '@/lib/permissions'
import { getDonorGifts, summariseGifts } from '@/lib/donations'
import { listRecurringForEmail } from '@/lib/admin-recurring'
import { StaffToggles } from '@/components/admin/StaffToggles'
import { ChurchMemberToggle } from '@/components/admin/ChurchMemberToggle'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'User | Lighthouse Care Admin' }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
const aud2 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const canSeeDonations = await getDonationsAccess()

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isChurchMember: true,
      isStaff: true,
      isTrainee: true,
      createdAt: true,
      lastLoginAt: true,
      volunteerProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mobile: true,
          status: true,
          joinedAt: true,
          lastAttendedAt: true,
          preferredLocations: true,
          suburb: true,
          state: true,
          _count: { select: { shiftAssignments: true, attendanceRecords: true } },
        },
      },
      donorProfile: { select: { phone: true, address: true } },
      _count: { select: { donations: true } },
    },
  })
  if (!user) notFound()

  const vp = user.volunteerProfile
  const isDonor = (user._count.donations ?? 0) > 0
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'

  // A donor-only account must not be visible to volunteer-only managers.
  if (!vp && !canSeeDonations) redirect('/admin/users')

  const gifts = canSeeDonations ? await getDonorGifts(user.id) : []
  const summary = canSeeDonations && gifts.length > 0 ? summariseGifts(gifts) : null
  const hasRecurring = gifts.some((g) => g.isRecurring)
  // Live recurring subscriptions (active + cancelled) for this donor.
  const recurring = canSeeDonations ? await listRecurringForEmail(user.email) : []

  const displayName = user.name || (vp ? `${vp.firstName} ${vp.lastName}` : user.email)
  const phone = vp?.mobile || user.donorProfile?.phone || null
  const location = vp ? [vp.suburb, vp.state].filter(Boolean).join(', ') || null : null

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <Avatar name={displayName} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          <p className="text-gray-500">{user.email}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {vp && <StatusBadge status={vp.status} />}
            {canSeeDonations && isDonor && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Donor
              </span>
            )}
            {isAdmin && (
              <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
              </span>
            )}
            {user.isChurchMember && (
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                Church member
              </span>
            )}
            {user.isStaff && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                Staff
              </span>
            )}
            {user.isTrainee && (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                Trainee
              </span>
            )}
            {!user.isActive && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                Inactive
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ChurchMemberToggle userId={user.id} initial={user.isChurchMember} />
            <StaffToggles userId={user.id} isStaff={user.isStaff} isTrainee={user.isTrainee} />
          </div>
        </div>
      </div>

      {/* Details */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
          {phone && <Field icon={<Phone className="h-4 w-4" />} label="Mobile" value={phone} />}
          {location && <Field icon={<MapPin className="h-4 w-4" />} label="Location" value={location} />}
          <Field
            icon={<CalendarDays className="h-4 w-4" />}
            label="Joined"
            value={formatDate(vp?.joinedAt ?? user.createdAt)}
          />
          <Field
            icon={<Clock className="h-4 w-4" />}
            label="Last login"
            value={user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
          />
        </dl>
      </section>

      {/* Volunteering */}
      {vp ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Volunteering</h2>
            <Link
              href={`/admin/volunteers/${vp.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Open full record <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat icon={<HandHeart className="h-5 w-5" />} value={vp._count.attendanceRecords} label="Attendances" />
            <Stat icon={<CalendarCheck className="h-5 w-5" />} value={vp._count.shiftAssignments} label="Shifts booked" />
            <Stat
              icon={<CalendarDays className="h-5 w-5" />}
              value={vp.lastAttendedAt ? formatDate(vp.lastAttendedAt) : '—'}
              label="Last attended"
              small
            />
            <Stat
              icon={<MapPin className="h-5 w-5" />}
              value={vp.preferredLocations.length ? vp.preferredLocations.join(', ') : '—'}
              label="Locations"
              small
            />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Not a volunteer.{' '}
          <Link href="/admin/volunteers/new" className="font-medium text-orange-600 hover:underline">
            Add a volunteer profile
          </Link>
        </section>
      )}

      {/* Giving — finance admins only */}
      {canSeeDonations &&
        (summary ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Giving</h2>
              <Link
                href="/admin/transactions"
                className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                All transactions <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Stat value={aud.format(summary.allTime)} label="All-time" />
              <Stat value={aud.format(summary.financialYear)} label={`This FY (${summary.fyLabel})`} small />
              <Stat
                value={String(summary.count)}
                label="Gifts"
                badge={hasRecurring ? 'Recurring' : undefined}
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Fund</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {gifts.slice(0, 20).map((g) => (
                    <tr key={g.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2.5 text-gray-600">{formatDate(g.createdAt)}</td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {g.fundName ?? 'General'}
                        {g.isRecurring && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
                            <Repeat className="h-3 w-3" /> Recurring
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-gray-900">
                        {aud2.format(g.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 shadow-sm">
            No gifts recorded for this account yet.
          </section>
        ))}

      {/* Recurring giving — live status from Stripe */}
      {canSeeDonations && recurring.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Recurring giving</h2>
          <div className="space-y-3">
            {recurring.map((r) => {
              const badge =
                r.active && (r.status === 'active' || r.status === 'trialing')
                  ? 'bg-green-100 text-green-700'
                  : r.active
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-600'
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-4">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                      {aud2.format(r.amount)}
                      <span className="font-normal text-gray-500">· {r.frequencyLabel}</span>
                      {r.isTithe && (
                        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">Tithe</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {r.active && r.nextChargeAt
                        ? `Next gift ${formatDate(new Date(r.nextChargeAt * 1000))}`
                        : r.endedAt
                          ? `Cancelled ${formatDate(new Date(r.endedAt * 1000))}`
                          : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
                    {r.statusLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div>
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className="text-sm font-medium text-gray-900">{value}</dd>
      </div>
    </div>
  )
}

function Stat({
  icon,
  value,
  label,
  small,
  badge,
}: {
  icon?: React.ReactNode
  value: string | number
  label: string
  small?: boolean
  badge?: string
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      {icon && <span className="text-orange-500">{icon}</span>}
      <p className={(small ? 'text-base' : 'text-2xl') + ' mt-2 font-bold tabular-nums text-gray-900'}>{value}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
        {label}
        {badge && (
          <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">
            {badge}
          </span>
        )}
      </p>
    </div>
  )
}
