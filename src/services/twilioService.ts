/**
 * HALCYON AI RECEPTIONIST - TWILIO SERVICE
 *
 * Handles Twilio API operations like hanging up calls
 */

import twilio from 'twilio';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Initialize Twilio client
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * Hang up an active call
 * @param callSid - The Twilio Call SID
 * @param delayMs - Optional delay before hanging up (default: 3000ms to let goodbye finish)
 */
export async function hangupCall(callSid: string, delayMs: number = 3000): Promise<boolean> {
  if (!callSid) {
    logger.warn({ event: 'hangup_skipped', reason: 'No callSid provided' });
    return false;
  }

  // Add delay to let the AI finish saying goodbye
  if (delayMs > 0) {
    logger.info({ event: 'hangup_scheduled', callSid, delayMs });
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  try {
    logger.info({ event: 'hangup_initiated', callSid });

    await twilioClient.calls(callSid).update({
      status: 'completed'
    });

    logger.info({ event: 'hangup_success', callSid });
    return true;
  } catch (error) {
    // Call might already be ended by the user
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not found') || errorMessage.includes('already completed')) {
      logger.info({ event: 'hangup_already_ended', callSid });
      return true;
    }

    logger.error({ event: 'hangup_failed', callSid, error: errorMessage });
    return false;
  }
}
