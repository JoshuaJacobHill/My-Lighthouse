'use server'

import { z } from 'zod'
import prisma from '@/lib/prisma'

const schema = z.object({
  token: z.string().min(1),
  comment: z.string().trim().min(1).max(1000),
})

/**
 * Attach an optional comment to a shift rating. Authorised by the emailed token
 * alone — the volunteer isn't asked to log in, and the token is unguessable.
 */
export async function addFeedbackCommentAction(
  input: z.input<typeof schema>
): Promise<{ success: boolean }> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false }
  try {
    const fb = await prisma.shiftFeedback.findUnique({
      where: { token: parsed.data.token },
      select: { id: true },
    })
    if (!fb) return { success: false }
    await prisma.shiftFeedback.update({
      where: { id: fb.id },
      data: { comment: parsed.data.comment },
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}
