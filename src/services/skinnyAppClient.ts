/**
 * HALCYON SKINNY APP API CLIENT
 *
 * Sends intake data to the Skinny App for scoring and storage.
 * This enables the Voice Receptionist to leverage the Skinny App's:
 * - Mature scoring engine with SSA-aligned algorithms
 * - Unified database for all intake channels
 * - CMS integrations, billing, and analytics
 */

import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import type { IntakeData, ScoringResult } from './intakeSession.js';

const log = createLogger('skinny-app-client');

// ============================================================================
// TYPES
// ============================================================================

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

interface SkinnyAppHealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

interface VoiceMetadata {
  callerPhone?: string;
  callerCity?: string;
  callerState?: string;
  callDuration?: number;
  smsConsentGiven?: boolean;
  isUrgent?: boolean;
  urgentReason?: string;
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

export class SkinnyAppClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private enabled: boolean;
  private fallbackToLocal: boolean;

  constructor() {
    this.baseUrl = config.skinnyApp?.baseUrl || 'http://localhost:3000';
    this.apiKey = config.skinnyApp?.apiKey || '';
    this.timeout = config.skinnyApp?.timeout || 30000;
    this.enabled = config.skinnyApp?.enabled || false;
    this.fallbackToLocal = config.skinnyApp?.fallbackToLocal ?? true;

    if (this.enabled) {
      log.info({
        event: 'skinny_app_client_initialized',
        baseUrl: this.baseUrl,
        timeout: this.timeout,
        fallbackEnabled: this.fallbackToLocal
      });
    }
  }

  /**
   * Check if Skinny App integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled && !!this.apiKey;
  }

  /**
   * Check if fallback to local scoring is enabled
   */
  shouldFallbackToLocal(): boolean {
    return this.fallbackToLocal;
  }

