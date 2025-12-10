/**
 * HALCYON AI RECEPTIONIST - SMS SERVICE
 *
 * Handles sending SMS messages via Twilio
 */

import twilio from 'twilio';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class SMSService {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
  }

  /**
   * Send confirmation SMS after intake call
   */
  async sendConfirmation(
    toPhone: string,
    firstName: string,
    intakeId: string,
    callbackTimeframe: string
  ): Promise<void> {
    const message = `Hi ${firstName}, thank you for calling ${config.firm.name} about your disability case.

Your reference number is: ${intakeId}

An attorney will review your information and contact you within ${callbackTimeframe}.

Questions? Reply to this message or call ${config.firm.phone}.

- ${config.firm.name} Team`;

    await this.sendSMS(toPhone, message);
  }

  /**
   * Send callback reminder SMS
   */
  async sendCallbackReminder(
    toPhone: string,
    firstName: string,
    callDate: string
  ): Promise<void> {
    const message = `Hi ${firstName}, this is ${config.firm.name}. We're following up on your disability case inquiry from ${callDate}. An attorney would like to speak with you. Please call us at ${config.firm.phone} or reply to schedule a callback.`;

    await this.sendSMS(toPhone, message);
  }

  /**
   * Send document request SMS
   */
  async sendDocumentRequest(
    toPhone: string,
    firstName: string
  ): Promise<void> {
    const message = `Hi ${firstName}, thank you for your disability consultation with ${config.firm.name}. To move forward, we need the following documents:

- Recent medical records
- List of treating doctors
- Any denial letters from Social Security

Please reply to this message with questions.

- ${config.firm.name}`;

    await this.sendSMS(toPhone, message);
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    toPhone: string,
    firstName: string,
    appointmentDate: string,
    appointmentTime: string
  ): Promise<void> {
    const message = `Hi ${firstName}, this is a reminder of your appointment with ${config.firm.name} on ${appointmentDate} at ${appointmentTime}. Please call ${config.firm.phone} if you need to reschedule.`;

    await this.sendSMS(toPhone, message);
  }

  /**
   * Send generic SMS
   */
  private async sendSMS(to: string, body: string): Promise<void> {
    if (!config.sms.enabled) {
      logger.info({ event: 'sms_disabled', to });
      return;
    }

    try {
      // Format phone number
      const formattedTo = this.formatPhoneNumber(to);

      // Use Messaging Service if configured, otherwise fall back to phone number
      const messageOptions: {
        to: string;
        body: string;
        messagingServiceSid?: string;
        from?: string;
      } = {
        to: formattedTo,
        body
      };

      if (config.twilio.messagingServiceSid) {
        messageOptions.messagingServiceSid = config.twilio.messagingServiceSid;
        logger.info({ event: 'sms_using_messaging_service', serviceSid: config.twilio.messagingServiceSid });
      } else {
        messageOptions.from = config.twilio.phoneNumber;
      }

      const result = await this.client.messages.create(messageOptions);

      logger.info({
        event: 'sms_sent',
        messageSid: result.sid,
        to: formattedTo,
        status: result.status,
        usingMessagingService: !!config.twilio.messagingServiceSid
      });
    } catch (error) {
      logger.error({
        event: 'sms_failed',
        to,
        error
      });
      throw error;
    }
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If it's 10 digits, assume US and add +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    // If it's 11 digits and starts with 1, add +
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // If it already starts with +, return as-is
    if (phone.startsWith('+')) {
      return phone;
    }

    // Default: add + prefix
    return `+${digits}`;
  }
}
