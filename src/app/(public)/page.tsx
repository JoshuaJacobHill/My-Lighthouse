import Link from 'next/link'
import {
  Heart,
  Package,
  Truck,
  Users,
  MapPin,
  CheckCircle,
  Clock,
  ShoppingCart,
  Wrench,
  CalendarDays,
  Sparkles,
  ArrowRight,
  Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Volunteer with Lighthouse Care',
  description:
    'Join the Lighthouse Care volunteer family and help us provide affordable food to families across South East Queensland.',
}

const roleCards = [
  {
    icon: Package,
    title: 'Packing Orders',
    description: 'Help pack grocery orders for families in need — making sure every bag is filled with care.',
  },
  {
    icon: Store,
    title: 'Grocery Store',
    description: 'Serve shoppers in our not-for-profit stores at Loganholme and Hillcrest with a friendly face.',
  },
  {
    icon: Truck,
    title: 'Deliveries',
    description: 'Deliver groceries and food relief directly to families who can\'t make it to the store.',
  },
  {
    icon: CalendarDays,
    title: 'Events',
    description: 'Help run community events and outreach activities that bring people together.',
  },
  {
    icon: Wrench,
    title: 'Admin',
    description: 'Support the team with administration, data entry, communications, and coordination.',
  },
  {
    icon: Sparkles,
    title: 'Cleaning',
    description: 'Keep our stores and warehouse clean and welcoming for volunteers and shoppers alike.',
  },
]

const stats = [
  { value: '750,000+', label: 'People served each year' },
  { value: '2', label: 'Not-for-profit store locations' },
  { value: '20+', label: 'Years of service' },
  { value: '100%', label: 'Self-funded' },
]

const steps = [
  {
    number: '1',
    title: 'Fill in your details',
    description:
      'Tell us a bit about yourself — your contact details, availability, and where you\'d like to volunteer.',
  },
  {
    number: '2',
    title: 'Complete your online induction',
    description:
      'Once you\'ve signed up, you\'ll complete a short online induction so you\'re ready to hit the ground running.',
  },
  {
    number: '3',
    title: 'Start making a difference',
    description:
      'You\'ll be rostered for shifts and welcomed into our amazing volunteer family. Every shift you do directly helps families across South East Queensland.',
  },
]

const locations = [
  {
    name: 'Loganholme Store',
    icon: Store,
    description:
      'Our Loganholme store serves the local community with affordable groceries and a warm, welcoming environment.',
    suburb: 'Loganholme, QLD',
  },
  {
    name: 'Hillcrest Store',
    icon: Store,
    description:
      'The Hillcrest store brings affordable food and dignified shopping to families in the Hillcrest area.',
    suburb: 'Hillcrest, QLD',
  },
]

// NOTE: app/page.tsx takes priority over this file for the "/" route.
// This component is kept for reference but is not rendered at "/".
// Routes /signup, /privacy, /terms in this group all use (public)/layout.tsx.
export default function PublicHomePage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-orange-500 to-orange-700 py-24 px-4 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-orange-100">
            <Heart className="h-4 w-4" aria-hidden="true" />
            Volunteers needed across South East Queensland
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Make a Difference<br className="hidden sm:block" /> in Logan
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-orange-100 sm:text-xl">
            Join the Lighthouse Care volunteer family and help us provide affordable food to families across South East Queensland.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/volunteer/apply">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 focus-visible:ring-white w-full sm:w-auto">
                Sign Up to Volunteer
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                className="border border-white/40 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white w-full sm:w-auto"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Impact stats ──────────────────────────────────────────────────────── */}
      <section className="bg-orange-600 py-10 px-4">
        <div className="mx-auto max-w-5xl">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <dt className="text-3xl font-bold text-white sm:text-4xl">{value}</dt>
                <dd className="mt-1 text-sm text-orange-200">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">About Lighthouse Care</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Founded in 2004 by Debbie and Ron Hill, Lighthouse Care has been quietly and practically
                changing lives across South East Queensland for over two decades.
              </p>
              <p className="mt-3 text-gray-600 leading-relaxed">
                We operate two not-for-profit grocery stores — in <strong className="text-gray-800">Loganholme</strong> and{' '}
                <strong className="text-gray-800">Hillcrest</strong> — plus an online store with home delivery.
                Every dollar spent in our stores directly funds free food relief for families in crisis.
              </p>
              <p className="mt-3 text-gray-600 leading-relaxed">
                We are completely self-funded with no recurring government grants. Our volunteers are the
                heartbeat of what we do — and we couldn&apos;t serve over 750,000 people each year without them.
              </p>
              <div className="mt-6 flex flex-col gap-2 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-orange-500 shrink-0" aria-hidden="true" />
                  ACNC Registered Charity
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-orange-500 shrink-0" aria-hidden="true" />
                  ABN 87 637 110 948
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-500 shrink-0" aria-hidden="true" />
                  Logan, South East Queensland
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-orange-50 p-8 border border-orange-100">
              <blockquote className="text-lg font-medium text-orange-700 leading-relaxed italic">
                &ldquo;Making lives better so that together we can make the world better.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-orange-500 font-medium">— Our mission</p>
              <div className="mt-6 border-t border-orange-200 pt-6 text-sm text-orange-600">
                <p>
                  Our culture is built on <strong>People, Empowering, Generosity, Integrity, Hope,</strong> and{' '}
                  <strong>Collaboration</strong> — and that spirit flows through everything our volunteers do.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you can do ───────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">What You Can Do</h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-600">
              There&apos;s a role to suit everyone. Whether you&apos;re a people person, a logistics whiz, or just
              want to roll up your sleeves and get stuck in — we&apos;d love to have you.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {roleCards.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-600">
              Getting started as a Lighthouse Care volunteer is straightforward. Here&apos;s how:
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map(({ number, title, description }) => (
              <div key={number} className="relative text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-xl font-bold text-white shadow-md">
                  {number}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/signup">
              <Button size="lg">
                Get Started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Locations ─────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Where We Operate</h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-600">
              We have volunteer opportunities across multiple locations in Logan and South East Queensland.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map(({ name, icon: Icon, description, suburb }) => (
              <div
                key={name}
                className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-gray-900">{name}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-orange-500 font-medium">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {suburb}
                </p>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-orange-500 to-orange-700 py-20 px-4 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-orange-200" aria-hidden="true" />
          <h2 className="text-3xl font-bold">Ready to join our volunteer family?</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-orange-100 leading-relaxed">
            It only takes a few minutes to sign up. Your time and energy can make a real, practical difference
            to families doing it tough across South East Queensland.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/volunteer/apply">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 focus-visible:ring-white w-full sm:w-auto">
                Sign Up to Volunteer
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                className="border border-white/40 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white w-full sm:w-auto"
              >
                Already registered? Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
