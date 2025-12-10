# Halcyon AI Receptionist

AI-powered phone receptionist for Social Security Disability legal intake using Twilio Voice and OpenAI's Realtime API.

## Features

- **Real-time Voice AI**: Natural conversation using OpenAI's speech-to-speech Realtime API
- **Intelligent Intake**: Structured SSD case evaluation following SSA guidelines
- **Automatic Scoring**: Case viability scoring based on Grid Rules, conditions, and functional limitations
- **Dashboard UI**: Web-based dashboard for viewing intakes, messages, and analytics
- **Email Notifications**: Staff notifications, client confirmations, and daily digests via SendGrid
- **SMS Follow-ups**: Automatic confirmation messages after calls (TCPA compliant)
- **Database Persistence**: PostgreSQL via Prisma (Supabase hosted)
- **Callback Requests**: Handles non-intake calls with categorization and priority

## Current Status (December 2024)

### Implemented & Working
- OpenAI Realtime API integration with Twilio Media Streams
- Full intake conversation flow with function calling
- Case scoring engine with Grid Rules logic
- Supabase PostgreSQL database with Prisma ORM
- Dashboard API routes for viewing/managing intakes
- SMS service via Twilio Messaging
- Email service via SendGrid:
  - Staff intake notifications
  - Staff message notifications
  - Client confirmation emails
  - Daily digest summaries
- Scheduler for automated daily digests

### Configuration
- Server: Port 4000
- ngrok URL: https://halcyon-receptionist.ngrok-free.dev
- Database: Supabase PostgreSQL

## Architecture

```
                                    Incoming Call
                                          |
                                          v
+------------------+     +-------------------+     +------------------+
|   Twilio         |---->|  Halcyon Server   |---->|  OpenAI          |
|   Voice          |<----|  (Fastify)        |<----|  Realtime API    |
+------------------+     +-------------------+     +------------------+
                                |
                +---------------+---------------+
                v               v               v
        +---------------+ +---------------+ +---------------+
        |   Supabase    | |   SendGrid    | |   Twilio      |
        |   PostgreSQL  | |   Email       | |   SMS         |
        +---------------+ +---------------+ +---------------+
```

## Project Structure

```
src/
├── server.ts                 # Main Fastify server
├── config/
│   └── index.ts              # Environment configuration
├── routes/
│   ├── twilio.ts             # Twilio webhook handlers
│   ├── dashboard.ts          # Dashboard API routes
│   └── health.ts             # Health check endpoints
├── handlers/
│   └── mediaStream.ts        # WebSocket media stream handler
├── services/
│   ├── database.ts           # Prisma database service
│   ├── emailService.ts       # SendGrid email notifications
│   ├── intakeSession.ts      # Intake state management
│   ├── intakePrompts.ts      # AI system prompts and tools
│   ├── openaiRealtime.ts     # OpenAI Realtime API client
│   ├── scheduler.ts          # Daily digest scheduler
│   ├── scoringEngine.ts      # Case scoring logic
│   └── smsService.ts         # Twilio SMS service
├── utils/
│   └── logger.ts             # Pino logger
prisma/
└── schema.prisma             # Database schema
public/
└── index.html                # Dashboard UI
```

## Prerequisites

- Node.js 20+
- Twilio account with Voice and SMS enabled
- OpenAI API key with Realtime API access
- Supabase account (PostgreSQL database)
- SendGrid account (email notifications)
- ngrok (for local development)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure all values.

### 3. Setup Database

```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
```

### 4. Start ngrok

```bash
ngrok http --url=your-subdomain.ngrok-free.dev 4000
```

### 5. Configure Twilio Webhook

Set webhook to: https://your-ngrok-url/twilio/voice (HTTP POST)

### 6. Start Server

```bash
npm run dev    # Development (hot reload)
npm run build  # Build for production
npm start      # Production
```

## API Endpoints

### Twilio Webhooks
- POST /twilio/voice - Incoming call webhook
- POST /twilio/status - Call status callback
- WS /media-stream - WebSocket for Twilio Media Streams

### Dashboard API
- GET /api/dashboard/stats - Dashboard statistics
- GET /api/dashboard/intakes - List intakes with filtering
- GET /api/dashboard/intakes/:id - Get single intake
- PATCH /api/dashboard/intakes/:id - Update intake
- GET /api/dashboard/messages - List callback requests
- POST /api/dashboard/test-email - Send test email

### Health
- GET /health - Basic health check
- GET /health/ready - Readiness check

## Database Schema

### Core Models
- **Intake** - SSD case intake records with scoring
- **CallbackRequest** - Non-intake calls (existing clients, vendors, etc.)
- **Task** - Follow-up tasks linked to intakes
- **Activity** - Audit log of all actions
- **DailyStats** - Aggregated daily analytics

## Email Notifications

1. **Intake Notifications** - Staff alert when new intake is completed
2. **Message Notifications** - Staff alert for callback requests
3. **Client Confirmations** - Sent to clients after intake
4. **Daily Digest** - Scheduled summary (default 8 AM)

## Scoring Logic

### Age Categories (SSA Grid Rules)
- 60+: 1.5x multiplier
- 55-59: 1.35x multiplier
- 50-54: 1.15x multiplier
- Under 50: 0.7x multiplier

### Score Interpretation
| Score | Recommendation | Callback |
|-------|----------------|----------|
| 70-100 | Highly Recommended | 24 hours |
| 45-69 | Recommended | 48 hours |
| 25-44 | Consider with Caution | 3-5 days |
| 10-24 | Weak Case | 5-7 days |
| 0-9 | Not Recommended | As needed |

## Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # Build TypeScript to dist/
npm run start        # Run production build
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
```

## Cost Estimates

### Per Call (10-minute average)
- OpenAI Realtime API: ~$3.00
- Twilio Voice: ~$0.09
- SMS confirmation: ~$0.01
- **Total: ~$3.10 per call**

## License

Proprietary - Halcyon Legal Tech
