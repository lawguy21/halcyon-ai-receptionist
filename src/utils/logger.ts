/**
 * HALCYON AI RECEPTIONIST - LOGGER
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

export function createCallLogger(callId: string) {
  return logger.child({ callId });
}

export function createLogger(name: string) {
  return logger.child({ module: name });
}
