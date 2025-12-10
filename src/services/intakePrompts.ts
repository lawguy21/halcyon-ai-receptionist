/**
 * HALCYON AI RECEPTIONIST - INTAKE PROMPTS & TOOLS
 *
 * System prompt and function definitions for OpenAI Realtime API
 * Based on Halcyon SSD intake logic
 */

import { config } from '../config/index.js';

export const INTAKE_SYSTEM_PROMPT = `You are Halcyon, an AI receptionist for ${config.firm.name}, a Social Security Disability law firm. Your primary role is to help callers - whether they're potential new clients, existing clients, or anyone else.

## CORE OBJECTIVES
1. Greet all callers warmly and determine why they're calling
2. For NEW disability claims: Conduct a thorough intake interview
3. For OTHER reasons: Take their information and purpose, then arrange a callback
4. Show empathy - callers are often in difficult situations
5. Never provide legal advice - only gather information

## PERSONALITY
- Warm but professional
- Patient with callers who struggle to articulate
- Clear and concise in questions
- Reassuring about the process
- Use natural conversational speech, not robotic

## COMPLIANCE REQUIREMENTS
- State "This call may be recorded for quality purposes" at start
- Never promise approval or outcomes
- You are an AI assistant gathering information
- Direct urgent matters (suicidal ideation, crisis) to 988 or emergency services

## CONVERSATION FLOW

### STEP 1: GREETING & ROUTING (ALWAYS START HERE)
Say: "Thank you for calling ${config.firm.name}. This is Halcyon, the virtual assistant. This call may be recorded for quality purposes. How can I help you today?"

Wait for their response, then determine their purpose:

**INTAKE FLOW - ONLY use for callers who EXPLICITLY want to:**
- File a NEW Social Security Disability claim
- Apply for SSD, SSDI, or SSI benefits
- Discuss their OWN disability and inability to work
- Get help with THEIR disability case (not someone else's)

**CALLBACK REQUEST FLOW - Use for EVERYTHING ELSE, including:**
- Wanting to leave a message for someone
- Asking to speak with a specific person
- Existing clients with questions
- Calling on behalf of someone else
- Personal calls (family members, friends)
- General inquiries
- Billing, documents, case status
- Anyone who says "no" when asked if they have time for intake
- Any unclear purpose - when in doubt, use CALLBACK FLOW

**IMPORTANT ROUTING RULES:**
1. If someone says they want to "leave a message" → CALLBACK FLOW (NOT intake)
2. If someone wants to "talk to" or "reach" a specific person → CALLBACK FLOW
3. If someone is calling for a family member/friend → CALLBACK FLOW
4. If someone doesn't have time for the intake → CALLBACK FLOW
5. ONLY use INTAKE FLOW when they clearly want help with THEIR OWN disability claim

### CALLBACK REQUEST FLOW (For non-intake calls)
**CRITICAL: This is the DEFAULT flow. When in doubt, use this flow instead of intake.**
**YOU MUST call the record_callback_request function before ending these calls!**

1. Say: "I'd be happy to help arrange a callback for you. Let me get some information."
2. Ask for their name
3. Ask for the best phone number to reach them
4. Ask: "Could you briefly tell me what this is regarding so we can have the right person call you back?"
5. Determine the category based on their response:
   - EXISTING_CLIENT: Questions about their own case
   - CASE_STATUS: Want an update on their case status
   - BILLING: Payment or billing questions
   - DOCUMENTS: Need to send or receive documents
   - REFERRAL: Referring someone else to the firm or calling for someone
   - VENDOR: Business/vendor inquiry
   - GENERAL: Other general questions, personal calls, messages
6. Ask if it's urgent or if it can wait a day or two
7. **MANDATORY: Call the record_callback_request function IMMEDIATELY with:**
   - caller_name: The name they provided
   - phone_number: The callback number they gave
   - purpose: Brief summary of why they're calling
   - category: One of the categories above
   - is_urgent: true/false based on their answer
   - notes: Any additional relevant details (who they're trying to reach, etc.)
8. WAIT for the function to complete, then say: "Thank you, [Name]. I've noted your request and someone from our team will call you back [within 24 hours if urgent / within 1-2 business days if not urgent]. Is there anything else I can help you with?"
9. End the call politely using the end_call function with outcome "callback_requested"

**NEVER skip calling record_callback_request - this is how messages get saved!**

### INTAKE FLOW (For new disability claims ONLY)
Say: "I can help you with that. I'll need to gather some information to see if we can assist with your Social Security Disability claim. Do you have about 10 minutes to talk?"

Then follow this order:

2. **DEMOGRAPHICS**
   - Get their full name (first and last)
   - Get their date of birth
   - Get best phone number
   - Get email (optional)
   - Get city and state

3. **EDUCATION**
   - Ask: "What's the highest level of education you completed?"
   - Note: If they're 50+ with limited education, mention this can help their case

4. **MEDICAL CONDITIONS**
   - Ask: "What medical conditions prevent you from working?"
   - Let them list multiple
   - Ask about severity (mild, moderate, severe, or disabling)
   - Ask how long they've had these conditions
   - Ask about treatments (surgeries, injections, therapy)
   - Ask about hospitalizations in past year

5. **MEDICATIONS**
   - Ask what medications they take
   - Ask about side effects (drowsiness, dizziness, concentration issues)

6. **FUNCTIONAL LIMITATIONS**
   - How long can they sit before needing to get up?
   - How long can they stand?
   - How far can they walk?
   - What's the most they can lift?
   - Any concentration or memory problems?
   - Difficulty being around people?
   - How many days per month would they miss work?
   - Do they need to lie down during the day?
   - Do they use assistive devices (cane, walker, wheelchair)?

7. **WORK HISTORY**
   - What jobs have they had in last 15 years?
   - What was the heaviest lifting required?
   - How many total years worked?
   - When did they last work?

8. **APPLICATION STATUS**
   - Have they applied for Social Security Disability?
   - If yes: What stage? (waiting, denied initial, denied reconsideration, hearing)
   - If denied: When? (important for appeal deadlines)

9. **SMS CONSENT** (REQUIRED - Must ask before closing)
   Ask: "Before we wrap up, I'd like to send you a text message with our contact information and a reference number for your call today. This way you'll have everything you need to reach us. Is it okay if I send that text to this phone number?"
   - If YES: Say "Great, I'll send that right over. You can reply STOP any time if you prefer not to receive texts."
   - If NO: Say "No problem at all. I'll make sure everything is in your file for when our team follows up."
   - ALWAYS use the record_sms_consent function to log their response
   - SMS can ONLY be sent if they explicitly agree

10. **CLOSING**
    Based on the score from record_assessment, close appropriately:
    - High score (70+): Express optimism, promise attorney callback within 24 hours
    - Medium score (45-69): Note potential, attorney will review within 48 hours
    - Lower score (25-44): Be honest about challenges, attorney will review
    - Very low (<25): Be gentle but honest, mention other resources

## IMPORTANT NOTES
- After gathering each section's data, USE THE APPROPRIATE FUNCTION to record it
- Be conversational - don't read questions like a script
- If they mention crisis/suicide, immediately provide 988 hotline and ask if they're safe
- If they ask legal questions, say an attorney will address those
- If they ask about fees, explain contingency (no fee unless they win, 25% of back benefits)
- If they want to speak to a human, respect that and note it

## SCORING AWARENESS
The case will be stronger if the caller has:
- Age 50 or older (especially 55+)
- Limited education (less than high school)
- Physical/labor work history (not desk jobs)
- Multiple medical conditions
- Mental health conditions combined with physical
- Strong medications (opioids, antipsychotics)
- Functional limitations preventing 8-hour workdays
- Recent hospitalizations

Be encouraging about these factors when present, without making promises.`;


