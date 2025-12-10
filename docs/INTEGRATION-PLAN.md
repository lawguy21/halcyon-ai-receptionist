# API Bridge Integration Plan
## Halcyon AI Receptionist + Halcyon Skinny App

---

## 1. Executive Summary

This plan integrates the **Halcyon AI Receptionist** (voice-based phone intake) with the **Halcyon Skinny App** (web-based assessment platform) using an API Bridge approach. The Receptionist will collect intake data via voice conversation and send it to the Skinny App's `/api/intake-assessment` endpoint for scoring, storage, and downstream processing.

### Benefits
- Single scoring engine (consistency across channels)
- Unified database (all intakes in one place)
- Inherited features (CMS integrations, billing, batch processing)
- Independent deployment and scaling
- Minimal code changes to both apps

---

## 2. Data Schema Mapping

### 2.1 Receptionist IntakeData → Skinny App AssessmentData

| Receptionist Field | Skinny App Field | Transformation |
|-------------------|------------------|----------------|
| `demographics.firstName + lastName` | `name` or `clientName` | Concatenate with space |
| `demographics.email` | `email` | Direct mapping |
| `demographics.dateOfBirth` | `dob` or `dateOfBirth` | Direct mapping (string) |
| `demographics.age` | `age` | Direct mapping (number) |
| `demographics.phone` | `phone` | Direct mapping |
| `demographics.city` | (custom field) | Pass in extended data |
| `demographics.state` | (custom field) | Pass in extended data |
| `education.level` | `education` | Map to string value |
| `medical.conditions[]` | `selectedConditions` or `conditions` | Direct array mapping |
| `medical.severity` | (custom field) | Pass in extended data |
| `medical.durationMonths` | (custom field) | Pass in extended data |
| `medical.medications[]` | `medications` | Direct array mapping |
| `medical.sideEffects[]` | (custom field) | Pass in extended data |
| `medical.treatments[]` | (custom field) | Pass in extended data |
| `medical.hospitalizations` | (custom field) | Pass in extended data |
| `functionalLimitations.*` | `functionalLimitations` | Convert to array of strings |
| `workHistory.jobs[]` | `workHistory` | Convert to formatted array |
| `workHistory.heaviestLifting` | (included in workHistory) | Include in work description |
| `workHistory.lastWorkDate` | `lastWorked` | Direct mapping |
| `workHistory.currentlyWorking` | `workStatus` | Map boolean to string |
| `application.status` | `caseStage` | Map enum to string |
| `application.hasApplied` | `alreadyApplied` | Map boolean to "yes"/"no" |
| `application.denialDate` | (custom field) | Pass in extended data |
| `application.hearingDate` | (custom field) | Pass in extended data |

### 2.2 New Fields for Voice Channel

Add these fields to Skinny App's Assessment model to track voice-originated intakes:

```prisma
model Assessment {
  // ... existing fields ...

  // Voice integration fields
  source            String?   // "web", "voice", "document", "batch", "cms"
  voiceCallId       String?   // Original call ID from Receptionist
  voiceIntakeId     String?   // Intake ID from Receptionist
  callerPhone       String?   // Phone number for callbacks
  callerCity        String?   // Caller location
  callerState       String?   // Caller state
  transcript        Json?     // Full conversation transcript
  callDuration      Int?      // Call duration in seconds
  smsConsentGiven   Boolean?  // TCPA SMS consent
  isUrgent          Boolean?  // Urgent flag from voice intake
  urgentReason      String?   // Why flagged urgent
}
```

---

## 3. API Bridge Specification

### 3.1 Endpoint Design

**Option A: Use Existing Endpoint (Recommended)**
Extend `/api/intake-assessment` to accept voice data:

