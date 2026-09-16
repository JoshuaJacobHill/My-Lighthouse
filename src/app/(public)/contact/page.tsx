import Link from 'next/link'
import type { Metadata } from 'next'
import { ContactForm } from './ContactForm'

export const metadata: Metadata = {
  title: 'Contact us | Lighthouse Care',
  description:
    'Get in touch with Lighthouse Care about volunteering, partnerships, donations or our stores.',
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
        We&rsquo;d love to hear from you
      </p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Contact us</h1>
      <p className="mt-3 text-lg leading-relaxed text-neutral-600">
        Volunteering, partnerships, donations, or a question about one of the stores — send us a
        note and someone will come back to you.
      </p>

      <div className="mt-9">
        <ContactForm />
      </div>

      <div className="mt-12 border-t border-neutral-100 pt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">
          Already with us?
        </h2>
        <ul className="mt-3 space-y-1.5 text-neutral-600">
          <li>
            Volunteers can sign in at{' '}
            <Link href="/login" className="font-semibold text-orange-600 hover:underline">
              my.lighthousecare.org.au
            </Link>
          </li>
          <li>
            Businesses supporting us have a{' '}
            <Link href="/partners" className="font-semibold text-orange-600 hover:underline">
              partner profile
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
