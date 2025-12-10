/**
 * HALCYON AI RECEPTIONIST - SCORING ENGINE
 *
 * Implements the SSD case scoring logic from Halcyon Skinny App
 * Based on SSA Grid Rules, approval rates, and case-winning factors
 */

import { IntakeData, ScoringResult } from './intakeSession.js';
import { config } from '../config/index.js';

// Condition database with SSA approval rates and scoring
const CONDITION_SCORES: Record<string, {
  baseScore: number;
  approvalRate: number;
  category: string;
  blueBookSection?: string;
}> = {
  // HIGH APPROVAL CONDITIONS
  'cancer': { baseScore: 30, approvalRate: 0.85, category: 'cancer', blueBookSection: '13.00' },
  'multiple sclerosis': { baseScore: 25, approvalRate: 0.80, category: 'neurological', blueBookSection: '11.09' },
  'ms': { baseScore: 25, approvalRate: 0.80, category: 'neurological', blueBookSection: '11.09' },
  'als': { baseScore: 35, approvalRate: 0.95, category: 'neurological', blueBookSection: '11.10' },
  'lou gehrig': { baseScore: 35, approvalRate: 0.95, category: 'neurological' },
  'parkinson': { baseScore: 28, approvalRate: 0.82, category: 'neurological', blueBookSection: '11.06' },
  'heart failure': { baseScore: 25, approvalRate: 0.78, category: 'cardiovascular', blueBookSection: '4.02' },
  'chf': { baseScore: 25, approvalRate: 0.78, category: 'cardiovascular' },
  'congestive heart failure': { baseScore: 25, approvalRate: 0.78, category: 'cardiovascular' },
  'copd': { baseScore: 22, approvalRate: 0.85, category: 'respiratory', blueBookSection: '3.02' },
  'emphysema': { baseScore: 20, approvalRate: 0.80, category: 'respiratory' },
  'dialysis': { baseScore: 28, approvalRate: 0.88, category: 'renal' },
  'kidney failure': { baseScore: 25, approvalRate: 0.85, category: 'renal' },

  // MUSCULOSKELETAL (34% of all awards)
  'back pain': { baseScore: 20, approvalRate: 0.63, category: 'musculoskeletal', blueBookSection: '1.15' },
  'chronic back pain': { baseScore: 20, approvalRate: 0.63, category: 'musculoskeletal' },
  'herniated disc': { baseScore: 22, approvalRate: 0.65, category: 'musculoskeletal' },
  'degenerative disc': { baseScore: 20, approvalRate: 0.62, category: 'musculoskeletal' },
  'spinal stenosis': { baseScore: 22, approvalRate: 0.68, category: 'musculoskeletal' },
  'arthritis': { baseScore: 18, approvalRate: 0.55, category: 'musculoskeletal', blueBookSection: '1.18' },
  'osteoarthritis': { baseScore: 18, approvalRate: 0.55, category: 'musculoskeletal' },
  'rheumatoid arthritis': { baseScore: 22, approvalRate: 0.70, category: 'musculoskeletal' },
  'fibromyalgia': { baseScore: 15, approvalRate: 0.45, category: 'musculoskeletal' },
  'lupus': { baseScore: 22, approvalRate: 0.72, category: 'immune', blueBookSection: '14.02' },

  // MENTAL HEALTH (48% approval under 50)
  'depression': { baseScore: 18, approvalRate: 0.59, category: 'mental', blueBookSection: '12.04' },
  'major depression': { baseScore: 20, approvalRate: 0.62, category: 'mental' },
  'major depressive disorder': { baseScore: 20, approvalRate: 0.62, category: 'mental' },
  'bipolar': { baseScore: 22, approvalRate: 0.68, category: 'mental', blueBookSection: '12.04' },
  'bipolar disorder': { baseScore: 22, approvalRate: 0.68, category: 'mental' },
  'anxiety': { baseScore: 16, approvalRate: 0.52, category: 'mental', blueBookSection: '12.06' },
  'generalized anxiety': { baseScore: 16, approvalRate: 0.52, category: 'mental' },
  'ptsd': { baseScore: 20, approvalRate: 0.60, category: 'mental', blueBookSection: '12.15' },
  'post traumatic stress': { baseScore: 20, approvalRate: 0.60, category: 'mental' },
  'schizophrenia': { baseScore: 28, approvalRate: 0.78, category: 'mental', blueBookSection: '12.03' },
  'panic disorder': { baseScore: 18, approvalRate: 0.55, category: 'mental' },
  'ocd': { baseScore: 18, approvalRate: 0.55, category: 'mental' },
  'autism': { baseScore: 22, approvalRate: 0.65, category: 'mental', blueBookSection: '12.10' },

  // NEUROLOGICAL
  'neuropathy': { baseScore: 18, approvalRate: 0.58, category: 'neurological', blueBookSection: '11.14' },
  'peripheral neuropathy': { baseScore: 18, approvalRate: 0.58, category: 'neurological' },
  'epilepsy': { baseScore: 22, approvalRate: 0.65, category: 'neurological', blueBookSection: '11.02' },
  'seizures': { baseScore: 22, approvalRate: 0.65, category: 'neurological' },
  'stroke': { baseScore: 20, approvalRate: 0.60, category: 'neurological' },
  'migraine': { baseScore: 14, approvalRate: 0.40, category: 'neurological' },
  'traumatic brain injury': { baseScore: 22, approvalRate: 0.65, category: 'neurological', blueBookSection: '11.18' },
  'tbi': { baseScore: 22, approvalRate: 0.65, category: 'neurological' },

  // SPECIAL CONDITIONS
  'pots': { baseScore: 16, approvalRate: 0.45, category: 'cardiovascular' },
  'dysautonomia': { baseScore: 16, approvalRate: 0.45, category: 'cardiovascular' },
  'ehlers danlos': { baseScore: 16, approvalRate: 0.48, category: 'musculoskeletal' },
  'eds': { baseScore: 16, approvalRate: 0.48, category: 'musculoskeletal' },
  'crps': { baseScore: 20, approvalRate: 0.55, category: 'neurological' },
  'complex regional pain': { baseScore: 20, approvalRate: 0.55, category: 'neurological' },
  'chiari': { baseScore: 18, approvalRate: 0.50, category: 'neurological' },

  // OTHER
  'diabetes': { baseScore: 12, approvalRate: 0.40, category: 'endocrine' },
  'sleep apnea': { baseScore: 10, approvalRate: 0.35, category: 'respiratory' },
  'chronic fatigue': { baseScore: 12, approvalRate: 0.38, category: 'immune' },
  'hypertension': { baseScore: 8, approvalRate: 0.25, category: 'cardiovascular' }
};

