/**
 * Applies the checklist template to the database.
 *
 * Matches on title + frequency + location and updates in place. Deliberately
 * never deletes: ChecklistCompletion cascades from ChecklistItem, so removing
 * an item would take the record of who did that work with it. Items that are
 * no longer wanted should be deactivated in admin instead.
 *
 * Safe to re-run. Pass --dry to see what it would do.
 *
 *   DATABASE_URL="$(cat scripts/migrate/.sydney-app)" npx tsx scripts/seed-checklist.ts --dry
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { CHECKLIST_TEMPLATE } from '../src/lib/checklist-template'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 5 }),
})

const DRY = process.argv.includes('--dry')

async function main() {
  const locations = await prisma.location.findMany({ select: { id: true, name: true } })
  const loganholme = locations.find((l) => /loganholme/i.test(l.name))
  const hillcrest = locations.find((l) => /hillcrest/i.test(l.name))
  if (!loganholme || !hillcrest) {
    throw new Error(`Need both stores. Found: ${locations.map((l) => l.name).join(', ')}`)
  }
  console.log(`Loganholme: ${loganholme.id}\nHillcrest:  ${hillcrest.id}\n`)

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const section of CHECKLIST_TEMPLATE) {
    const targets =
      section.scope === 'both' ? [loganholme, hillcrest] : [loganholme]

    for (const location of targets) {
      for (const [i, title] of section.items.entries()) {
        // Sort keeps sections together and preserves the order they were
        // written in, which is the order someone works through them.
        const sortOrder =
          CHECKLIST_TEMPLATE.indexOf(section) * 100 + i

        // Section is part of the key. "Wash exterior as required" is a real
        // item under both Delivery Vehicles and Large Trucks; without the
        // section they collapse into one and the second silently overwrites
        // the first, which is exactly what happened on the first run.
        const existing = await prisma.checklistItem.findFirst({
          where: {
            title,
            frequency: section.frequency,
            locationId: location.id,
            section: section.section,
          },
          select: { id: true, section: true, sortOrder: true, isActive: true },
        })

        if (!existing) {
          if (!DRY) {
            await prisma.checklistItem.create({
              data: {
                title,
                frequency: section.frequency,
                section: section.section,
                locationId: location.id,
                sortOrder,
                isActive: true,
              },
            })
          }
          created++
          continue
        }

        const needsUpdate =
          existing.section !== section.section || existing.sortOrder !== sortOrder
        if (needsUpdate) {
          if (!DRY) {
            await prisma.checklistItem.update({
              where: { id: existing.id },
              data: { section: section.section, sortOrder },
            })
          }
          updated++
        } else {
          unchanged++
        }
      }
    }
  }

  console.log(`${DRY ? 'WOULD create' : 'created'}: ${created}`)
  console.log(`${DRY ? 'WOULD update' : 'updated'}: ${updated}`)
  console.log(`unchanged: ${unchanged}`)

  const total = await prisma.checklistItem.count()
  const byFreq = await prisma.checklistItem.groupBy({
    by: ['frequency', 'locationId'],
    _count: true,
  })
  console.log(`\nitems in the database now: ${total}`)
  for (const g of byFreq) {
    const name = locations.find((l) => l.id === g.locationId)?.name ?? 'everywhere'
    console.log(`  ${g.frequency.padEnd(8)} ${name.padEnd(20)} ${g._count}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message?.slice(0, 400))
    process.exit(1)
  })
