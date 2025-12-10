/**
 * HALCYON AI RECEPTIONIST - TWILIO ROUTES
 *
 * Handles incoming calls from Twilio and initiates Media Streams
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import { prisma } from '../services/database.js';

const { VoiceResponse } = twilio.twiml;

interface TwilioVoiceRequest {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  CallerCity?: string;
  CallerState?: string;
  CallerZip?: string;
  CallerCountry?: string;
}

export async function twilioRoutes(app: FastifyInstance) {
  /**
   * POST /twilio/voice
   * Main webhook for incoming calls - initiates Media Stream connection
   */
  app.post('/voice', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as TwilioVoiceRequest;
    const callId = `HC_${Date.now()}_${uuidv4().slice(0, 8)}`;

    logger.info({
      event: 'incoming_call',
      callId,
      callSid: body.CallSid,
      from: body.From,
      to: body.To,
      callerCity: body.CallerCity,
      callerState: body.CallerState
    });

    const response = new VoiceResponse();

    // Initial greeting before connecting to AI
    response.say({
      voice: 'Google.en-US-Neural2-F'
    }, 'Please wait while I connect you to our intake assistant.');

    response.pause({ length: 1 });

    // Connect to Media Stream for real-time audio
    const connect = response.connect();

    // Build WebSocket URL with call metadata
    const wsUrl = new URL('/media-stream', config.server.publicUrl);
    wsUrl.protocol = wsUrl.protocol.replace('http', 'ws');

    // Pass call metadata as query params
    const streamParams = new URLSearchParams({
      callId,
      callSid: body.CallSid,
      callerPhone: body.From,
      callerCity: body.CallerCity || '',
      callerState: body.CallerState || ''
    });

    const stream = connect.stream({
      url: `${wsUrl.toString()}?${streamParams.toString()}`
    });

    // Configure stream parameters
    stream.parameter({ name: 'callId', value: callId });

    logger.info({
      event: 'media_stream_initiated',
      callId,
      wsUrl: wsUrl.toString()
    });

    reply.type('text/xml');
    return response.toString();
  });

  /**
   * POST /twilio/status
   * Webhook for call status updates
   */
  app.post('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      CallSid: string;
      CallStatus: string;
      CallDuration?: string;
      RecordingUrl?: string;
    };

    logger.info({
      event: 'call_status_update',
      callSid: body.CallSid,
      status: body.CallStatus,
      duration: body.CallDuration
    });

    // Handle call completion
    if (body.CallStatus === 'completed') {
      logger.info({
        event: 'call_completed',
        callSid: body.CallSid,
        duration: body.CallDuration
      });

      // Update call duration in database if intake exists
      // Note: Main finalization happens in mediaStream.ts on 'stop' event
      // This is a backup to ensure call duration is recorded
      try {
        const intake = await prisma.intake.findFirst({
          where: { callId: { contains: body.CallSid.slice(-8) } }
        });

        if (intake && body.CallDuration) {
          await prisma.intake.update({
            where: { id: intake.id },
            data: { callDuration: parseInt(body.CallDuration, 10) }
          });
          logger.info({
            event: 'call_duration_updated',
            intakeId: intake.id,
            duration: body.CallDuration
          });
        }
      } catch (error) {
        logger.error({ event: 'call_status_update_failed', error });
      }
    }

    return { received: true };
  });

  /**
   * POST /twilio/recording
   * Webhook for recording completion
   */
  app.post('/recording', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      CallSid: string;
      RecordingUrl: string;
      RecordingSid: string;
      RecordingDuration: string;
    };

    logger.info({
      event: 'recording_completed',
      callSid: body.CallSid,
      recordingUrl: body.RecordingUrl,
      duration: body.RecordingDuration
    });

    // Store recording URL in intake record
    try {
      // Find intake by partial callSid match (callId contains last 8 chars of callSid)
      const intake = await prisma.intake.findFirst({
        where: { callId: { contains: body.CallSid.slice(-8) } }
      });

      if (intake) {
        await prisma.intake.update({
          where: { id: intake.id },
          data: { recordingUrl: body.RecordingUrl }
        });

        // Log the activity
        await prisma.activity.create({
          data: {
            intakeId: intake.id,
            type: 'recording_saved',
            actor: 'system',
            details: {
              recordingSid: body.RecordingSid,
              duration: body.RecordingDuration
            }
          }
        });

        logger.info({
          event: 'recording_url_saved',
          intakeId: intake.id,
          recordingSid: body.RecordingSid
        });
      } else {
        logger.warn({
          event: 'recording_no_matching_intake',
          callSid: body.CallSid
        });
      }
    } catch (error) {
      logger.error({ event: 'recording_save_failed', error });
    }

    return { received: true };
  });

  /**
   * POST /twilio/fallback
   * Fallback webhook if primary fails
   */
  app.post('/fallback', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.error({
      event: 'twilio_fallback_triggered',
      body: request.body
    });

    const response = new VoiceResponse();
    response.say(
      { voice: 'Google.en-US-Neural2-F' },
      'We apologize, but we are experiencing technical difficulties. Please call back in a few minutes or leave a message after the tone.'
    );
    response.record({
      maxLength: 120,
      transcribe: true
    });

    reply.type('text/xml');
    return response.toString();
  });
}
