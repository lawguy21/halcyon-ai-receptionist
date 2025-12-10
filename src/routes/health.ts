/**
 * HALCYON AI RECEPTIONIST - HEALTH CHECK ROUTES
 */

import { FastifyInstance } from 'fastify';
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
}