```typescript
POST /api/intake-assessment
Content-Type: application/json
Authorization: Bearer <service_account_jwt>

{
  "action": "assess",
  "source": "voice",
  "voiceMetadata": {
    "callId": "HC_1733123456_abc12345",
    "intakeId": "INT_1733123456_def67890",
    "callerPhone": "+15551234567",
    "callerCity": "Memphis",
    "callerState": "TN",
    "callDuration": 480,
    "smsConsentGiven": true,
    "isUrgent": false,
    "transcript": [...]
  },
  "data": {
    "name": "John Smith",
    "email": "john@example.com",
    "dob": "1965-05-15",
    "age": 59,
    "phone": "+15551234567",
    "education": "limited",
    "selectedConditions": ["Chronic Back Pain", "Depression", "Diabetes"],
    "medications": ["Oxycodone", "Gabapentin", "Sertraline"],
    "functionalLimitations": [
      "Cannot sit more than 30 minutes",
      "Cannot stand more than 15 minutes",
      "Can only lift 10 pounds",
      "Severe concentration problems"
    ],
    "workHistory": [
      {"title": "Warehouse Worker", "years": 15, "physicalLevel": "heavy"},
      {"title": "Factory Worker", "years": 5, "physicalLevel": "medium"}
    ],
    "lastWorked": "2024-03-15",
    "workStatus": "not_working",
    "alreadyApplied": "yes",
    "caseStage": "denied_initial",
    // Extended voice-specific data
    "voiceExtendedData": {
      "severity": "severe",
      "durationMonths": 36,
      "treatments": ["Epidural injections", "Physical therapy"],
      "hospitalizations": 2,
      "sideEffects": ["Drowsiness", "Dizziness"],
      "denialDate": "2024-08-20",
      "heaviestLifting": "heavy",
      "sittingMinutes": 30,
      "standingMinutes": 15,
      "walkingBlocks": 1,
      "liftingPounds": 10,
      "concentrationIssues": true,
      "memoryIssues": true,
      "socialDifficulties": true,
      "expectedAbsences": 3,
      "assistiveDevices": ["Cane"]
    }
  }
}
```

**Response:**
```typescript
{
  "assessmentId": "uuid-from-skinny-app",
  "score": 72,
  "recommendation": "Highly Recommended",
  "viabilityRating": "High",
  "keyFactors": [...],
  "suggestedActions": [...],
  "practiceArea": "SSD",
  "scoreBreakdown": {...},
  "medicalAIAnalysis": {...}
}
```

### 3.2 Authentication Strategy

**Service Account Approach:**

1. Create a dedicated service account in Skinny App for the Receptionist
2. Generate a long-lived API key or JWT
3. Store securely in Receptionist's environment variables

```typescript
// Skinny App: Create service account
// Add to User table with role: SERVICE_ACCOUNT
{
  email: "voice-receptionist@halcyon.internal",
  name: "Halcyon Voice Receptionist",
  role: "SERVICE_ACCOUNT",  // New role enum value
  apiKey: "hky_live_xxxxxxxxxxxx"  // Generated secure key
}
```

**Alternative: API Key Header**
```
X-API-Key: hky_live_xxxxxxxxxxxx
```

### 3.3 Error Handling

```typescript
// Receptionist should handle these responses:

// 200 OK - Assessment successful
{ assessmentId, score, recommendation, ... }

// 400 Bad Request - Validation failed
{ error: "Invalid assessment data", details: [...] }

// 401 Unauthorized - Invalid/missing auth
{ error: "Unauthorized" }

// 429 Too Many Requests - Rate limited
{ error: "Rate limit exceeded", retryAfter: 60 }

// 500 Internal Server Error - Scoring failed
{ error: "Internal server error" }

// 503 Service Unavailable - Skinny App down
// Receptionist should fall back to local scoring
```

---

## 4. Implementation Changes

### 4.1 Skinny App Changes

#### File: `prisma/schema.prisma`
Add voice integration fields to Assessment model:

```prisma
model Assessment {
  // ... existing fields ...

  // Voice integration fields (NEW)
  source            String?   @default("web")
  voiceCallId       String?
  voiceIntakeId     String?   @unique
  callerPhone       String?
  callerCity        String?
  callerState       String?
  transcript        Json?
  callDuration      Int?
  smsConsentGiven   Boolean?  @default(false)
  isUrgent          Boolean?  @default(false)
  urgentReason      String?

  @@index([source])
  @@index([voiceIntakeId])
  @@index([isUrgent])
}
```

#### File: `src/lib/validations.ts`
Extend AssessmentDataSchema for voice data:

