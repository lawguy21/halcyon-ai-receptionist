/**
 * HALCYON AI RECEPTIONIST - OUTBOUND CALL ROUTES
 *
 * Handles outbound AI calls initiated from the Skinny App dashboard
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';

const { VoiceResponse } = twilio.twiml;

// Initialize Twilio client
const twilioClient = twilio(
  config.twilio.accountSid,
  config.twilio.authToken
);

interface OutboundCallRequest {
  to: string;
  assessmentId?: string;
  purpose?: string;
  systemPrompt?: string;
  additionalNotes?: string;
}

export async function outboundRoutes(app: FastifyInstance) {
  /**
   * POST /api/outbound-call
   * Initiates an outbound AI call to a client
   */
  app.post('/outbound-call', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as OutboundCallRequest;

    if (!body.to) {
      return reply.status(400).send({
        success: false,
        error: 'Phone number (to) is required'
      });
    }

    const callId = `OUT_${Date.now()}_${uuidv4().slice(0, 8)}`;

    logger.info({
      event: 'outbound_call_requested',
      callId,
      to: body.to,
      purpose: body.purpose,
      assessmentId: body.assessmentId
    });

    try {
      // Build the TwiML URL with parameters for the AI conversation
      const twimlUrl = new URL('/api/outbound-twiml', config.server.publicUrl);
      twimlUrl.searchParams.set('callId', callId);
      twimlUrl.searchParams.set('purpose', body.purpose || 'follow_up');
      if (body.systemPrompt) {
        twimlUrl.searchParams.set('systemPrompt', encodeURIComponent(body.systemPrompt));
      }
      if (body.additionalNotes) {
        twimlUrl.searchParams.set('notes', encodeURIComponent(body.additionalNotes));
      }

      // Initiate the outbound call via Twilio
      const call = await twilioClient.calls.create({
        to: body.to,
        from: config.twilio.phoneNumber,
        url: twimlUrl.toString(),
        statusCallback: `${config.server.publicUrl}/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        machineDetection: 'Enable',
        machineDetectionTimeout: 5
      });

      logger.info({
        event: 'outbound_call_initiated',
        callId,
        callSid: call.sid,
        to: body.to,
        purpose: body.purpose
      });

      return reply.send({
        success: true,
        callId,
        callSid: call.sid,
        status: call.status
      });

    } catch (error: any) {
      logger.error({
        event: 'outbound_call_failed',
        callId,
        error: error.message
      });

      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to initiate outbound call'
      });
    }
  });

  /**
   * GET/POST /api/outbound-twiml
   * Returns TwiML for outbound AI calls - connects to Media Stream
   */
  app.all('/outbound-twiml', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      callId?: string;
      purpose?: string;
      systemPrompt?: string;
      notes?: string;
    };

    const callId = query.callId || `OUT_${Date.now()}`;
    const purpose = query.purpose || 'follow_up';

    logger.info({
      event: 'outbound_twiml_requested',
      callId,
      purpose
    });

    const response = new VoiceResponse();

    // Brief connection message while OpenAI establishes its WebSocket
    // This prevents awkward silence during the ~1-2 second connection time
    // OpenAI will then take over with its full conversation
    response.say({
      voice: 'Google.en-US-Neural2-F'
    }, 'Hello, one moment please.');

    // Connect to Media Stream for real-time AI audio
    const connect = response.connect();

    // Build WebSocket URL with call metadata
    const wsUrl = new URL('/media-stream', config.server.publicUrl);
    wsUrl.protocol = wsUrl.protocol.replace('http', 'ws');

    // Pass call metadata as query params
    const streamParams = new URLSearchParams({
      callId,
      direction: 'outbound',
      purpose,
      callerPhone: '', // Will be populated by Twilio
      systemPrompt: query.systemPrompt || '',
      notes: query.notes || ''
    });

    const stream = connect.stream({
      url: `${wsUrl.toString()}?${streamParams.toString()}`
    });

    stream.parameter({ name: 'callId', value: callId });
    stream.parameter({ name: 'direction', value: 'outbound' });
    stream.parameter({ name: 'purpose', value: purpose });

    logger.info({
      event: 'outbound_media_stream_initiated',
      callId,
      purpose
    });

    reply.type('text/xml');
    return response.toString();
  });
}
