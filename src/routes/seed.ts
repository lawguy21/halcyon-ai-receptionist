/**
 * Seed Route - For seeding demo data remotely
 *
 * POST /api/seed - Seeds demo dashboard data
 * Requires ADMIN_SECRET header for security
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../services/database.js'

interface SeedHeaders {
  'x-admin-secret'?: string
}

export async function seedRoutes(fastify: FastifyInstance) {
  if (!prisma) {
    fastify.log.warn('Prisma not available - seed routes will return mock data')
  }

  fastify.post('/api/seed', async (request: FastifyRequest<{ Headers: SeedHeaders }>, reply: FastifyReply) => {
    // Security check
    const adminSecret = request.headers['x-admin-secret']
    const expectedSecret = process.env.ADMIN_SECRET || 'halcyon-demo-2025'

    if (adminSecret !== expectedSecret) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    if (!prisma) {
      return reply.code(503).send({ error: 'Database not configured' })
    }

    try {
      fastify.log.info('Starting demo data seed...')

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
          callDuration: 847,

          firstName: 'Robert',
          lastName: 'Martinez',
          dateOfBirth: new Date('1968-03-15'),
          age: 56,
          email: 'rmartinez.demo@email.com',
          city: 'Birmingham',
          state: 'AL',

          educationLevel: 'High School Diploma',
          educationDetails: 'Graduated 1986, no college education',

          conditions: ['Degenerative Disc Disease', 'Chronic Lower Back Pain', 'Sciatica', 'Hypertension'],
          severity: 'Severe',
          durationMonths: 48,
          treatments: ['Physical Therapy', 'Epidural Injections', 'Pain Management', 'Chiropractic Care'],
          hospitalizations: 2,
          medications: ['Gabapentin 600mg', 'Meloxicam 15mg', 'Lisinopril 10mg', 'Cyclobenzaprine PRN'],
          sideEffects: ['Drowsiness', 'Dizziness', 'Memory issues'],

          functionalLimitations: {
            standing: 'Can only stand for 15-20 minutes before severe pain',
            walking: 'Limited to one block before needing to rest',
            sitting: 'Must shift positions every 30 minutes',
            lifting: 'Cannot lift more than 10 pounds',
            bending: 'Cannot bend at waist without pain'
          },

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
            }
          ],
          totalWorkYears: 32,
          lastWorkDate: new Date('2022-08-15'),
          currentlyWorking: false,
          heaviestLifting: 'Heavy (50+ lbs)',

          applicationStatus: 'Initial Denial',
          denialDate: new Date('2024-06-20'),
          appealDeadline: new Date('2024-08-20'),

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
            'Multiple failed conservative treatments documented'
          ],
          caseConcerns: [
            'Initial denial will require appeal',
            'Need updated MRI/imaging within last 12 months',
            'May need RFC assessment from treating physician'
          ],

          transcript: [
            { role: 'ai', text: 'Thank you for calling Halcyon Legal. My name is Alex, the AI intake assistant. May I have your name please?', timestamp: '00:00' },
            { role: 'human', text: 'Yes, this is Robert Martinez.', timestamp: '00:08' },
            { role: 'ai', text: 'Thank you, Robert. Can you tell me about your main medical conditions that prevent you from working?', timestamp: '00:15' },
            { role: 'human', text: 'I\'ve got degenerative disc disease in my lower back. I\'ve been dealing with chronic pain for about 4 years now.', timestamp: '00:22' },
            { role: 'ai', text: 'How would you describe the severity?', timestamp: '00:35' },
            { role: 'human', text: 'It\'s severe. The pain is constant, ranging from a 6 to a 9 out of 10 on most days.', timestamp: '00:42' },
            { role: 'ai', text: 'What treatments have you tried?', timestamp: '00:55' },
            { role: 'human', text: 'Physical therapy for about 8 months, three epidural injections, pain management, and chiropractic care. Nothing gives lasting relief.', timestamp: '01:02' },
            { role: 'ai', text: 'Tell me about your work history.', timestamp: '01:25' },
            { role: 'human', text: 'I was a warehouse supervisor for 12 years. Before that I was a forklift operator. All physical work.', timestamp: '01:32' },
            { role: 'ai', text: 'When did you last work?', timestamp: '01:50' },
            { role: 'human', text: 'August 2022. I couldn\'t do it anymore with the pain.', timestamp: '01:56' },
            { role: 'ai', text: 'Have you applied for Social Security disability?', timestamp: '02:08' },
            { role: 'human', text: 'Yes, they denied me in June. My appeal deadline is coming up.', timestamp: '02:15' },
            { role: 'ai', text: 'Based on what you\'ve told me, your case has several strong factors. Would you like an attorney to call you back?', timestamp: '02:30' },
            { role: 'human', text: 'Yes, please. I really need help with this.', timestamp: '02:45' }
          ],

          isUrgent: true,
          urgentReason: 'Appeal deadline approaching - August 20th',
          smsConsentGiven: true,
          smsConsentTimestamp: new Date(),
          smsConsentPhone: '+12055551234',
          smsConsentMethod: 'verbal_during_intake_call',

          status: 'PENDING_REVIEW',
          aiNotes: 'Strong case with clear work history and documented medical conditions. Appeal deadline urgent. Grid Rules may apply given age (56) and limited education.'
        }
      })

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
          callDuration: 612,

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

      // ============================================
      // INTAKE 3: Lower Score Case
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
          disposition: 'Advised to wait until after surgery'
        }
      })

      // ============================================
      // TASKS
      // ============================================
      await prisma.task.deleteMany({ where: { intakeId: { in: [intake1.id, intake2.id, intake3.id] } } })
      await prisma.task.createMany({
        data: [
          {
            title: 'Call back Robert Martinez',
            description: 'Priority callback - appeal deadline approaching',
            priority: 'URGENT',
            status: 'PENDING',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            intakeId: intake1.id,
            assignedTo: 'Attorney Smith'
          },
          {
            title: 'Request medical records',
            description: 'Need updated MRI and treating physician RFC',
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
        ]
      })

      // ============================================
      // CALLBACK REQUESTS (Messages)
      // ============================================
      await prisma.callbackRequest.deleteMany({ where: { callId: { startsWith: 'CB_demo_' } } })
      await prisma.callbackRequest.createMany({
        data: [
          {
            callId: 'CB_demo_001_' + Date.now(),
            callerPhone: '+12055558888',
            callerName: 'Jennifer Williams',
            purpose: 'Checking on case status - 2 weeks since consultation',
            category: 'CASE_STATUS',
            priority: 'NORMAL',
            status: 'PENDING',
            transcript: [
              { role: 'ai', text: 'Thank you for calling. How can I help?', timestamp: '00:00' },
              { role: 'human', text: "I had a consultation two weeks ago and haven't heard back.", timestamp: '00:05' }
            ]
          },
          {
            callId: 'CB_demo_002_' + Date.now(),
            callerPhone: '+12055557777',
            callerName: 'David Brown',
            purpose: 'Has documents to submit for his case',
            category: 'DOCUMENTS',
            priority: 'HIGH',
            status: 'PENDING'
          },
          {
            callId: 'CB_demo_003_' + Date.now(),
            callerPhone: '+12055556666',
            callerName: 'General Inquiry',
            purpose: 'General inquiry about disability services',
            category: 'GENERAL',
            priority: 'LOW',
            status: 'COMPLETED',
            completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            resolution: 'Provided information, caller will call back if interested'
          }
        ]
      })

      fastify.log.info('Demo data seeded successfully')

      return reply.send({
        success: true,
        message: 'Demo data seeded successfully',
        data: {
          intakes: [intake1.intakeId, intake2.intakeId, intake3.intakeId],
          tasks: 4,
          messages: 3
        }
      })

    } catch (error: any) {
      fastify.log.error('Seed error:', error)
      return reply.code(500).send({
        error: 'Failed to seed data',
        details: error.message
      })
    }
  })

  // GET route to check if seed is needed
  fastify.get('/api/seed/status', async (request, reply) => {
    if (!prisma) {
      return reply.send({
        database: false,
        message: 'Database not configured'
      })
    }

    try {
      const intakeCount = await prisma.intake.count()
      return reply.send({
        database: true,
        intakeCount,
        needsSeed: intakeCount === 0
      })
    } catch (error: any) {
      return reply.send({
        database: false,
        error: error.message
      })
    }
  })
}
