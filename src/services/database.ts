/**
 * HALCYON AI RECEPTIONIST - DATABASE SERVICE
 *
 * Handles all database operations using Prisma
 * DATABASE IS OPTIONAL - calls will work without persistence if DATABASE_URL is not set
 */

import { PrismaClient, IntakeStatus, TaskPriority, TaskStatus, CallbackCategory, CallbackPriority } from '@prisma/client';
import { IntakeResult } from './intakeSession.js';
import { logger } from '../utils/logger.js';

// Check if database is configured
const isDatabaseConfigured = !!process.env.DATABASE_URL;

// Global Prisma client (singleton pattern) - only create if DATABASE_URL exists
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null };

export const prisma: PrismaClient | null = isDatabaseConfigured
  ? (globalForPrisma.prisma || new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    }))
  : null;

if (isDatabaseConfigured && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

if (!isDatabaseConfigured) {
  logger.warn({ event: 'database_not_configured', message: 'DATABASE_URL not set - running without persistence' });
}

export class DatabaseService {
  /**
   * Check if database is available
   */
  isAvailable(): boolean {
    return isDatabaseConfigured && prisma !== null;
  }

  /**
   * Save a completed intake record
   */
  async saveIntake(result: IntakeResult): Promise<string> {
    if (!prisma) {
      logger.warn({ event: 'intake_not_saved', reason: 'Database not configured' });
      return `NOSAVE_${result.intakeId}`;
    }

    try {
      const intake = await prisma.intake.create({
        data: {
          callId: result.callId,
          intakeId: result.intakeId,
          callDuration: result.data.transcript.length > 0
            ? Math.floor((new Date().getTime() - result.createdAt.getTime()) / 1000)
            : null,
          callerPhone: result.data.demographics.phone || 'unknown',

          // Client info
          firstName: result.data.demographics.firstName,
          lastName: result.data.demographics.lastName,
          dateOfBirth: result.data.demographics.dateOfBirth
            ? new Date(result.data.demographics.dateOfBirth)
            : null,
          age: result.data.demographics.age,
          email: result.data.demographics.email,
          city: result.data.demographics.city,
          state: result.data.demographics.state,

          // Education
          educationLevel: result.data.education.level,
          educationDetails: result.data.education.details,

          // Medical
          conditions: result.data.medical.conditions,
          severity: result.data.medical.severity,
          durationMonths: result.data.medical.durationMonths,
          treatments: result.data.medical.treatments,
          hospitalizations: result.data.medical.hospitalizations || 0,
          medications: result.data.medical.medications,
          sideEffects: result.data.medical.sideEffects,

          // Functional limitations
          functionalLimitations: result.data.functionalLimitations as object,

          // Work history
          workHistory: result.data.workHistory.jobs,
          totalWorkYears: result.data.workHistory.totalWorkYears,
          lastWorkDate: result.data.workHistory.lastWorkDate
            ? new Date(result.data.workHistory.lastWorkDate)
            : null,
          currentlyWorking: result.data.workHistory.currentlyWorking || false,
          heaviestLifting: result.data.workHistory.heaviestLifting,

          // Application
          applicationStatus: result.data.application.status,
          denialDate: result.data.application.denialDate
            ? new Date(result.data.application.denialDate)
            : null,
          hearingDate: result.data.application.hearingDate
            ? new Date(result.data.application.hearingDate)
            : null,

          // Scoring
          totalScore: result.scoring.totalScore,
          recommendation: result.scoring.recommendation,
          viabilityRating: result.scoring.viabilityRating,
          approvalLikelihood: result.scoring.approvalLikelihood,
          caseStrengths: result.scoring.caseStrengths,
          caseConcerns: result.scoring.caseConcerns,

          // Transcript
          transcript: result.data.transcript,

          // Flags
          isUrgent: result.flags.urgent,
          urgentReason: result.flags.urgentReason,
          crisisMentioned: result.flags.crisisMentioned,
          transferRequested: result.flags.transferRequested,

          // SMS Consent (TCPA Compliance)
          smsConsentGiven: result.data.smsConsent?.consentGiven || false,
          smsConsentTimestamp: result.data.smsConsent?.consentTimestamp,
          smsConsentPhone: result.data.smsConsent?.phoneNumber,
          smsConsentMethod: result.data.smsConsent?.consentGiven ? 'verbal_during_intake_call' : null,

          // Notes
          aiNotes: result.data.notes,

          // Status
          status: this.mapRecommendationToStatus(result.scoring.recommendation)
        }
      });

      // Log activity
      await this.logActivity(intake.id, 'intake_created', 'system', {
        score: result.scoring.totalScore,
        recommendation: result.scoring.recommendation
      });

      // Create follow-up task if high score
      if (result.scoring.totalScore >= 70) {
        await this.createTask({
          intakeId: intake.id,
          title: `High Priority Callback: ${result.data.demographics.firstName} ${result.data.demographics.lastName}`,
          description: `Score: ${result.scoring.totalScore}. Call within 24 hours.`,
          priority: 'URGENT',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
      } else if (result.scoring.totalScore >= 45) {
        await this.createTask({
          intakeId: intake.id,
          title: `Callback: ${result.data.demographics.firstName} ${result.data.demographics.lastName}`,
          description: `Score: ${result.scoring.totalScore}. Call within 48 hours.`,
          priority: 'HIGH',
          dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
        });
      }

      // Update daily stats
      await this.updateDailyStats(result);

      logger.info({
        event: 'intake_saved',
        intakeId: intake.id,
        score: result.scoring.totalScore
      });

      return intake.id;

    } catch (error) {
      logger.error({ event: 'intake_save_failed', error });
      throw error;
    }
  }

  /**
   * Get intake by ID
   */
  async getIntake(id: string) {
    if (!prisma) return null;
    return prisma.intake.findUnique({
      where: { id },
      include: {
        tasks: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });
  }

  /**
   * Get intake by call ID
   */
  async getIntakeByCallId(callId: string) {
    if (!prisma) return null;
    return prisma.intake.findUnique({
      where: { callId }
    });
  }

  /**
   * List intakes with filtering
   */
  async listIntakes(params: {
    status?: IntakeStatus;
    minScore?: number;
    maxScore?: number;
    isUrgent?: boolean;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    if (!prisma) return { intakes: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    const {
      status,
      minScore,
      maxScore,
      isUrgent,
      startDate,
      endDate,
      search,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (isUrgent !== undefined) where.isUrgent = isUrgent;

    if (minScore !== undefined || maxScore !== undefined) {
      where.totalScore = {};
      if (minScore !== undefined) (where.totalScore as Record<string, number>).gte = minScore;
      if (maxScore !== undefined) (where.totalScore as Record<string, number>).lte = maxScore;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { callerPhone: { contains: search } },
        { intakeId: { contains: search } }
      ];
    }

    const [intakes, total] = await Promise.all([
      prisma.intake.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          intakeId: true,
          callId: true,
          createdAt: true,
          firstName: true,
          lastName: true,
          callerPhone: true,
          age: true,
          city: true,
          state: true,
          totalScore: true,
          recommendation: true,
          viabilityRating: true,
          status: true,
          isUrgent: true,
          urgentReason: true,
          conditions: true,
          applicationStatus: true
        }
      }),
      prisma.intake.count({ where })
    ]);

    return {
      intakes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  /**
   * Update intake status
   */
  async updateIntakeStatus(
    id: string,
    status: IntakeStatus,
    reviewedBy?: string,
    disposition?: string,
    notes?: string
  ) {
    if (!prisma) return null;
    const intake = await prisma.intake.update({
      where: { id },
      data: {
        status,
        reviewedBy,
        reviewedAt: new Date(),
        disposition,
        humanNotes: notes
      }
    });

    await this.logActivity(id, 'status_changed', reviewedBy || 'system', {
      newStatus: status,
      disposition
    });

    return intake;
  }

  /**
   * Update SMS sent status
   */
  async markSmsSent(id: string) {
    if (!prisma) return null;
    return prisma.intake.update({
      where: { id },
      data: {
        smsSent: true,
        smsTimestamp: new Date()
      }
    });
  }

  /**
   * Create a task
   */
  async createTask(params: {
    intakeId?: string;
    title: string;
    description?: string;
    priority?: keyof typeof TaskPriority;
    dueDate?: Date;
    assignedTo?: string;
  }) {
    if (!prisma) return null;
    return prisma.task.create({
      data: {
        intakeId: params.intakeId,
        title: params.title,
        description: params.description,
        priority: params.priority || 'MEDIUM',
        dueDate: params.dueDate,
        assignedTo: params.assignedTo
      }
    });
  }

  /**
   * List tasks
   */
  async listTasks(params: {
    status?: TaskStatus;
    assignedTo?: string;
    intakeId?: string;
    priority?: TaskPriority;
    dueBefore?: Date;
  }) {
    if (!prisma) return [];
    const where: Record<string, unknown> = {};

    if (params.status) where.status = params.status;
    if (params.assignedTo) where.assignedTo = params.assignedTo;
    if (params.intakeId) where.intakeId = params.intakeId;
    if (params.priority) where.priority = params.priority;
    if (params.dueBefore) where.dueDate = { lte: params.dueBefore };

    return prisma.task.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' }
      ],
      include: {
        intake: {
          select: {
            firstName: true,
            lastName: true,
            callerPhone: true,
            totalScore: true
          }
        }
      }
    });
  }

  /**
   * Complete a task
   */
  async completeTask(id: string, completedBy: string) {
    if (!prisma) return null;
    return prisma.task.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedBy
      }
    });
  }

  /**
   * Log an activity
   */
  async logActivity(
    intakeId: string | null,
    type: string,
    actor: string,
    details: Record<string, unknown> = {}
  ) {
    if (!prisma) return null;
    return prisma.activity.create({
      data: {
        intakeId,
        type,
        actor,
        details: details as object
      }
    });
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(startDate?: Date, endDate?: Date) {
    if (!prisma) {
      return {
        totalIntakes: 0,
        statusCounts: {},
        scoreBuckets: [],
        avgScore: 0,
        recentIntakes: [],
        pendingTasks: 0,
        urgentCases: 0
      };
    }
    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [
      totalIntakes,
      statusCounts,
      scoreBuckets,
      avgScore,
      recentIntakes,
      pendingTasks,
      urgentCases
    ] = await Promise.all([
      // Total intakes
      prisma.intake.count({ where }),

      // Count by status
      prisma.intake.groupBy({
        by: ['status'],
        where,
        _count: true
      }),

      // Score distribution
      prisma.$queryRaw`
        SELECT
          CASE
            WHEN "totalScore" >= 70 THEN 'high'
            WHEN "totalScore" >= 45 THEN 'medium'
            WHEN "totalScore" >= 25 THEN 'low'
            ELSE 'very_low'
          END as bucket,
          COUNT(*)::int as count
        FROM "Intake"
        WHERE "createdAt" >= COALESCE(${startDate}, '1970-01-01'::timestamp)
          AND "createdAt" <= COALESCE(${endDate}, NOW())
        GROUP BY bucket
      `,

      // Average score
      prisma.intake.aggregate({
        where,
        _avg: { totalScore: true }
      }),

      // Recent intakes
      prisma.intake.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          intakeId: true,
          createdAt: true,
          firstName: true,
          lastName: true,
          totalScore: true,
          status: true,
          isUrgent: true
        }
      }),

      // Pending tasks
      prisma.task.count({
        where: { status: 'PENDING' }
      }),

      // Urgent cases
      prisma.intake.count({
        where: { ...where, isUrgent: true, status: 'NEW' }
      })
    ]);

    return {
      totalIntakes,
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      scoreBuckets,
      avgScore: avgScore._avg.totalScore || 0,
      recentIntakes,
      pendingTasks,
      urgentCases
    };
  }

  /**
   * Update daily stats
   */
  private async updateDailyStats(result: IntakeResult) {
    if (!prisma) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scoreCategory = result.scoring.totalScore >= 70 ? 'high'
      : result.scoring.totalScore >= 45 ? 'medium' : 'low';

    await prisma.dailyStats.upsert({
      where: { date: today },
      create: {
        date: today,
        totalCalls: 1,
        completedCalls: result.outcome === 'completed' ? 1 : 0,
        highScoreCalls: scoreCategory === 'high' ? 1 : 0,
        mediumScoreCalls: scoreCategory === 'medium' ? 1 : 0,
        lowScoreCalls: scoreCategory === 'low' ? 1 : 0
      },
      update: {
        totalCalls: { increment: 1 },
        completedCalls: result.outcome === 'completed' ? { increment: 1 } : undefined,
        highScoreCalls: scoreCategory === 'high' ? { increment: 1 } : undefined,
        mediumScoreCalls: scoreCategory === 'medium' ? { increment: 1 } : undefined,
        lowScoreCalls: scoreCategory === 'low' ? { increment: 1 } : undefined
      }
    });
  }

  /**
   * Map recommendation to initial status
   */
  private mapRecommendationToStatus(recommendation: string): IntakeStatus {
    switch (recommendation) {
      case 'highly_recommended':
      case 'recommended':
        return 'PENDING_REVIEW';
      default:
        return 'NEW';
    }
  }

  /**
   * Save a callback request (non-intake call)
   */
  async saveCallbackRequest(params: {
    callId: string;
    callerPhone: string;
    callerName?: string;
    purpose: string;
    category: string;
    priority?: string;
    notes?: string;
    transcript?: Array<{ role: string; content: string; timestamp: Date }>;
  }): Promise<string> {
    if (!prisma) {
      logger.warn({ event: 'callback_not_saved', reason: 'Database not configured' });
      return `NOSAVE_${params.callId}`;
    }
    try {
      // Map category string to enum
      const categoryMap: Record<string, CallbackCategory> = {
        'EXISTING_CLIENT': 'EXISTING_CLIENT',
        'CASE_STATUS': 'CASE_STATUS',
        'BILLING': 'BILLING',
        'DOCUMENTS': 'DOCUMENTS',
        'REFERRAL': 'REFERRAL',
        'VENDOR': 'VENDOR',
        'GENERAL': 'GENERAL',
        'OTHER': 'OTHER'
      };

      // Map priority string to enum
      const priorityMap: Record<string, CallbackPriority> = {
        'LOW': 'LOW',
        'NORMAL': 'NORMAL',
        'HIGH': 'HIGH',
        'URGENT': 'URGENT'
      };

      const callbackRequest = await prisma.callbackRequest.create({
        data: {
          callId: params.callId,
          callerPhone: params.callerPhone,
          callerName: params.callerName,
          purpose: params.purpose,
          category: categoryMap[params.category] || 'GENERAL',
          priority: priorityMap[params.priority || 'NORMAL'] || 'NORMAL',
          notes: params.notes,
          transcript: params.transcript || []
        }
      });

      // Create a task for the callback
      const priorityToTaskPriority: Record<string, keyof typeof TaskPriority> = {
        'LOW': 'LOW',
        'NORMAL': 'MEDIUM',
        'HIGH': 'HIGH',
        'URGENT': 'URGENT'
      };

      const dueHours = params.priority === 'URGENT' ? 24 : params.priority === 'HIGH' ? 48 : 72;

      await prisma.task.create({
        data: {
          title: `Callback: ${params.callerName || 'Unknown Caller'}`,
          description: `Purpose: ${params.purpose}\nCategory: ${params.category}\nPhone: ${params.callerPhone}`,
          priority: priorityToTaskPriority[params.priority || 'NORMAL'] || 'MEDIUM',
          dueDate: new Date(Date.now() + dueHours * 60 * 60 * 1000)
        }
      });

      logger.info({
        event: 'callback_request_saved',
        callbackId: callbackRequest.id,
        category: params.category,
        priority: params.priority
      });

      return callbackRequest.id;

    } catch (error) {
      logger.error({ event: 'callback_request_save_failed', error });
      throw error;
    }
  }

  /**
   * Get callback request by ID
   */
  async getCallbackRequest(id: string) {
    if (!prisma) return null;
    return prisma.callbackRequest.findUnique({
      where: { id }
    });
  }

  /**
   * List callback requests
   */
  async listCallbackRequests(params: {
    status?: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
    category?: CallbackCategory;
    priority?: CallbackPriority;
    page?: number;
    pageSize?: number;
  }) {
    if (!prisma) return { requests: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    const {
      status,
      category,
      priority,
      page = 1,
      pageSize = 20
    } = params;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;

    const [requests, total] = await Promise.all([
      prisma.callbackRequest.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.callbackRequest.count({ where })
    ]);

    return {
      requests,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  /**
   * Update callback request status
   */
  async updateCallbackStatus(
    id: string,
    status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED',
    completedBy?: string,
    resolution?: string
  ) {
    if (!prisma) return null;
    return prisma.callbackRequest.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
        completedBy,
        resolution
      }
    });
  }
}

// Export singleton instance
export const db = new DatabaseService();