```typescript
// Add to existing AssessmentDataSchema
export const AssessmentDataSchema = z.object({
  // ... existing fields ...

  // Voice-specific fields
  voiceExtendedData: z.object({
    severity: z.string().optional(),
    durationMonths: z.number().optional(),
    treatments: z.array(z.string()).optional(),
    hospitalizations: z.number().optional(),
    sideEffects: z.array(z.string()).optional(),
    denialDate: z.string().optional(),
    hearingDate: z.string().optional(),
    heaviestLifting: z.string().optional(),
    sittingMinutes: z.number().optional(),
    standingMinutes: z.number().optional(),
    walkingBlocks: z.number().optional(),
    liftingPounds: z.number().optional(),
    concentrationIssues: z.boolean().optional(),
    memoryIssues: z.boolean().optional(),
    socialDifficulties: z.boolean().optional(),
    expectedAbsences: z.number().optional(),
    assistiveDevices: z.array(z.string()).optional(),
  }).optional(),
}).passthrough();

// New schema for voice metadata
export const VoiceMetadataSchema = z.object({
  callId: z.string(),
  intakeId: z.string(),
  callerPhone: z.string().optional(),
  callerCity: z.string().optional(),
  callerState: z.string().optional(),
  callDuration: z.number().optional(),
  smsConsentGiven: z.boolean().optional(),
  isUrgent: z.boolean().optional(),
  urgentReason: z.string().optional(),
  transcript: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string(),
    timestamp: z.string()
  })).optional(),
});
```

#### File: `src/app/api/intake-assessment/route.ts`
Modify to handle voice source:

```typescript
export async function POST(request: NextRequest) {
  try {
    // ... existing auth check ...

    const body = await request.json()
    const { action, data, source, voiceMetadata } = body

    if (action === 'assess') {
      // Validate input
      AssessmentDataSchema.parse(data)

      // Validate voice metadata if present
      if (source === 'voice' && voiceMetadata) {
        VoiceMetadataSchema.parse(voiceMetadata)
      }

      // Run assessment
      const result = await runIntakeAssessment(data)

      // Save to database with voice fields
      await prisma.assessment.create({
        data: {
          assessmentId: result.assessmentId,
          score: result.score,
          recommendation: result.recommendation,
          viabilityRating: result.viabilityRating,
          keyFactors: keyFactorsStrings,
          suggestedActions: suggestedActionsStrings,
          practiceArea: result.practiceArea,
          clientData: result.clientData,
          sequentialEvaluation: result.sequentialEvaluation,
          caseStrengths: result.scoreBreakdown,
          medicalAnalysis: result.medicalAIAnalysis,
          tags: [],
          // Voice-specific fields (NEW)
          source: source || 'web',
          voiceCallId: voiceMetadata?.callId,
          voiceIntakeId: voiceMetadata?.intakeId,
          callerPhone: voiceMetadata?.callerPhone,
          callerCity: voiceMetadata?.callerCity,
          callerState: voiceMetadata?.callerState,
          transcript: voiceMetadata?.transcript,
          callDuration: voiceMetadata?.callDuration,
          smsConsentGiven: voiceMetadata?.smsConsentGiven,
          isUrgent: voiceMetadata?.isUrgent,
          urgentReason: voiceMetadata?.urgentReason,
        }
      })

      return NextResponse.json(result)
    }
    // ... rest of handler ...
  }
}
```

#### File: `src/lib/auth.ts`
Add service account authentication:

```typescript
// Add to authOptions callbacks
callbacks: {
  async jwt({ token, user }) {
    // ... existing code ...

    // Handle service account API key auth
    if (token.apiKey) {
      const serviceAccount = await prisma.user.findFirst({
        where: { apiKey: token.apiKey, role: 'SERVICE_ACCOUNT' }
      })
      if (serviceAccount) {
        token.id = serviceAccount.id
        token.role = 'SERVICE_ACCOUNT'
      }
    }
    return token
  }
}
```

#### File: `src/middleware.ts`
Add API key authentication for service accounts:

```typescript
// Add before session check
const apiKey = request.headers.get('X-API-Key')
if (apiKey && request.nextUrl.pathname.startsWith('/api/')) {
  // Validate API key against database
  // Allow request if valid service account key
  const isValidServiceKey = await validateServiceApiKey(apiKey)
  if (isValidServiceKey) {
    return NextResponse.next()
  }
}
```

---

### 4.2 Receptionist Changes

#### File: `src/services/skinnyAppClient.ts` (NEW)
Create API client for Skinny App:

