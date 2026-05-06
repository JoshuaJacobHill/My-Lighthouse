import prisma from '@/lib/prisma'
import { getTimePeriodConfig } from '@/lib/utils'
import SignupClient from './SignupClient'

export const dynamic = 'force-dynamic'

async function getAvailabilitySettings(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.appSetting.findMany({
      where: {
        key: {
          in: [
            'availability_morning_label',
            'availability_morning_hours',
            'availability_afternoon_label',
            'availability_afternoon_hours',
          ],
        },
      },
    })
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  } catch {
    return {}
  }
}

export default async function SignupPage() {
  const settings = await getAvailabilitySettings()

  // Get all periods from config then filter out EVENING
  const allPeriods = getTimePeriodConfig(settings)
  const timePeriods = allPeriods
    .filter((p) => p.key !== 'EVENING')
    .map((p) => ({ key: p.key, label: p.label, hours: p.hours }))

  return <SignupClient timePeriods={timePeriods} />
}
