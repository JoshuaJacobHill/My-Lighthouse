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
  const { title, content, sortOrder, isRequired, isActive } = body

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 })
  }

  const section = await prisma.inductionSection.create({
    data: {
      title,
      content,
      sortOrder: sortOrder ?? 0,
      isRequired: isRequired ?? true,
      isActive: isActive ?? true,
    },
  })

  return NextResponse.json({ success: true, section })
}
