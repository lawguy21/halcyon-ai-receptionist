/**
 * HALCYON AI RECEPTIONIST - CONFIGURATION
 */

import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  server: {
    port: parseInt(optionalEnv('PORT', '3000'), 10),
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    publicUrl: optionalEnv('PUBLIC_URL', 'http://localhost:3000'),
    logLevel: optionalEnv('LOG_LEVEL', 'info')
  },

  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    phoneNumber: requireEnv('TWILIO_PHONE_NUMBER'),
    messagingServiceSid: optionalEnv('TWILIO_MESSAGING_SERVICE_SID', '')
  },

  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
    realtimeModel: optionalEnv('OPENAI_REALTIME_MODEL', 'gpt-4o-realtime-preview-2024-12-17'),
    voice: optionalEnv('OPENAI_VOICE', 'alloy') as 'alloy' | 'echo' | 'shimmer' | 'ash' | 'ballad' | 'coral' | 'sage' | 'verse'
  },

  firm: {
    name: optionalEnv('FIRM_NAME', 'Law Firm'),
    phone: optionalEnv('FIRM_PHONE', ''),
    website: optionalEnv('FIRM_WEBSITE', '')
  },

  callbacks: {
    highPriority: parseInt(optionalEnv('CALLBACK_HIGH_PRIORITY', '24'), 10),
    mediumPriority: parseInt(optionalEnv('CALLBACK_MEDIUM_PRIORITY', '48'), 10),
    lowPriority: parseInt(optionalEnv('CALLBACK_LOW_PRIORITY', '120'), 10)
  },

  sms: {
    enabled: optionalEnv('ENABLE_SMS_FOLLOWUP', 'true') === 'true',
    confirmationDelay: parseInt(optionalEnv('SMS_CONFIRMATION_DELAY_SECONDS', '30'), 10)
  },

  recording: {
    enabled: optionalEnv('ENABLE_CALL_RECORDING', 'true') === 'true',
    transcriptionEnabled: optionalEnv('ENABLE_TRANSCRIPTION', 'true') === 'true',
    savePath: optionalEnv('SAVE_RECORDINGS_PATH', './recordings')
  },

  scoring: {
    highlyRecommended: parseInt(optionalEnv('SCORE_HIGHLY_RECOMMENDED', '70'), 10),
    recommended: parseInt(optionalEnv('SCORE_RECOMMENDED', '45'), 10),
    considerCaution: parseInt(optionalEnv('SCORE_CONSIDER_CAUTION', '25'), 10),
    weakCase: parseInt(optionalEnv('SCORE_WEAK_CASE', '10'), 10)
  },

  email: {
    sendgridApiKey: optionalEnv('SENDGRID_API_KEY', ''),
    fromEmail: optionalEnv('EMAIL_FROM', ''),
    notificationsTo: optionalEnv('EMAIL_NOTIFICATIONS_TO', ''),
    enableNotifications: optionalEnv('ENABLE_EMAIL_NOTIFICATIONS', 'true') === 'true',
    enableClientConfirmation: optionalEnv('ENABLE_CLIENT_CONFIRMATION_EMAILS', 'true') === 'true',
    enableDailyDigest: optionalEnv('ENABLE_DAILY_DIGEST', 'true') === 'true',
    dailyDigestHour: parseInt(optionalEnv('DAILY_DIGEST_HOUR', '8'), 10)
  },

  // Skinny App Integration
  // When enabled, voice intakes are sent to the Skinny App for scoring and storage
  // This provides unified scoring, CMS integrations, and centralized data management
  skinnyApp: {
    enabled: optionalEnv('SKINNY_APP_ENABLED', 'false') === 'true',
    baseUrl: optionalEnv('SKINNY_APP_URL', 'http://localhost:3000'),
    apiKey: optionalEnv('SKINNY_APP_API_KEY', ''),
    timeout: parseInt(optionalEnv('SKINNY_APP_TIMEOUT', '30000'), 10),
    // If true, falls back to local scoring when Skinny App is unavailable
    fallbackToLocal: optionalEnv('SKINNY_APP_FALLBACK', 'true') === 'true'
  }
} as const;

export type Config = typeof config;
