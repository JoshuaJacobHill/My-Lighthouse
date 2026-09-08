/**
 * The shop, warehouse and office checklist.
 *
 * Held as data rather than typed into the admin screens so it can be reviewed
 * in a diff and re-applied safely. Seeding matches on title + frequency +
 * location and updates in place, so re-running after an edit never duplicates
 * an item and never deletes one — deleting would cascade away the completion
 * history, which is the record of who did the work.
 *
 * `scope` reflects the sites as they actually are: the warehouse, the trucks
 * and the office are all at Loganholme. Amenities are split from the office on
 * purpose — Hillcrest has no office but its staff still have a kitchen and
 * toilets to keep clean.
 */

export type Scope = 'both' | 'loganholme'
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export type TemplateSection = {
  frequency: Frequency
  section: string
  scope: Scope
  items: string[]
}

export const CHECKLIST_TEMPLATE: TemplateSection[] = [
  // ── Daily ────────────────────────────────────────────────────────────────
  {
    frequency: 'DAILY',
    section: 'Shop Floor & Customer Areas',
    scope: 'both',
    items: [
      'Sweep all shop floors',
      'Mop shop floors and clean spills immediately',
      'Clean entrance, door glass and handles',
      'Empty rubbish bins and replace liners',
      'Wipe counters, registers and customer service areas',
      'Tidy shelves and face products forward',
      'Remove empty cartons and packaging',
      'Check aisles are clear of boxes, pallets and trip hazards',
      'Check pricing/signage is tidy and correctly positioned',
      'Clean baskets and trolleys as required',
      'Check customer areas are neat and presentable',
    ],
  },
  {
    frequency: 'DAILY',
    section: 'Fridges & Freezers',
    scope: 'both',
    items: [
      'Restock fridges and freezers',
      'Rotate stock using FIFO — oldest stock to the front',
      'Check products for damage, leaks or deterioration',
      'Check fridge and freezer temperatures',
      'Record temperatures where required',
      'Clean any spills inside fridges/freezers',
      'Ensure freezer and cool-room doors are properly closed',
      'Ensure stock is not blocking vents or refrigeration airflow',
    ],
  },
  {
    frequency: 'DAILY',
    section: 'Warehouse',
    scope: 'loganholme',
    items: [
      'Sweep warehouse floors and loading areas',
      'Remove loose cardboard, plastic wrap and rubbish',
      'Flatten/remove empty cartons',
      'Return pallets to designated areas',
      'Keep emergency exits, fire equipment and walkways clear',
      'Ensure stock is safely stacked',
      'Clean up broken/damaged stock immediately',
      'Check loading areas are clear and safe',
      'Return pallet jacks, trolleys and equipment to designated locations',
      'Check for obvious leaks, damage or maintenance issues',
    ],
  },
  {
    frequency: 'DAILY',
    section: 'Stock',
    scope: 'both',
    items: [
      'Rotate stock while replenishing shelves',
      'Check short-dated stock',
      'Identify products approaching or past best-before/use-by dates',
      'Remove any unsafe, leaking, damaged or contaminated products',
      'Move suitable short-dated products into appropriate clearance/free areas',
      'Report unusual stock shortages or excess stock',
      'Keep food products off the floor and stored correctly',
    ],
  },
  {
    frequency: 'DAILY',
    section: 'Staff Areas',
    scope: 'both',
    items: [
      'Empty kitchen bins',
      'Clean kitchen benches and sink',
      'Wash/put away dishes',
      'Wipe lunchroom tables',
      'Wipe frequently touched surfaces',
      'Check toilets and replenish toilet paper, soap and paper towel',
      'Clean toilets as required throughout the day',
      'Sweep/mop staff kitchen and toilet areas as required',
    ],
  },
  {
    frequency: 'DAILY',
    section: 'Office',
    scope: 'loganholme',
    items: ['Empty office bins', 'Keep desks and shared spaces tidy'],
  },
  {
    frequency: 'DAILY',
    section: 'Closing Check',
    scope: 'both',
    items: [
      'All rubbish removed',
      'Floors clear',
      'Cold storage operating correctly',
      'Lights/equipment turned off where appropriate',
      'Any maintenance or safety issues reported',
    ],
  },
  {
    frequency: 'DAILY',
    section: 'Closing Check — Warehouse & Vehicles',
    scope: 'loganholme',
    items: ['Warehouse secure', 'Loading doors closed/locked', 'Vehicles secured'],
  },

  // ── Weekly ───────────────────────────────────────────────────────────────
  {
    frequency: 'WEEKLY',
    section: 'Shop',
    scope: 'both',
    items: [
      'Thoroughly mop/scrub shop floors',
      'Clean underneath movable displays',
      'Dust shelving and displays',
      'Wipe shelving where stock allows',
      'Clean walls, doors and skirting where required',
      'Clean windows and glass',
      'Clean and disinfect shopping trolleys/baskets',
      'Clean register equipment and surrounding cabinetry',
      'Remove outdated posters/signage',
      'Check shop presentation and merchandising',
    ],
  },
  {
    frequency: 'WEEKLY',
    section: 'Fridges, Freezers & Cool Rooms',
    scope: 'both',
    items: [
      'Thoroughly clean fridge/freezer doors and handles',
      'Clean seals/gaskets',
      'Clean accessible shelving',
      'Check for ice build-up',
      'Check for damaged seals or doors',
      'Review temperature records for abnormalities',
      'Check underneath/around refrigeration units for rubbish or obstructions',
    ],
  },
  {
    frequency: 'WEEKLY',
    section: 'Warehouse',
    scope: 'loganholme',
    items: [
      'Thoroughly sweep warehouse',
      'Sweep loading dock/loading bay',
      'Clean underneath accessible pallet areas',
      'Organise pallet storage',
      'Organise cardboard/recycling areas',
      'Check racking for visible damage',
      'Check pallet condition and remove unsafe pallets',
      'Ensure stock locations are clearly labelled',
      'Check walkways and emergency exits',
      'Check fire extinguishers/fire equipment are accessible',
    ],
  },
  {
    frequency: 'WEEKLY',
    section: 'Stock Management',
    scope: 'both',
    items: [
      'Complete a dedicated short-date/best-before review',
      'Review products already past best-before date',
      'Confirm past-best-before products are still suitable for distribution/sale under Lighthouse Care procedures',
      'Remove expired use-by products',
      'Rotate warehouse stock',
      'Identify slow-moving stock',
      'Consolidate partly filled pallets/cartons where appropriate',
      'Review damaged stock area',
      'Investigate unexplained stock discrepancies',
    ],
  },
  {
    frequency: 'WEEKLY',
    section: 'Delivery Vehicles',
    scope: 'loganholme',
    items: [
      'Sweep/vacuum Lighthouse delivery vehicles',
      'Clean cargo areas',
      'Remove rubbish, cartons and loose items',
      'Wipe dashboards/interior surfaces',
      'Clean windows and mirrors',
      'Wash exterior as required',
      'Check fuel',
      'Check tyres visually',
      'Check lights and indicators',
      'Check for new vehicle damage',
      'Ensure straps, trolleys and delivery equipment are secured',
    ],
  },
  {
    frequency: 'WEEKLY',
    section: 'Large Trucks',
    scope: 'loganholme',
    items: [
      'Sweep and clean truck cargo areas',
      'Remove pallets, rubbish and loose packaging',
      'Clean cab',
      'Wash exterior as required',
      'Check tyres visually',
      'Check lights/indicators',
      'Check tailgate operation',
      'Check load restraints/straps',
      'Report damage or mechanical concerns',
    ],
  },
  {
    frequency: 'WEEKLY',
    section: 'Amenities',
    scope: 'both',
    items: [
      'Mop hard floors',
      'Thoroughly clean staff kitchen',
      'Clean microwave, fridge exterior and appliances',
      'Check staff fridge and dispose of spoiled/abandoned food',
      'Thoroughly clean toilets',
      'Refill cleaning and bathroom supplies',
      'Clean door handles, switches and high-touch areas',
    ],
  },
  {
    frequency: 'WEEKLY',
    section: 'Office',
    scope: 'loganholme',
    items: ['Vacuum office floors', 'Dust desks, shelves and equipment'],
  },

  // ── Monthly ──────────────────────────────────────────────────────────────
  {
    frequency: 'MONTHLY',
    section: 'Deep Cleaning',
    scope: 'both',
    items: [
      'Deep clean shop floors',
      'Clean underneath shelving/display units where accessible',
      'Dust high areas, vents, ledges and tops of shelving',
      'Clean walls and doors',
      'Deep clean staff kitchen',
      'Deep clean toilets',
      'Deep clean fridges/freezers where operationally possible',
    ],
  },
  {
    frequency: 'MONTHLY',
    section: 'Deep Cleaning — Warehouse',
    scope: 'loganholme',
    items: [
      'Clean warehouse corners and difficult-to-reach areas',
      'Clean loading dock/loading bay thoroughly',
    ],
  },
  {
    frequency: 'MONTHLY',
    section: 'Full Stock Review',
    scope: 'both',
    items: [
      'Complete full warehouse stock rotation check',
      'Review all short-dated stock',
      'Review all past-best-before stock',
      'Review damaged/quarantined stock',
      'Identify dead/slow-moving stock',
      'Check stock is stored in correct locations',
      'Check cartons/pallets for pest or water damage',
      'Check stock is adequately protected from contamination',
      'Review clearance/free stock opportunities',
      'Check stock records against physical stock where appropriate',
    ],
  },
  {
    frequency: 'MONTHLY',
    section: 'Warehouse & Safety',
    scope: 'loganholme',
    items: [
      'Inspect racking for damage',
      'Inspect shelving',
      'Check pallet jacks and warehouse equipment',
      'Check ladders/step ladders',
      'Check safety signs',
      'Check emergency exits and exit signs',
      'Check first-aid supplies',
      'Check fire equipment is unobstructed',
      'Check warehouse lighting',
      'Check for water leaks',
      'Check for evidence of pests',
      'Review trip/slip hazards',
      'Check loading areas and bollards/barriers for damage',
      'Report building repairs required',
    ],
  },
  {
    frequency: 'MONTHLY',
    section: 'Vehicles',
    scope: 'loganholme',
    items: [
      'Thoroughly wash and clean all delivery vehicles',
      'Thoroughly clean large trucks',
      'Check vehicle service dates/kilometres',
      'Check tyre condition',
      'Check windscreen condition',
      'Check registration/service documentation',
      'Check first-aid/safety equipment kept in vehicles',
      'Check load restraints',
      'Check tailgates and loading equipment',
      'Record and arrange repairs for damage',
    ],
  },
  {
    frequency: 'MONTHLY',
    section: 'Refrigeration & Equipment',
    scope: 'both',
    items: [
      'Inspect fridge/freezer seals',
      'Check refrigeration temperatures/trends',
      'Check for unusual noises, leaks or ice build-up',
      'Clean vents and accessible condenser areas where appropriate',
      'Check scales, trolleys and other shop equipment',
      'Review maintenance issues requiring a technician',
    ],
  },
  {
    frequency: 'MONTHLY',
    section: 'Building & Grounds',
    scope: 'both',
    items: [
      'Check external rubbish areas',
      'Clean around bins',
      'Sweep external loading areas',
      'Check drains are clear',
      'Check gutters/drainage visually where accessible',
      'Check signage',
      'Check exterior lighting',
      'Check doors, locks and roller doors',
      'Check carpark/loading areas for hazards',
      'Check pest-control requirements',
    ],
  },
  {
    frequency: 'MONTHLY',
    section: 'Office',
    scope: 'loganholme',
    items: [
      'Declutter shared storage areas',
      'Dispose of unnecessary paperwork appropriately',
      'Check stationery and cleaning supply levels',
      'Clean office equipment',
      'Check electrical cords/equipment for visible damage',
      'Review any outstanding maintenance requests',
    ],
  },
]

/** How many items the template produces, given which stores exist. */
export function templateCounts(): { total: number; byFrequency: Record<Frequency, number> } {
  const byFrequency: Record<Frequency, number> = { DAILY: 0, WEEKLY: 0, MONTHLY: 0 }
  let total = 0
  for (const s of CHECKLIST_TEMPLATE) {
    const copies = s.scope === 'both' ? 2 : 1
    const n = s.items.length * copies
    byFrequency[s.frequency] += n
    total += n
  }
  return { total, byFrequency }
}
