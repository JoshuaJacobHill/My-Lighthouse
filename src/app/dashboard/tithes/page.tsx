import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, Church } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { listMyTithes } from '@/lib/actions/tithe.actions'
import { TitheManager } from '@/components/donor/TitheManager'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My tithes' }

export default async function TithesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const tithes = await listMyTithes()

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">My tithes</h1>
      <p className="mt-1.5 text-gray-500">Your regular giving to Lighthouse Family Church.</p>

      {tithes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Church className="mx-auto h-8 w-8 text-orange-400" />
          <p className="mt-3 text-gray-600">You don’t have a regular tithe set up.</p>
          <Link
            href="/give/tithe"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Set up my tithe <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-3">
            {tithes.map((t) => (
              <TitheManager key={t.id} tithe={t} />
            ))}
          </div>
          <Link
            href="/give/tithe"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            Give a one-off tithe <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  )
}
