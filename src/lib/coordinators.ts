import prisma from '@/lib/prisma'

/**
 * Volunteer coordinators, per store.
 *
 * Emails to volunteers should come back to the coordinator who actually knows
 * them, so replies don't disappear into a no-reply mailbox. Addresses are held
 * in AppSettings so they can be changed without a deploy; the constants below
 * are only a fallback if a setting is missing.
 */
export const COORDINATOR_SETTING_KEYS = {
  Loganholme: 'loganholme_coordinator_email',
  Hillcrest: 'hillcrest_coordinator_email',
} as const

const FALLBACK = {
  Loganholme: 'rochelle@lighthousecare.org.au',
  Hillcrest: 'georgina@lighthousecare.org.au',
} as const

export type StoreLocation = keyof typeof COORDINATOR_SETTING_KEYS

function normaliseLocation(value?: string | null): StoreLocation {
  return /hillcrest/i.test(value ?? '') ? 'Hillcrest' : 'Loganholme'
}

/** Coordinator address for a store (defaults to Loganholme). */
export async function getCoordinatorEmail(location?: string | null): Promise<string> {
  const store = normaliseLocation(location)
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: COORDINATOR_SETTING_KEYS[store] },
      select: { value: true },
    })
    return row?.value?.trim() || FALLBACK[store]
  } catch {
    return FALLBACK[store]
  }
}

/** Coordinator for a volunteer, based on the store they prefer. */
export async function getCoordinatorEmailForVolunteer(volunteerId: string): Promise<string | null> {
  try {
    const vp = await prisma.volunteerProfile.findUnique({
      where: { id: volunteerId },
      select: { preferredLocations: true },
    })
    if (!vp) return null
    return getCoordinatorEmail(vp.preferredLocations?.[0])
  } catch {
    return null
  }
}

/** Both coordinator addresses (for admin settings screens). */
export async function getAllCoordinatorEmails(): Promise<Record<StoreLocation, string>> {
  const [loganholme, hillcrest] = await Promise.all([
    getCoordinatorEmail('Loganholme'),
    getCoordinatorEmail('Hillcrest'),
  ])
  return { Loganholme: loganholme, Hillcrest: hillcrest }
}
