/**
 * HALCYON AI RECEPTIONIST - EMAIL SERVICE
 *
 * Handles sending emails via SendGrid:
 * - Staff notifications for new intakes and messages
 * - Client confirmation emails after intake
 * - Daily digest summaries
 */

import sgMail from '@sendgrid/mail';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Initialize SendGrid
if (config.email.sendgridApiKey) {
  sgMail.setApiKey(config.email.sendgridApiKey);
}

interface IntakeData {
  id: string;
  callerName: string;
  callerPhone: string;
  totalScore: number;
  isUrgent: boolean;
  conditions: string[];
  caseStrengths: string[];
  caseConcerns: string[];
  aiSummary?: string;
  createdAt: Date;
}

interface MessageData {
  id: string;
  callerName?: string;
  callerPhone: string;
  purpose: string;
  category: string;
  priority: string;
  notes?: string;
  createdAt: Date;
}

interface DailyDigestData {
  date: string;
  newIntakes: number;
  newMessages: number;
  urgentItems: number;
  highScoreIntakes: IntakeData[];
  pendingMessages: MessageData[];
  statusSummary: Record<string, number>;
}

export class EmailService {
  private enabled: boolean;

  constructor() {
    this.enabled = !!(config.email.sendgridApiKey && config.email.fromEmail);

    if (!this.enabled) {
      logger.warn({ event: 'email_service_disabled', reason: 'Missing SendGrid API key or from email' });
    }
  }

