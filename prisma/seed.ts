import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcryptjs from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding Lighthouse Care Volunteers database...')

  // ─── 1. Locations ────────────────────────────────────────────────────────────

  const loganholme = await prisma.location.upsert({
    where: { name: 'Loganholme Store' },
    update: {},
    create: {
      name: 'Loganholme Store',
      address: '3 Bryants Road, Loganholme QLD 4129',
      isActive: true,
      sortOrder: 1,
    },
  })

  const hillcrest = await prisma.location.upsert({
    where: { name: 'Hillcrest Store' },
    update: {},
    create: {
      name: 'Hillcrest Store',
      address: '19 Milky Way, Hillcrest QLD 4118',
      isActive: true,
      sortOrder: 2,
    },
  })

  console.log('  Locations created.')

  // ─── 2. Departments ───────────────────────────────────────────────────────────

  const deptStore = await prisma.department.upsert({
    where: { name: 'Store' },
    update: {},
    create: { name: 'Store', isActive: true, sortOrder: 1 },
  })

  const deptPacking = await prisma.department.upsert({
    where: { name: 'Packing' },
    update: {},
    create: { name: 'Packing', isActive: true, sortOrder: 2 },
  })

  const deptEvents = await prisma.department.upsert({
    where: { name: 'Events' },
    update: {},
    create: { name: 'Events', isActive: true, sortOrder: 5 },
  })

  const deptAdmin = await prisma.department.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin', isActive: true, sortOrder: 6 },
  })

  console.log('  Departments created.')

  // ─── 3. Admin user ────────────────────────────────────────────────────────────

  const adminPasswordHash = await bcryptjs.hash('Admin@1234!', 12)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@lighthousecare.org.au' },
    update: {},
    create: {
      email: 'admin@lighthousecare.org.au',
      name: 'Lighthouse Care Admin',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: new Date(),
    },
  })

  console.log('  Admin user created: admin@lighthousecare.org.au / Admin@1234!')

  // ─── 4. Kiosk user ────────────────────────────────────────────────────────────

  const kioskPasswordHash = await bcryptjs.hash('Kiosk@1234!', 12)
  await prisma.user.upsert({
    where: { email: 'kiosk@lighthousecare.org.au' },
    update: {},
    create: {
      email: 'kiosk@lighthousecare.org.au',
      name: 'Kiosk',
      passwordHash: kioskPasswordHash,
      role: 'KIOSK',
      isActive: true,
      emailVerified: new Date(),
    },
  })

  console.log('  Kiosk user created: kiosk@lighthousecare.org.au / Kiosk@1234!')

  // ─── 5. Volunteer users ───────────────────────────────────────────────────────

  const volunteerPassword = await bcryptjs.hash('Volunteer@1234!', 12)

  // Sarah Mitchell — ACTIVE, Loganholme
  const sarahUser = await prisma.user.upsert({
    where: { email: 'sarah.mitchell@example.com' },
    update: {},
    create: {
      email: 'sarah.mitchell@example.com',
      name: 'Sarah Mitchell',
      passwordHash: volunteerPassword,
      role: 'VOLUNTEER',
      isActive: true,
      emailVerified: new Date(),
      lastLoginAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  })
  const sarahProfile = await prisma.volunteerProfile.upsert({
    where: { userId: sarahUser.id },
    update: {},
    create: {
      userId: sarahUser.id,
      firstName: 'Sarah',
      lastName: 'Mitchell',
      email: 'sarah.mitchell@example.com',
      mobile: '0412 345 678',
      dateOfBirth: new Date('1988-04-12'),
      addressLine1: '14 Banksia Street',
      suburb: 'Loganholme',
      state: 'QLD',
      postcode: '4129',
      emergencyName: 'Mark Mitchell',
      emergencyPhone: '0401 234 567',
      emergencyRelation: 'Husband',
      status: 'ACTIVE',
      joinedAt: new Date('2023-03-15'),
      lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      lastAttendedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      preferredLocations: ['Loganholme Store'],
      areasOfInterest: ['Store', 'Packing'],
      blueCardStatus: 'CURRENT',
      blueCardNumber: 'BC-2024-44821',
      blueCardExpiry: new Date('2026-03-14'),
      agreedToTerms: true,
      agreedToPrivacy: true,
      consentEmailUpdates: true,
      consentSmsUpdates: true,
      agreedAt: new Date('2023-03-15'),
    },
  })

  // David Nguyen — ACTIVE, Hillcrest
  const davidUser = await prisma.user.upsert({
    where: { email: 'david.nguyen@example.com' },
    update: {},
    create: {
      email: 'david.nguyen@example.com',
      name: 'David Nguyen',
      passwordHash: volunteerPassword,
      role: 'VOLUNTEER',
      isActive: true,
      emailVerified: new Date(),
      lastLoginAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  })
  const davidProfile = await prisma.volunteerProfile.upsert({
    where: { userId: davidUser.id },
    update: {},
    create: {
      userId: davidUser.id,
      firstName: 'David',
      lastName: 'Nguyen',
      email: 'david.nguyen@example.com',
      mobile: '0423 456 789',
      dateOfBirth: new Date('1979-09-27'),
      addressLine1: '82 Wattle Drive',
      suburb: 'Hillcrest',
      state: 'QLD',
      postcode: '4118',
      emergencyName: 'Linh Nguyen',
      emergencyPhone: '0412 876 543',
      emergencyRelation: 'Wife',
      status: 'ACTIVE',
      joinedAt: new Date('2022-11-08'),
      lastActiveAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      lastAttendedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      preferredLocations: ['Hillcrest Store'],
      areasOfInterest: ['Store', 'Packing'],
      blueCardStatus: 'CURRENT',
      blueCardNumber: 'BC-2023-31902',
      blueCardExpiry: new Date('2025-11-07'),
      agreedToTerms: true,
      agreedToPrivacy: true,
      consentEmailUpdates: true,
      consentSmsUpdates: false,
      agreedAt: new Date('2022-11-08'),
    },
  })

  // Emma Thompson — INDUCTED (completed induction, not yet active)
  const emmaUser = await prisma.user.upsert({
    where: { email: 'emma.thompson@example.com' },
    update: {},
    create: {
      email: 'emma.thompson@example.com',
      name: 'Emma Thompson',
      passwordHash: volunteerPassword,
      role: 'VOLUNTEER',
      isActive: true,
      emailVerified: new Date(),
      lastLoginAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  })
  const emmaProfile = await prisma.volunteerProfile.upsert({
    where: { userId: emmaUser.id },
    update: {},
    create: {
      userId: emmaUser.id,
      firstName: 'Emma',
      lastName: 'Thompson',
      email: 'emma.thompson@example.com',
      mobile: '0434 567 890',
      dateOfBirth: new Date('1995-02-18'),
      addressLine1: '9 Grevillea Court',
      suburb: 'Springwood',
      state: 'QLD',
      postcode: '4127',
      emergencyName: 'Claire Thompson',
      emergencyPhone: '0401 111 222',
      emergencyRelation: 'Mother',
      status: 'INDUCTED',
      joinedAt: new Date('2024-11-20'),
      lastActiveAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      preferredLocations: ['Loganholme Store'],
      areasOfInterest: ['Store', 'Events'],
      blueCardStatus: 'PENDING',
      agreedToTerms: true,
      agreedToPrivacy: true,
      consentEmailUpdates: true,
      consentSmsUpdates: true,
      agreedAt: new Date('2024-11-20'),
    },
  })

  // James Patel — PENDING_INDUCTION (just signed up)
  const jamesUser = await prisma.user.upsert({
    where: { email: 'james.patel@example.com' },
    update: {},
    create: {
      email: 'james.patel@example.com',
      name: 'James Patel',
      passwordHash: volunteerPassword,
      role: 'VOLUNTEER',
      isActive: true,
      emailVerified: new Date(),
      lastLoginAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  })
  const jamesProfile = await prisma.volunteerProfile.upsert({
    where: { userId: jamesUser.id },
    update: {},
    create: {
      userId: jamesUser.id,
      firstName: 'James',
      lastName: 'Patel',
      email: 'james.patel@example.com',
      mobile: '0445 678 901',
      dateOfBirth: new Date('2000-07-03'),
      addressLine1: '22 Eucalyptus Way',
      suburb: 'Logan Central',
      state: 'QLD',
      postcode: '4114',
      emergencyName: 'Priya Patel',
      emergencyPhone: '0412 333 444',
      emergencyRelation: 'Mother',
      status: 'PENDING_INDUCTION',
      joinedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      preferredLocations: ['Loganholme Store', 'Hillcrest Store'],
      areasOfInterest: ['Store', 'Packing', 'Admin'],
      blueCardStatus: 'NOT_APPLICABLE',
      agreedToTerms: true,
      agreedToPrivacy: true,
      consentEmailUpdates: true,
      consentSmsUpdates: false,
      agreedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  })

  // Lisa Chen — INACTIVE (hasn't attended in 6+ weeks)
  const lisaUser = await prisma.user.upsert({
    where: { email: 'lisa.chen@example.com' },
    update: {},
    create: {
      email: 'lisa.chen@example.com',
      name: 'Lisa Chen',
      passwordHash: volunteerPassword,
      role: 'VOLUNTEER',
      isActive: true,
      emailVerified: new Date(),
      lastLoginAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
    },
  })
  const lisaProfile = await prisma.volunteerProfile.upsert({
    where: { userId: lisaUser.id },
    update: {},
    create: {
      userId: lisaUser.id,
      firstName: 'Lisa',
      lastName: 'Chen',
      email: 'lisa.chen@example.com',
      mobile: '0456 789 012',
      dateOfBirth: new Date('1983-12-05'),
      addressLine1: '5 Ironbark Place',
      suburb: 'Beenleigh',
      state: 'QLD',
      postcode: '4207',
      emergencyName: 'Kevin Chen',
      emergencyPhone: '0412 555 666',
      emergencyRelation: 'Brother',
      status: 'INACTIVE',
      joinedAt: new Date('2022-06-01'),
      lastActiveAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
      lastAttendedAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
      deactivatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      deactivatedReason: 'No attendance for over 6 weeks.',
      preferredLocations: ['Hillcrest Store'],
      areasOfInterest: ['Packing', 'Warehouse'],
      blueCardStatus: 'EXPIRED',
      blueCardNumber: 'BC-2020-18803',
      blueCardExpiry: new Date('2024-05-31'),
      agreedToTerms: true,
      agreedToPrivacy: true,
      consentEmailUpdates: false,
      consentSmsUpdates: false,
      agreedAt: new Date('2022-06-01'),
    },
  })

  console.log('  5 volunteer profiles created.')

  // ─── 6. Induction sections ────────────────────────────────────────────────────

  const inductionSections = [
    {
      sortOrder: 10,
      title: 'Welcome to Lighthouse Care',
      isRequired: true,
      isActive: true,
      content: `Welcome, and thank you for choosing to give your time to Lighthouse Care.

Lighthouse Care is a not-for-profit charity based in Logan, South East Queensland. Founded in 2004 by Debbie and Ron Hill, our mission is simple: making lives better so that together we can make the world better.

Each year, we support over 750,000 people across South East Queensland through affordable groceries, $25 trolleys, home delivery, and emergency food relief. We run two not-for-profit grocery stores — in Loganholme and Hillcrest — and an online store with home delivery. Every dollar raised through our stores goes directly back into funding free food relief for families doing it tough.

We are entirely self-funded. There is no recurring government funding. That makes the role of every volunteer critical to what we do.

You are joining a team of passionate, generous people who believe that everyone deserves to eat well — regardless of their circumstances. We are so glad you are here.`,
    },
    {
      sortOrder: 20,
      title: 'Our Mission and Values',
      isRequired: true,
      isActive: true,
      content: `Our mission: Making lives better so that together we can make the world better.

Everything we do is guided by six cultural pillars:

PEOPLE — Our community is at the heart of everything. We treat every person — shopper, recipient, donor, or volunteer — with warmth, dignity, and respect.

EMPOWERING — We believe in building people up. Our goal is not just to provide food, but to help families regain stability and confidence.

GENEROSITY — We give freely. Our stores operate on a low-margin model so that more people can afford nutritious food, and surplus funds emergency food relief at no cost.

INTEGRITY — We do what we say. We are transparent, honest, and accountable in all we do.

HOPE — We believe every family's situation can improve. We hold hope for the people we serve, even when things are hard.

COLLABORATION — We work together — with volunteers, churches, schools, councils, and other charities — because we know we achieve more side by side.

As a volunteer, you represent these values every time you walk through our doors or interact with a community member. The way you greet someone, serve them, or simply make eye contact matters more than you might think.`,
    },
    {
      sortOrder: 30,
      title: 'Your Role as a Volunteer',
      isRequired: true,
      isActive: true,
      content: `Volunteers are the engine of Lighthouse Care. Without you, we simply could not serve the families who rely on us.

Depending on your area of interest, your role may include:

- STORE TEAM: Greeting customers, restocking shelves, operating the register, and maintaining a welcoming, organised shop floor.
- PACKING TEAM: Sorting and packing donated and purchased goods into food relief hampers for families in crisis.
- WAREHOUSE TEAM: Receiving stock deliveries, managing storage, and preparing orders for distribution.
- DELIVERY TEAM: Transporting food parcels to families who cannot travel to our stores (valid driver's licence required).
- EVENTS TEAM: Assisting with community events, fundraisers, and awareness campaigns.
- ADMIN TEAM: Supporting office functions including data entry, phones, and coordination.

Regardless of your role, every volunteer is expected to:
- Arrive on time and sign in using the kiosk at the start of your shift.
- Sign out when you leave so we can accurately record your contribution.
- Wear your volunteer lanyard or badge while on-site.
- Treat all community members, staff, and fellow volunteers with kindness and respect.
- Report any concerns, incidents, or hazards to a staff member immediately.`,
    },
    {
      sortOrder: 40,
      title: 'Sign-In and Sign-Out Procedures',
      isRequired: true,
      isActive: true,
      content: `Recording your attendance is important — not just for our records, but because your volunteer hours contribute to reports we share with the community and our supporters.

WHEN YOU ARRIVE:
1. Go to the volunteer kiosk (tablet) at the front of your location.
2. Search for your name or scan your QR code (if provided).
3. Confirm your details and tap "Sign In".
4. You'll see a confirmation screen — you're officially on shift!

WHEN YOU LEAVE:
1. Return to the kiosk before you leave.
2. Find your name and tap "Sign Out".
3. Confirm the time is correct.

If you forget to sign in or out, please let a staff member know as soon as possible so they can manually record your attendance.

GUEST SIGN-IN:
If you're bringing a friend or family member to help for the day (a "one-off" volunteer), they must also sign in using the Guest sign-in on the kiosk. They'll need to provide their name, mobile number, and acknowledge the safety notice.

WHY THIS MATTERS:
Accurate attendance records help us:
- Celebrate volunteer milestones (hours, anniversaries)
- Report impact to donors and the community
- Identify and follow up with volunteers who may need support
- Fulfil our duty of care obligations`,
    },
    {
      sortOrder: 50,
      title: 'Food Safety and Hygiene',
      isRequired: true,
      isActive: true,
      content: `As a volunteer handling food — even in a retail or packing environment — you have a responsibility to maintain basic food safety standards. This protects both the people we serve and your fellow volunteers.

PERSONAL HYGIENE:
- Wash your hands thoroughly with soap and water when you arrive, after handling bins or waste, after using the bathroom, and before handling food.
- If hand washing facilities are not immediately available, use the hand sanitiser provided at each station.
- Do not handle food if you are unwell. If you are experiencing symptoms of illness (nausea, diarrhoea, vomiting, or a fever), please stay home and notify your shift coordinator as soon as possible.
- Keep hair tied back and avoid wearing loose jewellery when working in the packing or warehouse areas.
- Wear gloves when handling open food products or when instructed by a staff member.

FOOD HANDLING:
- Do not consume food products from the stock area without permission.
- Never place food items on the floor — use trolleys, shelving, or benches.
- Check the "best before" and "use by" dates on all products. Flag anything that appears damaged, leaking, or past its date to a staff member immediately.
- Hot or chilled items must be stored correctly. If in doubt, ask.
- Do not accept food from the public to pass on to recipients unless explicitly approved by a team leader.

CROSS-CONTAMINATION:
- Keep raw and ready-to-eat foods separate.
- Use colour-coded equipment (cutting boards, gloves) if available.
- Clean and sanitise surfaces before and after food preparation.

If you are unsure about any aspect of food safety, please ask a staff member before proceeding. It is always better to check than to guess.`,
    },
    {
      sortOrder: 60,
      title: 'Work Health and Safety',
      isRequired: true,
      isActive: true,
      content: `The safety of our volunteers, staff, and community members is our highest priority. Everyone has a responsibility to maintain a safe environment.

YOUR RESPONSIBILITIES:
- Follow all safety instructions given by staff.
- Do not attempt tasks you have not been trained for.
- Report hazards, near misses, and incidents to a staff member immediately — this includes wet floors, damaged shelving, heavy lifting injuries, and any situation that felt unsafe.
- Use personal protective equipment (PPE) where provided (e.g. gloves, high-visibility vests in the warehouse).

MANUAL HANDLING:
- Ask for help when lifting heavy or awkward items.
- Bend at the knees, not the back, when lifting.
- Use trolleys and hand trucks where available.
- Never try to lift more than you are comfortable with.

EMERGENCY PROCEDURES:
- Familiarise yourself with the emergency exits at your location on your first shift.
- In the event of a fire or emergency evacuation: leave immediately via the nearest exit, do not stop to collect belongings, and assemble at the designated muster point (signposted outside the building).
- Emergency contacts and first aid kits are located at the customer service desk.
- If someone is injured, do not move them unless they are in immediate danger. Call 000 if required and notify a staff member immediately.

INCIDENT REPORTING:
All incidents — no matter how minor — must be reported to a staff member. An incident report form will be completed. This is a legal requirement and protects both you and Lighthouse Care.`,
    },
    {
      sortOrder: 70,
      title: 'Dignity, Privacy and Confidentiality',
      isRequired: true,
      isActive: true,
      content: `Many of the families and individuals who shop at our stores or receive food relief are going through difficult times. They may be experiencing financial hardship, domestic challenges, illness, or grief. Your role is to serve every person with dignity, warmth, and without judgement.

DIGNITY IN SERVICE:
- Treat every customer and recipient the same way you would wish to be treated.
- Do not make assumptions about why someone is in need of support.
- Use respectful, everyday language. Avoid labels like "the needy", "the poor", or "charity cases".
- If someone appears distressed or asks for extra assistance, notify a staff member rather than trying to handle it alone.

CONFIDENTIALITY:
- You may become aware of personal information about community members or other volunteers in the course of your duties. This information is strictly confidential.
- Do not discuss individual clients or their circumstances outside of the organisation.
- Do not take photos or videos of community members or recipients without explicit permission.
- Do not share anything about Lighthouse Care's operations, client data, or internal matters on social media.

PRIVACY ACT:
Lighthouse Care collects and stores personal data in accordance with the Australian Privacy Act 1988. As a volunteer, you must not access, share, or misuse any personal information you encounter. If you have concerns about how data is being handled, speak with a staff member.

If you are ever unsure whether something is appropriate to share or discuss, the answer is: don't. Check with a staff member first.`,
    },
    {
      sortOrder: 80,
      title: 'Child Safety and Blue Cards',
      isRequired: true,
      isActive: true,
      content: `Lighthouse Care is committed to the safety and wellbeing of all children and young people in our community. We comply fully with the Queensland Child Safety (Prohibiting the Use of Corporal Punishment) Act and all relevant child protection legislation.

WORKING WITH CHILDREN:
Some volunteer roles may involve incidental contact with children (e.g. children accompanying parents while shopping). If your role involves direct, regular, or unsupervised contact with children under 18, you will be required to hold a current Queensland Blue Card before commencing that work.

WHAT IS A BLUE CARD?
A Blue Card (Working with Children Check) is issued by Blue Card Services Queensland and verifies that an individual is suitable to work with children. It is a legal requirement for many volunteer roles in Queensland.

If you need a Blue Card:
1. Apply online at www.bluecard.qld.gov.au (volunteer applications are free).
2. Provide your Blue Card number to the Lighthouse Care admin team once issued.
3. Your Blue Card must remain current. It expires every three years.

CHILD SAFE BEHAVIOUR:
- Never be alone with a child in an isolated area.
- Do not take photos of children under any circumstances.
- If a child discloses abuse or makes you concerned for their safety, notify a staff member immediately and do not attempt to investigate yourself.
- Report any concerns about child safety to the Lighthouse Care coordinator or, in an emergency, to the Queensland Police Service on 000.

Our commitment is not just legal compliance — it is a genuine belief that every child deserves to be safe.`,
    },
    {
      sortOrder: 90,
      title: 'Communication and Conduct',
      isRequired: false,
      isActive: true,
      content: `Being part of the Lighthouse Care volunteer team means you are part of our community. We want you to feel welcome, informed, and connected.

STAYING IN TOUCH:
- The Lighthouse Care admin team will communicate with you via the email address you registered with. Please check your email regularly.
- We will send you shift reminders, updates, and occasional newsletters. You can manage your communication preferences in your volunteer profile.
- If your contact details change, please update them in the volunteer portal as soon as possible.

CANCELLING A SHIFT:
Life happens. If you need to cancel a shift, please let us know as soon as possible — ideally at least 24 hours before. You can cancel via the volunteer portal, or call/email the coordinator at your location. Last-minute cancellations without notice make it difficult for us to find a replacement and may leave a team short-staffed.

CONDUCT EXPECTATIONS:
- Be respectful to all staff, volunteers, and community members at all times.
- Do not use offensive, discriminatory, or inappropriate language on-site.
- Mobile phones should be on silent during shifts. Personal calls should be taken on breaks.
- Do not be under the influence of alcohol or substances while volunteering.
- Volunteers who breach our Code of Conduct may be asked to leave and may not be invited back.

SOCIAL MEDIA:
- Please do not post photos or information about Lighthouse Care operations, staff, or community members without permission.
- If you'd like to share your experience, feel free to post general positives (e.g. "Loved volunteering at Lighthouse Care today!") but always respect confidentiality.

We are one team. How we treat each other and the people we serve is our greatest statement of who we are.`,
    },
    {
      sortOrder: 100,
      title: 'Next Steps and Support',
      isRequired: true,
      isActive: true,
      content: `You've nearly completed your induction — well done and thank you!

COMPLETING YOUR INDUCTION:
Once you have read all sections and passed the short quiz that follows, your status will be updated to "Inducted" and a coordinator will be in touch to arrange your first shift.

YOUR FIRST SHIFT:
- Arrive 10 minutes early so you can meet the team.
- Bring your volunteer lanyard or confirm your name is in the system.
- Wear comfortable, enclosed footwear — open-toed shoes are not permitted in the warehouse or packing areas.
- Let the shift coordinator know you are new — they will introduce you to the team and walk you through the day.

GETTING SUPPORT:
If you have questions, concerns, or need to take a break from volunteering, please reach out. We understand that life has seasons, and we would rather you tell us than simply disappear.

Contact the volunteer coordinator at your preferred location:
- Loganholme: volunteers@lighthousecare.org.au
- Hillcrest: volunteers@lighthousecare.org.au

Your volunteer profile on this portal lets you:
- Update your personal details and availability
- View your upcoming shifts
- Track your volunteer hours
- Update your communication preferences

Thank you again for your generosity. What you are about to do matters — more than you may ever fully know. Together, we are making lives better.

The Lighthouse Care Team`,
    },
  ]

  for (const section of inductionSections) {
    await prisma.inductionSection.upsert({
      where: {
        id: (await prisma.inductionSection.findFirst({ where: { title: section.title } }))?.id ?? 'nonexistent',
      },
      update: {},
      create: section,
    })
  }

  console.log('  10 induction sections created.')

  // ─── 7. Quiz questions ────────────────────────────────────────────────────────

  const quizData = [
    {
      sortOrder: 10,
      question: 'What should you do if you are feeling unwell before your shift?',
      options: [
        { optionText: 'Come in anyway and let a staff member know when you arrive.', isCorrect: false, sortOrder: 0 },
        { optionText: 'Stay home, contact the shift coordinator as soon as possible, and do not handle food.', isCorrect: true, sortOrder: 1 },
        { optionText: 'Come in for the first hour and leave early if you feel worse.', isCorrect: false, sortOrder: 2 },
        { optionText: 'Send a message to another volunteer to cover for you without notifying staff.', isCorrect: false, sortOrder: 3 },
      ],
    },
    {
      sortOrder: 20,
      question: 'Where is the correct place to sign in at the start of your shift?',
      options: [
        { optionText: 'Tell a staff member your name when you arrive and they will mark you off.', isCorrect: false, sortOrder: 0 },
        { optionText: 'Use the volunteer kiosk (tablet) at the front of the building.', isCorrect: true, sortOrder: 1 },
        { optionText: 'Sign the paper sign-in sheet near the back office.', isCorrect: false, sortOrder: 2 },
        { optionText: 'You do not need to sign in — just start your shift.', isCorrect: false, sortOrder: 3 },
      ],
    },
    {
      sortOrder: 30,
      question: 'You notice a product on the shelf has a "use by" date that has passed. What should you do?',
      options: [
        { optionText: 'Leave it on the shelf — customers can decide for themselves.', isCorrect: false, sortOrder: 0 },
        { optionText: 'Remove it yourself and place it in the general bin.', isCorrect: false, sortOrder: 1 },
        { optionText: 'Flag it to a staff member immediately so it can be removed and disposed of correctly.', isCorrect: true, sortOrder: 2 },
        { optionText: 'Move it to the discount section with a reduced price.', isCorrect: false, sortOrder: 3 },
      ],
    },
    {
      sortOrder: 40,
      question: 'There is a fire alarm in your building. What is the correct action?',
      options: [
        { optionText: 'Wait to see if it is a false alarm before doing anything.', isCorrect: false, sortOrder: 0 },
        { optionText: 'Grab your personal belongings and walk quickly to the carpark.', isCorrect: false, sortOrder: 1 },
        { optionText: 'Leave immediately via the nearest exit, leave belongings behind, and assemble at the designated muster point.', isCorrect: true, sortOrder: 2 },
        { optionText: 'Call 000 first, then begin evacuating once you have confirmation.', isCorrect: false, sortOrder: 3 },
      ],
    },
    {
      sortOrder: 50,
      question: 'A community member you are serving mentions something personal about their circumstances. What should you do with this information?',
      options: [
        { optionText: 'Share it with other volunteers so the team can better support them.', isCorrect: false, sortOrder: 0 },
        { optionText: 'Keep it strictly confidential — do not share it with anyone outside the organisation or discuss it publicly.', isCorrect: true, sortOrder: 1 },
        { optionText: 'Post about it on social media to raise awareness for people doing it tough.', isCorrect: false, sortOrder: 2 },
        { optionText: 'Write it down and put it in the suggestion box for the admin team.', isCorrect: false, sortOrder: 3 },
      ],
    },
  ]

  for (const q of quizData) {
    const existing = await prisma.inductionQuizQuestion.findFirst({ where: { question: q.question } })
    if (!existing) {
      await prisma.inductionQuizQuestion.create({
        data: {
          question: q.question,
          sortOrder: q.sortOrder,
          isActive: true,
          options: {
            create: q.options,
          },
        },
      })
    }
  }

  console.log('  5 quiz questions created.')

  // ─── 8. Availability ──────────────────────────────────────────────────────────

  const sarahAvailability = [
    { dayOfWeek: 'TUESDAY' as const, timePeriod: 'MORNING' as const },
    { dayOfWeek: 'TUESDAY' as const, timePeriod: 'AFTERNOON' as const },
    { dayOfWeek: 'SATURDAY' as const, timePeriod: 'MORNING' as const },
    { dayOfWeek: 'SATURDAY' as const, timePeriod: 'AFTERNOON' as const },
  ]
  for (const avail of sarahAvailability) {
    await prisma.volunteerAvailability.upsert({
      where: { volunteerId_dayOfWeek_timePeriod: { volunteerId: sarahProfile.id, ...avail } },
      update: {},
      create: { volunteerId: sarahProfile.id, ...avail },
    })
  }

  const davidAvailability = [
    { dayOfWeek: 'MONDAY' as const, timePeriod: 'MORNING' as const },
    { dayOfWeek: 'WEDNESDAY' as const, timePeriod: 'MORNING' as const },
    { dayOfWeek: 'FRIDAY' as const, timePeriod: 'MORNING' as const },
    { dayOfWeek: 'SATURDAY' as const, timePeriod: 'MORNING' as const },
  ]
  for (const avail of davidAvailability) {
    await prisma.volunteerAvailability.upsert({
      where: { volunteerId_dayOfWeek_timePeriod: { volunteerId: davidProfile.id, ...avail } },
      update: {},
      create: { volunteerId: davidProfile.id, ...avail },
    })
  }

  console.log('  Availability created for Sarah and David.')

  // ─── 9. Shifts ────────────────────────────────────────────────────────────────

  const now = new Date()

  function shiftDates(daysFromNow: number, startHour: number, durationHours: number) {
    const date = new Date(now)
    date.setDate(date.getDate() + daysFromNow)
    date.setHours(0, 0, 0, 0)
    const startTime = new Date(date)
    startTime.setHours(startHour, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(startHour + durationHours, 0, 0, 0)
    return { date, startTime, endTime }
  }

  // Upcoming shifts
  const upcomingShifts = await Promise.all([
    prisma.shift.create({
      data: {
        locationId: loganholme.id,
        departmentId: deptStore.id,
        title: 'Tuesday Morning Store — Loganholme',
        ...shiftDates(3, 8, 4),
        capacity: 4,
        isActive: true,
        notes: 'Focus on restocking the canned goods aisle and fresh produce section.',
      },
    }),
    prisma.shift.create({
      data: {
        locationId: loganholme.id,
        departmentId: deptPacking.id,
        title: 'Hamper Packing — Loganholme',
        ...shiftDates(5, 9, 3),
        capacity: 6,
        isActive: true,
        notes: 'Emergency food relief packing day. 40 hampers required.',
      },
    }),
    prisma.shift.create({
      data: {
        locationId: hillcrest.id,
        departmentId: deptStore.id,
        title: 'Saturday Store — Hillcrest',
        ...shiftDates(7, 8, 5),
        capacity: 5,
        isActive: true,
      },
    }),
  ])

  // Past shifts
  const pastShifts = await Promise.all([
    prisma.shift.create({
      data: {
        locationId: loganholme.id,
        departmentId: deptStore.id,
        title: 'Tuesday Morning Store — Loganholme',
        ...shiftDates(-7, 8, 4),
        capacity: 4,
        isActive: true,
      },
    }),
    prisma.shift.create({
      data: {
        locationId: loganholme.id,
        departmentId: deptPacking.id,
        title: 'Hamper Packing — Loganholme',
        ...shiftDates(-10, 9, 3),
        capacity: 6,
        isActive: true,
      },
    }),
    prisma.shift.create({
      data: {
        locationId: hillcrest.id,
        departmentId: deptStore.id,
        title: 'Saturday Store — Hillcrest',
        ...shiftDates(-14, 8, 5),
        capacity: 5,
        isActive: true,
      },
    }),
    prisma.shift.create({
      data: {
        locationId: hillcrest.id,
        departmentId: deptPacking.id,
        title: 'Community Hamper Day — Hillcrest',
        ...shiftDates(-28, 8, 4),
        capacity: 8,
        isActive: true,
        notes: 'Annual community hamper day. High attendance expected.',
      },
    }),
  ])

  console.log('  7 shifts created (3 upcoming, 4 past).')

  // ─── 10. Assignments and attendance ──────────────────────────────────────────

  // Assign Sarah to upcoming shifts
  await prisma.shiftAssignment.upsert({
    where: { shiftId_volunteerId: { shiftId: upcomingShifts[0].id, volunteerId: sarahProfile.id } },
    update: {},
    create: { shiftId: upcomingShifts[0].id, volunteerId: sarahProfile.id, status: 'CONFIRMED', confirmedAt: new Date() },
  })
  await prisma.shiftAssignment.upsert({
    where: { shiftId_volunteerId: { shiftId: upcomingShifts[1].id, volunteerId: sarahProfile.id } },
    update: {},
    create: { shiftId: upcomingShifts[1].id, volunteerId: sarahProfile.id, status: 'SCHEDULED' },
  })

  // Assign David to upcoming shifts
  await prisma.shiftAssignment.upsert({
    where: { shiftId_volunteerId: { shiftId: upcomingShifts[2].id, volunteerId: davidProfile.id } },
    update: {},
    create: { shiftId: upcomingShifts[2].id, volunteerId: davidProfile.id, status: 'CONFIRMED', confirmedAt: new Date() },
  })

  // Attendance records for past shifts (Sarah)
  function pastAttendance(shift: { startTime: Date; locationId: string }, volunteerId: string, durationMins: number) {
    const signInAt = new Date(shift.startTime)
    signInAt.setMinutes(signInAt.getMinutes() - 5) // arrived 5 mins early
    const signOutAt = new Date(signInAt)
    signOutAt.setMinutes(signOutAt.getMinutes() + durationMins)
    return { volunteerId, locationId: shift.locationId, signInAt, signOutAt, durationMins, kioskName: 'Kiosk-01' }
  }

  await prisma.attendanceRecord.create({ data: pastAttendance(pastShifts[0], sarahProfile.id, 238) })
  await prisma.attendanceRecord.create({ data: pastAttendance(pastShifts[1], sarahProfile.id, 185) })
  await prisma.attendanceRecord.create({ data: pastAttendance(pastShifts[2], davidProfile.id, 302) })
  await prisma.attendanceRecord.create({ data: pastAttendance(pastShifts[3], sarahProfile.id, 245) })

  // Update last attended
  await prisma.volunteerProfile.update({ where: { id: sarahProfile.id }, data: { lastAttendedAt: pastShifts[0].startTime } })
  await prisma.volunteerProfile.update({ where: { id: davidProfile.id }, data: { lastAttendedAt: pastShifts[2].startTime } })

  console.log('  Shift assignments and attendance records created.')

  // ─── 11. Email templates ──────────────────────────────────────────────────────

  const emailTemplates = [
    {
      type: 'SIGNUP_CONFIRMATION' as const,
      name: 'Sign-Up Confirmation',
      subject: 'Welcome to Lighthouse Care Volunteers, {{first_name}}!',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #0d9488; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Welcome to Lighthouse Care Volunteers!</h1>
  </div>
  <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi {{first_name}},</p>
    <p>Thank you for signing up to volunteer with Lighthouse Care! We're so glad you've chosen to give your time to help families across South East Queensland.</p>
    <p>Your next step is to complete your online induction. This takes about 15–20 minutes and covers everything you need to know before your first shift — from food safety and sign-in procedures to our values and how we serve our community.</p>
    <a href="{{portal_link}}/auth/login" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; font-weight: bold;">Log In & Complete Induction</a>
    <p>Once you've completed your induction, a coordinator will be in touch to organise your first shift. We can't wait to have you on the team.</p>
    <p>If you have any questions in the meantime, reply to this email or call us on (07) 3801 0000.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>The Lighthouse Care Team</strong></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af;">Lighthouse Care | ABN 87 637 110 948 | <a href="https://lighthousecare.org.au" style="color: #9ca3af;">lighthousecare.org.au</a></p>
  </div>
</body>
</html>`,
    },
    {
      type: 'INDUCTION_REMINDER' as const,
      name: 'Induction Reminder',
      subject: 'Just a reminder — complete your induction, {{first_name}}',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #0d9488; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Your Induction is Waiting</h1>
  </div>
  <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi {{first_name}},</p>
    <p>Just a friendly reminder that your Lighthouse Care volunteer induction is still waiting to be completed. It takes around 15–20 minutes and will set you up with everything you need before your first shift.</p>
    <a href="{{portal_link}}/induction" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; font-weight: bold;">Complete My Induction</a>
    <p>Once you're through, a coordinator will be in touch to get you rostered on. We're looking forward to having you with us!</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>The Lighthouse Care Volunteer Team</strong></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af;">Lighthouse Care | ABN 87 637 110 948 | <a href="https://lighthousecare.org.au" style="color: #9ca3af;">lighthousecare.org.au</a></p>
  </div>
</body>
</html>`,
    },
    {
      type: 'INDUCTION_COMPLETE' as const,
      name: 'Induction Complete',
      subject: 'You\'ve completed your induction, {{first_name}} — what\'s next',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #0d9488; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Induction Complete — Well Done!</h1>
  </div>
  <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi {{first_name}},</p>
    <p>Congratulations on completing your Lighthouse Care volunteer induction! You're one step closer to making a real difference in our community.</p>
    <p>A volunteer coordinator will be in touch shortly to welcome you to the team and arrange your first shift. In the meantime, you can log in to your volunteer portal to set your availability and view upcoming opportunities.</p>
    <a href="{{portal_link}}/dashboard" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; font-weight: bold;">Go to My Portal</a>
    <p>Thank you for your generosity, {{first_name}}. We are genuinely grateful.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>The Lighthouse Care Team</strong></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af;">Lighthouse Care | ABN 87 637 110 948 | <a href="https://lighthousecare.org.au" style="color: #9ca3af;">lighthousecare.org.au</a></p>
  </div>
</body>
</html>`,
    },
    {
      type: 'SHIFT_REMINDER' as const,
      name: 'Shift Reminder',
      subject: 'Reminder: Your shift is tomorrow, {{first_name}}',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #0d9488; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Your Shift is Tomorrow</h1>
  </div>
  <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi {{first_name}},</p>
    <p>Just a reminder that you have a volunteer shift at Lighthouse Care tomorrow.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; width: 120px;">Shift</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{shift_title}}</td></tr>
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Date</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{shift_date}}</td></tr>
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Time</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{shift_time}}</td></tr>
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Location</td><td style="padding: 8px;">{{shift_location}}</td></tr>
    </table>
    <p>Please remember to sign in using the kiosk when you arrive. If you need to cancel, please do so as soon as possible via the volunteer portal or by calling us.</p>
    <a href="{{portal_link}}/dashboard" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; font-weight: bold;">View My Shifts</a>
    <p>See you tomorrow — thank you for showing up for our community!</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>The Lighthouse Care Team</strong></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af;">Lighthouse Care | ABN 87 637 110 948 | <a href="https://lighthousecare.org.au" style="color: #9ca3af;">lighthousecare.org.au</a></p>
  </div>
</body>
</html>`,
    },
    {
      type: 'SHIFT_CANCELLED' as const,
      name: 'Shift Cancelled',
      subject: 'Update: Your shift on {{shift_date}} has been cancelled',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #0d9488; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Shift Cancellation Notice</h1>
  </div>
  <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi {{first_name}},</p>
    <p>We're letting you know that the following shift has been cancelled:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; width: 120px;">Shift</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{shift_title}}</td></tr>
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Date</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{shift_date}}</td></tr>
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Location</td><td style="padding: 8px;">{{shift_location}}</td></tr>
    </table>
    <p>We're sorry for any inconvenience. Please check the volunteer portal for other upcoming shift opportunities.</p>
    <a href="{{portal_link}}/dashboard" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; font-weight: bold;">View Available Shifts</a>
    <p>Thank you for your understanding — and for everything you do for our community.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>The Lighthouse Care Team</strong></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af;">Lighthouse Care | ABN 87 637 110 948 | <a href="https://lighthousecare.org.au" style="color: #9ca3af;">lighthousecare.org.au</a></p>
  </div>
</body>
</html>`,
    },
    {
      type: 'MISSED_SHIFT_FOLLOWUP' as const,
      name: 'Missed Shift Follow-Up',
      subject: 'We missed you at your shift, {{first_name}}',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #0d9488; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">We Missed You</h1>
  </div>
  <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi {{first_name}},</p>
    <p>We noticed that you weren't able to make it to your shift on {{shift_date}} at {{shift_location}}. We hope everything is okay!</p>
    <p>If something came up, no worries at all — life happens. But if you're available, we'd love to have you back for an upcoming shift. There are always families who benefit from your support.</p>
    <a href="{{portal_link}}/dashboard" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; font-weight: bold;">View Upcoming Shifts</a>
    <p>If there's anything we can do to better support you as a volunteer, please don't hesitate to reach out. Your wellbeing matters to us too.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>The Lighthouse Care Team</strong></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af;">Lighthouse Care | ABN 87 637 110 948 | <a href="https://lighthousecare.org.au" style="color: #9ca3af;">lighthousecare.org.au</a></p>
  </div>
</body>
</html>`,
    },
    {
      type: 'INACTIVITY_CHECKIN' as const,
      name: 'Inactivity Check-In',
      subject: 'Checking in — we\'d love to see you back, {{first_name}}',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #0d9488; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">We'd Love to See You Back</h1>
  </div>
  <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi {{first_name}},</p>
    <p>It's been a little while since we've seen you at Lighthouse Care, and we just wanted to check in and say hello.</p>
    <p>We understand that life gets busy, and we completely respect that. But whenever you're ready — even if that's months from now — there will always be a place for you on our team. The families we serve benefit so much from the generosity of people like you.</p>
    <p>If your circumstances have changed and you'd like to pause or step back from volunteering for a while, please let us know so we can update your profile.</p>
    <a href="{{portal_link}}/dashboard" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; font-weight: bold;">Log In to My Portal</a>
    <p>Either way, thank you for everything you've contributed. It hasn't gone unnoticed.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>The Lighthouse Care Team</strong></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af;">Lighthouse Care | ABN 87 637 110 948 | <a href="https://lighthousecare.org.au" style="color: #9ca3af;">lighthousecare.org.au</a></p>
  </div>
</body>
</html>`,
    },
    {
      type: 'ADMIN_NEW_VOLUNTEER' as const,
      name: 'Admin: New Volunteer Sign-Up',
      subject: 'New volunteer sign-up: {{first_name}} {{last_name}}',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #1e40af; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">New Volunteer Sign-Up</h1>
  </div>
  <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p>A new volunteer has signed up and is awaiting induction.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; width: 140px;">Name</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{first_name}} {{last_name}}</td></tr>
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{email}}</td></tr>
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Mobile</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{mobile}}</td></tr>
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Locations</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{preferred_locations}}</td></tr>
      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Interests</td><td style="padding: 8px;">{{areas_of_interest}}</td></tr>
    </table>
    <a href="{{admin_link}}/admin/volunteers/{{volunteer_id}}" style="background: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; font-weight: bold;">View in Admin Portal</a>
  </div>
</body>
</html>`,
    },
    {
      type: 'ADMIN_REPEATED_NOSHOWS' as const,
      name: 'Admin: Repeated No-Shows',
      subject: 'Action required: {{first_name}} {{last_name}} has missed {{noshow_count}} shifts',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #b45309; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Repeated No-Shows Alert</h1>
  </div>
  <div style="background: #fffbeb; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #fde68a; border-top: none;">
    <p><strong>{{first_name}} {{last_name}}</strong> has now missed {{noshow_count}} consecutive scheduled shifts without notification.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; background: #fef3c7; font-weight: bold; width: 140px;">Volunteer</td><td style="padding: 8px; border-bottom: 1px solid #fde68a;">{{first_name}} {{last_name}}</td></tr>
      <tr><td style="padding: 8px; background: #fef3c7; font-weight: bold;">Email</td><td style="padding: 8px; border-bottom: 1px solid #fde68a;">{{email}}</td></tr>
      <tr><td style="padding: 8px; background: #fef3c7; font-weight: bold;">No-Shows</td><td style="padding: 8px; border-bottom: 1px solid #fde68a;">{{noshow_count}}</td></tr>
      <tr><td style="padding: 8px; background: #fef3c7; font-weight: bold;">Last Attended</td><td style="padding: 8px;">{{last_attended}}</td></tr>
    </table>
    <p>We recommend reaching out to check in with this volunteer before taking any action.</p>
    <a href="{{admin_link}}/admin/volunteers/{{volunteer_id}}" style="background: #b45309; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; font-weight: bold;">View Volunteer Profile</a>
  </div>
</body>
</html>`,
    },
    {
      type: 'CUSTOM' as const,
      name: 'Custom Email',
      subject: '{{subject}}',
      bodyHtml: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #0d9488; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Lighthouse Care Volunteers</h1>
  </div>
  <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    {{body}}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af;">Lighthouse Care | ABN 87 637 110 948 | <a href="https://lighthousecare.org.au" style="color: #9ca3af;">lighthousecare.org.au</a></p>
  </div>
</body>
</html>`,
    },
  ]

  for (const template of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { type: template.type },
      update: {},
      create: template,
    })
  }

  console.log('  11 email templates created.')

  // ─── 12. App settings ─────────────────────────────────────────────────────────

  const appSettings = [
    { key: 'app.name', value: 'Lighthouse Care Volunteers', label: 'Application Name', group: 'general' },
    { key: 'app.url', value: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000', label: 'App URL', group: 'general' },
    { key: 'app.org.name', value: 'Lighthouse Care', label: 'Organisation Name', group: 'general' },
    { key: 'app.org.abn', value: '87 637 110 948', label: 'ABN', group: 'general' },
    { key: 'app.org.website', value: 'https://lighthousecare.org.au', label: 'Organisation Website', group: 'general' },
    { key: 'app.org.phone', value: '(07) 3801 0000', label: 'Contact Phone', group: 'general' },
    { key: 'app.org.email', value: 'volunteers@lighthousecare.org.au', label: 'Contact Email', group: 'general' },
    { key: 'induction.quiz.pass_mark', value: '80', label: 'Quiz Pass Mark (%)', group: 'induction' },
    { key: 'induction.quiz.enabled', value: 'true', label: 'Quiz Enabled', group: 'induction' },
    { key: 'volunteers.inactivity.weeks', value: '6', label: 'Inactivity Threshold (weeks)', group: 'volunteers' },
    { key: 'volunteers.noshow.alert_count', value: '3', label: 'No-Show Alert Threshold', group: 'volunteers' },
    { key: 'shifts.reminder.hours_before', value: '24', label: 'Shift Reminder Lead Time (hours)', group: 'shifts' },
    { key: 'email.provider', value: process.env.EMAIL_PROVIDER ?? 'mock', label: 'Email Provider', group: 'email' },
    { key: 'email.from.name', value: process.env.EMAIL_FROM_NAME ?? 'Lighthouse Care', label: 'Email From Name', group: 'email' },
    { key: 'email.from.address', value: process.env.EMAIL_FROM_ADDRESS ?? 'volunteers@lighthousecare.org.au', label: 'Email From Address', group: 'email' },
    { key: 'kiosk.guest.enabled', value: 'true', label: 'Allow Guest Sign-In', group: 'kiosk' },
    { key: 'kiosk.session.timeout_minutes', value: '30', label: 'Kiosk Session Timeout (minutes)', group: 'kiosk' },
  ]

  for (const setting of appSettings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }

  console.log('  App settings created.')
  console.log('')
  console.log('Seeding complete!')
  console.log('')
  console.log('Default credentials:')
  console.log('  Super Admin:  admin@lighthousecare.org.au  /  Admin@1234!')
  console.log('  Kiosk:        kiosk@lighthousecare.org.au  /  Kiosk@1234!')
  console.log('  Volunteers:   sarah.mitchell@example.com   /  Volunteer@1234!')
  console.log('                david.nguyen@example.com     /  Volunteer@1234!')
  console.log('                emma.thompson@example.com    /  Volunteer@1234!')
  console.log('                james.patel@example.com      /  Volunteer@1234!')
  console.log('                lisa.chen@example.com        /  Volunteer@1234!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
