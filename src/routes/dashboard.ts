/**
 * HALCYON AI RECEPTIONIST - DASHBOARD API ROUTES
 *
 * API endpoints for the intake management dashboard
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../services/database.js';
import { IntakeStatus, TaskStatus, TaskPriority } from '@prisma/client';
import { scheduler } from '../services/scheduler.js';
import { emailService } from '../services/emailService.js';

// Request types
interface ListIntakesQuery {
  status?: IntakeStatus;
  minScore?: string;
  maxScore?: string;
  isUrgent?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UpdateStatusBody {
  status: IntakeStatus;
  reviewedBy?: string;
  disposition?: string;
  notes?: string;
}

interface CreateTaskBody {
  intakeId?: string;
  title: string;
  description?: string;
  priority?: keyof typeof TaskPriority;
  dueDate?: string;
  assignedTo?: string;
}

export async function dashboardRoutes(app: FastifyInstance) {
  // ============================================
  // DASHBOARD STATS
  // ============================================

  /**
   * GET /api/dashboard/stats
   * Get dashboard statistics
   */
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { startDate?: string; endDate?: string };

    const stats = await db.getDashboardStats(
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined
    );

    return stats;
  });

  // ============================================
  // INTAKES
  // ============================================

  /**
   * GET /api/dashboard/intakes
   * List intakes with filtering and pagination
   */
  app.get('/intakes', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as ListIntakesQuery;

    const result = await db.listIntakes({
      status: query.status,
      minScore: query.minScore ? parseInt(query.minScore) : undefined,
      maxScore: query.maxScore ? parseInt(query.maxScore) : undefined,
      isUrgent: query.isUrgent === 'true' ? true : query.isUrgent === 'false' ? false : undefined,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      search: query.search,
      page: query.page ? parseInt(query.page) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc'
    });

    return result;
  });

  /**
   * GET /api/dashboard/intakes/:id
   * Get single intake by ID
   */
  app.get('/intakes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const intake = await db.getIntake(id);

    if (!intake) {
      return reply.status(404).send({ error: 'Intake not found' });
    }

    return intake;
  });

  /**
   * PATCH /api/dashboard/intakes/:id/status
   * Update intake status
   */
  app.patch('/intakes/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateStatusBody;

    try {
      const intake = await db.updateIntakeStatus(
        id,
        body.status,
        body.reviewedBy,
        body.disposition,
        body.notes
      );

      return intake;
    } catch (error) {
      return reply.status(400).send({ error: 'Failed to update status' });
    }
  });

  /**
   * POST /api/dashboard/intakes/:id/notes
   * Add notes to intake
   */
  app.post('/intakes/:id/notes', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { notes: string; author: string };

    const intake = await db.getIntake(id);
    if (!intake) {
      return reply.status(404).send({ error: 'Intake not found' });
    }

    // Append to existing notes
    const existingNotes = intake.humanNotes || '';
    const timestamp = new Date().toISOString();
    const newNotes = existingNotes
      ? `${existingNotes}\n\n[${timestamp}] ${body.author}:\n${body.notes}`
      : `[${timestamp}] ${body.author}:\n${body.notes}`;

    await db.updateIntakeStatus(id, intake.status, undefined, undefined, newNotes);

    // Log activity
    await db.logActivity(id, 'note_added', body.author, { noteLength: body.notes.length });

    return { success: true };
  });

  // ============================================
  // TASKS
  // ============================================

  /**
   * GET /api/dashboard/tasks
   * List tasks
   */
  app.get('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      status?: TaskStatus;
      assignedTo?: string;
      intakeId?: string;
      priority?: TaskPriority;
      dueBefore?: string;
    };

    const tasks = await db.listTasks({
      status: query.status,
      assignedTo: query.assignedTo,
      intakeId: query.intakeId,
      priority: query.priority,
      dueBefore: query.dueBefore ? new Date(query.dueBefore) : undefined
    });

    return tasks;
  });

  /**
   * POST /api/dashboard/tasks
   * Create a task
   */
  app.post('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateTaskBody;

    const task = await db.createTask({
      intakeId: body.intakeId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      assignedTo: body.assignedTo
    });

    return task;
  });

  /**
   * POST /api/dashboard/tasks/:id/complete
   * Complete a task
   */
  app.post('/tasks/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { completedBy: string };

    const task = await db.completeTask(id, body.completedBy);
    return task;
  });

  // ============================================
  // QUICK ACTIONS
  // ============================================

  /**
   * POST /api/dashboard/intakes/:id/accept
   * Accept a case
   */
  app.post('/intakes/:id/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reviewedBy: string; notes?: string };

    const intake = await db.updateIntakeStatus(
      id,
      'ACCEPTED',
      body.reviewedBy,
      'Case accepted for representation',
      body.notes
    );

    // Create onboarding task
    await db.createTask({
      intakeId: id,
      title: 'Onboard new client',
      description: 'Send retainer agreement and collect initial documents',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
    });

    return intake;
  });

  /**
   * POST /api/dashboard/intakes/:id/decline
   * Decline a case
   */
  app.post('/intakes/:id/decline', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reviewedBy: string; reason: string; notes?: string };

    const intake = await db.updateIntakeStatus(
      id,
      'DECLINED',
      body.reviewedBy,
      body.reason,
      body.notes
    );

    return intake;
  });

  /**
   * POST /api/dashboard/intakes/:id/schedule-callback
   * Schedule a callback
   */
  app.post('/intakes/:id/schedule-callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      callbackDate: string;
      assignedTo: string;
      notes?: string;
    };

    // Create callback task
    const task = await db.createTask({
      intakeId: id,
      title: `Callback scheduled`,
      description: body.notes || 'Follow up call with potential client',
      priority: 'HIGH',
      dueDate: new Date(body.callbackDate),
      assignedTo: body.assignedTo
    });

    // Log activity
    await db.logActivity(id, 'callback_scheduled', body.assignedTo, {
      callbackDate: body.callbackDate
    });

    return { success: true, task };
  });

  // ============================================
  // REPORTS
  // ============================================

  /**
   * GET /api/dashboard/reports/score-distribution
   * Get score distribution data
   */
  app.get('/reports/score-distribution', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { startDate?: string; endDate?: string };

    const stats = await db.getDashboardStats(
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined
    );

    return {
      distribution: stats.scoreBuckets,
      avgScore: stats.avgScore
    };
  });

  /**
   * GET /api/dashboard/reports/conversion
   * Get conversion funnel data
   */
  app.get('/reports/conversion', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { startDate?: string; endDate?: string };

    const stats = await db.getDashboardStats(
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined
    );

    return {
      totalIntakes: stats.totalIntakes,
      byStatus: stats.statusCounts,
      conversionRate: stats.statusCounts['ACCEPTED']
        ? ((stats.statusCounts['ACCEPTED'] / stats.totalIntakes) * 100).toFixed(1)
        : 0
    };
  });

  // ============================================
  // MESSAGES / CALLBACK REQUESTS
  // ============================================

  /**
   * GET /api/dashboard/messages
   * List callback requests/messages
   */
  app.get('/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      status?: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
      category?: string;
      priority?: string;
      page?: string;
      pageSize?: string;
    };

    const result = await db.listCallbackRequests({
      status: query.status,
      category: query.category as any,
      priority: query.priority as any,
      page: query.page ? parseInt(query.page) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize) : 20
    });

    return result;
  });

  /**
   * POST /api/dashboard/messages
   * Create a new callback request/message manually
   */
  app.post('/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      callId: string;
      callerPhone: string;
      callerName?: string;
      purpose: string;
      category: string;
      priority?: string;
      notes?: string;
      transcript?: Array<{ role: string; text: string; timestamp: string }>;
    };

    try {
      const messageId = await db.saveCallbackRequest({
        callId: body.callId,
        callerPhone: body.callerPhone,
        callerName: body.callerName,
        purpose: body.purpose,
        category: body.category,
        priority: body.priority,
        notes: body.notes,
        transcript: body.transcript?.map(t => ({
          role: t.role,
          content: t.text,
          timestamp: new Date(t.timestamp)
        }))
      });

      return { success: true, id: messageId };
    } catch (error) {
      return reply.status(400).send({ error: 'Failed to create message' });
    }
  });

  /**
   * GET /api/dashboard/messages/:id
   * Get single message by ID
   */
  app.get('/messages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const message = await db.getCallbackRequest(id);

    if (!message) {
      return reply.status(404).send({ error: 'Message not found' });
    }

    return message;
  });

  /**
   * PATCH /api/dashboard/messages/:id/status
   * Update message status
   */
  app.patch('/messages/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
      completedBy?: string;
      resolution?: string;
    };

    try {
      const message = await db.updateCallbackStatus(
        id,
        body.status,
        body.completedBy,
        body.resolution
      );

      return message;
    } catch (error) {
      return reply.status(400).send({ error: 'Failed to update status' });
    }
  });

  /**
   * POST /api/dashboard/messages/:id/complete
   * Mark message as completed
   */
  app.post('/messages/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { completedBy: string; resolution?: string };

    const message = await db.updateCallbackStatus(
      id,
      'COMPLETED',
      body.completedBy,
      body.resolution
    );

    return message;
  });

  /**
   * GET /api/dashboard/messages/stats
   * Get message statistics
   */
  app.get('/messages/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const [pending, urgent, today] = await Promise.all([
      db.listCallbackRequests({ status: 'PENDING', pageSize: 1000 }),
      db.listCallbackRequests({ status: 'PENDING', priority: 'URGENT' as any, pageSize: 1000 }),
      db.listCallbackRequests({ status: 'PENDING', pageSize: 1000 })
    ]);

    // Count by category
    const byCategory: Record<string, number> = {};
    pending.requests.forEach(r => {
      byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    });

    return {
      totalPending: pending.pagination.total,
      urgentCount: urgent.pagination.total,
      byCategory
    };
  });

  // ============================================
  // EMAIL / DIGEST
  // ============================================

  /**
   * POST /api/dashboard/email/send-digest
   * Manually trigger the daily digest email (useful for testing)
   */
  app.post('/email/send-digest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await scheduler.runDailyDigest();
      return { success: true, message: 'Daily digest sent' };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to send daily digest' });
    }
  });

  /**
   * POST /api/dashboard/email/test
   * Send a test email to verify SendGrid configuration
   */
  app.post('/email/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email?: string };

    try {
      // Send a simple test intake notification
      await emailService.sendIntakeNotification({
        id: 'TEST_' + Date.now(),
        callerName: 'Test User',
        callerPhone: '555-555-5555',
        totalScore: 8,
        isUrgent: false,
        conditions: ['Test Condition 1', 'Test Condition 2'],
        caseStrengths: ['Strong medical documentation', 'Age-related benefits'],
        caseConcerns: ['Recent work history'],
        aiSummary: 'This is a test email to verify SendGrid integration is working correctly.',
        createdAt: new Date()
      });

      return { success: true, message: 'Test email sent' };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to send test email',
        details: error.message
      });
    }
  });
}
