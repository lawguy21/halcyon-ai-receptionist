# Halcyon AI Receptionist - SMS Campaign Registration Guide

## Campaign Use Case
**Legal Services / Professional Services**

---

## Campaign Description

**Copy this into the "Campaign Description" field:**

> This campaign sends transactional SMS messages to individuals who call our Social Security Disability legal intake phone line. Messages include: (1) confirmation of their intake call with a reference number, (2) case status updates, (3) appointment and callback reminders, and (4) requests for additional information. All recipients verbally consent to receiving SMS during their phone call with our intake system. Messages are transactional in nature, not promotional. Average frequency is 2-6 messages per month during active case review. All messages include opt-out instructions.

---

## Call to Action (CTA) Description

**Use this exact language in your campaign registration:**

> Consumers initiate contact by calling our legal intake phone line seeking information about Social Security Disability representation. During the phone conversation with our AI-powered intake system, callers are explicitly asked: "May I send you a text message with our contact information and next steps?" Only after receiving verbal confirmation ("yes" or affirmative response) does the system send SMS messages. The verbal consent is logged with timestamp in our intake management system. All SMS messages include opt-out instructions. Consumers can opt out at any time by replying STOP.

---

## Opt-In Method
**Verbal Consent During Phone Call (IVR/Voice)**

The opt-in occurs during an inbound phone call:
1. Consumer calls our intake phone number
2. During the conversation, the AI system asks for SMS consent
3. Consumer verbally agrees to receive text messages
4. Consent is logged with call ID and timestamp
5. SMS is sent only after affirmative consent

---

## Sample Opt-In Script (Verbal - During Call)

The AI receptionist uses this language during intake calls:

```
"Before we finish, I'd like to send you a text message with our office
contact information and a summary of the next steps. This way you'll
have everything handy. Is it okay if I send that to your phone at
[phone number]?"

[Wait for response]

If YES: "Great, I'll send that over right now. You can reply STOP
at any time if you'd prefer not to receive texts from us."

If NO: "No problem at all. Let me give you the information verbally
instead..."
```

---

## Sample Message Flows

### Message 1: Initial Follow-Up (Sent immediately after call with consent)
```
Halcyon Legal: Thank you for calling about your disability case.
Your intake ID is [ID]. Our team will review your information and
contact you within 1 business day. Questions? Call 555-123-4567.
Reply STOP to opt out.
```
**Character count: 248**

### Message 2: Case Status Update
```
Halcyon Legal: Good news! Your case has been reviewed and we'd like
to schedule a consultation. Please call us at 555-123-4567 at your
earliest convenience. Reply STOP to opt out.
```
**Character count: 199**

### Message 3: Appointment Reminder
```
Halcyon Legal: Reminder - You have a callback scheduled for [DATE]
at [TIME]. If you need to reschedule, please call 555-123-4567.
Reply STOP to opt out.
```
**Character count: 172**

### Message 4: Document Request
```
Halcyon Legal: To proceed with your case, we need additional
information. Please call 555-123-4567 to speak with our team.
Reply STOP to opt out.
```
**Character count: 162**

### Message 5: Callback Reminder
```
Halcyon Legal: We tried reaching you earlier. Please call us back
at 555-123-4567 regarding your disability case inquiry.
Reply STOP to opt out.
```
**Character count: 159**

---

## Opt-Out Handling

**Supported Keywords:** STOP, UNSUBSCRIBE, CANCEL, END, QUIT

**Opt-Out Confirmation Message:**
```
Halcyon Legal: You've been unsubscribed and will no longer receive
texts from us. If you need assistance, call 555-123-4567.
```

**Opt-In Keywords:** START, UNSTOP, YES

**Re-Opt-In Confirmation:**
```
Halcyon Legal: You're now subscribed to receive updates about your
case. Reply STOP at any time to opt out. Call 555-123-4567 for help.
```

---

## Message Frequency

- **Initial message:** 1 message immediately after call (with consent)
- **Follow-up messages:** 1-3 messages per week maximum during active case review
- **Appointment reminders:** 1 message per scheduled appointment
- **Total expected:** 2-6 messages per month during active engagement

---

## Campaign Details for Registration

| Field | Value |
|-------|-------|
| **Campaign Use Case** | Legal Services |
| **Sub Use Case** | Professional Services / Legal Intake |
| **Message Volume** | Low (under 2,000/month) |
| **Opt-In Type** | Verbal consent during phone call |
| **Opt-In Workflow** | Consumer-initiated inbound call |
| **Message Types** | Transactional (case updates, reminders) |
| **Contains Links** | No (or Yes - link to client portal) |
| **Contains Phone Numbers** | Yes (office callback number) |
| **Age-Gated Content** | No |
| **Direct Lending/Loans** | No |

---

## Privacy Policy Requirements

Your website/landing page should include:

1. **SMS Terms disclosure** stating:
   - What messages they'll receive
   - Message frequency
   - "Message and data rates may apply"
   - How to opt out (reply STOP)
   - Link to privacy policy

2. **Example footer for website:**
```
By providing your phone number and consenting to SMS during your
intake call, you agree to receive transactional text messages from
Halcyon Legal regarding your case inquiry. Message frequency varies.
Message and data rates may apply. Reply STOP to cancel.
View our Privacy Policy at [URL].
```

---

## Help/Support Message

When user texts HELP:
```
Halcyon Legal: For assistance with your disability case,
call 555-123-4567 (Mon-Fri 9AM-5PM). To stop messages, reply STOP.
Msg & data rates may apply.
```

---

## Checklist for Campaign Approval

- [ ] Verbal consent script added to AI intake prompts
- [ ] All messages include business name "Halcyon Legal"
- [ ] All messages include opt-out language "Reply STOP to opt out"
- [ ] STOP/HELP keyword responses configured in Twilio
- [ ] Privacy policy updated with SMS terms
- [ ] Consent logging implemented in database
- [ ] Message templates registered match actual sent messages

---

## Twilio Console Configuration

### 1. Messaging Service Setup
- Create a Messaging Service in Twilio Console
- Add your phone number to the service
- Enable "Sticky Sender" for consistent number

### 2. Advanced Opt-Out Management
Go to: Messaging → Services → [Your Service] → Opt-Out Management
- Enable Advanced Opt-Out
- Configure STOP, HELP responses with messages above

### 3. A2P 10DLC Registration
Go to: Messaging → Regulatory Compliance → A2P Registration
- Register your Brand (business information)
- Create Campaign with details above
- Submit for review

---

## Updating Your AI Intake Prompts

Add this to your intake conversation flow to capture SMS consent properly:

```javascript
// Add to intakePrompts.ts - near end of conversation

"Before we wrap up, I'd like to send you a text message with our
contact information and a reference number for your call today.
This makes it easy to reach us if you have questions. Is it okay
if I send that text to this phone number?"

// Log the consent
{
  "smsConsent": true,
  "smsConsentTimestamp": "2025-01-15T10:30:00Z",
  "smsConsentMethod": "verbal_during_intake_call"
}
```