  /**
   * Transform Receptionist IntakeData to Skinny App format
   */
  private transformIntakeData(data: IntakeData): Record<string, unknown> {
    const { demographics, education, medical, functionalLimitations, workHistory, application } = data;

    // Build functional limitations as string array for Skinny App
    const limitations: string[] = [];

    if (functionalLimitations.sittingMinutes !== undefined && functionalLimitations.sittingMinutes <= 60) {
      limitations.push(`Cannot sit more than ${functionalLimitations.sittingMinutes} minutes`);
    }
    if (functionalLimitations.standingMinutes !== undefined && functionalLimitations.standingMinutes <= 30) {
      limitations.push(`Cannot stand more than ${functionalLimitations.standingMinutes} minutes`);
    }
    if (functionalLimitations.walkingBlocks !== undefined && functionalLimitations.walkingBlocks <= 2) {
      limitations.push(`Can only walk ${functionalLimitations.walkingBlocks} block(s)`);
    }
    if (functionalLimitations.liftingPounds !== undefined && functionalLimitations.liftingPounds <= 20) {
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
    if (functionalLimitations.expectedAbsences !== undefined && functionalLimitations.expectedAbsences >= 2) {
      limitations.push(`Would miss ${functionalLimitations.expectedAbsences}+ days per month`);
    }
    if (functionalLimitations.needsToLieDown) {
      limitations.push('Needs to lie down during the day');
    }
    if (functionalLimitations.assistiveDevices?.length) {
      limitations.push(`Uses assistive devices: ${functionalLimitations.assistiveDevices.join(', ')}`);
    }

    // Map education level to Skinny App format
    const educationMap: Record<string, string> = {
      'illiterate': 'illiterate',
      'marginal': 'marginal',
      'limited': 'limited',
      'high_school': 'high_school',
      'college': 'college'
    };

    // Map application status to Skinny App case stage
    const caseStageMap: Record<string, string> = {
      'never_applied': 'not_applied',
      'waiting': 'pending',
      'denied_initial': 'denied_initial',
      'denied_reconsideration': 'denied_reconsideration',
      'hearing_pending': 'hearing_pending',
      'hearing_scheduled': 'hearing_scheduled'
    };

    return {
      // Core fields
      name: `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim() || undefined,
      clientName: `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim() || undefined,
      email: demographics.email,
      dob: demographics.dateOfBirth,
      dateOfBirth: demographics.dateOfBirth,
      age: demographics.age,
      phone: demographics.phone,

      // Education
      education: education.level ? educationMap[education.level] : undefined,

      // Medical conditions
      selectedConditions: medical.conditions,
      conditions: medical.conditions,
      medications: medical.medications,

      // Functional limitations as string array
      functionalLimitations: limitations.length > 0 ? limitations : undefined,

      // Work history
      workHistory: workHistory.jobs?.map(j => ({
        title: j.title,
        years: j.years,
        physicalLevel: workHistory.heaviestLifting
      })),
      lastWorked: workHistory.lastWorkDate,
      workStatus: workHistory.currentlyWorking ? 'working' : 'not_working',
      cannotWork: !workHistory.currentlyWorking,

      // Application status
      alreadyApplied: application.hasApplied ? 'yes' : 'no',
      caseStage: application.status ? caseStageMap[application.status] : undefined,

      // Practice area
      practiceArea: 'SSD',

      // Extended voice data for enhanced scoring
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
        needsToLieDown: functionalLimitations.needsToLieDown,
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
    metadata: VoiceMetadata
  ): Promise<SkinnyAppAssessmentResponse> {
    if (!this.isEnabled()) {
      throw new Error('Skinny App integration is not enabled');
    }

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
        transcript: data.transcript?.map(t => ({
          role: t.role,
          text: t.text,
          timestamp: t.timestamp.toISOString()
        }))
      },
      data: this.transformIntakeData(data)
    };

    log.info({
      event: 'skinny_app_request_start',
      callId,
      intakeId,
      endpoint: `${this.baseUrl}/api/intake-assessment`,
      conditionCount: data.medical.conditions.length
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/intake-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'User-Agent': 'Halcyon-Voice-Receptionist/1.0'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        log.error({
          event: 'skinny_app_error',
          callId,
          status: response.status,
          statusText: response.statusText,
          body: errorBody.substring(0, 500) // Truncate for logging
        });

        if (response.status === 401) {
          throw new Error('Skinny App authentication failed - check API key');
        }
        if (response.status === 400) {
          throw new Error(`Skinny App validation error: ${errorBody}`);
        }
        if (response.status === 429) {
          throw new Error('Skinny App rate limit exceeded');
        }

        throw new Error(`Skinny App API error: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json() as SkinnyAppAssessmentResponse;

      log.info({
        event: 'skinny_app_success',
        callId,
        intakeId,
        assessmentId: result.assessmentId,
        score: result.score,
        recommendation: result.recommendation,
        viabilityRating: result.viabilityRating
      });

      return result;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          log.error({ event: 'skinny_app_timeout', callId, timeout: this.timeout });
          throw new Error(`Skinny App request timed out after ${this.timeout}ms`);
        }

        log.error({
          event: 'skinny_app_request_failed',
          callId,
          error: error.message
        });
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
    if (response.score >= 70) {
      callbackTimeframe = '24 hours';
    } else if (response.score >= 45) {
      callbackTimeframe = '48 hours';
    } else if (response.score >= 25) {
      callbackTimeframe = '3-5 days';
    } else {
      callbackTimeframe = '5-7 days';
    }

    // Separate key factors into strengths and concerns
    const caseStrengths: string[] = [];
    const caseConcerns: string[] = [];

    for (const factor of response.keyFactors || []) {
      const lowerFactor = factor.toLowerCase();
      if (
        lowerFactor.includes('concern') ||
        lowerFactor.includes('weak') ||
        lowerFactor.includes('challenge') ||
        lowerFactor.includes('risk') ||
        lowerFactor.includes('negative')
      ) {
        caseConcerns.push(factor);
      } else {
        caseStrengths.push(factor);
      }
    }

    return {
      totalScore: response.score,
      recommendation: recommendationMap[response.recommendation] || 'consider_caution',
      viabilityRating: response.viabilityRating,
      approvalLikelihood: likelihoodMap[response.viabilityRating] || '40-60%',
      caseStrengths,
      caseConcerns,
      callbackTimeframe
    };
  }

  /**
   * Health check for Skinny App
   */
  async healthCheck(): Promise<{ healthy: boolean; details?: SkinnyAppHealthResponse }> {
    if (!this.isEnabled()) {
      return { healthy: false };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

      const response = await fetch(
        `${this.baseUrl}/api/intake-assessment?action=health`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'User-Agent': 'Halcyon-Voice-Receptionist/1.0'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const details = await response.json() as SkinnyAppHealthResponse;
        log.debug({ event: 'skinny_app_health_check', status: 'healthy', details });
        return { healthy: true, details };
      }

      log.warn({ event: 'skinny_app_health_check', status: 'unhealthy', httpStatus: response.status });
      return { healthy: false };

    } catch (error) {
      log.warn({
        event: 'skinny_app_health_check',
        status: 'unreachable',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { healthy: false };
    }
  }

  /**
   * Get the Skinny App assessment ID from a previous submission
   * Useful for linking records across systems
   */
  getAssessmentUrl(assessmentId: string): string {
    return `${this.baseUrl}/assessments/${assessmentId}`;
  }
}

// Export singleton instance
export const skinnyAppClient = new SkinnyAppClient();
