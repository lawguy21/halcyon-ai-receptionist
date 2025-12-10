/**
 * HALCYON AI RECEPTIONIST - SCHEDULER SERVICE
 *
 * Handles scheduled tasks like daily digest emails
 */

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { emailService } from './emailService.js';
import { db } from './database.js';

class Scheduler {
  private dailyDigestTimer: NodeJS.Timeout | null = null;

  /**
   * Start the scheduler
   */
  start(): void {
    if (config.email.enableDailyDigest) {
      this.scheduleDailyDigest();
      logger.info({
        event: 'scheduler_started',
        dailyDigestHour: config.email.dailyDigestHour
      });
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.dailyDigestTimer) {
      clearTimeout(this.dailyDigestTimer);
      this.dailyDigestTimer = null;
      logger.info({ event: 'scheduler_stopped' });
    }
  }

  /**
   * Schedule the daily digest to run at the configured hour
   */
  private scheduleDailyDigest(): void {
    const now = new Date();
    const targetHour = config.email.dailyDigestHour;

    // Calculate next run time
    const nextRun = new Date();
    nextRun.setHours(targetHour, 0, 0, 0);

    // If the target hour has passed today, schedule for tomorrow
    if (now.getHours() >= targetHour) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const msUntilNextRun = nextRun.getTime() - now.getTime();

    logger.info({
      event: 'daily_digest_scheduled',
      nextRun: nextRun.toISOString(),
      msUntilNextRun
    });

    this.dailyDigestTimer = setTimeout(async () => {
      await this.runDailyDigest();
      // Reschedule for the next day
      this.scheduleDailyDigest();
    }, msUntilNextRun);
  }

  /**
   * Run the daily digest
   */
  async runDailyDigest(): Promise<void> {
    logger.info({ event: 'daily_digest_running' });

    try {
      // Get yesterday's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Fetch stats
      const stats = await db.getDashboardStats(yesterday, today);

      // Fetch high-score intakes from yesterday
      const intakesResult = await db.listIntakes({
        startDate: yesterday,
        endDate: today,
        minScore: 6,
        pageSize: 10,
        sortBy: 'totalScore',
        sortOrder: 'desc'
      });

      // Fetch pending messages
      const messagesResult = await db.listCallbackRequests({
        status: 'PENDING',
        pageSize: 10
      });

      // Count urgent items
      const urgentIntakes = intakesResult.intakes.filter(i => i.isUrgent).length;
      const urgentMessages = messagesResult.requests.filter(m => m.priority === 'URGENT').length;

      // Format date for display
      const dateStr = yesterday.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Build status summary
      const statusSummary: Record<string, number> = {};
      if (stats.statusCounts) {
        Object.entries(stats.statusCounts).forEach(([status, count]) => {
          if (count > 0) {
            statusSummary[status] = count;
          }
        });
      }

      // Send the digest
      await emailService.sendDailyDigest({
        date: dateStr,
        newIntakes: stats.totalIntakes || 0,
        newMessages: messagesResult.pagination.total,
        urgentItems: urgentIntakes + urgentMessages,
        highScoreIntakes: intakesResult.intakes.map(intake => ({
          id: intake.id,
          callerName: `${intake.firstName || ''} ${intake.lastName || ''}`.trim() || 'Unknown',
          callerPhone: intake.callerPhone,
          totalScore: intake.totalScore,
          isUrgent: intake.isUrgent,
          conditions: intake.conditions || [],
          caseStrengths: intake.caseStrengths || [],
          caseConcerns: intake.caseConcerns || [],
          createdAt: intake.createdAt
        })),
        pendingMessages: messagesResult.requests.map(msg => ({
          id: msg.id,
          callerName: msg.callerName || undefined,
          callerPhone: msg.callerPhone,
          purpose: msg.purpose,
          category: msg.category,
          priority: msg.priority,
          notes: msg.notes || undefined,
          createdAt: msg.createdAt
        })),
        statusSummary
      });

      logger.info({
        event: 'daily_digest_sent',
        date: dateStr,
        intakeCount: stats.totalIntakes,
        messageCount: messagesResult.pagination.total
      });
    } catch (error) {
      logger.error({
        event: 'daily_digest_failed',
        error
      });
    }
  }
}

export const scheduler = new Scheduler();
