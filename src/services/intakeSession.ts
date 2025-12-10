/**
 * HALCYON AI RECEPTIONIST - INTAKE SESSION MANAGER
 *
 * Manages the state of each intake call
 * Handles function calls from OpenAI and calculates scores
 */

import { v4 as uuidv4 } from 'uuid';
import { createCallLogger } from '../utils/logger.js';
import { ScoringEngine } from './scoringEngine.js';
import { SMSService } from './smsService.js';
import { emailService } from './emailService.js';
import { db } from './database.js';
import { config } from '../config/index.js';
import { skinnyAppClient } from './skinnyAppClient.js';

// Intake data types
export interface Demographics {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  age?: number;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
}

export interface Education {
  level?: 'illiterate' | 'marginal' | 'limited' | 'high_school' | 'college';
  details?: string;
}

export interface MedicalInfo {
  conditions: string[];
  severity?: 'mild' | 'moderate' | 'severe' | 'disabling';
  durationMonths?: number;
  treatments: string[];
  hospitalizations?: number;
  medications: string[];
  sideEffects: string[];
}

export interface FunctionalLimitations {
  sittingMinutes?: number;
  standingMinutes?: number;
  walkingBlocks?: number;
  liftingPounds?: number;
  concentrationIssues?: boolean;
  memoryIssues?: boolean;
  socialDifficulties?: boolean;
  expectedAbsences?: number;
  needsToLieDown?: boolean;
  assistiveDevices: string[];
}

export interface WorkHistory {
  jobs: Array<{ title: string; years: number }>;
  heaviestLifting?: 'sedentary' | 'light' | 'medium' | 'heavy' | 'very_heavy';
  totalWorkYears?: number;
  lastWorkDate?: string;
  currentlyWorking?: boolean;
}

export interface ApplicationStatus {
  hasApplied?: boolean;
  status?: 'never_applied' | 'waiting' | 'denied_initial' | 'denied_reconsideration' | 'hearing_pending' | 'hearing_scheduled';
  denialDate?: string;
  hearingDate?: string;
}

export interface SmsConsent {
  consentGiven: boolean;
  consentTimestamp?: Date;
  phoneNumber?: string;
}

export interface IntakeData {
  demographics: Demographics;
  education: Education;
  medical: MedicalInfo;
  functionalLimitations: FunctionalLimitations;
  workHistory: WorkHistory;
  application: ApplicationStatus;
  smsConsent: SmsConsent;
  notes: string;
  transcript: Array<{ role: 'user' | 'assistant'; text: string; timestamp: Date }>;
}

export interface ScoringResult {
  totalScore: number;
  recommendation: 'highly_recommended' | 'recommended' | 'consider_caution' | 'weak_case' | 'not_recommended';
  viabilityRating: string;
  approvalLikelihood: string;
  caseStrengths: string[];
  caseConcerns: string[];
  callbackTimeframe: string;
}

export interface IntakeResult {
  callId: string;
  intakeId: string;
  data: IntakeData;
  scoring: ScoringResult;
  flags: {
    urgent: boolean;
    urgentReason?: string;
    crisisMentioned: boolean;
    transferRequested: boolean;
  };
  outcome: string;
  createdAt: Date;
  completedAt?: Date;
}

interface CallerInfo {
  callerPhone: string;
  callerCity: string;
  callerState: string;
}

export class IntakeSession {
  private callId: string;
  private intakeId: string;
  private log;
  private scoringEngine: ScoringEngine;
  private smsService: SMSService;
  private callerInfo: CallerInfo;

  private data: IntakeData = {
    demographics: {},
    education: {},
    medical: {
      conditions: [],
      treatments: [],
      medications: [],
      sideEffects: []
    },
    functionalLimitations: {
      assistiveDevices: []
    },
    workHistory: {
      jobs: []
    },
    application: {},
    smsConsent: {
      consentGiven: false
    },
    notes: '',
    transcript: []
  };

  private flags = {
    urgent: false,
    urgentReason: undefined as string | undefined,
    crisisMentioned: false,
    transferRequested: false
  };

  private outcome = 'in_progress';
  private scoring: ScoringResult | null = null;
  private createdAt: Date;