```typescript
/**
 * HALCYON SKINNY APP API CLIENT
 *
 * Sends intake data to the Skinny App for scoring and storage
 */

import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import type { IntakeData, ScoringResult } from './intakeSession.js';

const log = createLogger('skinny-app-client');

interface SkinnyAppAssessmentRequest {
  action: 'assess';
  source: 'voice';
  voiceMetadata: {
    callId: string;
    intakeId: string;
    callerPhone?: string;
    callerCity?: string;
    callerState?: string;
    callDuration?: number;
    smsConsentGiven?: boolean;
    isUrgent?: boolean;
    urgentReason?: string;
    transcript?: Array<{ role: string; text: string; timestamp: string }>;
  };
  data: Record<string, unknown>;
}

interface SkinnyAppAssessmentResponse {
  assessmentId: string;
  score: number;
  recommendation: string;
  viabilityRating: string;
  keyFactors: string[];
  suggestedActions: string[];
  practiceArea: string;
  scoreBreakdown?: Record<string, unknown>;
  medicalAIAnalysis?: Record<string, unknown>;
}

export class SkinnyAppClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor() {
    this.baseUrl = config.skinnyApp.baseUrl; // Add to config
    this.apiKey = config.skinnyApp.apiKey;   // Add to config
    this.timeout = config.skinnyApp.timeout || 30000;
  }

  /**
   * Transform Receptionist IntakeData to Skinny App format
   */
  private transformIntakeData(data: IntakeData): Record<string, unknown> {
    const { demographics, education, medical, functionalLimitations, workHistory, application } = data;

    // Build functional limitations as string array
    const limitations: string[] = [];
    if (functionalLimitations.sittingMinutes && functionalLimitations.sittingMinutes <= 60) {
      limitations.push(`Cannot sit more than ${functionalLimitations.sittingMinutes} minutes`);
    }
    if (functionalLimitations.standingMinutes && functionalLimitations.standingMinutes <= 30) {
      limitations.push(`Cannot stand more than ${functionalLimitations.standingMinutes} minutes`);
    }
    if (functionalLimitations.liftingPounds && functionalLimitations.liftingPounds <= 20) {
      limitations.push(`Can only lift ${functionalLimitations.liftingPounds} pounds`);
    }
    if (functionalLimitations.concentrationIssues) {
      limitations.push('Severe concentration problems');
    }
    if (functionalLimitations.memoryIssues) {
      limitations.push('Memory issues');
    }
    if (functionalLimitations.socialDifficulties) {
      limitations.push('Difficulty with social interactions');
    }
    if (functionalLimitations.expectedAbsences && functionalLimitations.expectedAbsences >= 2) {
      limitations.push(`Would miss ${functionalLimitations.expectedAbsences}+ days per month`);
    }
    if (functionalLimitations.assistiveDevices?.length) {
      limitations.push(`Uses: ${functionalLimitations.assistiveDevices.join(', ')}`);
    }

    return {
      // Core fields
      name: `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim(),
      clientName: `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim(),
      email: demographics.email,
      dob: demographics.dateOfBirth,
      dateOfBirth: demographics.dateOfBirth,
      age: demographics.age,
      phone: demographics.phone,

      // Education
      education: education.level,

      // Medical
      selectedConditions: medical.conditions,
      conditions: medical.conditions,
      medications: medical.medications,

      // Functional limitations
      functionalLimitations: limitations,

      // Work history
      workHistory: workHistory.jobs.map(j => ({
        title: j.title,
        years: j.years,
        physicalLevel: workHistory.heaviestLifting
      })),
      lastWorked: workHistory.lastWorkDate,
      workStatus: workHistory.currentlyWorking ? 'working' : 'not_working',
      cannotWork: !workHistory.currentlyWorking,

      // Application status
      alreadyApplied: application.hasApplied ? 'yes' : 'no',
      caseStage: application.status,

      // Practice area
      practiceArea: 'SSD',

      // Extended voice data (for enhanced scoring)
      voiceExtendedData: {
        severity: medical.severity,
        durationMonths: medical.durationMonths,
        treatments: medical.treatments,
        hospitalizations: medical.hospitalizations,
        sideEffects: medical.sideEffects,
        denialDate: application.denialDate,
        hearingDate: application.hearingDate,
        heaviestLifting: workHistory.heaviestLifting,
        sittingMinutes: functionalLimitations.sittingMinutes,
        standingMinutes: functionalLimitations.standingMinutes,
        walkingBlocks: functionalLimitations.walkingBlocks,
        liftingPounds: functionalLimitations.liftingPounds,
        concentrationIssues: functionalLimitations.concentrationIssues,
        memoryIssues: functionalLimitations.memoryIssues,
        socialDifficulties: functionalLimitations.socialDifficulties,
        expectedAbsences: functionalLimitations.expectedAbsences,
        assistiveDevices: functionalLimitations.assistiveDevices,
      }
    };
  }

  /**
   * Send intake to Skinny App for assessment
   */
  async submitAssessment(
    callId: string,
    intakeId: string,
    data: IntakeData,
    metadata: {
      callerPhone?: string;
      callerCity?: string;
      callerState?: string;
      callDuration?: number;
      smsConsentGiven?: boolean;
      isUrgent?: boolean;
      urgentReason?: string;
    }
  ): Promise<SkinnyAppAssessmentResponse> {
    const request: SkinnyAppAssessmentRequest = {
      action: 'assess',
      source: 'voice',
      voiceMetadata: {
        callId,
        intakeId,
        callerPhone: metadata.callerPhone,
        callerCity: metadata.callerCity,
        callerState: metadata.callerState,
        callDuration: metadata.callDuration,
        smsConsentGiven: metadata.smsConsentGiven,
        isUrgent: metadata.isUrgent,
        urgentReason: metadata.urgentReason,
        transcript: data.transcript.map(t => ({
          role: t.role,
          text: t.text,
          timestamp: t.timestamp.toISOString()
        }))
      },
      data: this.transformIntakeData(data)
    };

    log.info({
      event: 'skinny_app_request',
      callId,
      intakeId,
      endpoint: `${this.baseUrl}/api/intake-assessment`
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/intake-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        log.error({
          event: 'skinny_app_error',
          status: response.status,
          body: errorBody
        });
        throw new Error(`Skinny App API error: ${response.status} - ${errorBody}`);
      }

      const result = await response.json() as SkinnyAppAssessmentResponse;

      log.info({
        event: 'skinny_app_success',
        callId,
        assessmentId: result.assessmentId,
        score: result.score,
        recommendation: result.recommendation
      });

      return result;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        log.error({ event: 'skinny_app_timeout', callId });
        throw new Error('Skinny App request timed out');
      }

      throw error;
    }
  }

  /**
   * Map Skinny App response to Receptionist ScoringResult format
   */
  mapToScoringResult(response: SkinnyAppAssessmentResponse): ScoringResult {
    // Map recommendation string to enum
    const recommendationMap: Record<string, ScoringResult['recommendation']> = {
      'Highly Recommended': 'highly_recommended',
      'Strong Referral': 'highly_recommended',
      'Recommended': 'recommended',
      'Moderate Referral': 'recommended',
      'Conditional Referral': 'consider_caution',
      'Consider with Caution': 'consider_caution',
      'Weak Referral': 'weak_case',
      'Weak Case': 'weak_case',
      'Not Recommended': 'not_recommended',
    };

    // Map viability to approval likelihood
    const likelihoodMap: Record<string, string> = {
      'Very High': '80%+',
      'High': '60-80%',
      'Moderate': '40-60%',
      'Low': '20-40%',
      'Very Low': '<20%',
    };

    // Map score to callback timeframe
    let callbackTimeframe = '48 hours';
    if (response.score >= 70) callbackTimeframe = '24 hours';
    else if (response.score >= 45) callbackTimeframe = '48 hours';
    else if (response.score >= 25) callbackTimeframe = '3-5 days';
    else callbackTimeframe = '5-7 days';

    return {
      totalScore: response.score,
      recommendation: recommendationMap[response.recommendation] || 'consider_caution',
      viabilityRating: response.viabilityRating,
      approvalLikelihood: likelihoodMap[response.viabilityRating] || '40-60%',
      caseStrengths: response.keyFactors.filter(f => !f.toLowerCase().includes('concern')),
      caseConcerns: response.keyFactors.filter(f => f.toLowerCase().includes('concern')),
      callbackTimeframe
    };
  }

  /**
   * Health check for Skinny App
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/intake-assessment?action=health`,
        { method: 'GET', headers: { 'X-API-Key': this.apiKey } }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const skinnyAppClient = new SkinnyAppClient();