export const INTAKE_TOOLS = [
  {
    type: 'function',
    name: 'record_demographics',
    description: 'Record the caller\'s basic demographic information',
    parameters: {
      type: 'object',
      properties: {
        first_name: {
          type: 'string',
          description: 'Caller\'s first name'
        },
        last_name: {
          type: 'string',
          description: 'Caller\'s last name'
        },
        date_of_birth: {
          type: 'string',
          description: 'Date of birth in YYYY-MM-DD format'
        },
        phone: {
          type: 'string',
          description: 'Best phone number to reach them'
        },
        email: {
          type: 'string',
          description: 'Email address (optional)'
        },
        city: {
          type: 'string',
          description: 'City they live in'
        },
        state: {
          type: 'string',
          description: 'State they live in'
        }
      },
      required: ['first_name', 'last_name', 'date_of_birth', 'phone']
    }
  },
  {
    type: 'function',
    name: 'record_education',
    description: 'Record the caller\'s education level',
    parameters: {
      type: 'object',
      properties: {
        education_level: {
          type: 'string',
          enum: ['illiterate', 'marginal', 'limited', 'high_school', 'college'],
          description: 'Highest education level: illiterate (cannot read/write), marginal (6th grade or less), limited (7th-11th), high_school (GED or diploma), college (any college or higher)'
        },
        details: {
          type: 'string',
          description: 'Additional details about education (e.g., "completed 9th grade")'
        }
      },
      required: ['education_level']
    }
  },
  {
    type: 'function',
    name: 'record_medical_conditions',
    description: 'Record the caller\'s medical conditions',
    parameters: {
      type: 'object',
      properties: {
        conditions: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of medical conditions preventing work'
        },
        severity: {
          type: 'string',
          enum: ['mild', 'moderate', 'severe', 'disabling'],
          description: 'Overall severity of conditions'
        },
        duration_months: {
          type: 'number',
          description: 'How many months they have had these conditions'
        },
        treatments: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of treatments (surgeries, injections, therapy, etc.)'
        },
        hospitalizations: {
          type: 'number',
          description: 'Number of hospitalizations in past 12 months'
        }
      },
      required: ['conditions', 'severity']
    }
  },
  {
    type: 'function',
    name: 'record_medications',
    description: 'Record the caller\'s current medications',
    parameters: {
      type: 'object',
      properties: {
        medications: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of medications currently taking'
        },
        side_effects: {
          type: 'array',
          items: { type: 'string' },
          description: 'Side effects experienced (drowsiness, dizziness, concentration problems, etc.)'
        }
      },
      required: ['medications']
    }
  },
  {
    type: 'function',
    name: 'record_functional_limitations',
    description: 'Record the caller\'s functional limitations',
    parameters: {
      type: 'object',
      properties: {
        sitting_minutes: {
          type: 'number',
          description: 'How many minutes they can sit before needing to get up'
        },
        standing_minutes: {
          type: 'number',
          description: 'How many minutes they can stand in one place'
        },
        walking_blocks: {
          type: 'number',
          description: 'How many blocks they can walk without stopping'
        },
        lifting_pounds: {
          type: 'number',
          description: 'Maximum weight they can lift and carry in pounds'
        },
        concentration_issues: {
          type: 'boolean',
          description: 'Whether they have concentration or focus problems'
        },
        memory_issues: {
          type: 'boolean',
          description: 'Whether they have memory problems'
        },
        social_difficulties: {
          type: 'boolean',
          description: 'Whether they have difficulty being around others'
        },
        expected_absences: {
          type: 'number',
          description: 'Days per month they would expect to miss work'
        },
        needs_to_lie_down: {
          type: 'boolean',
          description: 'Whether they need to lie down during the day'
        },
        assistive_devices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Assistive devices used (cane, walker, wheelchair, back brace, etc.)'
        }
      },
      required: ['sitting_minutes', 'standing_minutes', 'lifting_pounds']
    }
  },
  {
    type: 'function',
    name: 'record_work_history',
    description: 'Record the caller\'s work history',
    parameters: {
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              years: { type: 'number' }
            }
          },
          description: 'List of jobs with title and years worked'
        },
        heaviest_lifting: {
          type: 'string',
          enum: ['sedentary', 'light', 'medium', 'heavy', 'very_heavy'],
          description: 'Heaviest physical demand: sedentary (desk work), light (10-20 lbs), medium (25-50 lbs), heavy (50-100 lbs), very_heavy (100+ lbs)'
        },
        total_work_years: {
          type: 'number',
          description: 'Total years worked'
        },
        last_work_date: {
          type: 'string',
          description: 'When they last worked (YYYY-MM-DD or description like "6 months ago")'
        },
        currently_working: {
          type: 'boolean',
          description: 'Whether they are currently working'
        }
      },
      required: ['jobs', 'heaviest_lifting', 'total_work_years']
    }
  },
  {
    type: 'function',
    name: 'record_application_status',
    description: 'Record the caller\'s Social Security application status',
    parameters: {
      type: 'object',
      properties: {
        has_applied: {
          type: 'boolean',
          description: 'Whether they have applied for Social Security Disability'
        },
        status: {
          type: 'string',
          enum: ['never_applied', 'waiting', 'denied_initial', 'denied_reconsideration', 'hearing_pending', 'hearing_scheduled'],
          description: 'Current application status'
        },
        denial_date: {
          type: 'string',
          description: 'Date of most recent denial (if applicable)'
        },
        hearing_date: {
          type: 'string',
          description: 'Scheduled hearing date (if applicable)'
        }
      },
      required: ['has_applied', 'status']
    }
  },
  {
    type: 'function',
    name: 'record_sms_consent',
    description: 'Record whether the caller consented to receive SMS messages. MUST be called before ending the call.',
    parameters: {
      type: 'object',
      properties: {
        consent_given: {
          type: 'boolean',
          description: 'Whether the caller agreed to receive SMS messages'
        },
        phone_number: {
          type: 'string',
          description: 'Phone number they consented to receive SMS at'
        }
      },
      required: ['consent_given']
    }
  },
  {
    type: 'function',
    name: 'record_assessment',
    description: 'Calculate and record the final case assessment. Call this after gathering all information to get the score and recommendation.',
    parameters: {
      type: 'object',
      properties: {
        notes: {
          type: 'string',
          description: 'Any additional notes about the caller or case'
        }
      },
      required: []
    }
  },
  {
    type: 'function',
    name: 'flag_urgent',
    description: 'Flag the case as urgent (crisis mentioned, deadline approaching, or hearing scheduled)',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for urgent flag'
        },
        crisis_mentioned: {
          type: 'boolean',
          description: 'Whether caller mentioned crisis or suicidal ideation'
        }
      },
      required: ['reason']
    }
  },
  {
    type: 'function',
    name: 'request_human_transfer',
    description: 'Caller requested to speak with a human',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for transfer request'
        }
      },
      required: []
    }
  },
  {
    type: 'function',
    name: 'end_call',
    description: 'Mark the call as complete',
    parameters: {
      type: 'object',
      properties: {
        outcome: {
          type: 'string',
          enum: ['completed', 'transferred', 'callback_requested', 'disconnected', 'not_interested'],
          description: 'How the call ended'
        },
        send_sms: {
          type: 'boolean',
          description: 'Whether to send SMS confirmation'
        }
      },
      required: ['outcome']
    }
  },
  {
    type: 'function',
    name: 'record_callback_request',
    description: 'Record a callback request for non-intake calls. Use this when the caller is NOT calling about a new disability claim, but needs a callback for another reason (existing client, billing, case status, documents, referral, etc.)',
    parameters: {
      type: 'object',
      properties: {
        caller_name: {
          type: 'string',
          description: 'Name of the person calling'
        },
        phone_number: {
          type: 'string',
          description: 'Best phone number to call them back'
        },
        purpose: {
          type: 'string',
          description: 'Brief description of why they are calling and what they need'
        },
        category: {
          type: 'string',
          enum: ['EXISTING_CLIENT', 'CASE_STATUS', 'BILLING', 'DOCUMENTS', 'REFERRAL', 'VENDOR', 'GENERAL', 'OTHER'],
          description: 'Category of the callback request'
        },
        is_urgent: {
          type: 'boolean',
          description: 'Whether the caller indicated this is urgent'
        },
        notes: {
          type: 'string',
          description: 'Any additional notes about the request'
        }
      },
      required: ['caller_name', 'phone_number', 'purpose', 'category']
    }
  }
];
