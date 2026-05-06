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
                create: (data.availability ?? []).map((a) => ({
                  dayOfWeek: a.dayOfWeek.toUpperCase().replace(/\s+/g, '_') as never,
                  timePeriod: a.timePeriod.includes('Morning')
                    ? 'MORNING'
                    : a.timePeriod.includes('Afternoon')
                      ? 'AFTERNOON'
                      : 'EVENING',
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
      const template = await renderTemplate('SIGNUP_CONFIRMATION', {
        first_name: data.firstName,
        last_name: data.lastName,
        portal_link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/volunteer/dashboard`,
      })

      await sendEmail({
        to: data.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        templateType: 'SIGNUP_CONFIRMATION',
        volunteerId: user.volunteerProfile?.id,
      })

      // Notify admin of new volunteer — always send to main admin email
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
      if (adminEmail) {
        const adminTemplate = await renderTemplate('ADMIN_NEW_VOLUNTEER', {
          first_name: data.firstName,
          last_name: data.lastName,
          portal_link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/volunteers`,
        })
        await sendEmail({
          to: adminEmail,
          subject: adminTemplate.subject,
          html: adminTemplate.html,
          text: adminTemplate.text,
          templateType: 'ADMIN_NEW_VOLUNTEER',
        })

        // Also notify Hillcrest if that's their preferred store
        const preferredStore = formData.get('preferredStore') as string | null
        if (preferredStore === 'Hillcrest') {
          await sendEmail({
            to: 'hillcrest@lighthousecare.org.au',
            subject: adminTemplate.subject,
            html: adminTemplate.html,
            text: adminTemplate.text,
            templateType: 'ADMIN_NEW_VOLUNTEER',
          })
        }
      }
    } catch (emailErr) {
      console.error('[registerVolunteerAction] email error:', emailErr)
    }

    return { success: true }
  } catch (err) {
    console.error('[registerVolunteerAction]', err)
    return { success: false, error: 'Registration failed. Please try again.' }
  }
}