  /**
   * Send staff notification for new intake
   */
  async sendIntakeNotification(intake: IntakeData): Promise<void> {
    if (!this.enabled || !config.email.enableNotifications) {
      logger.info({ event: 'email_notification_skipped', type: 'intake', id: intake.id });
      return;
    }

    const scoreCategory = this.getScoreCategory(intake.totalScore);
    const urgentBadge = intake.isUrgent ? '🚨 URGENT - ' : '';

    const subject = `${urgentBadge}New Intake: ${intake.callerName} (Score: ${intake.totalScore}/10)`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${this.getScoreColor(intake.totalScore)}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .score-display { font-size: 48px; font-weight: bold; text-align: center; margin: 10px 0; }
    .section { margin: 20px 0; }
    .section h3 { color: #374151; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-urgent { background: #ef4444; color: white; }
    .badge-high { background: #10b981; color: white; }
    .badge-medium { background: #f59e0b; color: white; }
    .badge-low { background: #ef4444; color: white; }
    .list { list-style: none; padding: 0; }
    .list li { padding: 5px 0; padding-left: 20px; position: relative; }
    .list li.strength::before { content: '✓'; position: absolute; left: 0; color: #10b981; }
    .list li.concern::before { content: '!'; position: absolute; left: 0; color: #f59e0b; }
    .footer { background: #1f2937; color: #9ca3af; padding: 15px 20px; border-radius: 0 0 8px 8px; font-size: 14px; }
    .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 10px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 New Intake Received</h1>
      ${intake.isUrgent ? '<span class="badge badge-urgent">URGENT</span>' : ''}
    </div>

    <div class="content">
      <div class="score-display" style="color: ${this.getScoreColor(intake.totalScore)}">
        ${intake.totalScore}/10
      </div>
      <p style="text-align: center; margin: 0;">
        <span class="badge badge-${scoreCategory}">${scoreCategory.toUpperCase()} PRIORITY</span>
      </p>

      <div class="section">
        <h3>Caller Information</h3>
        <div class="info-row">
          <span class="info-label">Name</span>
          <span class="info-value">${intake.callerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phone</span>
          <span class="info-value">${this.formatPhone(intake.callerPhone)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Call Time</span>
          <span class="info-value">${this.formatDate(intake.createdAt)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Reference ID</span>
          <span class="info-value">${intake.id}</span>
        </div>
      </div>

      ${intake.conditions && intake.conditions.length > 0 ? `
      <div class="section">
        <h3>Medical Conditions</h3>
        <p>${intake.conditions.join(', ')}</p>
      </div>
      ` : ''}

      ${intake.caseStrengths && intake.caseStrengths.length > 0 ? `
      <div class="section">
        <h3>Case Strengths</h3>
        <ul class="list">
          ${intake.caseStrengths.map(s => `<li class="strength">${s}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${intake.caseConcerns && intake.caseConcerns.length > 0 ? `
      <div class="section">
        <h3>Case Concerns</h3>
        <ul class="list">
          ${intake.caseConcerns.map(c => `<li class="concern">${c}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${intake.aiSummary ? `
      <div class="section">
        <h3>AI Summary</h3>
        <p>${intake.aiSummary}</p>
      </div>
      ` : ''}

      <div style="text-align: center; margin-top: 20px;">
        <a href="${config.server.publicUrl}" class="cta-button">View in Dashboard</a>
      </div>
    </div>

    <div class="footer">
      <p>Halcyon AI Receptionist - ${config.firm.name}</p>
      <p>This is an automated notification. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    await this.sendEmail(config.email.notificationsTo, subject, html);
  }

  /**
   * Send staff notification for new callback request/message
   */
  async sendMessageNotification(message: MessageData): Promise<void> {
    if (!this.enabled || !config.email.enableNotifications) {
      logger.info({ event: 'email_notification_skipped', type: 'message', id: message.id });
      return;
    }

    const urgentBadge = message.priority === 'URGENT' ? '🚨 URGENT - ' : '';
    const subject = `${urgentBadge}New Message: ${message.callerName || 'Unknown Caller'}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .section { margin: 20px 0; }
    .section h3 { color: #374151; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-left: 10px; }
    .badge-urgent { background: #ef4444; color: white; }
    .badge-normal { background: #6b7280; color: white; }
    .purpose-box { background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 15px 0; }
    .footer { background: #1f2937; color: #9ca3af; padding: 15px 20px; border-radius: 0 0 8px 8px; font-size: 14px; }
    .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 10px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📞 New Message Received
        <span class="badge badge-${message.priority === 'URGENT' ? 'urgent' : 'normal'}">${message.priority}</span>
      </h1>
    </div>

    <div class="content">
      <div class="section">
        <h3>Caller Information</h3>
        <div class="info-row">
          <span class="info-label">Name</span>
          <span class="info-value">${message.callerName || 'Not provided'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phone</span>
          <span class="info-value">${this.formatPhone(message.callerPhone)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Category</span>
          <span class="info-value">${message.category}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Time</span>
          <span class="info-value">${this.formatDate(message.createdAt)}</span>
        </div>
      </div>

      <div class="section">
        <h3>Message Purpose</h3>
        <div class="purpose-box">
          ${message.purpose}
        </div>
      </div>

      ${message.notes ? `
      <div class="section">
        <h3>Additional Notes</h3>
        <p>${message.notes}</p>
      </div>
      ` : ''}

      <div style="text-align: center; margin-top: 20px;">
        <a href="${config.server.publicUrl}" class="cta-button">View in Dashboard</a>
      </div>
    </div>

    <div class="footer">
      <p>Halcyon AI Receptionist - ${config.firm.name}</p>
      <p>This is an automated notification. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    await this.sendEmail(config.email.notificationsTo, subject, html);
  }

  /**
   * Send confirmation email to client after intake
   */
  async sendClientConfirmation(
    toEmail: string,
    firstName: string,
    intakeId: string,
    callbackTimeframe: string
  ): Promise<void> {
    if (!this.enabled || !config.email.enableClientConfirmation) {
      logger.info({ event: 'email_confirmation_skipped', intakeId });
      return;
    }

    const subject = `Thank you for contacting ${config.firm.name}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1f2937; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .reference { background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .reference-number { font-size: 24px; font-weight: bold; color: #2563eb; font-family: monospace; }
    .timeline { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
    .contact-info { margin-top: 20px; }
    .contact-info p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${config.firm.name}</h1>
    </div>

    <div class="content">
      <p>Dear ${firstName},</p>

      <p>Thank you for calling ${config.firm.name} today regarding your Social Security Disability case. We appreciate you taking the time to share your information with us.</p>

      <div class="reference">
        <p style="margin: 0; color: #6b7280;">Your Reference Number</p>
        <p class="reference-number">${intakeId}</p>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Please save this for your records</p>
      </div>

      <div class="timeline">
        <strong>What happens next?</strong>
        <p style="margin: 10px 0 0 0;">An attorney will review your case information and contact you within <strong>${callbackTimeframe}</strong>.</p>
      </div>

      <p>If you have any urgent questions in the meantime, please don't hesitate to call us.</p>

      <div class="contact-info">
        <p><strong>Phone:</strong> ${config.firm.phone}</p>
        ${config.firm.website ? `<p><strong>Website:</strong> <a href="${config.firm.website}">${config.firm.website}</a></p>` : ''}
      </div>

      <p>We look forward to speaking with you soon.</p>

      <p>Best regards,<br>
      <strong>The ${config.firm.name} Team</strong></p>
    </div>

    <div class="footer">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        This email was sent from ${config.firm.name}.<br>
        If you did not request this, please disregard this message.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    await this.sendEmail(toEmail, subject, html);
  }

  /**
   * Send daily digest email
   */
  async sendDailyDigest(data: DailyDigestData): Promise<void> {
    if (!this.enabled || !config.email.enableDailyDigest) {
      logger.info({ event: 'daily_digest_skipped' });
      return;
    }

    const subject = `📊 Daily Digest: ${data.date} - ${data.newIntakes} Intakes, ${data.newMessages} Messages`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header .date { color: #9ca3af; margin-top: 5px; }
    .content { background: white; padding: 20px; border: 1px solid #e5e7eb; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
    .stat-card { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 36px; font-weight: bold; color: #1f2937; }
    .stat-label { color: #6b7280; font-size: 14px; }
    .stat-card.urgent { border-left: 4px solid #ef4444; }
    .stat-card.urgent .stat-value { color: #ef4444; }
    .section { margin: 25px 0; }
    .section h3 { color: #374151; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
    .intake-item { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #10b981; }
    .intake-item.urgent { border-left-color: #ef4444; }
    .intake-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .intake-name { font-weight: 600; font-size: 16px; }
    .intake-score { background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-weight: 600; }
    .intake-score.medium { background: #f59e0b; }
    .intake-score.low { background: #ef4444; }
    .message-item { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
    .message-header { display: flex; justify-content: space-between; align-items: center; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-urgent { background: #ef4444; color: white; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; }
    .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 15px; }
    .status-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .status-item { display: flex; justify-content: space-between; padding: 10px; background: #f9fafb; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Daily Digest</h1>
      <div class="date">${data.date}</div>
    </div>

    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${data.newIntakes}</div>
          <div class="stat-label">New Intakes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.newMessages}</div>
          <div class="stat-label">New Messages</div>
        </div>
        <div class="stat-card urgent">
          <div class="stat-value">${data.urgentItems}</div>
          <div class="stat-label">Urgent Items</div>
        </div>
      </div>

      ${data.highScoreIntakes.length > 0 ? `
      <div class="section">
        <h3>🌟 High Priority Intakes</h3>
        ${data.highScoreIntakes.map(intake => `
          <div class="intake-item ${intake.isUrgent ? 'urgent' : ''}">
            <div class="intake-header">
              <span class="intake-name">${intake.callerName}</span>
              <span class="intake-score ${this.getScoreCategory(intake.totalScore)}">${intake.totalScore}/10</span>
            </div>
            <div style="color: #6b7280; font-size: 14px;">
              ${this.formatPhone(intake.callerPhone)} • ${this.formatTime(intake.createdAt)}
            </div>
            ${intake.conditions.length > 0 ? `<div style="margin-top: 8px; font-size: 14px;">${intake.conditions.slice(0, 3).join(', ')}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${data.pendingMessages.length > 0 ? `
      <div class="section">
        <h3>📞 Pending Messages</h3>
        ${data.pendingMessages.map(msg => `
          <div class="message-item">
            <div class="message-header">
              <span style="font-weight: 500;">${msg.callerName || 'Unknown'}</span>
              ${msg.priority === 'URGENT' ? '<span class="badge badge-urgent">URGENT</span>' : ''}
            </div>
            <div style="color: #6b7280; font-size: 14px; margin-top: 5px;">
              ${this.formatPhone(msg.callerPhone)} • ${msg.category}
            </div>
            <div style="margin-top: 8px; font-size: 14px;">${msg.purpose}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${Object.keys(data.statusSummary).length > 0 ? `
      <div class="section">
        <h3>📈 Intake Status Summary</h3>
        <div class="status-grid">
          ${Object.entries(data.statusSummary).map(([status, count]) => `
            <div class="status-item">
              <span>${status.replace('_', ' ')}</span>
              <strong>${count}</strong>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <div style="text-align: center; margin-top: 25px;">
        <a href="${config.server.publicUrl}" class="cta-button">Open Dashboard</a>
      </div>
    </div>

    <div class="footer">
      <p>Halcyon AI Receptionist - ${config.firm.name}</p>
      <p style="font-size: 12px;">Sent daily at ${config.email.dailyDigestHour}:00 AM</p>
    </div>
  </div>
</body>
</html>
    `;

    await this.sendEmail(config.email.notificationsTo, subject, html);
  }

  /**
   * Send generic email
   */
  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.enabled) {
      logger.warn({ event: 'email_send_skipped', reason: 'service_disabled' });
      return;
    }

    try {
      await sgMail.send({
        to,
        from: {
          email: config.email.fromEmail,
          name: config.firm.name
        },
        subject,
        html
      });

      logger.info({
        event: 'email_sent',
        to,
        subject
      });
    } catch (error: any) {
      logger.error({
        event: 'email_failed',
        to,
        subject,
        error: error.message,
        response: error.response?.body
      });
      throw error;
    }
  }

  /**
   * Helper: Get score category
   */
  private getScoreCategory(score: number): 'high' | 'medium' | 'low' {
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  /**
   * Helper: Get score color
   */
  private getScoreColor(score: number): string {
    if (score >= 7) return '#10b981';
    if (score >= 4) return '#f59e0b';
    return '#ef4444';
  }

  /**
   * Helper: Format phone number for display
   */
  private formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }

  /**
   * Helper: Format date
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Helper: Format time only
   */
  private formatTime(date: Date): string {
    return new Date(date).toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
