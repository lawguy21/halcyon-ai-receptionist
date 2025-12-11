/**
 * HALCYON AI RECEPTIONIST - HEALTH CHECK ROUTES
 */

import { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { config } from '../config/index.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'halcyon-ai-receptionist',
      version: '1.0.0',
      environment: config.server.nodeEnv
    };
  });

  app.get('/ready', async () => {
    // Check if required services are configured
    const checks = {
      twilio: !!config.twilio.accountSid,
      openai: !!config.openai.apiKey,
      publicUrl: !!config.server.publicUrl
    };

    const allReady = Object.values(checks).every(Boolean);

    return {
      ready: allReady,
      checks
    };
  });

  // Diagnostic endpoint to test OpenAI Realtime connection
  app.get('/openai-test', async () => {
    const apiKey = config.openai.apiKey;
    const keyLength = apiKey.length;
    const maskedKey = apiKey.slice(0, 10) + '...' + apiKey.slice(-4);
    const model = config.openai.realtimeModel;

    // Check for common issues
    const hasNewline = apiKey.includes('\n') || apiKey.includes('\\n');
    const hasWhitespace = apiKey.trim() !== apiKey;
    const startsWithSk = apiKey.startsWith('sk-');

    // Attempt actual WebSocket connection to OpenAI
    const connectionTest = await new Promise<{
      success: boolean;
      error?: string;
      events?: string[];
      latency?: number;
    }>((resolve) => {
      const startTime = Date.now();
      const events: string[] = [];
      const url = `wss://api.openai.com/v1/realtime?model=${model}`;

      const ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      const timeout = setTimeout(() => {
        ws.close();
        resolve({ success: false, error: 'Connection timeout (5s)', events });
      }, 5000);

      ws.on('open', () => {
        events.push('ws_open');
        // Send session update to verify full functionality
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice: config.openai.voice,
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw'
          }
        }));
      });

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          events.push(event.type);

          if (event.type === 'session.created' || event.type === 'session.updated') {
            clearTimeout(timeout);
            ws.close();
            resolve({
              success: true,
              events,
              latency: Date.now() - startTime
            });
          }

          if (event.type === 'error') {
            clearTimeout(timeout);
            ws.close();
            resolve({
              success: false,
              error: JSON.stringify(event.error),
              events
            });
          }
        } catch (e) {
          events.push('parse_error');
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        events.push('ws_error');
        resolve({
          success: false,
          error: error.message,
          events
        });
      });

      ws.on('close', (code, reason) => {
        events.push(`ws_close_${code}`);
      });
    });

    return {
      timestamp: new Date().toISOString(),
      config: {
        apiKeyLength: keyLength,
        apiKeyMasked: maskedKey,
        model,
        voice: config.openai.voice,
        publicUrl: config.server.publicUrl
      },
      validation: {
        startsWithSk,
        hasNewline,
        hasWhitespace,
        isValid: startsWithSk && !hasNewline && !hasWhitespace
      },
      connectionTest
    };
  });
}
