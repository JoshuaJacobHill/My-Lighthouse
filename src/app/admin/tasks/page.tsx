import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { TasksAdmin } from './TasksAdmin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tasks & Checklists | Lighthouse Care Admin' }

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

export default async function AdminTasksPage() {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) redirect('/login')

  const [tasks, items, staff, locations] = await Promise.all([
    prisma.staffTask.findMany({
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 80,
      select: {
        id: true, title: true, status: true, priority: true, dueAt: true,
        assignedTo: { select: { name: true, email: true } },
      },
    }),
    prisma.checklistItem.findMany({
      orderBy: [{ frequency: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
      select: {
        id: true, title: true, description: true, frequency: true, dueTime: true,
        weekday: true, dayOfMonth: true, isActive: true, locationId: true,
        location: { select: { name: true } },
      },
    }),
    // Staff and trainees are the people you can assign work to.
    prisma.user.findMany({
      where: { OR: [{ isStaff: true }, { isTrainee: true }], isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, isTrainee: true },
    }),
    prisma.location.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
  ])

  const now = new Date()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tasks &amp; checklists</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Assign one-off jobs to staff and trainees, and set the recurring cleaning &amp; maintenance list.
        </p>
      </div>

      {staff.length === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nobody is marked as staff or trainee yet — set that on a user&rsquo;s page first, then you can assign tasks to them.
        </p>
      )}

      <TasksAdmin
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assignedTo: t.assignedTo?.name ?? t.assignedTo?.email ?? null,
          dueLabel: t.dueAt ? fmtDue(t.dueAt) : null,
          overdue: Boolean(t.dueAt && t.dueAt < now),
        }))}
        items={items.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          frequency: i.frequency,
          dueTime: i.dueTime,
          weekday: i.weekday,
          dayOfMonth: i.dayOfMonth,
          isActive: i.isActive,
          locationId: i.locationId,
          location: i.location?.name ?? null,
        }))}
        staff={staff.map((s) => ({
          id: s.id,
          label: `${s.name ?? s.email}${s.isTrainee ? ' (trainee)' : ''}`,
        }))}
        locations={locations}
      />
    </div>
  )
}
