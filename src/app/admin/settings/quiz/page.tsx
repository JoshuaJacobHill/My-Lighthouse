import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import QuizManager from './QuizManager'
import { isAdminRole } from '@/lib/permissions-core'
import { requireCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireCapability('system.settings')
  const session = await getSession()
  if (!session || !isAdminRole(session.role)) redirect('/login')

  const questions = await prisma.inductionQuizQuestion.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quiz Questions</h1>
        <p className="text-gray-600 mt-1">Volunteers answer these questions at the end of their induction.</p>
      </div>
      <QuizManager questions={questions} />
    </div>
  )
}
