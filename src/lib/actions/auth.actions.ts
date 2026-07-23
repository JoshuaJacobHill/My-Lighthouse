'use server'

import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import {
  hashPassword,
  comparePassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
} from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { renderTemplate } from '@/lib/email-templates'
import { loginSchema, volunteerSignupSchema } from '@/lib/validations'

// ─── ICS Calendar helper ──────────────────────────────────────────────────────

/**
 * Format a "HH:MM" 24-hour time string into a human-readable label.
 * e.g. "09:00" → "9:00 AM", "13:30" → "1:30 PM"
 */
function formatTimeLabel(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mPadded = String(m).padStart(2, '0')
  return `${h12}:${mPadded} ${ampm}`
}

function generateICS(opts: {
  summary: string
  description: string
  date: string
  /** "HH:MM" 24-hour arrival time — event runs for 1 hour from this time */
  startTime: string
  location: string
  organizerEmail: string
}): string {
  const [year, month, day] = opts.date.split('-')
  const [hStr, mStr] = opts.startTime.split(':')
  const startHour = parseInt(hStr, 10)
  const startMinute = parseInt(mStr, 10)
  // 1-hour appointment block
  const endHour = startMinute === 0 ? startHour + 1 : startHour
  const endMinute = startMinute === 0 ? 0 : startMinute

  const pad = (n: number) => String(n).padStart(2, '0')
  // Store as AEST (UTC+10) — QLD never observes daylight saving
  const dtStart = `${year}${month}${day}T${pad(startHour)}${pad(startMinute)}00`
  const dtEnd = `${year}${month}${day}T${pad(endHour)}${pad(endMinute)}00`
  const tzid = 'Australia/Brisbane'
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lighthouse Care Volunteers//EN',
    'METHOD:REQUEST',
    'BEGIN:VTIMEZONE',
    `TZID:${tzid}`,
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+1000',
    'TZOFFSETTO:+1000',
    'TZNAME:AEST',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${now}-volunteer@lighthousecare.org.au`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${tzid}:${dtStart}`,
    `DTEND;TZID=${tzid}:${dtEnd}`,
    `SUMMARY:${opts.summary}`,
    `DESCRIPTION:${opts.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${opts.location}`,
    `ORGANIZER:mailto:${opts.organizerEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData): Promise<{
  success: boolean
  error?: string
  redirectTo?: string
}> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return { success: false, error: firstError }
  }

  const { email, password } = parsed.data

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        volunteerProfile: { select: { id: true, status: true } },
      },
    })

    if (!user || !user.passwordHash) {
      return { success: false, error: 'Invalid email or password' }
    }

    if (!user.isActive) {
      return { success: false, error: 'Your account has been deactivated. Please contact us for assistance.' }
    }

    const passwordValid = await comparePassword(password, user.passwordHash)
    if (!passwordValid) {
      return { success: false, error: 'Invalid email or password' }
    }

    // Create session and set cookie
    const token = await createSession(user.id)
    await setSessionCookie(token)

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Determine redirect destination based on role
    let redirectTo = '/volunteer'
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      redirectTo = '/admin'
    } else if (user.role === 'KIOSK') {
      redirectTo = '/kiosk'
    } else if (!user.volunteerProfile) {
      // Donor-only account (no volunteer profile) → the giving dashboard.
      redirectTo = '/donor'
    }

    return { success: true, redirectTo }
  } catch (err) {
    console.error('[loginAction]', err)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await destroySession()
  await clearSessionCookie()
  redirect('/login')
}

// ─── Volunteer registration ───────────────────────────────────────────────────

export async function registerVolunteerAction(formData: FormData): Promise<{
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
}> {
  // Parse availability JSON if provided as a JSON string
  let availabilityRaw: unknown[] = []
  const availabilityStr = formData.get('availability') as string | null
  if (availabilityStr) {
    try {
      availabilityRaw = JSON.parse(availabilityStr)
    } catch {
      availabilityRaw = []
    }
  }

  // Parse array fields that may be submitted as comma-separated or JSON
  function parseArrayField(key: string): string[] {
    const val = formData.get(key)
    if (!val) return []
    try {
      const parsed = JSON.parse(val as string)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return (val as string).split(',').map((s) => s.trim()).filter(Boolean)
    }
  }

  const raw = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    mobile: formData.get('mobile') as string,
    dateOfBirth: (formData.get('dateOfBirth') as string) || undefined,
    addressLine1: (formData.get('addressLine1') as string) || undefined,
    addressLine2: (formData.get('addressLine2') as string) || undefined,
    suburb: (formData.get('suburb') as string) || undefined,
    state: (formData.get('state') as string) || undefined,
    postcode: (formData.get('postcode') as string) || undefined,
    emergencyName: formData.get('emergencyName') as string,
    emergencyPhone: formData.get('emergencyPhone') as string,
    emergencyRelation: (formData.get('emergencyRelation') as string) || undefined,
    preferredLocations: parseArrayField('preferredLocations'),
    areasOfInterest: parseArrayField('areasOfInterest'),
    availability: availabilityRaw,
    medicalNotes: (formData.get('medicalNotes') as string) || undefined,
    accessibilityNeeds: (formData.get('accessibilityNeeds') as string) || undefined,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
    agreedToTerms: formData.get('agreedToTerms') === 'true' || formData.get('agreedToTerms') === 'on',
    agreedToPrivacy: formData.get('agreedToPrivacy') === 'true' || formData.get('agreedToPrivacy') === 'on',
    consentEmailUpdates: formData.get('consentEmailUpdates') === 'true' || formData.get('consentEmailUpdates') === 'on',
    consentSmsUpdates: formData.get('consentSmsUpdates') === 'true' || formData.get('consentSmsUpdates') === 'on',
  }

  const parsed = volunteerSignupSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString()
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { success: false, error: 'Please fix the errors below', fieldErrors }
  }

  const data = parsed.data

  try {
    // Check for existing email
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })
    if (existing) {
      return {
        success: false,
        error: 'An account with this email address already exists.',
        fieldErrors: { email: 'This email address is already registered.' },
      }
    }

    const passwordHash = await hashPassword(data.password)

    // Create user + volunteer profile in a transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          name: `${data.firstName} ${data.lastName}`,
          role: 'VOLUNTEER',
          volunteerProfile: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email.toLowerCase(),
              mobile: data.mobile,
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
              addressLine1: data.addressLine1 ?? null,
              addressLine2: data.addressLine2 ?? null,
              suburb: data.suburb ?? null,
              state: data.state ?? null,
              postcode: data.postcode ?? null,
              emergencyName: data.emergencyName,
              emergencyPhone: data.emergencyPhone,
              emergencyRelation: data.emergencyRelation ?? null,
              preferredLocations: data.preferredLocations ?? [],
              areasOfInterest: data.areasOfInterest ?? [],
              medicalNotes: data.medicalNotes ?? null,
              accessibilityNeeds: data.accessibilityNeeds ?? null,
              agreedToTerms: data.agreedToTerms,
              agreedToPrivacy: data.agreedToPrivacy,
              consentEmailUpdates: data.consentEmailUpdates ?? false,
              consentSmsUpdates: data.consentSmsUpdates ?? false,
              agreedAt: new Date(),
              status: 'PENDING_INDUCTION',
              availability: {
                create: (data.availability ?? []).map((a: { dayOfWeek: string; startTime: string; endTime: string }) => ({
                  dayOfWeek: a.dayOfWeek.toUpperCase().replace(/\s+/g, '_') as never,
                  startTime: a.startTime,
                  endTime: a.endTime,
                  timePeriod: (a.startTime < '09:00' ? 'PRE_OPEN' : a.startTime < '12:30' ? 'MORNING' : 'AFTERNOON') as never,
                })),
              },
            },
          },
        },
      })
      return newUser
    })

    // Send confirmation email — fire and forget, don't block registration
    try {
      const preferredStore = formData.get('preferredStore') as string | null
      const firstVisitDate = formData.get('firstVisitDate') as string | null
      // firstVisitPeriod is now a "HH:MM" 24-hour time string (e.g. "09:00")
      const firstVisitPeriod = formData.get('firstVisitPeriod') as string | null

      const storeName = preferredStore ?? 'Loganholme'

      // Format date as DD/MM/YYYY for email display
      const visitDateFormatted = firstVisitDate
        ? (() => {
            const [y, m, d] = firstVisitDate.split('-')
            return `${d}/${m}/${y}`
          })()
        : 'Not specified'

      // Format time as "9:00 AM" for email display
      const visitTimeFormatted = firstVisitPeriod
        ? formatTimeLabel(firstVisitPeriod)
        : 'Not specified'

      // Generate .ics calendar invite if we have a date and time
      let icsAttachment: { filename: string; content: string; contentType: string } | undefined
      if (firstVisitDate && firstVisitPeriod) {
        // Load coordinator email for ORGANIZER field
        let coordinatorEmailForIcs = 'rochelle@lighthousecare.org.au'
        try {
          const settingRows = await prisma.appSetting.findMany({
            where: { key: { in: ['loganholme_coordinator_email', 'hillcrest_coordinator_email'] } },
          })
          const s = Object.fromEntries(settingRows.map((r) => [r.key, r.value]))
          coordinatorEmailForIcs =
            preferredStore === 'Hillcrest'
              ? (s.hillcrest_coordinator_email ?? 'georgina@lighthousecare.org.au')
              : (s.loganholme_coordinator_email ?? 'rochelle@lighthousecare.org.au')
        } catch { /* fall through */ }

        const icsContent = generateICS({
          summary: `Volunteer First Visit — ${storeName} Lighthouse Care`,
          description: [
            `Welcome to Lighthouse Care Volunteers, ${data.firstName}!`,
            `Your coordinator will meet you at the ${storeName} store.`,
            ``,
            `Volunteer: ${data.firstName} ${data.lastName}`,
            `Email: ${data.email}`,
            `Mobile: ${data.mobile}`,
          ].join('\n'),
          date: firstVisitDate,
          startTime: firstVisitPeriod,
          location: `Lighthouse Care ${storeName} Store`,
          organizerEmail: coordinatorEmailForIcs,
        })
        icsAttachment = {
          filename: 'first-visit.ics',
          content: icsContent,
          contentType: 'text/calendar',
        }
      }

      // ── Volunteer confirmation email ────────────────────────────────────────
      const template = await renderTemplate('SIGNUP_CONFIRMATION', {
        first_name: data.firstName,
        last_name: data.lastName,
        portal_link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/volunteer`,
        shift_date: visitDateFormatted,
        shift_time: visitTimeFormatted,
        location: storeName,
      })

      await sendEmail({
        to: data.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        templateType: 'SIGNUP_CONFIRMATION',
        volunteerId: user.volunteerProfile?.id,
        attachments: icsAttachment ? [icsAttachment] : undefined,
      })

      // ── Coordinator notification email ─────────────────────────────────────
      // Load coordinator emails from AppSettings (with hardcoded fallbacks)
      let coordinatorSettings: Record<string, string> = {}
      try {
        const settingRows = await prisma.appSetting.findMany({
          where: { key: { in: ['loganholme_coordinator_email', 'hillcrest_coordinator_email'] } },
        })
        coordinatorSettings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]))
      } catch {
        // fall through to defaults
      }

      const loganholmeEmail =
        coordinatorSettings.loganholme_coordinator_email ?? 'rochelle@lighthousecare.org.au'
      const hillcrestEmail =
        coordinatorSettings.hillcrest_coordinator_email ?? 'georgina@lighthousecare.org.au'

      const coordinatorEmail =
        preferredStore === 'Hillcrest' ? hillcrestEmail : loganholmeEmail

      const coordinatorSubject = `New Volunteer: ${data.firstName} ${data.lastName} — First Visit ${visitDateFormatted}`

      const coordinatorHtml = `
<html><body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #f97316;">New Volunteer Registration — Lighthouse Care</h2>
  <p>A new volunteer has registered and selected their preferred first visit appointment.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 8px 12px; background: #f9fafb; font-weight: bold; width: 40%;">Name</td>
      <td style="padding: 8px 12px;">${data.firstName} ${data.lastName}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f9fafb; font-weight: bold;">Email</td>
      <td style="padding: 8px 12px;">${data.email}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f9fafb; font-weight: bold;">Mobile</td>
      <td style="padding: 8px 12px;">${data.mobile}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f9fafb; font-weight: bold;">Preferred Store</td>
      <td style="padding: 8px 12px;">${storeName}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f9fafb; font-weight: bold;">First Visit Date</td>
      <td style="padding: 8px 12px;">${visitDateFormatted}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f9fafb; font-weight: bold;">Arrival Time</td>
      <td style="padding: 8px 12px;">${visitTimeFormatted}</td>
    </tr>
  </table>
  <p style="color: #6b7280; font-size: 14px;">A calendar invite is attached. Please reach out to welcome this volunteer and confirm their visit.</p>
  <p style="color: #6b7280; font-size: 12px;">— Lighthouse Care Volunteer System</p>
</body></html>`

      const coordinatorText = [
        'New Volunteer Registration — Lighthouse Care',
        '',
        `Name: ${data.firstName} ${data.lastName}`,
        `Email: ${data.email}`,
        `Mobile: ${data.mobile}`,
        `Preferred Store: ${storeName}`,
        `First Visit Date: ${visitDateFormatted}`,
        `Arrival Time: ${visitTimeFormatted}`,
        '',
        'A calendar invite is attached. Please reach out to welcome this volunteer and confirm their visit.',
      ].join('\n')

      await sendEmail({
        to: coordinatorEmail,
        subject: coordinatorSubject,
        html: coordinatorHtml,
        text: coordinatorText,
        attachments: icsAttachment ? [icsAttachment] : undefined,
        ccAdmin: true,
      })
    } catch (emailErr) {
      console.error('[registerVolunteerAction] email error:', emailErr)
    }

    return { success: true }
  } catch (err) {
    console.error('[registerVolunteerAction]', err)
    return { success: false, error: 'Registration failed. Please try again.' }
  }
}
