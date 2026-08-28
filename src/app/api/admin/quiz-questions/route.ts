import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasCapability } from '@/lib/permissions'

async function requireAdmin() {
  const session = await getSession()
  if (!session || !(await hasCapability('system.settings'))) {
    return null
  }
  return session
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const { question, sortOrder, isActive, options } = body

  if (!question) {
    return NextResponse.json({ error: 'Question text is required.' }, { status: 400 })
  }

  const created = await prisma.inductionQuizQuestion.create({
    data: {
      question,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
      options: options
        ? {
            create: options.map(
              (o: { optionText: string; isCorrect: boolean; sortOrder?: number }) => ({
                optionText: o.optionText,
                isCorrect: o.isCorrect ?? false,
                sortOrder: o.sortOrder ?? 0,
              })
            ),
          }
        : undefined,
    },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  })

  return NextResponse.json({ success: true, question: created })
}
