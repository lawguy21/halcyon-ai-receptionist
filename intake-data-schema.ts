/**
 * HALCYON AI RECEPTIONIST - INTAKE DATA SCHEMA
 *
 * TypeScript interfaces and types for SSD phone intake data
 * Based on Halcyon Skinny App scoring logic
 *
 * © 2025 Halcyon Legal Tech
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export enum EducationLevel {
  ILLITERATE = 'illiterate',           // Cannot read/write
  MARGINAL = 'marginal',               // 6th grade or less
  LIMITED = 'limited',                 // 7th-11th grade
  HIGH_SCHOOL = 'high_school',         // GED or diploma
  COLLEGE = 'college'                  // Any college or higher
}

export enum SeverityLevel {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  DISABLING = 'disabling'
}

export enum PhysicalDemandLevel {
  SEDENTARY = 'sedentary',             // Lifting max 10 lbs, mostly sitting
  LIGHT = 'light',                     // Lifting max 20 lbs
  MEDIUM = 'medium',                   // Lifting max 50 lbs
  HEAVY = 'heavy',                     // Lifting 50-100 lbs
  VERY_HEAVY = 'very_heavy'            // Lifting 100+ lbs
}

export enum SkillLevel {
  UNSKILLED = 'unskilled',             // No transferable skills
  SEMI_SKILLED = 'semi_skilled',       // Limited transferable skills
  SKILLED = 'skilled'                  // Has transferable skills
}

export enum ApplicationStatus {
  NEVER_APPLIED = 'never_applied',
  APPLIED_WAITING = 'applied_waiting',
  DENIED_INITIAL = 'denied_initial',
  DENIED_RECONSIDERATION = 'denied_reconsideration',
  HEARING_PENDING = 'hearing_pending',
  HEARING_SCHEDULED = 'hearing_scheduled',
  APPEALS_COUNCIL = 'appeals_council',
  FEDERAL_COURT = 'federal_court'
}

export enum RecommendationLevel {
  HIGHLY_RECOMMENDED = 'highly_recommended',   // 70-100
  RECOMMENDED = 'recommended',                  // 45-69
  CONSIDER_WITH_CAUTION = 'consider_caution',  // 25-44
  WEAK_CASE = 'weak_case',                     // 10-24
  NOT_RECOMMENDED = 'not_recommended'          // 0-9
}

export enum ConditionCategory {
  MUSCULOSKELETAL = 'musculoskeletal',
  MENTAL = 'mental',
  NEUROLOGICAL = 'neurological',
  CARDIOVASCULAR = 'cardiovascular',
  RESPIRATORY = 'respiratory',
  ENDOCRINE = 'endocrine',
  IMMUNE = 'immune',
  CANCER = 'cancer',
  SENSORY = 'sensory',
  OTHER = 'other'
}

export enum MedicationCategory {
  OPIOID_PAIN = 'opioid_pain',
  NON_OPIOID_PAIN = 'non_opioid_pain',
  ANTIDEPRESSANT = 'antidepressant',
  ANTIPSYCHOTIC = 'antipsychotic',
  MOOD_STABILIZER = 'mood_stabilizer',
  ANXIOLYTIC = 'anxiolytic',
  DIABETES = 'diabetes',
  CARDIAC = 'cardiac',
  IMMUNOSUPPRESSANT = 'immunosuppressant',
  MS_PARKINSONS = 'ms_parkinsons',
  RESPIRATORY = 'respiratory',
  OTHER = 'other'
}

// ============================================
// CORE DATA INTERFACES
// ============================================

export interface ClientInfo {
  name: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;           // ISO date string
  age: number;                   // Calculated from DOB
  phone: string;
  email?: string;
  address?: {
    street?: string;
    city: string;
    state: string;
    zipCode?: string;
  };
  preferredContactMethod?: 'phone' | 'email' | 'text';
  preferredCallbackTime?: string;
}

export interface MedicalCondition {
  name: string;
  category: ConditionCategory;
  blueBookSection?: string;      // SSA Blue Book listing reference
  baseScore: number;
  ssaApprovalRate: number;       // 0-1 decimal
  dateOfOnset?: string;
  isTreated: boolean;
  treatingProvider?: string;
}

export interface Medication {
  name: string;
  category: MedicationCategory;
  dosage?: string;
  frequency?: string;
  prescribedFor?: string;
  points: number;
  sideEffects?: string[];
}

export interface Treatment {
  type: 'surgery' | 'injection' | 'therapy' | 'hospitalization' | 'specialist' | 'other';
  description: string;
  date?: string;
  provider?: string;
  evidenceWeight: number;        // 1.0 - 2.0
}

export interface FunctionalLimitation {
  category: string;              // sitting, standing, walking, lifting, etc.
  description: string;
  value?: number;                // minutes, pounds, blocks, etc.
  unit?: string;
  rfcImpact: string;             // sedentary, light, medium, less_than_sedentary
  points: number;
  isCritical: boolean;           // If true, this alone may preclude work
}

export interface WorkHistoryEntry {
  jobTitle: string;
  employer?: string;
  yearsWorked: number;
  startDate?: string;
  endDate?: string;
  skillLevel: SkillLevel;
  physicalDemand: PhysicalDemandLevel;
  description?: string;
}

export interface ApplicationInfo {
  status: ApplicationStatus;
  applicationDate?: string;
  denialDate?: string;
  denialLevel?: 'initial' | 'reconsideration' | 'hearing' | 'appeals_council';
  hearingDate?: string;
  appealDeadline?: string;
  assignedJudge?: string;
  caseNumber?: string;
}

// ============================================
// SCORING INTERFACES
// ============================================

export interface ScoreBreakdown {
  conditionScores: number;
  multipleConditionsBonus: number;
  comorbidityBonus: number;
  ageBonus: number;
  educationBonus: number;
  workHistoryBonus: number;
  gridRuleBonus: number;
  medicationScore: number;
  hospitalizationBonus: number;
  functionalLimitationPoints: number;
  penalties: number;
}

export interface CaseStrength {
  factor: string;
  description: string;
  points: number;
  ssaRule?: string;              // Reference to SSA regulation
}

export interface CaseConcern {
  factor: string;
  description: string;
  impact: 'minor' | 'moderate' | 'significant';
  mitigation?: string;
}

export interface ScoringResult {
  totalScore: number;            // 0-100
  recommendation: RecommendationLevel;
  viabilityRating: 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
  approvalLikelihood: string;    // e.g., "60-80%"
  breakdown: ScoreBreakdown;
  caseStrengths: CaseStrength[];
  caseConcerns: CaseConcern[];
  suggestedActions: string[];
  gridRuleApplicable: boolean;
  gridRuleDetails?: {
    rule: string;
    ageCategory: string;
    educationFactor: string;
    workFactor: string;
    rfcNeeded: string;
  };
}

// ============================================
// CALL & INTAKE SESSION
// ============================================

export interface CallMetadata {
  callId: string;                // Unique identifier: HC_YYYYMMDD_xxxxx
  timestamp: string;             // ISO datetime
  durationSeconds: number;
  phoneNumberCalled: string;     // Firm's number that was called
  callerPhoneNumber: string;
  agentId?: string;              // AI agent identifier
  recordingUrl?: string;
  transcriptUrl?: string;
  platform: 'twilio' | 'vapi' | 'custom' | 'other';
}

export interface CallFlags {
  urgent: boolean;
  urgentReason?: string;
  crisisMentioned: boolean;
  crisisDetails?: string;
  transferredToHuman: boolean;
  transferReason?: string;
  callbackRequested: boolean;
  callbackPreferredTime?: string;
  incompleteIntake: boolean;
  incompleteReason?: string;
}

export interface FollowUp {
  smsSent: boolean;
  smsTimestamp?: string;
  smsContent?: string;
  callbackScheduled: boolean;
  callbackDate?: string;
  callbackTime?: string;
  assignedAttorney?: string;
  assignedParalegal?: string;
  taskCreated: boolean;
  taskId?: string;
  crmLeadCreated: boolean;
  crmLeadId?: string;
}

// ============================================
// MAIN INTAKE RECORD
// ============================================

export interface IntakeRecord {
  // Identifiers
  id: string;
  callId: string;
  createdAt: string;
  updatedAt: string;

  // Call Information
  call: CallMetadata;

  // Client Information
  client: ClientInfo;

  // Demographics
  demographics: {
    educationLevel: EducationLevel;
    educationDetails?: string;
    languagePreference?: string;
    interpreterNeeded?: boolean;
  };

  // Medical Information
  medical: {
    conditions: MedicalCondition[];
    severity: SeverityLevel;
    durationMonths: number;
    treatments: Treatment[];
    hospitalizationsLast12Months: number;
    medications: Medication[];
    medicationSideEffects: string[];
    assistiveDevices: string[];
    treatingDoctors?: string[];
  };

  // Functional Limitations
  functionalLimitations: {
    sitting: FunctionalLimitation;
    standing: FunctionalLimitation;
    walking: FunctionalLimitation;
    lifting: FunctionalLimitation;
    concentration: FunctionalLimitation;
    memory: FunctionalLimitation;
    socialInteraction: FunctionalLimitation;
    attendance: FunctionalLimitation;
    additionalLimitations: FunctionalLimitation[];
  };

  // Work History
  workHistory: {
    jobs: WorkHistoryEntry[];
    totalWorkYears: number;
    lastWorkDate?: string;
    currentlyWorking: boolean;
    reducedHours?: boolean;
    heaviestDemandLevel: PhysicalDemandLevel;
    primarySkillLevel: SkillLevel;
  };

  // Application Status
  application: ApplicationInfo;

  // Scoring
  scoring: ScoringResult;

  // Flags & Follow-up
  flags: CallFlags;
  followUp: FollowUp;

  // Notes
  notes: {
    aiNotes: string;             // Generated by AI during call
    humanNotes?: string;         // Added by staff
    attorneyNotes?: string;      // Added after review
  };

  // Status tracking
  status: 'new' | 'pending_review' | 'reviewed' | 'accepted' | 'declined' | 'converted';
  reviewedBy?: string;
  reviewedAt?: string;
  disposition?: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface IntakeAssessmentRequest {
  client: ClientInfo;
  demographics: {
    educationLevel: EducationLevel;
    educationDetails?: string;
  };
  medical: {
    conditions: string[];        // Condition names to be matched
    severity: SeverityLevel;
    durationMonths: number;
    treatments: string[];
    hospitalizationsLast12Months: number;
    medications: string[];       // Medication names to be matched
    medicationSideEffects: string[];
    assistiveDevices: string[];
  };
  functionalLimitations: {
    sittingMinutes?: number;
    standingMinutes?: number;
    walkingBlocks?: number;
    liftingPounds?: number;
    concentrationLevel?: string;
    memoryLevel?: string;
    socialInteractionLevel?: string;
    expectedAbsencesPerMonth?: number;
    needsToLieDown?: boolean;
    additionalLimitations?: string[];
  };
  workHistory: {
    jobs: Array<{
      title: string;
      yearsWorked: number;
      description?: string;
    }>;
    lastWorkDate?: string;
    currentlyWorking?: boolean;
  };
  application: {
    status: ApplicationStatus;
    denialDate?: string;
    hearingDate?: string;
  };
}

export interface IntakeAssessmentResponse {
  success: boolean;
  intakeId: string;
  scoring: ScoringResult;
  nextSteps: string[];
  estimatedCallbackTime: string;
  error?: string;
}

// ============================================
// SCORING CONSTANTS (from Halcyon Logic)
// ============================================

export const AGE_MULTIPLIERS = {
  YOUNGER: { min: 18, max: 49, multiplier: 0.7 },
  CLOSELY_APPROACHING_ADVANCED: { min: 50, max: 54, multiplier: 1.15 },
  ADVANCED: { min: 55, max: 59, multiplier: 1.35 },
  APPROACHING_RETIREMENT: { min: 60, max: 100, multiplier: 1.5 }
} as const;

export const EDUCATION_MULTIPLIERS = {
  [EducationLevel.ILLITERATE]: { multiplier: 1.5, bonus50Plus: 8 },
  [EducationLevel.MARGINAL]: { multiplier: 1.4, bonus50Plus: 5 },
  [EducationLevel.LIMITED]: { multiplier: 1.2, bonus50Plus: 3 },
  [EducationLevel.HIGH_SCHOOL]: { multiplier: 1.0, bonus50Plus: 0 },
  [EducationLevel.COLLEGE]: { multiplier: 0.85, bonus50Plus: -5 }
} as const;

export const SEVERITY_MULTIPLIERS = {
  [SeverityLevel.MILD]: 0.6,
  [SeverityLevel.MODERATE]: 0.75,
  [SeverityLevel.SEVERE]: 1.0,
  [SeverityLevel.DISABLING]: 1.2
} as const;

export const WORK_DEMAND_POINTS = {
  [PhysicalDemandLevel.VERY_HEAVY]: 25,
  [PhysicalDemandLevel.HEAVY]: 20,
  [PhysicalDemandLevel.MEDIUM]: 15,
  [PhysicalDemandLevel.LIGHT]: 5,
  [PhysicalDemandLevel.SEDENTARY]: -10
} as const;

export const SKILL_LEVEL_POINTS = {
  [SkillLevel.UNSKILLED]: 15,
  [SkillLevel.SEMI_SKILLED]: 8,
  [SkillLevel.SKILLED]: -5
} as const;

export const MULTIPLE_CONDITIONS_BONUS = {
  2: 10,
  3: 18,
  4: 25
} as const;

export const SCORE_THRESHOLDS = {
  HIGHLY_RECOMMENDED: { min: 70, max: 100, likelihood: '80%+' },
  RECOMMENDED: { min: 45, max: 69, likelihood: '60-80%' },
  CONSIDER_CAUTION: { min: 25, max: 44, likelihood: '40-60%' },
  WEAK_CASE: { min: 10, max: 24, likelihood: '20-40%' },
  NOT_RECOMMENDED: { min: 0, max: 9, likelihood: '<20%' }
} as const;

// ============================================
// HELPER TYPE GUARDS
// ============================================

export function isHighScoreCase(score: number): boolean {
  return score >= 70;
}

export function isUrgentCase(intake: IntakeRecord): boolean {
  // Urgent if high score OR deadline approaching OR hearing scheduled
  if (intake.scoring.totalScore >= 70) return true;
  if (intake.application.appealDeadline) {
    const deadline = new Date(intake.application.appealDeadline);
    const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDeadline <= 30) return true;
  }
  if (intake.application.status === ApplicationStatus.HEARING_SCHEDULED) return true;
  return false;
}

export function getAgeCategory(age: number): keyof typeof AGE_MULTIPLIERS {
  if (age >= 60) return 'APPROACHING_RETIREMENT';
  if (age >= 55) return 'ADVANCED';
  if (age >= 50) return 'CLOSELY_APPROACHING_ADVANCED';
  return 'YOUNGER';
}

export function getRecommendationLevel(score: number): RecommendationLevel {
  if (score >= 70) return RecommendationLevel.HIGHLY_RECOMMENDED;
  if (score >= 45) return RecommendationLevel.RECOMMENDED;
  if (score >= 25) return RecommendationLevel.CONSIDER_WITH_CAUTION;
  if (score >= 10) return RecommendationLevel.WEAK_CASE;
  return RecommendationLevel.NOT_RECOMMENDED;
}

// ============================================
// DATABASE SCHEMA (Prisma-style)
// ============================================

/*
model IntakeRecord {
  id                    String   @id @default(cuid())
  callId                String   @unique
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Client
  clientName            String
  clientDob             DateTime
  clientAge             Int
  clientPhone           String
  clientEmail           String?
  clientCity            String?
  clientState           String?

  // Demographics
  educationLevel        String
  educationDetails      String?

  // Medical (stored as JSON)
  conditions            Json     // MedicalCondition[]
  severity              String
  durationMonths        Int
  treatments            Json     // Treatment[]
  hospitalizations      Int
  medications           Json     // Medication[]
  medicationSideEffects Json     // string[]
  assistiveDevices      Json     // string[]

  // Functional Limitations (stored as JSON)
  functionalLimitations Json

  // Work History (stored as JSON)
  workHistory           Json
  totalWorkYears        Int
  lastWorkDate          DateTime?
  currentlyWorking      Boolean  @default(false)

  // Application
  applicationStatus     String
  denialDate            DateTime?
  hearingDate           DateTime?
  appealDeadline        DateTime?

  // Scoring
  totalScore            Int
  recommendation        String
  viabilityRating       String
  scoreBreakdown        Json
  caseStrengths         Json
  caseConcerns          Json

  // Call Metadata
  callDuration          Int
  callTimestamp         DateTime
  recordingUrl          String?
  transcriptUrl         String?
  platform              String

  // Flags
  isUrgent              Boolean  @default(false)
  urgentReason          String?
  crisisMentioned       Boolean  @default(false)

  // Follow-up
  smsSent               Boolean  @default(false)
  callbackScheduled     Boolean  @default(false)
  callbackDate          DateTime?
  assignedAttorney      String?

  // Status
  status                String   @default("new")
  reviewedBy            String?
  reviewedAt            DateTime?
  disposition           String?

  // Notes
  aiNotes               String?
  humanNotes            String?
  attorneyNotes         String?

  // Relations
  userId                String?
  user                  User?    @relation(fields: [userId], references: [id])

  @@index([status])
  @@index([totalScore])
  @@index([applicationStatus])
  @@index([createdAt])
  @@index([isUrgent])
}
*/
