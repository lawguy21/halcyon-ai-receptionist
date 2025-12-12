/**
 * HALCYON AI RECEPTIONIST - MAIN SERVER
 *
 * Twilio + OpenAI Realtime API Integration for SSD Legal Intake
 *
 * © 2025 Halcyon Legal Tech. All rights reserved.
 */

import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyFormBody from '@fastify/formbody';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { twilioRoutes } from './routes/twilio.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { outboundRoutes } from './routes/outbound.js';
import { mediaStreamHandler } from './handlers/mediaStream.js';
import { healthRoutes } from './routes/health.js';
import { seedRoutes } from './routes/seed.js';
import { scheduler } from './services/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: logger
});

async function start() {
  try {
    // Register plugins
    await app.register(fastifyCors, {
      origin: true
    });

    await app.register(fastifyFormBody);

    await app.register(fastifyWebsocket, {
      options: {
        maxPayload: 1048576 // 1MB
      }
    });

    // Serve static files for dashboard
    await app.register(fastifyStatic, {
      root: path.join(__dirname, '..', 'public'),
      prefix: '/'
    });

    // Register routes
    await app.register(healthRoutes, { prefix: '/health' });
    await app.register(twilioRoutes, { prefix: '/twilio' });
    await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
    await app.register(outboundRoutes, { prefix: '/api' });
    await app.register(seedRoutes);

    // WebSocket route for Twilio Media Streams
    app.get('/media-stream', { websocket: true }, mediaStreamHandler as any);

    // Serve dashboard at root
    app.get('/', async (request, reply) => {
      return reply.sendFile('index.html');
    });

    // Start server
    await app.listen({
      port: config.server.port,
      host: '0.0.0.0'
    });

    // Start the scheduler for daily digest
    scheduler.start();

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎙️  HALCYON AI RECEPTIONIST                                 ║
║                                                               ║
║   Server running on port ${config.server.port}                            ║
║                                                               ║
║   Dashboard:      http://localhost:${config.server.port}                  ║
║   API:            http://localhost:${config.server.port}/api/dashboard    ║
║                                                               ║
║   Endpoints:                                                  ║
║   • GET  /                  - Dashboard UI                    ║
║   • POST /twilio/voice      - Incoming call webhook           ║
║   • WS   /media-stream      - Twilio Media Stream             ║
║   • GET  /api/dashboard/*   - Dashboard API                   ║
║   • GET  /health            - Health check                    ║
║                                                               ║
║   Configure Twilio webhook to:                                ║
║   ${config.server.publicUrl}/twilio/voice
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  scheduler.stop();
  await app.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  scheduler.stop();
  await app.close();
  process.exit(0);
});

start();
