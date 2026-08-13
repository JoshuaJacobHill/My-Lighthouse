import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  CalendarPlus,
  Clock,
  User,
  MessageSquare,
  AlertTriangle,
  Calendar,
  HeartHandshake,
  Users,
  Sparkles,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { companiesMatch } from '@/lib/corporate'
import { StatusBadge } from '@/components/volunteer/StatusBadge'
import { ServingTeams } from '@/components/donor/ServingTeams'
import { CorporateVolunteering } from '@/components/volunteer/CorporateVolunteering'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Volunteer — Lighthouse Care' }

const BRISBANE_TZ = 'Australia/Brisbane'
const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: BRISBANE_TZ })
const fmtTime = (d: Date) =>
  d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: BRISBANE_TZ })

const QUICK_ACTIONS = [
  { href: '/volunteer/roster', icon: CalendarPlus, label: 'Book a shift', description: 'Browse and book available shifts' },
  { href: '/volunteer/availability', icon: Clock, label: 'My availability', description: 'Let us know when you can help' },
  { href: '/volunteer/profile', icon: User, label: 'My profile', description: 'Keep your details up to date' },
  { href: '/volunteer/contact', icon: MessageSquare, label: 'Contact the team', description: 'Send us a message' },
]

export default async function VolunteerTabPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [user, corporate] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        isChurchMember: true,
        volunteerProfile: { select: { id: true, firstName: true, status: true } },
      },
    }),
    prisma.donation.findFirst({
      where: { userId: session.userId, donorCompany: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { donorCompany: true },
    }),
  ])
  if (!user) redirect('/login')

  const vp = user.volunteerProfile
  const isVolunteer = Boolean(vp)
  const firstName = vp?.firstName ?? user.name?.split(' ')[0] ?? 'there'
  const company = corporate?.donorCompany ?? null

  // Corporate volunteering history for this supporter's company (matched by name).
  const corpSessions = company
    ? (
        await prisma.corporateVolunteerSession.findMany({
          orderBy: { date: 'desc' },
          select: { id: true, companyName: true, date: true, timeLabel: true, teamSize: true, source: true },
        })
      )
        .filter((s) => companiesMatch(s.companyName, company))
        .map((s) => ({
          id: s.id,
          date: s.date ? s.date.toISOString() : null,
          timeLabel: s.timeLabel,
          teamSize: s.teamSize,
          source: s.source,
        }))
    : []

  // Church members can join serving teams (distinct from Care volunteering).
  const servingTeams = user.isChurchMember
    ? await prisma.servingTeam.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          interests: { where: { userId: session.userId }, select: { id: true } },
        },
      })
    : []
  const teamCards = servingTeams.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    joined: t.interests.length > 0,
  }))

  const upcoming = vp
    ? await prisma.shiftAssignment.findMany({
        where: {
          volunteerId: vp.id,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          shift: { date: { gte: new Date() } },
        },
        include: { shift: { include: { location: true } } },
        orderBy: { shift: { date: 'asc' } },
        take: 3,
      })
    : []

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        {/* Church serving teams — church members only */}
        {teamCards.length > 0 && (
          <section className="mb-12">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Serving at <span className="text-orange-600">Lighthouse Family Church</span>
            </h1>
            <p className="mt-1.5 text-neutral-500">
              Join a team and use your gifts — tap the ones you&rsquo;re interested in and our team will be in touch.
            </p>
            <div className="mt-6">
              <ServingTeams teams={teamCards} />
            </div>
            <div className="mt-10 border-t border-neutral-100 pt-8">
              <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                Lighthouse Care volunteering
              </p>
            </div>
          </section>
        )}

        {isVolunteer && vp ? (
          <>
            {/* ── Volunteer hub ── */}
            <header className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your volunteering</h1>
                <p className="mt-1 text-neutral-500">Welcome back, {firstName}.</p>
              </div>
              <StatusBadge status={vp.status} />
            </header>

            {vp.status === 'PENDING_INDUCTION' && (
              <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-[28px] bg-amber-50 p-6 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p className="font-semibold text-amber-900">Complete your induction to start booking shifts.</p>
                </div>
                <Link
                  href="/volunteer/induction"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Start induction <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            {/* Upcoming shifts */}
            <section className="mb-10">
              <div className="mb-4 flex items-end justify-between">
                <h2 className="text-xl font-bold tracking-tight">Upcoming shifts</h2>
                <Link href="/volunteer/shifts" className="text-sm font-semibold text-orange-600 hover:text-orange-700">
                  View all
                </Link>
              </div>
              {upcoming.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-neutral-300 p-8 text-center">
                  <Calendar className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
                  <p className="font-medium text-neutral-600">No shifts booked yet</p>
                  <Link
                    href="/volunteer/roster"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    Book a shift <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 rounded-2xl border border-neutral-200 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
                        <Calendar className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">{fmtDate(a.shift.date)}</p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                          {fmtTime(a.shift.startTime)} · {a.shift.location.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Quick actions */}
            <section>
              <h2 className="mb-4 text-xl font-bold tracking-tight">Quick actions</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {QUICK_ACTIONS.map(({ href, icon: Icon, label, description }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex items-center gap-4 rounded-2xl border border-neutral-200 p-5 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">{label}</p>
                      <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* ── Inspire to sign up ── */}
            <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-orange-500 to-orange-600 p-8 text-white sm:p-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" /> Join the team
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Give your time. Change a life.
              </h1>
              <p className="mt-3 max-w-lg text-orange-50">
                Our volunteers are the heart of Lighthouse Care — packing trolleys, welcoming families, and making sure
                no one in our community faces hard times alone.
              </p>
              <Link
                href="/signup"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3.5 text-base font-bold text-white transition-transform active:scale-[0.98]"
              >
                Sign up to volunteer <ArrowRight className="h-5 w-5" />
              </Link>
            </section>

            <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: Clock, title: 'Shifts that suit you', body: 'Choose when and where you help — set your own availability.' },
                { icon: HeartHandshake, title: 'Real, local impact', body: 'Directly support families doing it tough across South East Queensland.' },
                { icon: Users, title: 'A great community', body: 'Join a warm, welcoming team who genuinely love what they do.' },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-[28px] border border-neutral-200 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{body}</p>
                </div>
              ))}
            </section>
          </>
        )}

        {/* ── Corporate volunteering — shown to anyone who gave with a company ── */}
        {company && (
          <section className="mt-8">
            <CorporateVolunteering companyName={company} sessions={corpSessions} />
          </section>
        )}
      </div>
    </div>
  )
}