  constructor(callId: string, callerInfo: CallerInfo) {
    this.callId = callId;
    this.intakeId = `INT_${Date.now()}_${uuidv4().slice(0, 8)}`;
    this.callerInfo = callerInfo;
    this.log = createCallLogger(callId);
    this.scoringEngine = new ScoringEngine();
    this.smsService = new SMSService();
    this.createdAt = new Date();

    // Pre-populate from caller ID if available
    this.data.demographics.phone = callerInfo.callerPhone;
    this.data.demographics.city = callerInfo.callerCity;
    this.data.demographics.state = callerInfo.callerState;

    this.log.info({
      event: 'intake_session_created',
      intakeId: this.intakeId
    });
  }

  addTranscript(role: 'user' | 'assistant', text: string): void {
    this.data.transcript.push({
      role,
      text,
      timestamp: new Date()
    });
  }

  async handleFunctionCall(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.log.info({ event: 'function_call_received', name, args });

    switch (name) {
      case 'record_demographics':
        return this.recordDemographics(args);

      case 'record_education':
        return this.recordEducation(args);

      case 'record_medical_conditions':
        return this.recordMedicalConditions(args);

      case 'record_medications':
        return this.recordMedications(args);

      case 'record_functional_limitations':
        return this.recordFunctionalLimitations(args);

      case 'record_work_history':
        return this.recordWorkHistory(args);

      case 'record_application_status':
        return this.recordApplicationStatus(args);

      case 'record_sms_consent':
        return this.recordSmsConsent(args);

      case 'record_assessment':
        return this.recordAssessment(args);

      case 'flag_urgent':
        return this.flagUrgent(args);

      case 'request_human_transfer':
        return this.requestHumanTransfer(args);

      case 'end_call':
        return this.endCall(args);

      case 'record_callback_request':
        return this.recordCallbackRequest(args);

      default:
        this.log.warn({ event: 'unknown_function', name });
        return { error: `Unknown function: ${name}` };
    }
  }

