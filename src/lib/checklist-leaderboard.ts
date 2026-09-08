/**
 * Who has been ticking things off.
 *
 * Counted from `completedAt` over the Brisbane calendar month rather than from
 * the period key: a daily item ticked late still belongs to the month the work
 * happened in, and weekly and monthly items have keys that don't map to a
 * month at all.
 *
 * What this measures is completions, not effort — a tick is a tick whether it
 * followed twenty minutes of mopping or nothing at all. It is genuinely useful
 * for seeing who carries the load, and a poor thing to award a prize from
 * automatically.
 */

import prisma from '@/lib/prisma'

export type ChecklistStanding = {
  userId: string
  name: string
  completions: number
}

export type ChecklistMonth = {
  label: string
  from: Date
  to: Date
  standings: ChecklistStanding[]
  total: number
}

const BNE = 'Australia/Brisbane'

/** First and last instant of the current Brisbane month. */
function monthRange(now = new Date()): { from: Date; to: Date; label: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: BNE, year: 'numeric', month: '2-digit' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  const y = Number(parts.year)
  const m = Number(parts.month)

  // Queensland has no daylight saving, so a fixed +10:00 is always right.
  const from = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00.000+10:00`)
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const to = new Date(
    new Date(`${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00.000+10:00`).getTime() - 1,
  )
  const label = new Intl.DateTimeFormat('en-AU', {
    timeZone: BNE,
    month: 'long',
    year: 'numeric',
  }).format(from)
  return { from, to, label }
}

export async function getChecklistMonth(now = new Date()): Promise<ChecklistMonth> {
  const { from, to, label } = monthRange(now)

  const rows = await prisma.checklistCompletion.groupBy({
    by: ['completedById'],
    where: { completedAt: { gte: from, lte: to } },
    _count: { _all: true },
  })

  const names = rows.length
    ? await prisma.user.findMany({
        where: { id: { in: rows.map((r) => r.completedById) } },
        select: { id: true, name: true, email: true },
      })
    : []
  const nameById = new Map(names.map((u) => [u.id, u.name ?? u.email]))

  const standings: ChecklistStanding[] = rows
    .map((r) => ({
      userId: r.completedById,
      name: nameById.get(r.completedById) ?? 'Someone',
      completions: r._count._all,
    }))
    .sort((a, b) => b.completions - a.completions || a.name.localeCompare(b.name))

  return {
    label,
    from,
    to,
    standings,
    total: standings.reduce((n, s) => n + s.completions, 0),
  }
}
