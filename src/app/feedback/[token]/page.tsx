import Image from 'next/image'
import { Heart } from 'lucide-react'
import prisma from '@/lib/prisma'
import { CommentBox } from './CommentBox'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Thanks for your feedback', robots: { index: false } }

/**
 * One-tap rating landing page. The star links in the email hit this with
 * ?stars=N; we record it on first visit and then offer an optional comment.
 */
export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ stars?: string }>
}) {
  const { token } = await params
  const { stars } = await searchParams

  const fb = await prisma.shiftFeedback.findUnique({
    where: { token },
    select: { id: true, rating: true, volunteer: { select: { firstName: true } } },
  })

  let rating = fb?.rating ?? null
  if (fb && stars) {
    const n = Number(stars)
    if (Number.isInteger(n) && n >= 1 && n <= 5) {
      await prisma.shiftFeedback.update({
        where: { id: fb.id },
        data: { rating: n, ratedAt: new Date() },
      })
      rating = n
    }
  }

  const firstName = fb?.volunteer.firstName ?? 'there'

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/logo-inline-black.png" alt="Lighthouse Care" width={180} height={48} className="h-9 w-auto" />
        </div>
        <div className="rounded-[28px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          {!fb ? (
            <>
              <Heart className="mx-auto h-8 w-8 text-orange-400" />
              <h1 className="mt-3 text-xl font-bold text-neutral-900">This link isn&rsquo;t valid</h1>
              <p className="mt-2 text-sm text-neutral-600">
                It may have already been used. Thank you for volunteering with us either way.
              </p>
            </>
          ) : (
            <>
              <p className="text-4xl" aria-hidden="true">
                {rating && rating >= 4 ? '🎉' : '💛'}
              </p>
              <h1 className="mt-3 text-2xl font-bold text-neutral-900">Thanks, {firstName}!</h1>
              {rating ? (
                <>
                  <p className="mt-2 text-sm text-neutral-600">
                    You rated today{' '}
                    <strong className="text-neutral-900">
                      {rating} star{rating > 1 ? 's' : ''}
                    </strong>
                    . We&rsquo;ve passed it on to your coordinator.
                  </p>
                  <p className="mt-4 text-2xl tracking-widest text-amber-500" aria-hidden="true">
                    {'★'.repeat(rating)}
                    <span className="text-neutral-200">{'★'.repeat(5 - rating)}</span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-neutral-600">Thanks for giving your time today.</p>
              )}
              <div className="mt-6 text-left">
                <CommentBox token={token} />
              </div>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-neutral-400">
          Lighthouse Care — making lives better so that together we can make the world better.
        </p>
      </div>
    </main>
  )
}
