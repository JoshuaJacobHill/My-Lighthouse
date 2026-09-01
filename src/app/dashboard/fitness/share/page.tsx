import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isAdminRole } from '@/lib/permissions-core'
import { getCurrentChallenge } from '@/lib/fitness-data'
import { decodeDraft } from '@/lib/step-draft'
import { ConfirmShared } from './ConfirmShared'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Confirm your steps' }

/** Where a shared screenshot lands once it has been read. */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isStaff: true, isTrainee: true, role: true },
  })
  if (!me || !(me.isStaff || me.isTrainee || isAdminRole(me.role))) notFound()

  const params = await searchParams
  const flat = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string') flat.set(k, v)

  const challenge = await getCurrentChallenge()
  const draft = decodeDraft(session.userId, flat)
  const error = flat.get('error')

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-lg px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard/fitness"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the challenge
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Confirm your steps</h1>

        <div className="mt-5">
          {!challenge ? (
            <p className="rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-600">
              No challenge is running at the moment.
            </p>
          ) : error || !draft ? (
            <div className="rounded-[28px] border border-neutral-200 p-6">
              <p className="inline-flex items-start gap-2 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error ?? 'That link has expired. Please share the screenshot again.'}
              </p>
              <Link
                href="/dashboard/fitness"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-neutral-950 px-6 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
              >
                Back to the challenge
              </Link>
            </div>
          ) : (
            <ConfirmShared
              challengeId={challenge.id}
              steps={draft.steps}
              day={draft.day}
              assumed={draft.assumed}
            />
          )}
        </div>
      </div>
    </div>
  )
}