  private recordDemographics(args: Record<string, unknown>): object {
    this.data.demographics = {
      ...this.data.demographics,
      firstName: args.first_name as string,
      lastName: args.last_name as string,
      dateOfBirth: args.date_of_birth as string,
      phone: (args.phone as string) || this.data.demographics.phone,
      email: args.email as string,
      city: (args.city as string) || this.data.demographics.city,
      state: (args.state as string) || this.data.demographics.state
    };

    // Calculate age from DOB
    if (this.data.demographics.dateOfBirth) {
      const dob = new Date(this.data.demographics.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      this.data.demographics.age = age;
    }

    this.log.info({
      event: 'demographics_recorded',
      name: `${this.data.demographics.firstName} ${this.data.demographics.lastName}`,
      age: this.data.demographics.age
    });

    // Return age-based guidance
    const age = this.data.demographics.age || 0;
    if (age >= 55) {
      return {
        recorded: true,
        age,
        guidance: 'This caller is in the Advanced Age category (55+), which provides significant advantages under SSA Grid Rules.'
      };
    } else if (age >= 50) {
      return {
        recorded: true,
        age,
        guidance: 'This caller is in the Closely Approaching Advanced Age category (50-54), which provides some Grid Rule advantages.'
      };
    }

    return { recorded: true, age };
  }

  private recordEducation(args: Record<string, unknown>): object {
    this.data.education = {
      level: args.education_level as Education['level'],
      details: args.details as string
    };

    this.log.info({
      event: 'education_recorded',
      level: this.data.education.level
    });

    const age = this.data.demographics.age || 0;
    const level = this.data.education.level;

    if ((level === 'limited' || level === 'marginal') && age >= 50) {
      return {
        recorded: true,
        guidance: 'Limited education combined with age 50+ is favorable under Grid Rules. This strengthens the case.'
      };
    }

    return { recorded: true };
  }

  private recordMedicalConditions(args: Record<string, unknown>): object {
    this.data.medical.conditions = args.conditions as string[];
    this.data.medical.severity = args.severity as MedicalInfo['severity'];
    this.data.medical.durationMonths = args.duration_months as number;
    this.data.medical.treatments = (args.treatments as string[]) || [];
    this.data.medical.hospitalizations = args.hospitalizations as number;

    this.log.info({
      event: 'medical_conditions_recorded',
      conditionCount: this.data.medical.conditions.length,
      severity: this.data.medical.severity
    });

    // Check for high-approval conditions
    const highApproval = ['cancer', 'multiple sclerosis', 'ms', 'als', 'copd', 'heart failure', 'chf'];
    const hasHighApproval = this.data.medical.conditions.some(c =>
      highApproval.some(h => c.toLowerCase().includes(h))
    );

    if (hasHighApproval) {
      return {
        recorded: true,
        guidance: 'One or more conditions have high approval rates. This is a strong case indicator.'
      };
    }

    if (this.data.medical.conditions.length >= 3) {
      return {
        recorded: true,
        guidance: 'Multiple conditions documented. Combined effect may qualify even if individual conditions don\'t meet listings.'
      };
    }

    return { recorded: true };
  }

  private recordMedications(args: Record<string, unknown>): object {
    this.data.medical.medications = args.medications as string[];
    this.data.medical.sideEffects = (args.side_effects as string[]) || [];

    this.log.info({
      event: 'medications_recorded',
      medicationCount: this.data.medical.medications.length
    });

    // Check for high-severity medications
    const opioids = ['oxycodone', 'morphine', 'fentanyl', 'hydrocodone', 'percocet', 'vicodin'];
    const hasOpioids = this.data.medical.medications.some(m =>
      opioids.some(o => m.toLowerCase().includes(o))
    );

    if (hasOpioids) {
      return {
        recorded: true,
        guidance: 'Opioid medications indicate significant chronic pain. This supports case severity.'
      };
    }

    if (this.data.medical.medications.length >= 5) {
      return {
        recorded: true,
        guidance: 'Polypharmacy (5+ medications) indicates complex medical situation.'
      };
    }

    return { recorded: true };
  }

  private recordFunctionalLimitations(args: Record<string, unknown>): object {
    this.data.functionalLimitations = {
      sittingMinutes: args.sitting_minutes as number,
      standingMinutes: args.standing_minutes as number,
      walkingBlocks: args.walking_blocks as number,
      liftingPounds: args.lifting_pounds as number,
      concentrationIssues: args.concentration_issues as boolean,
      memoryIssues: args.memory_issues as boolean,
      socialDifficulties: args.social_difficulties as boolean,
      expectedAbsences: args.expected_absences as number,
      needsToLieDown: args.needs_to_lie_down as boolean,
      assistiveDevices: (args.assistive_devices as string[]) || []
    };

    this.log.info({
      event: 'functional_limitations_recorded',
      lifting: this.data.functionalLimitations.liftingPounds,
      sitting: this.data.functionalLimitations.sittingMinutes
    });

    const fl = this.data.functionalLimitations;
    const criticalLimitations: string[] = [];

    if (fl.liftingPounds && fl.liftingPounds <= 10) {
      criticalLimitations.push('sedentary lifting capacity');
    }
    if (fl.sittingMinutes && fl.sittingMinutes <= 30) {
      criticalLimitations.push('cannot sit for extended periods');
    }
    if (fl.expectedAbsences && fl.expectedAbsences >= 2) {
      criticalLimitations.push('would miss 2+ days/month (precludes competitive employment)');
    }

    if (criticalLimitations.length > 0) {
      return {
        recorded: true,
        guidance: `Critical limitations identified: ${criticalLimitations.join(', ')}. These are strong case factors.`
      };
    }

    return { recorded: true };
  }

  private recordWorkHistory(args: Record<string, unknown>): object {
    this.data.workHistory = {
      jobs: (args.jobs as Array<{ title: string; years: number }>) || [],
      heaviestLifting: args.heaviest_lifting as WorkHistory['heaviestLifting'],
      totalWorkYears: args.total_work_years as number,
      lastWorkDate: args.last_work_date as string,
      currentlyWorking: args.currently_working as boolean
    };

    this.log.info({
      event: 'work_history_recorded',
      jobCount: this.data.workHistory.jobs.length,
      heaviestLifting: this.data.workHistory.heaviestLifting
    });

    // Check for favorable work history
    const wh = this.data.workHistory;
    const unskilledKeywords = ['warehouse', 'factory', 'labor', 'construction', 'cleaning', 'cashier'];
    const hasUnskilled = wh.jobs.some(j =>
      unskilledKeywords.some(k => j.title.toLowerCase().includes(k))
    );

    if (hasUnskilled && (wh.heaviestLifting === 'heavy' || wh.heaviestLifting === 'very_heavy')) {
      return {
        recorded: true,
        guidance: 'Unskilled heavy work history with no transferable skills. Very favorable for Grid Rules.'
      };
    }

    return { recorded: true };
  }

  private recordApplicationStatus(args: Record<string, unknown>): object {
    this.data.application = {
      hasApplied: args.has_applied as boolean,
      status: args.status as ApplicationStatus['status'],
      denialDate: args.denial_date as string,
      hearingDate: args.hearing_date as string
    };

    this.log.info({
      event: 'application_status_recorded',
      status: this.data.application.status
    });

    // Check for deadline urgency
    if (this.data.application.denialDate) {
      const denialDate = new Date(this.data.application.denialDate);
      const today = new Date();
      const daysSinceDenial = Math.floor((today.getTime() - denialDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceDenial >= 45) {
        this.flags.urgent = true;
        this.flags.urgentReason = 'Appeal deadline approaching (60 days from denial)';
        return {
          recorded: true,
          warning: 'URGENT: Appeal deadline may be approaching. Only 60 days from denial date to appeal.'
        };
      }
    }

    if (this.data.application.status === 'hearing_scheduled') {
      this.flags.urgent = true;
      this.flags.urgentReason = 'Hearing scheduled';
      return {
        recorded: true,
        warning: 'URGENT: Hearing is scheduled. Attorney review needed immediately.'
      };
    }

    return { recorded: true };
  }

  private recordSmsConsent(args: Record<string, unknown>): object {
    const consentGiven = args.consent_given as boolean;
    const phoneNumber = (args.phone_number as string) || this.data.demographics.phone;

    this.data.smsConsent = {
      consentGiven,
      consentTimestamp: new Date(),
      phoneNumber
    };

    this.log.info({
      event: 'sms_consent_recorded',
      consentGiven,
      phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : 'none'
    });

    if (consentGiven) {
      return {
        recorded: true,
        consent: 'granted',
        message: 'SMS consent recorded. You may send the follow-up text message.'
      };
    } else {
      return {
        recorded: true,
        consent: 'declined',
        message: 'SMS consent declined. Do not send text messages to this caller.'
      };
    }
  }

  private recordAssessment(args: Record<string, unknown>): object {
    if (args.notes) {
      this.data.notes = args.notes as string;
    }

    // Calculate the score
    this.scoring = this.scoringEngine.calculateScore(this.data);

    this.log.info({
      event: 'assessment_calculated',
      score: this.scoring.totalScore,
      recommendation: this.scoring.recommendation
    });

    return {
      score: this.scoring.totalScore,
      recommendation: this.scoring.recommendation,
      viability: this.scoring.viabilityRating,
      likelihood: this.scoring.approvalLikelihood,
      strengths: this.scoring.caseStrengths,
      concerns: this.scoring.caseConcerns,
      callback_timeframe: this.scoring.callbackTimeframe,
      closing_guidance: this.getClosingGuidance()
    };
  }

  private getClosingGuidance(): string {
    if (!this.scoring) return '';

    const name = this.data.demographics.firstName || 'there';
    const score = this.scoring.totalScore;

    if (score >= 70) {
      return `This is a strong case. Tell ${name} their case has strong potential, mention 1-2 key strengths (${this.scoring.caseStrengths.slice(0, 2).join(', ')}), and that an attorney will call within 24 hours.`;
    } else if (score >= 45) {
      return `This is a promising case. Tell ${name} their situation has several factors that could support a claim, and an attorney will review and call within 48 hours.`;
    } else if (score >= 25) {
      return `This case has challenges. Be honest with ${name} that disability cases can be challenging, but the attorney will review and call within a few days.`;
    } else {
      return `This case may be difficult. Gently explain to ${name} that without certain factors, these cases can be hard to win. Still pass to attorney for review, but mention they might want to explore other resources.`;
    }
  }

  private flagUrgent(args: Record<string, unknown>): object {
    this.flags.urgent = true;
    this.flags.urgentReason = args.reason as string;
    this.flags.crisisMentioned = (args.crisis_mentioned as boolean) || false;

    this.log.warn({
      event: 'case_flagged_urgent',
      reason: this.flags.urgentReason,
      crisisMentioned: this.flags.crisisMentioned
    });

    if (this.flags.crisisMentioned) {
      return {
        flagged: true,
        instruction: 'IMPORTANT: Ensure caller knows about 988 crisis line. Verify they are safe before continuing.'
      };
    }

    return { flagged: true };
  }

  private requestHumanTransfer(args: Record<string, unknown>): object {
    this.flags.transferRequested = true;

    this.log.info({
      event: 'human_transfer_requested',
      reason: args.reason
    });

    return {
      transfer_initiated: true,
      instruction: 'Acknowledge their request and let them know you\'re transferring them to a team member.'
    };
  }

  private async endCall(args: Record<string, unknown>): Promise<object> {
    this.outcome = args.outcome as string;
    const sendSms = args.send_sms as boolean;

    this.log.info({
      event: 'call_ending',
      outcome: this.outcome,
      sendSms,
      smsConsentGiven: this.data.smsConsent.consentGiven
    });

    // Send SMS ONLY if:
    // 1. SMS was requested (send_sms = true)
    // 2. Caller gave explicit consent (smsConsent.consentGiven = true)
    // 3. We have a phone number
    // 4. SMS is enabled in config
    const canSendSms = sendSms &&
                       this.data.smsConsent.consentGiven &&
                       this.data.demographics.phone &&
                       config.sms.enabled;

    if (canSendSms) {
      try {
        await this.smsService.sendConfirmation(
          this.data.demographics.phone!,
          this.data.demographics.firstName || 'there',
          this.intakeId,
          this.scoring?.callbackTimeframe || '48 hours'
        );
        this.log.info({ event: 'sms_sent', consentTimestamp: this.data.smsConsent.consentTimestamp });
      } catch (error) {
        this.log.error({ event: 'sms_failed', error });
      }
    } else if (sendSms && !this.data.smsConsent.consentGiven) {
      this.log.info({ event: 'sms_skipped', reason: 'no_consent' });
    }

    return {
      call_ended: true,
      intake_id: this.intakeId,
      sms_sent: canSendSms
    };
  }

  private async recordCallbackRequest(args: Record<string, unknown>): Promise<object> {
    const callerName = args.caller_name as string;
    const phoneNumber = (args.phone_number as string) || this.callerInfo.callerPhone;
    const purpose = args.purpose as string;
    const category = args.category as string;
    const isUrgent = (args.is_urgent as boolean) || false;
    const notes = args.notes as string;

    this.log.info({
      event: 'callback_request_received',
      callerName,
      category,
      isUrgent
    });

    // Mark this as a callback request type call
    this.outcome = 'callback_request';

    try {
      // Save callback request to database
      const messageId = await db.saveCallbackRequest({
        callId: this.callId,
        callerPhone: phoneNumber || 'unknown',
        callerName,
        purpose,
        category,
        priority: isUrgent ? 'URGENT' : 'NORMAL',
        notes,
        transcript: this.data.transcript
      });

      this.log.info({
        event: 'callback_request_saved',
        callId: this.callId,
        callerName,
        category
      });

      // Send email notification for new message
      try {
        await emailService.sendMessageNotification({
          id: messageId,
          callerName,
          callerPhone: phoneNumber || 'unknown',
          purpose,
          category,
          priority: isUrgent ? 'URGENT' : 'NORMAL',
          notes,
          createdAt: new Date()
        });
        this.log.info({ event: 'message_email_notification_sent', messageId });
      } catch (emailError) {
        this.log.error({ event: 'message_email_notification_failed', error: emailError });
      }

      return {
        recorded: true,
        callback_timeframe: isUrgent ? 'within 24 hours' : 'within 1-2 business days',
        message: `Callback request recorded for ${callerName}. Someone will call back ${isUrgent ? 'within 24 hours' : 'within 1-2 business days'}.`
      };
    } catch (error) {
      this.log.error({ event: 'callback_request_save_failed', error });
      return {
        recorded: false,
        error: 'Failed to save callback request, but the call details have been logged.'
      };
    }
  }

  async finalize(): Promise<IntakeResult> {
    let usedSkinnyApp = false;
    let skinnyAppAssessmentId: string | undefined;

    // Try Skinny App first if enabled (for unified scoring and storage)
    if (skinnyAppClient.isEnabled() && this.outcome !== 'callback_request') {
      try {
        this.log.info({ event: 'skinny_app_scoring_attempt', intakeId: this.intakeId });

        const response = await skinnyAppClient.submitAssessment(
          this.callId,
          this.intakeId,
          this.data,
          {
            callerPhone: this.callerInfo.callerPhone,
            callerCity: this.callerInfo.callerCity,
            callerState: this.callerInfo.callerState,
            callDuration: undefined, // Will be set by Twilio status callback
            smsConsentGiven: this.data.smsConsent.consentGiven,
            isUrgent: this.flags.urgent,
            urgentReason: this.flags.urgentReason,
          }
        );

        // Map Skinny App response to our scoring format
        this.scoring = skinnyAppClient.mapToScoringResult(response);
        skinnyAppAssessmentId = response.assessmentId;
        usedSkinnyApp = true;

        this.log.info({
          event: 'skinny_app_scoring_success',
          intakeId: this.intakeId,
          skinnyAppAssessmentId,
          score: this.scoring.totalScore,
          recommendation: this.scoring.recommendation
        });

      } catch (error) {
        this.log.error({
          event: 'skinny_app_scoring_failed',
          intakeId: this.intakeId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Fall back to local scoring if configured
        if (skinnyAppClient.shouldFallbackToLocal()) {
          this.log.info({ event: 'falling_back_to_local_scoring', intakeId: this.intakeId });
          this.scoring = this.scoringEngine.calculateScore(this.data);
        } else {
          // If fallback is disabled, re-throw the error
          throw error;
        }
      }
    } else {
      // Use local scoring (Skinny App not enabled or this is a callback request)
      if (!this.scoring) {
        this.scoring = this.scoringEngine.calculateScore(this.data);
      }
    }

    const result: IntakeResult = {
      callId: this.callId,
      intakeId: this.intakeId,
      data: this.data,
      scoring: this.scoring,
      flags: this.flags,
      outcome: this.outcome,
      createdAt: this.createdAt,
      completedAt: new Date()
    };

    this.log.info({
      event: 'intake_finalized',
      intakeId: this.intakeId,
      score: this.scoring.totalScore,
      outcome: this.outcome,
      scoringSource: usedSkinnyApp ? 'skinny_app' : 'local',
      skinnyAppAssessmentId
    });

    // Persist to local database (skip if Skinny App succeeded - it handles storage)
    // We still save locally as a backup and for the voice-specific dashboard
    try {
      await db.saveIntake(result);
      this.log.info({ event: 'intake_saved_to_db', intakeId: this.intakeId });
    } catch (error) {
      this.log.error({ event: 'intake_db_save_failed', error });
      // Don't throw - we still want to return the result even if DB save fails
    }

    // Send email notification for completed intake (only if it's a real intake, not a callback)
    if (this.outcome !== 'callback_request') {
      try {
        await emailService.sendIntakeNotification({
          id: this.intakeId,
          callerName: `${this.data.demographics.firstName || ''} ${this.data.demographics.lastName || ''}`.trim() || 'Unknown',
          callerPhone: this.data.demographics.phone || 'Unknown',
          totalScore: this.scoring.totalScore,
          isUrgent: this.flags.urgent,
          conditions: this.data.medical.conditions || [],
          caseStrengths: this.scoring.caseStrengths || [],
          caseConcerns: this.scoring.caseConcerns || [],
          aiSummary: this.data.notes,
          createdAt: this.createdAt
        });
        this.log.info({ event: 'intake_email_notification_sent', intakeId: this.intakeId });
      } catch (emailError) {
        this.log.error({ event: 'intake_email_notification_failed', error: emailError });
      }

      // Send client confirmation email if we have their email
      if (this.data.demographics.email) {
        try {
          await emailService.sendClientConfirmation(
            this.data.demographics.email,
            this.data.demographics.firstName || 'there',
            this.intakeId,
            this.scoring.callbackTimeframe
          );
          this.log.info({ event: 'client_confirmation_email_sent', intakeId: this.intakeId });
        } catch (emailError) {
          this.log.error({ event: 'client_confirmation_email_failed', error: emailError });
        }
      }
    }

    return result;
  }
}
