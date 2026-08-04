import Link from 'next/link'
import { UserPlus, ChevronLeft, ChevronRight, Search } from 'lucide-react'
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

type UserType = 'all' | 'volunteers' | 'donors'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string; page?: string }>
}) {
  const params = await searchParams
  const canSeeDonations = await getDonationsAccess()

  const page = Math.max(1, Number(params.page) || 1)
  const skip = (page - 1) * PAGE_SIZE
  const search = params.search?.trim() || ''

  // Volunteer-only managers never see donor-type filtering or donor-only users.
  let type = (params.type as UserType) || 'all'
  if (!canSeeDonations) type = 'volunteers'

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
        : {} // 'all' (finance admins only)

  const where: Prisma.UserWhereInput = { AND: [searchWhere, typeWhere] }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
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
        _count: { select: { donations: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  // Giving totals for the users on this page (finance admins only).
  const totals = new Map<string, { total: number; count: number }>()
  if (canSeeDonations) {
    const ids = users.map((u) => u.id)
    if (ids.length) {
      const grouped = await prisma.donation.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _sum: { amount: true },
        _count: true,
      })
      for (const g of grouped) {
        if (g.userId) totals.set(g.userId, { total: Number(g._sum.amount ?? 0), count: g._count })
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tabs: { key: UserType; label: string }[] = canSeeDonations
    ? [
        { key: 'all', label: 'All' },
        { key: 'volunteers', label: 'Volunteers' },
        { key: 'donors', label: 'Donors' },
      ]
    : [{ key: 'volunteers', label: 'Volunteers' }]

  const tabHref = (t: UserType) => {
    const q = new URLSearchParams()
    if (t !== 'all') q.set('type', t)
    if (search) q.set('search', search)
    const s = q.toString()
    return `/admin/users${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {canSeeDonations
              ? 'Everyone in your community — volunteers and donors.'
              : 'Volunteers in your community.'}
          </p>
        </div>
        <Link
          href="/admin/volunteers/new"
          className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <UserPlus className="h-4 w-4" /> Add volunteer
        </Link>
      </div>

      {/* Filter tabs */}
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

      {/* Search */}
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

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Joined</th>
              {canSeeDonations && <th className="px-5 py-3 text-right">Given</th>}
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
              const displayName =
                u.name || (vp ? `${vp.firstName} ${vp.lastName}` : u.email)
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
                      {isAdmin && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                          Admin
                        </span>
                      )}
                      {!vp && !isDonor && !isAdmin && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {formatDate(vp?.joinedAt ?? u.createdAt)}
                  </td>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {total} {total === 1 ? 'user' : 'users'} · page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <PageLink type={type} search={search} page={page - 1} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </PageLink>
            <PageLink type={type} search={search} page={page + 1} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </PageLink>
          </div>
        </div>
      )}
    </div>
  )
}

function PageLink({
  type,
  search,
  page,
  disabled,
  children,
}: {
  type: string
  search: string
  page: number
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-300">
        {children}
      </span>
    )
  }
  const q = new URLSearchParams()
  if (type && type !== 'all') q.set('type', type)
  if (search) q.set('search', search)
  q.set('page', String(page))
  return (
    <Link
      href={`/admin/users?${q.toString()}`}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
    >
      {children}
    </Link>
  )
}