// Medication scoring
const HIGH_SEVERITY_MEDS = [
  'oxycodone', 'morphine', 'fentanyl', 'hydrocodone', 'percocet', 'vicodin', 'norco', 'dilaudid',
  'seroquel', 'zyprexa', 'risperdal', 'abilify', 'clozapine', 'haldol',
  'lithium', 'depakote', 'lamictal',
  'humira', 'enbrel', 'remicade', 'methotrexate'
];

const MODERATE_SEVERITY_MEDS = [
  'gabapentin', 'lyrica', 'cymbalta', 'tramadol',
  'zoloft', 'lexapro', 'prozac', 'effexor', 'wellbutrin',
  'klonopin', 'xanax', 'ativan', 'valium'
];

export class ScoringEngine {
  calculateScore(data: IntakeData): ScoringResult {
    let totalScore = 0;
    const caseStrengths: string[] = [];
    const caseConcerns: string[] = [];

    // 1. AGE SCORING
    const age = data.demographics.age || 0;
    let ageMultiplier = 0.7; // Default for under 50

    if (age >= 60) {
      ageMultiplier = 1.5;
      caseStrengths.push('Age 60+ (Approaching Retirement Age - most favorable Grid Rules)');
    } else if (age >= 55) {
      ageMultiplier = 1.35;
      caseStrengths.push('Age 55-59 (Advanced Age - significant Grid Rule advantage)');
    } else if (age >= 50) {
      ageMultiplier = 1.15;
      caseStrengths.push('Age 50-54 (Closely Approaching Advanced Age - Grid Rule advantage)');
    } else if (age < 50) {
      caseConcerns.push('Under 50 (must meet or equal a listing, or have severe limitations)');
    }

    // 2. EDUCATION SCORING
    const education = data.education.level;
    let educationBonus = 0;

    if (education === 'illiterate' || education === 'marginal') {
      educationBonus = age >= 50 ? 8 : 3;
      caseStrengths.push('Marginal/Limited education (favorable for Grid Rules)');
    } else if (education === 'limited') {
      educationBonus = age >= 50 ? 5 : 2;
      caseStrengths.push('Limited education (7th-11th grade - Grid Rule favorable)');
    } else if (education === 'college') {
      educationBonus = -5;
      caseConcerns.push('College education (transferable skills may be assumed)');
    }

    totalScore += educationBonus;

    // 3. CONDITION SCORING
    let conditionScore = 0;
    let hasPhysical = false;
    let hasMental = false;
    const conditionCount = data.medical.conditions.length;

    for (const condition of data.medical.conditions) {
      const conditionLower = condition.toLowerCase();
      let matched = false;

      for (const [key, value] of Object.entries(CONDITION_SCORES)) {
        if (conditionLower.includes(key)) {
          // Base score with SSA approval rate weighting
          const ssaMultiplier = 0.3 + (value.approvalRate * 2.5);
          let score = value.baseScore * ssaMultiplier;

          // Apply severity multiplier
          const severityMult = this.getSeverityMultiplier(data.medical.severity);
          score *= severityMult;

          // Age bonuses for condition
          if (age >= 55) {
            score += 10;
          } else if (age >= 50) {
            score += 5;
          }

          conditionScore += score;

          // Track category
          if (value.category === 'mental') {
            hasMental = true;
          } else {
            hasPhysical = true;
          }

          matched = true;
          break;
        }
      }

      // Default score for unmatched conditions
      if (!matched) {
        conditionScore += 10 * this.getSeverityMultiplier(data.medical.severity);
      }
    }

    totalScore += conditionScore;

    // Multiple conditions bonus
    if (conditionCount >= 4) {
      totalScore += 25;
      caseStrengths.push('4+ medical conditions (significant combined effect)');
    } else if (conditionCount >= 3) {
      totalScore += 18;
      caseStrengths.push('3 medical conditions (combined effect consideration)');
    } else if (conditionCount >= 2) {
      totalScore += 10;
      caseStrengths.push('Multiple medical conditions');
    }

    // Mental + Physical comorbidity
    if (hasMental && hasPhysical) {
      totalScore += 15;
      caseStrengths.push('Mental + Physical conditions (erodes occupational base)');
    }

    // 4. MEDICATION SCORING
    let medicationScore = 0;
    const meds = data.medical.medications || [];

    for (const med of meds) {
      const medLower = med.toLowerCase();

      if (HIGH_SEVERITY_MEDS.some(m => medLower.includes(m))) {
        medicationScore += 15;
      } else if (MODERATE_SEVERITY_MEDS.some(m => medLower.includes(m))) {
        medicationScore += 8;
      } else {
        medicationScore += 3;
      }
    }

    // Polypharmacy bonus
    if (meds.length >= 10) {
      medicationScore += 15;
      caseStrengths.push('10+ medications (high treatment complexity)');
    } else if (meds.length >= 7) {
      medicationScore += 10;
    } else if (meds.length >= 5) {
      medicationScore += 5;
      caseStrengths.push('5+ medications (polypharmacy)');
    }

    // Side effects bonus
    if (data.medical.sideEffects.length > 0) {
      const sideEffectPoints = Math.min(data.medical.sideEffects.length * 5, 15);
      medicationScore += sideEffectPoints;
    }

    totalScore += medicationScore;

    // 5. FUNCTIONAL LIMITATIONS SCORING
    const fl = data.functionalLimitations;
    let functionalScore = 0;

    // Lifting capacity (determines RFC)
    if (fl.liftingPounds !== undefined) {
      if (fl.liftingPounds <= 10) {
        functionalScore += 25;
        caseStrengths.push('Sedentary lifting capacity (10 lbs or less)');
      } else if (fl.liftingPounds <= 20) {
        functionalScore += 15;
        caseStrengths.push('Light work capacity (20 lbs or less)');
      }
    }

    // Sitting limitations
    if (fl.sittingMinutes !== undefined && fl.sittingMinutes <= 30) {
      functionalScore += 20;
      caseStrengths.push('Cannot sit for extended periods (erodes sedentary base)');
    }

    // Standing limitations
    if (fl.standingMinutes !== undefined && fl.standingMinutes <= 15) {
      functionalScore += 18;
      caseStrengths.push('Cannot stand more than 15 minutes');
    }

    // Walking limitations
    if (fl.walkingBlocks !== undefined && fl.walkingBlocks <= 1) {
      functionalScore += 15;
    }

    // Concentration issues
    if (fl.concentrationIssues) {
      functionalScore += 12;
      caseStrengths.push('Concentration difficulties (impacts work pace)');
    }

    // Memory issues
    if (fl.memoryIssues) {
      functionalScore += 10;
    }

    // Social difficulties
    if (fl.socialDifficulties) {
      functionalScore += 12;
      caseStrengths.push('Social interaction difficulties');
    }

    // Expected absences (CRITICAL)
    if (fl.expectedAbsences !== undefined && fl.expectedAbsences >= 2) {
      functionalScore += 25;
      caseStrengths.push('Would miss 2+ days/month (precludes competitive employment)');
    }

    // Need to lie down
    if (fl.needsToLieDown) {
      functionalScore += 15;
      caseStrengths.push('Needs to lie down during day');
    }

    // Assistive devices
    if (fl.assistiveDevices.length > 0) {
      functionalScore += fl.assistiveDevices.length * 5;
      caseStrengths.push(`Uses assistive devices: ${fl.assistiveDevices.join(', ')}`);
    }

    totalScore += functionalScore;

    // 6. WORK HISTORY SCORING
    const wh = data.workHistory;
    let workScore = 0;

    // Physical demand level
    if (wh.heaviestLifting === 'very_heavy') {
      workScore += 25;
      caseStrengths.push('Very heavy work history (100+ lbs)');
    } else if (wh.heaviestLifting === 'heavy') {
      workScore += 20;
      caseStrengths.push('Heavy work history (50-100 lbs)');
    } else if (wh.heaviestLifting === 'medium') {
      workScore += 15;
    } else if (wh.heaviestLifting === 'sedentary') {
      workScore -= 10;
      caseConcerns.push('Sedentary work history (transferable skills to desk work)');
    }

    // Check for unskilled work
    const unskilledKeywords = ['warehouse', 'factory', 'labor', 'construction', 'cleaning', 'cashier', 'assembly'];
    const hasUnskilled = wh.jobs.some(j =>
      unskilledKeywords.some(k => j.title.toLowerCase().includes(k))
    );

    if (hasUnskilled) {
      workScore += 15;
      caseStrengths.push('Unskilled work history (no transferable skills)');
    }

    // Long work history
    if (wh.totalWorkYears && wh.totalWorkYears >= 20) {
      workScore += 10;
      caseStrengths.push('20+ years work history (credibility factor)');
    }

    totalScore += workScore;

    // 7. GRID RULE BONUS
    let gridBonus = 0;
    const limitedEducation = education === 'limited' || education === 'marginal' || education === 'illiterate';

    if (age >= 60 && (fl.liftingPounds || 50) <= 20) {
      gridBonus += 35;
      caseStrengths.push('Grid Rule 202.01 may apply (60+, light RFC)');
    } else if (age >= 55 && limitedEducation && (fl.liftingPounds || 50) <= 20) {
      gridBonus += 30;
      caseStrengths.push('Grid Rule 202.04 may apply (55+, limited education, light RFC)');
    } else if (age >= 50 && limitedEducation && (fl.liftingPounds || 50) <= 10) {
      gridBonus += 25;
      caseStrengths.push('Grid Rule 201.14 may apply (50+, limited education, sedentary RFC)');
    }

    totalScore += gridBonus;

    // 8. HOSPITALIZATIONS
    const hospitalizations = data.medical.hospitalizations || 0;
    if (hospitalizations >= 3) {
      totalScore += 10;
      caseStrengths.push('3+ hospitalizations in past year');
    } else if (hospitalizations >= 1) {
      totalScore += hospitalizations * 3;
    }

    // 9. APPLY AGE MULTIPLIER (partial)
    // Apply age multiplier to a portion of the score to prevent over-inflation
    const baseScore = totalScore * 0.7;
    const ageAdjustedPortion = (totalScore * 0.3) * ageMultiplier;
    totalScore = baseScore + ageAdjustedPortion;

    // 10. NORMALIZE SCORE
    totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

    // Determine recommendation
    const { recommendation, viabilityRating, approvalLikelihood, callbackTimeframe } =
      this.getRecommendation(totalScore);

    return {
      totalScore,
      recommendation,
      viabilityRating,
      approvalLikelihood,
      caseStrengths,
      caseConcerns,
      callbackTimeframe
    };
  }

