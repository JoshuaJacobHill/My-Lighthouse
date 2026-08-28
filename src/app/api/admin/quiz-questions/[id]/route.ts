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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { question, sortOrder, isActive, options } = body

  try {
    // Update the question fields
    await prisma.inductionQuizQuestion.update({
      where: { id },
      data: {
        ...(question !== undefined && { question }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    // If options are provided, replace them all
    if (options !== undefined) {
      await prisma.inductionQuizOption.deleteMany({ where: { questionId: id } })
      if (options.length > 0) {
        await prisma.inductionQuizOption.createMany({
          data: options.map(
            (o: { optionText: string; isCorrect: boolean; sortOrder?: number }) => ({
              questionId: id,
              optionText: o.optionText,
              isCorrect: o.isCorrect ?? false,
              sortOrder: o.sortOrder ?? 0,
            })
          ),
        })
      }
    }

    const updated = await prisma.inductionQuizQuestion.findUniqueOrThrow({
      where: { id },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    })

    return NextResponse.json({ success: true, question: updated })
  } catch {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.inductionQuizQuestion.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  }
}
