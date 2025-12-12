/**
 * Seed Demo Dashboard Data
 *
 * Populates the AI Receptionist database with realistic example data
 * to demonstrate the dashboard functionality.
 *
 * Run: npx ts-node scripts/seed-demo-dashboard.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding demo dashboard data...\n')

  // ============================================
  // INTAKE 1: High-Score Case (Recent Call)
  // ============================================
  const intake1 = await prisma.intake.upsert({
    where: { intakeId: 'DEMO-INT-001' },
    update: {},
    create: {
      callId: 'CA_demo_001_' + Date.now(),
      intakeId: 'DEMO-INT-001',
      callerPhone: '+12055551234',
      callDuration: 847, // 14 minutes 7 seconds

      // Client Information
      firstName: 'Robert',
      lastName: 'Martinez',
      dateOfBirth: new Date('1968-03-15'),
      age: 56,
      email: 'rmartinez.demo@email.com',
      city: 'Birmingham',
      state: 'AL',

      // Education
      educationLevel: 'High School Diploma',
      educationDetails: 'Graduated 1986, no college education',

      // Medical Information
      conditions: ['Degenerative Disc Disease', 'Chronic Lower Back Pain', 'Sciatica', 'Hypertension'],
      severity: 'Severe',
      durationMonths: 48,
      treatments: ['Physical Therapy', 'Epidural Injections', 'Pain Management', 'Chiropractic Care'],
      hospitalizations: 2,
      medications: ['Gabapentin 600mg', 'Meloxicam 15mg', 'Lisinopril 10mg', 'Cyclobenzaprine PRN'],
      sideEffects: ['Drowsiness', 'Dizziness', 'Memory issues'],

      // Functional Limitations
      functionalLimitations: {
        standing: 'Can only stand for 15-20 minutes before severe pain',
        walking: 'Limited to one block before needing to rest',
        sitting: 'Must shift positions every 30 minutes',
        lifting: 'Cannot lift more than 10 pounds',
        bending: 'Cannot bend at waist without pain',
        reaching: 'Difficulty reaching overhead',
        concentrating: 'Pain interferes with focus and concentration',
        sleeping: 'Wakes 3-4 times per night due to pain'
      },

      // Work History
      workHistory: [
        {
          jobTitle: 'Warehouse Supervisor',
          employer: 'ABC Distribution',
          startDate: '2010',
          endDate: '2022',
          duties: 'Supervising warehouse operations, inventory management, some lifting',
          reasonLeft: 'Back injury made job impossible'
        },
        {
          jobTitle: 'Forklift Operator',
          employer: 'XYZ Logistics',
          startDate: '2002',
          endDate: '2010',
          duties: 'Operating forklift, loading/unloading trucks',
          reasonLeft: 'Better opportunity'
        },
        {
          jobTitle: 'General Laborer',
          employer: 'Various Temp Agencies',
          startDate: '1990',
          endDate: '2002',
          duties: 'Construction, warehouse work, manual labor',
          reasonLeft: 'Found full-time position'
        }
      ],
      totalWorkYears: 32,
      lastWorkDate: new Date('2022-08-15'),
      currentlyWorking: false,
      heaviestLifting: 'Heavy (50+ lbs) - frequently in past roles',

      // Application Status
      applicationStatus: 'Initial Denial',
      denialDate: new Date('2024-06-20'),
      appealDeadline: new Date('2024-08-20'),

      // Scoring
      totalScore: 127,
      recommendation: 'ACCEPT - Strong Case',
      viabilityRating: 'HIGH',
      approvalLikelihood: '78%',
      scoreBreakdown: {
        ageScore: 25,
        medicalScore: 42,
        functionalScore: 28,
        workHistoryScore: 20,
        educationScore: 12
      },
      caseStrengths: [
        'Age 56 - approaching Grid Rule advantages (55+)',
        'Multiple documented medical conditions with objective findings',
        'Long work history establishes strong work record',
        'Limited education restricts sedentary job transfer',
        'Multiple failed conservative treatments documented',
        'Consistent treatment history shows ongoing disability'
      ],
      caseConcerns: [
        'Initial denial will require appeal',
        'Need updated MRI/imaging within last 12 months',
        'May need RFC assessment from treating physician'
      ],

      // Transcript (simulated conversation)
      transcript: [
        { role: 'ai', text: 'Thank you for calling Halcyon Legal. My name is Alex, the AI intake assistant. I\'m here to help gather some information about your disability case. May I have your name please?', timestamp: '00:00' },
        { role: 'human', text: 'Yes, this is Robert Martinez.', timestamp: '00:08' },
        { role: 'ai', text: 'Thank you, Robert. And what\'s a good phone number to reach you at?', timestamp: '00:12' },
        { role: 'human', text: '205-555-1234', timestamp: '00:18' },
        { role: 'ai', text: 'Perfect. Can you tell me your date of birth?', timestamp: '00:22' },
        { role: 'human', text: 'March 15th, 1968', timestamp: '00:26' },
        { role: 'ai', text: 'And what city and state are you in?', timestamp: '00:30' },
        { role: 'human', text: 'Birmingham, Alabama', timestamp: '00:34' },
        { role: 'ai', text: 'Thank you. Now, Robert, can you tell me about your main medical conditions that prevent you from working?', timestamp: '00:40' },
        { role: 'human', text: 'Well, I\'ve got degenerative disc disease in my lower back. I\'ve been dealing with chronic pain for about 4 years now. I also have sciatica that shoots down my left leg, and I have high blood pressure.', timestamp: '00:48' },
        { role: 'ai', text: 'I\'m sorry to hear that. How would you describe the severity of your back condition?', timestamp: '01:15' },
        { role: 'human', text: 'It\'s severe. The pain is constant, ranging from a 6 to a 9 out of 10 on most days. On bad days I can barely get out of bed.', timestamp: '01:22' },
        { role: 'ai', text: 'That sounds very difficult. What treatments have you tried?', timestamp: '01:42' },
        { role: 'human', text: 'I\'ve done physical therapy for about 8 months, had three epidural injections, been to pain management regularly, and tried chiropractic care. Nothing really gives me lasting relief.', timestamp: '01:48' },
        { role: 'ai', text: 'Have you had any hospitalizations related to your conditions?', timestamp: '02:15' },
        { role: 'human', text: 'Yes, twice. Once when my back first went out in 2020, I couldn\'t move at all and went to the ER. Then again last year when the pain got so bad I thought something was really wrong.', timestamp: '02:22' },
        { role: 'ai', text: 'What medications are you currently taking?', timestamp: '02:48' },
        { role: 'human', text: 'I take Gabapentin 600 milligrams three times a day, Meloxicam 15 milligrams daily for inflammation, Lisinopril for my blood pressure, and Cyclobenzaprine as needed for muscle spasms.', timestamp: '02:55' },
        { role: 'ai', text: 'Do the medications cause any side effects?', timestamp: '03:28' },
        { role: 'human', text: 'Yes, the Gabapentin makes me drowsy and dizzy. I also have trouble remembering things sometimes, which I never had before.', timestamp: '03:35' },
        { role: 'ai', text: 'Let me ask about your limitations. How long can you stand in one place?', timestamp: '03:55' },
        { role: 'human', text: 'Maybe 15 to 20 minutes, then I have to sit down or the pain gets really bad.', timestamp: '04:02' },
        { role: 'ai', text: 'And how far can you walk?', timestamp: '04:15' },
        { role: 'human', text: 'About a block, maybe two on a good day. Then I need to rest.', timestamp: '04:20' },
        { role: 'ai', text: 'How much weight can you lift?', timestamp: '04:32' },
        { role: 'human', text: 'Not much anymore. Doctor says nothing over 10 pounds. Even picking up my grandkids hurts.', timestamp: '04:38' },
        { role: 'ai', text: 'Tell me about your work history. What was your last job?', timestamp: '04:55' },
        { role: 'human', text: 'I was a warehouse supervisor at ABC Distribution for about 12 years. Before that I was a forklift operator for 8 years, and before that general labor - construction, warehouse work, things like that.', timestamp: '05:02' },
        { role: 'ai', text: 'When did you last work?', timestamp: '05:35' },
        { role: 'human', text: 'August 2022. I tried to keep going but the pain got too bad. I couldn\'t supervise properly when I could barely stand or walk around the warehouse.', timestamp: '05:42' },
        { role: 'ai', text: 'What was the heaviest lifting required in your jobs?', timestamp: '06:05' },
        { role: 'human', text: 'In the warehouse we regularly lifted 50 pounds or more. As a forklift operator I didn\'t lift as much but there was still loading and unloading by hand sometimes.', timestamp: '06:12' },
        { role: 'ai', text: 'What\'s your highest level of education?', timestamp: '06:38' },
        { role: 'human', text: 'High school diploma. Graduated in 1986. Never went to college, went straight to work.', timestamp: '06:45' },
        { role: 'ai', text: 'Have you applied for Social Security disability benefits?', timestamp: '07:00' },
        { role: 'human', text: 'Yes, I applied about a year ago. They denied me in June.', timestamp: '07:08' },
        { role: 'ai', text: 'Do you know your deadline to appeal?', timestamp: '07:22' },
        { role: 'human', text: 'I think it\'s August 20th. That\'s coming up soon which is why I\'m calling.', timestamp: '07:28' },
        { role: 'ai', text: 'Thank you Robert. Based on what you\'ve told me, your case has several strong factors. Your age, extensive work history, physical limitations, and the denial gives us an opportunity to appeal. Would you like someone from our team to call you back to discuss your case?', timestamp: '07:45' },
        { role: 'human', text: 'Yes, please. I really need help with this. I don\'t know what I\'m going to do if I don\'t get approved.', timestamp: '08:25' },
        { role: 'ai', text: 'I understand, and we\'re here to help. Before I let you go, I need to ask - is it okay if we send you text message updates about your case to this phone number?', timestamp: '08:45' },
        { role: 'human', text: 'Yes, that\'s fine.', timestamp: '09:05' },
        { role: 'ai', text: 'Great. An attorney from our team will reach out to you within 24 hours. Thank you for calling Halcyon Legal, Robert. Take care.', timestamp: '09:10' }
      ],

      // Flags
      isUrgent: true,
      urgentReason: 'Appeal deadline approaching - August 20th',
      crisisMentioned: false,
      transferRequested: false,

      // SMS Consent
      smsConsentGiven: true,
      smsConsentTimestamp: new Date(),
      smsConsentPhone: '+12055551234',
      smsConsentMethod: 'verbal_during_intake_call',

      // Follow-up
      smsSent: true,
      smsTimestamp: new Date(),
      callbackScheduled: true,
      callbackDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow

      // Status
      status: 'PENDING_REVIEW',

      // Notes
      aiNotes: 'Strong case with clear work history and documented medical conditions. Appeal deadline urgent. Grid Rules may apply given age (56) and limited education. Recommend priority callback.'
    }
  })
  console.log('✅ Created Intake 1:', intake1.intakeId)

  // ============================================
  // INTAKE 2: Medium-Score Case
  // ============================================
  const intake2 = await prisma.intake.upsert({
    where: { intakeId: 'DEMO-INT-002' },
    update: {},
    create: {
      callId: 'CA_demo_002_' + Date.now(),
      intakeId: 'DEMO-INT-002',
      callerPhone: '+12055559876',
      callDuration: 612, // 10 minutes

      firstName: 'Sarah',
      lastName: 'Johnson',
      dateOfBirth: new Date('1975-07-22'),
      age: 49,
      city: 'Huntsville',
      state: 'AL',

      educationLevel: 'Some College',

      conditions: ['Fibromyalgia', 'Depression', 'Anxiety'],
      severity: 'Moderate to Severe',
      durationMonths: 36,
      treatments: ['Medication Management', 'Therapy'],
      medications: ['Cymbalta', 'Lyrica', 'Xanax PRN'],

      workHistory: [
        { jobTitle: 'Administrative Assistant', employer: 'Regional Hospital', startDate: '2015', endDate: '2023' }
      ],
      totalWorkYears: 18,
      lastWorkDate: new Date('2023-03-01'),
      currentlyWorking: false,

      totalScore: 68,
      recommendation: 'REVIEW - Moderate Case',
      viabilityRating: 'MEDIUM',
      approvalLikelihood: '45%',

      transcript: [
        { role: 'ai', text: 'Thank you for calling. How can I help you today?', timestamp: '00:00' },
        { role: 'human', text: 'I need help with my disability case.', timestamp: '00:05' }
      ],

      status: 'NEW',
      aiNotes: 'Fibromyalgia case with mental health components. Documentation of objective findings will be important.'
    }
  })
  console.log('✅ Created Intake 2:', intake2.intakeId)

  // ============================================
  // INTAKE 3: Lower Score Case (for variety)
  // ============================================
  const intake3 = await prisma.intake.upsert({
    where: { intakeId: 'DEMO-INT-003' },
    update: {},
    create: {
      callId: 'CA_demo_003_' + Date.now(),
      intakeId: 'DEMO-INT-003',
      callerPhone: '+12055554567',
      callDuration: 425,

      firstName: 'Michael',
      lastName: 'Thompson',
      dateOfBirth: new Date('1985-11-30'),
      age: 39,
      city: 'Mobile',
      state: 'AL',

      educationLevel: "Bachelor's Degree",

      conditions: ['Knee Injury', 'Minor Arthritis'],
      severity: 'Moderate',
      durationMonths: 12,
      treatments: ['Physical Therapy', 'Surgery Pending'],

      workHistory: [
        { jobTitle: 'IT Manager', employer: 'Tech Corp', startDate: '2018', endDate: '2024' }
      ],
      totalWorkYears: 12,
      currentlyWorking: false,

      totalScore: 32,
      recommendation: 'CAUTION - Difficult Case',
      viabilityRating: 'LOW',
      approvalLikelihood: '20%',

      transcript: [],

      status: 'REVIEWED',
      disposition: 'Advised to wait until after surgery for stronger case'
    }
  })
  console.log('✅ Created Intake 3:', intake3.intakeId)

  // ============================================
  // TASKS
  // ============================================
  await prisma.task.createMany({
    data: [
      {
        title: 'Call back Robert Martinez',
        description: 'Priority callback - appeal deadline approaching August 20th',
        priority: 'URGENT',
        status: 'PENDING',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        intakeId: intake1.id,
        assignedTo: 'Attorney Smith'
      },
      {
        title: 'Request medical records',
        description: 'Need updated MRI and treating physician RFC for Martinez case',
        priority: 'HIGH',
        status: 'PENDING',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        intakeId: intake1.id
      },
      {
        title: 'Review Johnson case',
        description: 'Assess fibromyalgia documentation strength',
        priority: 'MEDIUM',
        status: 'PENDING',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        intakeId: intake2.id
      },
      {
        title: 'Follow up with Thompson',
        description: 'Check on surgery schedule',
        priority: 'LOW',
        status: 'COMPLETED',
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        intakeId: intake3.id
      }
    ],
    skipDuplicates: true
  })
  console.log('✅ Created Tasks')

  // ============================================
  // CALLBACK REQUESTS (Messages)
  // ============================================
  await prisma.callbackRequest.createMany({
    data: [
      {
        callId: 'CB_demo_001_' + Date.now(),
        callerPhone: '+12055558888',
        callerName: 'Jennifer Williams',
        purpose: 'Checking on case status - has been 2 weeks since initial consultation',
        category: 'CASE_STATUS',
        priority: 'NORMAL',
        status: 'PENDING',
        transcript: [
          { role: 'ai', text: 'Thank you for calling. How can I help?', timestamp: '00:00' },
          { role: 'human', text: "Hi, I had a consultation two weeks ago and haven't heard back.", timestamp: '00:05' }
        ]
      },
      {
        callId: 'CB_demo_002_' + Date.now(),
        callerPhone: '+12055557777',
        callerName: 'David Brown',
        purpose: 'Has documents to submit for his case',
        category: 'DOCUMENTS',
        priority: 'HIGH',
        status: 'PENDING',
        transcript: []
      },
      {
        callId: 'CB_demo_003_' + Date.now(),
        callerPhone: '+12055556666',
        callerName: 'Unknown Caller',
        purpose: 'General inquiry about disability services',
        category: 'GENERAL',
        priority: 'LOW',
        status: 'COMPLETED',
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        resolution: 'Provided information, caller will call back if interested'
      }
    ],
    skipDuplicates: true
  })
  console.log('✅ Created Callback Requests (Messages)')

  // ============================================
  // ACTIVITIES
  // ============================================
  await prisma.activity.createMany({
    data: [
      {
        type: 'intake_completed',
        actor: 'AI Receptionist',
        details: { score: 127, duration: 847 },
        intakeId: intake1.id
      },
      {
        type: 'sms_consent_given',
        actor: 'Robert Martinez',
        details: { phone: '+12055551234' },
        intakeId: intake1.id
      },
      {
        type: 'sms_sent',
        actor: 'System',
        details: { message: 'Thank you for calling Halcyon Legal. An attorney will contact you within 24 hours.' },
        intakeId: intake1.id
      },
      {
        type: 'intake_completed',
        actor: 'AI Receptionist',
        details: { score: 68, duration: 612 },
        intakeId: intake2.id
      }
    ],
    skipDuplicates: true
  })
  console.log('✅ Created Activities')

  console.log('\n🎉 Demo dashboard data seeded successfully!')
  console.log('\nSummary:')
  console.log('- 3 Intakes (High: 127, Medium: 68, Low: 32)')
  console.log('- 4 Tasks (1 Urgent, 1 High, 1 Medium, 1 Completed)')
  console.log('- 3 Messages (2 Pending, 1 Completed)')
  console.log('- 4 Activity records')
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