  private getSeverityMultiplier(severity?: string): number {
    switch (severity) {
      case 'disabling': return 1.2;
      case 'severe': return 1.0;
      case 'moderate': return 0.75;
      case 'mild': return 0.6;
      default: return 0.8;
    }
  }

  private getRecommendation(score: number): {
    recommendation: ScoringResult['recommendation'];
    viabilityRating: string;
    approvalLikelihood: string;
    callbackTimeframe: string;
  } {
    if (score >= config.scoring.highlyRecommended) {
      return {
        recommendation: 'highly_recommended',
        viabilityRating: 'Very High',
        approvalLikelihood: '80%+',
        callbackTimeframe: `${config.callbacks.highPriority} hours`
      };
    } else if (score >= config.scoring.recommended) {
      return {
        recommendation: 'recommended',
        viabilityRating: 'High',
        approvalLikelihood: '60-80%',
        callbackTimeframe: `${config.callbacks.mediumPriority} hours`
      };
    } else if (score >= config.scoring.considerCaution) {
      return {
        recommendation: 'consider_caution',
        viabilityRating: 'Medium',
        approvalLikelihood: '40-60%',
        callbackTimeframe: '3-5 business days'
      };
    } else if (score >= config.scoring.weakCase) {
      return {
        recommendation: 'weak_case',
        viabilityRating: 'Low',
        approvalLikelihood: '20-40%',
        callbackTimeframe: '5-7 business days'
      };
    } else {
      return {
        recommendation: 'not_recommended',
        viabilityRating: 'Very Low',
        approvalLikelihood: '<20%',
        callbackTimeframe: 'as time permits'
      };
    }
  }
}
