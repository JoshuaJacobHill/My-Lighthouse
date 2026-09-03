import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { periodKey, periodLabel, isOverdue } from '@/lib/checklists'
import { TaskList, type TaskRow, type ChecklistRow } from './TaskList'
import { CreateTask } from './CreateTask'
import { isAdminRole } from '@/lib/permissions-core'
import { hasCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tasks & checklists' }

const fmtDue = (d: Date) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)

export default async function StaffTasksPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Came back with the session; this used to be a second serial query.
  const me = session.user
  const allowed = me.isStaff || me.isTrainee || isAdminRole(me.role)
  if (!allowed) notFound()

  // Care Managers (and admins) can hand out work from here, not just tick it
  // off. Gated on the capability, never on the role.
  const canAssign = await hasCapability('care.tasks')
  const [assignable, locations] = canAssign
    ? await Promise.all([
        prisma.user.findMany({
          where: { isActive: true, OR: [{ isStaff: true }, { isTrainee: true }] },
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
        }),
        prisma.location.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ])
    : [[], []]

  const [tasks, items] = await Promise.all([
    // Mine, plus anything unassigned that anyone on shift can pick up.
    prisma.staffTask.findMany({
      where: {
        status: { in: ['OPEN', 'DONE'] },
        OR: [{ assignedToId: me!.id }, { assignedToId: null }],
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        dueAt: true,
        status: true,
        assignedToId: true,
        location: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.checklistItem.findMany({
      where: { isActive: true },
      orderBy: [{ frequency: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        frequency: true,
        dueTime: true,
        weekday: true,
        dayOfMonth: true,
        location: { select: { name: true } },
      },
    }),
  ])

  // One query for every current-period completion, rather than N.
  const keys = [...new Set(items.map((i) => periodKey(i.frequency)))]
  const completions = await prisma.checklistCompletion.findMany({
    where: { itemId: { in: items.map((i) => i.id) }, periodKey: { in: keys } },
    select: { itemId: true, periodKey: true, completedBy: { select: { name: true } } },
  })
  const doneMap = new Map(completions.map((c) => [`${c.itemId}:${c.periodKey}`, c.completedBy?.name ?? null]))

  const now = new Date()

  const taskRows: TaskRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    dueLabel: t.dueAt ? fmtDue(t.dueAt) : null,
    overdue: Boolean(t.dueAt && t.dueAt < now),
    location: t.location?.name ?? null,
    // Only say who it's for when it isn't you (i.e. an unassigned shared task).
    assignedTo: t.assignedToId && t.assignedToId !== me!.id ? t.assignedTo?.name ?? null : null,
    done: t.status === 'DONE',
  }))

  const checklistRows: ChecklistRow[] = items.map((i) => {
    const key = periodKey(i.frequency)
    const mapKey = `${i.id}:${key}`
    const done = doneMap.has(mapKey)
    return {
      id: i.id,
      title: i.title,
      description: i.description,
      frequency: i.frequency,
      periodLabel: periodLabel(i.frequency),
      dueTime: i.dueTime,
      location: i.location?.name ?? null,
      done,
      overdue: !done && isOverdue(i, now),
      doneBy: doneMap.get(mapKey) ?? null,
    }
  })

  const outstanding =
    taskRows.filter((t) => !t.done).length + checklistRows.filter((c) => !c.done).length

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Staff only</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Tasks &amp; checklists</h1>
        <p className="mt-2 text-neutral-500">
          {outstanding === 0
            ? 'Everything is done. Great work.'
            : `${outstanding} thing${outstanding === 1 ? '' : 's'} still to do.`}
        </p>

        {canAssign && (
          <div className="mt-8">
            <CreateTask
              staff={assignable.map((a) => ({ id: a.id, name: a.name ?? a.email }))}
              locations={locations}
            />
          </div>
        )}

        <div className="mt-8">
          <TaskList tasks={taskRows} checklist={checklistRows} />
        </div>
      </div>
    </div>
  )
}