```

#### File: `src/config/index.ts`
Add Skinny App configuration:

```typescript
// Add to config object
skinnyApp: {
  enabled: process.env.SKINNY_APP_ENABLED === 'true',
  baseUrl: process.env.SKINNY_APP_URL || 'http://localhost:3000',
  apiKey: process.env.SKINNY_APP_API_KEY || '',
  timeout: parseInt(process.env.SKINNY_APP_TIMEOUT || '30000'),
  fallbackToLocal: process.env.SKINNY_APP_FALLBACK === 'true', // Use local scoring if API fails
},
```

#### File: `src/services/intakeSession.ts`
Modify finalize() to use Skinny App:

```typescript
import { skinnyAppClient } from './skinnyAppClient.js';

// In IntakeSession class, modify finalize():

async finalize(): Promise<IntakeResult> {
  let scoring: ScoringResult;

  // Try Skinny App first if enabled
  if (config.skinnyApp.enabled) {
    try {
      const response = await skinnyAppClient.submitAssessment(
        this.callId,
        this.intakeId,
        this.data,
        {
          callerPhone: this.callerInfo.callerPhone,
          callerCity: this.callerInfo.callerCity,
          callerState: this.callerInfo.callerState,
          callDuration: undefined, // Set by Twilio status callback
          smsConsentGiven: this.data.smsConsent.consentGiven,
          isUrgent: this.flags.urgent,
          urgentReason: this.flags.urgentReason,
        }
      );

      // Map response to our format
      scoring = skinnyAppClient.mapToScoringResult(response);

      this.log.info({
        event: 'skinny_app_scoring_used',
        score: scoring.totalScore,
        assessmentId: response.assessmentId
      });

      // Store the Skinny App assessment ID for reference
      this.skinnyAppAssessmentId = response.assessmentId;

    } catch (error) {
      this.log.error({ event: 'skinny_app_scoring_failed', error });

      // Fall back to local scoring if configured
      if (config.skinnyApp.fallbackToLocal) {
        this.log.info({ event: 'falling_back_to_local_scoring' });
        scoring = this.scoringEngine.calculateScore(this.data);
      } else {
        throw error;
      }
    }
  } else {
    // Use local scoring
    scoring = this.scoringEngine.calculateScore(this.data);
  }

  this.scoring = scoring;

  // ... rest of finalize() remains the same ...
  // Note: Skip local DB save if Skinny App succeeded (it saves there)
  // But still send SMS and email notifications
}
```

---

## 5. Environment Variables

### 5.1 Receptionist (.env)
```env
# Skinny App Integration
SKINNY_APP_ENABLED=true
SKINNY_APP_URL=https://your-skinny-app.vercel.app
SKINNY_APP_API_KEY=hky_live_xxxxxxxxxxxxxxxxxxxx
SKINNY_APP_TIMEOUT=30000
SKINNY_APP_FALLBACK=true
```

### 5.2 Skinny App (.env)
```env
# Voice Integration
VOICE_API_KEY=hky_live_xxxxxxxxxxxxxxxxxxxx
VOICE_SERVICE_ENABLED=true
```

---

## 6. Database Migrations

### 6.1 Skinny App Migration
Run after updating schema.prisma:

```bash
cd halcyon-skinny-app
npx prisma migrate dev --name add_voice_integration_fields
npx prisma generate
```

### 6.2 Service Account Setup
```sql
-- Create service account for Voice Receptionist
INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'voice-receptionist@halcyon.internal',
  'Halcyon Voice Receptionist',
  'SERVICE_ACCOUNT',
  NOW(),
  NOW()
);

