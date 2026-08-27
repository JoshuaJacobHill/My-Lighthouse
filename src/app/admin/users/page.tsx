import Link from 'next/link'
import { UserPlus, ChevronLeft, ChevronRight, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/volunteer/StatusBadge'
import { formatDate } from '@/lib/utils'
import { getDonationsAccess } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Users | Lighthouse Care Admin' }

const PAGE_SIZE = 25
const aud0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

type UserType = 'all' | 'volunteers' | 'donors' | 'staff' | 'trainees' | 'church'
type SortKey = 'activity' | 'name' | 'joined' | 'total'
type Dir = 'asc' | 'desc'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string; page?: string; sort?: string; dir?: string }>
}) {
  const params = await searchParams
  const canSeeDonations = await getDonationsAccess()

  const page = Math.max(1, Number(params.page) || 1)
  const skip = (page - 1) * PAGE_SIZE
  const search = params.search?.trim() || ''

  const sort: SortKey = (['activity', 'name', 'joined', 'total'] as const).includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : 'activity'
  const dir: Dir = params.dir === 'asc' ? 'asc' : params.dir === 'desc' ? 'desc' : sort === 'name' ? 'asc' : 'desc'

  let type = (params.type as UserType) || 'all'
  // Volunteer-only admins must not browse the donor base at all — that's why
  // 'All' is off-limits to them too, not just the Donors tab. Staff, trainee and
  // church membership aren't financial data, so those filters stay available.
  if (!canSeeDonations && (type === 'donors' || type === 'all')) type = 'volunteers'

  const searchWhere: Prisma.UserWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          {
            volunteerProfile: {
              is: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { mobile: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      }
    : {}

  const typeWhere: Prisma.UserWhereInput =
    type === 'volunteers'
      ? { volunteerProfile: { isNot: null } }
      : type === 'donors'
        ? { donations: { some: {} } }
        : type === 'staff'
          ? { isStaff: true }
          : type === 'trainees'
            ? { isTrainee: true }
            : type === 'church'
              ? { isChurchMember: true }
              : {}

  const where: Prisma.UserWhereInput = { AND: [searchWhere, typeWhere] }

  // Fetch all matching users (light select), then sort by giving/activity in
  // memory — Prisma can't order by a donation sum — and paginate the result.
  const allUsers = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      volunteerProfile: {
        select: { id: true, status: true, firstName: true, lastName: true, joinedAt: true },
      },
      isStaff: true,
      isTrainee: true,
      isChurchMember: true,
      _count: { select: { donations: true } },
    },
  })

  // Per-user giving total + most recent gift date (finance admins only).
  const totals = new Map<string, { total: number; count: number }>()
  const lastGift = new Map<string, number>()
  if (canSeeDonations && allUsers.length) {
    const grouped = await prisma.donation.groupBy({
      by: ['userId'],
      where: { userId: { in: allUsers.map((u) => u.id) } },
      _sum: { amount: true },
      _max: { createdAt: true },
      _count: true,
    })
    for (const g of grouped) {
      if (!g.userId) continue
      totals.set(g.userId, { total: Number(g._sum.amount ?? 0), count: g._count })
      if (g._max.createdAt) lastGift.set(g.userId, g._max.createdAt.getTime())
    }
  }

  const displayNameOf = (u: (typeof allUsers)[number]) =>
    u.name || (u.volunteerProfile ? `${u.volunteerProfile.firstName} ${u.volunteerProfile.lastName}` : u.email)
  const joinedOf = (u: (typeof allUsers)[number]) => (u.volunteerProfile?.joinedAt ?? u.createdAt).getTime()
  const activityOf = (u: (typeof allUsers)[number]) => lastGift.get(u.id) ?? u.createdAt.getTime()

  const sign = dir === 'asc' ? 1 : -1
  allUsers.sort((a, b) => {
    let cmp = 0
    if (sort === 'name') cmp = displayNameOf(a).localeCompare(displayNameOf(b))
    else if (sort === 'joined') cmp = joinedOf(a) - joinedOf(b)
    else if (sort === 'total') cmp = (totals.get(a.id)?.total ?? 0) - (totals.get(b.id)?.total ?? 0)
    else cmp = activityOf(a) - activityOf(b) // 'activity'
    if (cmp === 0) cmp = b.createdAt.getTime() - a.createdAt.getTime() // tiebreak: newest signup
    return cmp * sign
  })

  const total = allUsers.length
  const users = allUsers.slice(skip, skip + PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const tabs: { key: UserType; label: string }[] = [
    ...(canSeeDonations ? [{ key: 'all' as UserType, label: 'All' }] : []),
    { key: 'volunteers', label: 'Volunteers' },
    ...(canSeeDonations ? [{ key: 'donors' as UserType, label: 'Donors' }] : []),
    { key: 'staff', label: 'Staff' },
    { key: 'trainees', label: 'Trainees' },
    { key: 'church', label: 'Church' },
  ]

  const baseQuery = (over: Record<string, string>) => {
    const q = new URLSearchParams()
    if (type !== 'all') q.set('type', type)
    if (search) q.set('search', search)
    if (sort !== 'activity') q.set('sort', sort)
    if (params.sort && dir !== (sort === 'name' ? 'asc' : 'desc')) q.set('dir', dir)
    for (const [k, v] of Object.entries(over)) {
      if (v) q.set(k, v)
      else q.delete(k)
    }
    const s = q.toString()
    return `/admin/users${s ? `?${s}` : ''}`
  }

  const tabHref = (t: UserType) => {
    const q = new URLSearchParams()
    if (t !== 'all') q.set('type', t)
    if (search) q.set('search', search)
    const s = q.toString()
    return `/admin/users${s ? `?${s}` : ''}`
  }

  // A sortable column header — clicking sets/toggles the sort.
  const sortHref = (col: SortKey) => {
    const nextDir: Dir = sort === col ? (dir === 'asc' ? 'desc' : 'asc') : col === 'name' ? 'asc' : 'desc'
    const q = new URLSearchParams()
    if (type !== 'all') q.set('type', type)
    if (search) q.set('search', search)
    q.set('sort', col)
    q.set('dir', nextDir)
    return `/admin/users?${q.toString()}`
  }
  const SortHead = ({ col, label, align }: { col: SortKey; label: string; align?: 'right' }) => (
    <th className={`px-5 py-3 ${align === 'right' ? 'text-right' : ''}`}>
      <Link href={sortHref(col)} className="inline-flex items-center gap-1 hover:text-gray-800">
        {label}
        {sort === col ? (
          dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-gray-300" />
        )}
      </Link>
    </th>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {canSeeDonations
              ? 'Everyone in your community — volunteers, donors, staff and church members.'
              : 'Volunteers, staff and church members in your community.'}
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <UserPlus className="h-4 w-4" /> Add user
        </Link>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          {tabs.map((t) => {
            const active = type === t.key
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                className={
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors ' +
                  (active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')
                }
              >
                {t.label}
              </Link>
            )
          })}
        </div>
      )}

      <form method="GET" className="relative max-w-md">
        {type !== 'all' && <input type="hidden" name="type" value={type} />}
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by name, email or mobile…"
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        />
      </form>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <SortHead col="name" label="Name" />
              <th className="px-5 py-3">Type</th>
              <SortHead col="joined" label="Joined" />
              {canSeeDonations && <SortHead col="total" label="Given" align="right" />}
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={canSeeDonations ? 5 : 4} className="px-5 py-12 text-center text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const vp = u.volunteerProfile
              const displayName = displayNameOf(u)
              const giving = totals.get(u.id)
              const isDonor = (u._count.donations ?? 0) > 0
              const isAdmin = u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'
              return (
                <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                      <Avatar name={displayName} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">{displayName}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {vp && <StatusBadge status={vp.status} />}
                      {canSeeDonations && isDonor && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Donor
                        </span>
                      )}
                      {u.isStaff && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Staff
                        </span>
                      )}
                      {u.isTrainee && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                          Trainee
                        </span>
                      )}
                      {u.isChurchMember && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                          Church
                        </span>
                      )}
                      {isAdmin && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                          Admin
                        </span>
                      )}
                      {!vp && !isDonor && !isAdmin && <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{formatDate(vp?.joinedAt ?? u.createdAt)}</td>
                  {canSeeDonations && (
                    <td className="px-5 py-3 text-right tabular-nums text-gray-900">
                      {giving ? (
                        <span className="font-medium">{aud0.format(giving.total)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-sm font-medium text-orange-600 hover:text-orange-700"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {total} {total === 1 ? 'user' : 'users'} · page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page <= 1 ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-300">
                <ChevronLeft className="h-4 w-4" />
              </span>
            ) : (
              <Link
                href={baseQuery({ page: String(page - 1) })}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            )}
            {page >= totalPages ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-300">
                <ChevronRight className="h-4 w-4" />
              </span>
            ) : (
              <Link
                href={baseQuery({ page: String(page + 1) })}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
