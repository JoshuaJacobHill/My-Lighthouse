import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canOpenSlhOrg, slhOrg } from '@/lib/slh'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add a family', robots: { index: false } }

const field = 'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base'
const label = 'block text-[13px] font-bold'

/**
 * Nominating a family.
 *
 * The guardian's details stay with the organisation and Lighthouse; a shopper
 * never sees them. They are captured because both need them — to chase a list
 * that is half filled, and to ring a family directly when the organisation has
 * gone quiet.
 *
 * Consent is recorded rather than assumed. We will email this family, and
 * sometimes phone them, and "the organisation said it was fine" is not the same
 * as knowing when and who said so.
 *
 * Nothing saves. There is no schema yet — this is the shape of the form, not
 * the form.
 */
export default async function AddFamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  if (!(await canOpenSlhOrg(id))) notFound()
  const org = await slhOrg(id)
  if (!org) notFound()

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href={`/dashboard/slh/org/${org.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {org.name}
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Add a family</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          The guardian&rsquo;s details stay with you and Lighthouse. A shopper never sees them.
        </p>

        <div className="mt-7 grid gap-5">
          <div>
            <label className={label} htmlFor="guardian">
              Parent or guardian
            </label>
            <input id="guardian" className={`${field} mt-1.5`} placeholder="Leila M." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="phone">
                Phone
              </label>
              <input id="phone" inputMode="tel" className={`${field} mt-1.5`} placeholder="0412 884 221" />
            </div>
            <div>
              <label className={label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                inputMode="email"
                className={`${field} mt-1.5`}
                placeholder="leila.m@example.com"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-green-600 text-white">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <p className="text-sm leading-relaxed">
              This family knows they have been nominated and is happy for Lighthouse to contact
              them
            </p>
          </div>
        </div>

        <hr className="my-7 border-neutral-100" />

        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold tracking-tight">Their children</h2>
          <button
            type="button"
            className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-bold hover:bg-neutral-50"
          >
            Add another
          </button>
        </div>

        <div className="mt-4 grid gap-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div>
              <label className={label} htmlFor="child">
                First name only
              </label>
              <input id="child" className={`${field} mt-1.5`} placeholder="Amira" />
            </div>
            <div>
              <label className={label} htmlFor="age">
                Age
              </label>
              <input id="age" inputMode="numeric" className={`${field} mt-1.5`} placeholder="7" />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="dob">
              Date of birth
            </label>
            <input id="dob" type="date" className={`${field} mt-1.5`} />
            <p className="mt-1.5 text-xs text-neutral-400">
              Used to spot the same child nominated twice by two organisations. A shopper only ever
              sees an age.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="clothes">
                Clothing size
              </label>
              <input id="clothes" className={`${field} mt-1.5`} placeholder="Size 7" />
            </div>
            <div>
              <label className={label} htmlFor="shoes">
                Shoe size
              </label>
              <input id="shoes" className={`${field} mt-1.5`} placeholder="Size 12" />
            </div>
          </div>
        </div>

        <div className="mt-7 rounded-[28px] bg-neutral-50 p-5">
          <b className="text-sm">Would the family rather fill it in themselves?</b>
          <p className="mt-1.5 text-sm text-neutral-500">
            One link for the whole family — a few questions per child, on a phone, and it comes back
            here. No account, no password.
          </p>
        </div>

        <div className="mt-7 grid gap-3">
          <button
            type="button"
            disabled
            className="rounded-full bg-[#c8102e] py-3.5 text-base font-bold text-white opacity-40"
          >
            Save this family
          </button>
          <p className="text-center text-xs text-neutral-400">
            Preview — nothing saves until the program has a schema.
          </p>
        </div>

        <hr className="my-7 border-neutral-100" />

        <b className="text-sm">No parent or guardian?</b>
        <p className="mt-1.5 text-sm text-neutral-500">
          For a child in residential or kinship care. They are nominated on their own and your team
          fills in the list.
        </p>
      </div>
    </div>
  )
}