-- Generate API key (store securely)
-- In production, use a proper key generation and storage system
```

---

## 7. Testing Plan

### 7.1 Unit Tests
- Test data transformation (Receptionist → Skinny App format)
- Test response mapping (Skinny App → Receptionist format)
- Test error handling (timeout, 4xx, 5xx responses)
- Test fallback to local scoring

### 7.2 Integration Tests
1. **Happy Path**: Voice call → Skinny App → Score returned → SMS sent
2. **Auth Failure**: Invalid API key → 401 → Local fallback
3. **Timeout**: Skinny App slow → Timeout → Local fallback
4. **Validation Error**: Bad data → 400 → Error logged
5. **Service Down**: Skinny App unreachable → Local fallback

### 7.3 E2E Test Scenarios
```typescript
describe('Voice Integration', () => {
  it('should submit voice intake to Skinny App', async () => {
    // Simulate voice call data
    const intakeData = createMockIntakeData();

    // Submit to Skinny App
    const response = await skinnyAppClient.submitAssessment(
      'test-call-id',
      'test-intake-id',
      intakeData,
      { callerPhone: '+15551234567' }
    );

    // Verify response
    expect(response.assessmentId).toBeDefined();
    expect(response.score).toBeGreaterThanOrEqual(0);
    expect(response.score).toBeLessThanOrEqual(100);
  });

  it('should fall back to local scoring on API failure', async () => {
    // Mock Skinny App failure
    mockSkinnyAppDown();

    // Submit should still succeed with local scoring
    const result = await intakeSession.finalize();

    expect(result.scoring).toBeDefined();
    expect(result.scoring.totalScore).toBeGreaterThanOrEqual(0);
  });
});
```

---

## 8. Deployment Steps

### Phase 1: Skinny App Updates (Day 1-2)
1. Update `prisma/schema.prisma` with voice fields
2. Run database migration
3. Update `src/lib/validations.ts` with voice schemas
4. Update `/api/intake-assessment/route.ts` to handle voice source
5. Add API key authentication to middleware
6. Create service account in database
7. Deploy to staging, test with mock requests
8. Deploy to production

### Phase 2: Receptionist Updates (Day 2-3)
1. Create `src/services/skinnyAppClient.ts`
2. Update `src/config/index.ts` with Skinny App config
3. Update `src/services/intakeSession.ts` finalize()
4. Add environment variables
5. Test locally against Skinny App staging
6. Deploy to staging
7. End-to-end test with real phone calls
8. Deploy to production

### Phase 3: Monitoring & Validation (Day 3-5)
1. Monitor API calls between services
2. Verify data appears correctly in Skinny App dashboard
3. Confirm scoring consistency
4. Check error rates and fallback activation
5. Validate SMS/email notifications still work
6. Test CMS sync includes voice intakes

---

## 9. Rollback Plan

If issues arise:

1. **Immediate**: Set `SKINNY_APP_ENABLED=false` in Receptionist
   - Falls back to local scoring immediately
   - No code deployment needed

2. **Short-term**: Revert Receptionist code changes
   - Keep Skinny App changes (backwards compatible)
   - Restore original intakeSession.ts

3. **Full rollback**: Revert both apps
   - Remove voice fields from Skinny App (or leave unused)
   - Revert Receptionist to pre-integration state

---

## 10. Future Enhancements

1. **Real-time sync**: WebSocket connection for live call updates
2. **Bidirectional**: Skinny App triggers callbacks via Receptionist
3. **Analytics**: Voice channel metrics in Skinny App dashboard
4. **CMS integration**: Voice intakes sync directly to CMS platforms
5. **Batch voice**: Process multiple voice recordings in batch
6. **Quality scoring**: AI-powered call quality assessment

---

## Appendix A: Full File Change List

### Skinny App
| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | MODIFY | Add voice integration fields to Assessment |
| `src/lib/validations.ts` | MODIFY | Add VoiceMetadataSchema, extend AssessmentDataSchema |
| `src/app/api/intake-assessment/route.ts` | MODIFY | Handle voice source and metadata |
| `src/lib/auth.ts` | MODIFY | Add service account authentication |
| `src/middleware.ts` | MODIFY | Add API key validation for service accounts |

### Receptionist
| File | Action | Description |
|------|--------|-------------|
| `src/services/skinnyAppClient.ts` | CREATE | New API client for Skinny App |
| `src/config/index.ts` | MODIFY | Add Skinny App configuration |
| `src/services/intakeSession.ts` | MODIFY | Use Skinny App for scoring in finalize() |
| `.env.example` | MODIFY | Add Skinny App environment variables |

---

## Appendix B: API Key Security

1. **Generation**: Use cryptographically secure random generation
2. **Storage**: Environment variables only, never in code
3. **Rotation**: Implement key rotation every 90 days
4. **Scoping**: Keys should only access specific endpoints
5. **Logging**: Log all API key usage (without the key itself)
6. **Revocation**: Ability to immediately revoke compromised keys

```typescript
// Example key generation (Node.js)
import crypto from 'crypto';

function generateApiKey(): string {
  const prefix = 'hky_live_';
  const key = crypto.randomBytes(32).toString('base64url');
  return prefix + key;
}
```
