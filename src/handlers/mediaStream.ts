/**
 * HALCYON AI RECEPTIONIST - MEDIA STREAM HANDLER
 *
 * Bridges Twilio Media Streams with OpenAI Realtime API
 * Handles bidirectional audio streaming for real-time voice conversation
 */

import { WebSocket, RawData } from 'ws';
import type { FastifyRequest } from 'fastify';
import { createCallLogger } from '../utils/logger.js';
import { OpenAIRealtimeClient } from '../services/openaiRealtime.js';
import { IntakeSession } from '../services/intakeSession.js';

// Type for fastify-websocket connection
interface SocketStream {
  socket: WebSocket;
}

interface TwilioMediaMessage {
  event: string;
  sequenceNumber?: string;
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // Base64 encoded audio (mulaw 8kHz)
  };
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
  mark?: {
    name: string;
  };
}

export async function mediaStreamHandler(
  connection: WebSocket | SocketStream,
  request: FastifyRequest
) {
  const query = request.query as Record<string, string>;
  const callId = query.callId || `HC_${Date.now()}`;
  const callerPhone = query.callerPhone || 'unknown';
  const callerCity = query.callerCity || '';
  const callerState = query.callerState || '';

  const log = createCallLogger(callId);
  log.info({ event: 'websocket_connected', callerPhone });

  let streamSid: string | null = null;
  let openaiClient: OpenAIRealtimeClient | null = null;
  let intakeSession: IntakeSession | null = null;

  // Handle both direct WebSocket and SocketStream wrapper
  const twilioWs: WebSocket = 'socket' in connection ? connection.socket : connection;

  // Send mark message to Twilio (for tracking audio playback)
  function sendMark(markName: string) {
    if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({
        event: 'mark',
        streamSid,
        mark: { name: markName }
      }));
    }
  }

  // Send audio to Twilio (from OpenAI)
  function sendAudioToTwilio(audioBase64: string) {
    if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: {
          payload: audioBase64
        }
      }));
    }
  }

  // Clear Twilio's audio queue (for interruptions)
  function clearTwilioAudio() {
    if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({
        event: 'clear',
        streamSid
      }));
    }
  }

  // Handle messages from Twilio
  twilioWs.on('message', async (data: RawData) => {
    try {
      const message: TwilioMediaMessage = JSON.parse(data.toString());

      switch (message.event) {
        case 'connected':
          log.info({ event: 'twilio_stream_connected' });
          break;

        case 'start':
          streamSid = message.start?.streamSid || null;
          log.info({
            event: 'twilio_stream_started',
            streamSid,
            callSid: message.start?.callSid
          });

          // Initialize OpenAI Realtime connection
          try {
            intakeSession = new IntakeSession(callId, {
              callerPhone,
              callerCity,
              callerState
            });

            openaiClient = new OpenAIRealtimeClient({
              callId,
              onAudioResponse: (audioBase64) => {
                sendAudioToTwilio(audioBase64);
              },
              onTranscript: (role, text) => {
                log.info({ event: 'transcript', role, text });
                if (intakeSession) {
                  intakeSession.addTranscript(role, text);
                }
              },
              onFunctionCall: async (name, args) => {
                log.info({ event: 'function_call', name, args });
                if (intakeSession) {
                  return await intakeSession.handleFunctionCall(name, args);
                }
                return { error: 'No intake session' };
              },
              onInterruption: () => {
                clearTwilioAudio();
              },
              onError: (error) => {
                log.error({ event: 'openai_error', error });
              },
              onClose: () => {
                log.info({ event: 'openai_connection_closed' });
              }
            });

            await openaiClient.connect();
            log.info({ event: 'openai_connected' });

          } catch (error) {
            log.error({ event: 'openai_connection_failed', error });
          }
          break;

        case 'media':
          // Forward audio from Twilio to OpenAI
          if (message.media && openaiClient) {
            // Twilio sends mulaw 8kHz, OpenAI expects pcm16 24kHz
            // The OpenAI client handles the conversion
            openaiClient.sendAudio(message.media.payload);
          }
          break;

        case 'mark':
          log.debug({
            event: 'twilio_mark_received',
            mark: message.mark?.name
          });
          break;

        case 'stop':
          log.info({ event: 'twilio_stream_stopped' });

          // Finalize the intake session
          if (intakeSession) {
            const result = await intakeSession.finalize();
            log.info({
              event: 'intake_finalized',
              score: result.scoring.totalScore,
              recommendation: result.scoring.recommendation
            });
          }

          // Close OpenAI connection
          if (openaiClient) {
            openaiClient.close();
          }
          break;

        default:
          log.debug({ event: 'unknown_twilio_event', eventType: message.event });
      }
    } catch (error) {
      log.error({ event: 'message_parse_error', error });
    }
  });

  // Handle WebSocket errors
  twilioWs.on('error', (error) => {
    log.error({ event: 'websocket_error', error });
  });

  // Handle WebSocket close
  twilioWs.on('close', (code, reason) => {
    log.info({
      event: 'websocket_closed',
      code,
      reason: reason.toString()
    });

    // Cleanup
    if (openaiClient) {
      openaiClient.close();
    }
  });
}
