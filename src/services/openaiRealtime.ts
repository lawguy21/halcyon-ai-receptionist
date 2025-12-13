/**
 * HALCYON AI RECEPTIONIST - OPENAI REALTIME API CLIENT
 *
 * Handles WebSocket connection to OpenAI's Realtime API
 * Manages audio streaming, function calls, and conversation state
 */

import WebSocket from 'ws';
import { config } from '../config/index.js';
import { createCallLogger } from '../utils/logger.js';
import { INTAKE_SYSTEM_PROMPT, INTAKE_TOOLS } from './intakePrompts.js';

// OpenAI Realtime API types
interface RealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: unknown;
}

interface AudioDelta {
  type: 'response.audio.delta';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string; // Base64 encoded audio
}

interface TranscriptDelta {
  type: 'response.audio_transcript.delta' | 'conversation.item.input_audio_transcription.completed';
  transcript?: string;
  delta?: string;
}

interface FunctionCallArguments {
  type: 'response.function_call_arguments.done';
  call_id: string;
  name: string;
  arguments: string;
}

export interface OpenAIRealtimeClientOptions {
  callId: string;
  onAudioResponse: (audioBase64: string) => void;
  onTranscript: (role: 'user' | 'assistant', text: string) => void;
  onFunctionCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  onInterruption: () => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

// Silence timeout - how long to wait before re-prompting if user doesn't respond
// First prompt waits longer (20s), subsequent prompts wait 15s
const FIRST_SILENCE_TIMEOUT_MS = 20000; // 20 seconds for first re-prompt (give caller plenty of time)
const SILENCE_TIMEOUT_MS = 15000; // 15 seconds for subsequent prompts
const MAX_SILENCE_PROMPTS = 2;   // Max times to re-prompt before giving up (reduced from 3)

export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null;
  private options: OpenAIRealtimeClientOptions;
  private log;
  private isConnected = false;
  private pendingAudioChunks: string[] = [];
  private currentTranscript = '';
  private audioChunkCount = 0;  // Track how many audio chunks we receive
  private silenceTimeout: NodeJS.Timeout | null = null;
  private silencePromptCount = 0;  // Track how many times we've re-prompted
  private callEnding = false;  // Flag to prevent re-prompts after call conclusion

  constructor(options: OpenAIRealtimeClientOptions) {
    this.options = options;
    this.log = createCallLogger(options.callId);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${config.openai.realtimeModel}`;

      // Log connection attempt with key details (mask most of API key for security)
      const maskedKey = config.openai.apiKey.slice(0, 10) + '...' + config.openai.apiKey.slice(-4);
      this.log.info({
        event: 'openai_ws_connecting',
        url,
        model: config.openai.realtimeModel,
        apiKeyPrefix: maskedKey
      });

      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${config.openai.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        this.log.info({ event: 'openai_ws_open', message: 'WebSocket connected successfully' });
        this.isConnected = true;
        this.initializeSession();
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        this.log.error({ event: 'openai_ws_error', error });
        this.options.onError(error);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.log.info({
          event: 'openai_ws_close',
          code,
          reason: reason.toString()
        });
        this.isConnected = false;
        this.options.onClose();
      });
    });
  }

  private initializeSession(): void {
    this.log.info({ event: 'initializing_session', voice: config.openai.voice });

    // Configure the session
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: INTAKE_SYSTEM_PROMPT,
        voice: config.openai.voice,
        input_audio_format: 'g711_ulaw', // Twilio's format
        output_audio_format: 'g711_ulaw', // Send back in Twilio's format
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.7,           // Higher = less sensitive to background noise (avoid false triggers)
          prefix_padding_ms: 500,   // Capture more audio before detected speech
          silence_duration_ms: 1600 // Wait 1.6 seconds of silence before responding (give caller time to think)
        },
        tools: INTAKE_TOOLS,
        tool_choice: 'auto',
        temperature: 0.6,           // OpenAI Realtime API minimum is 0.6
        max_response_output_tokens: 512  // Shorter responses = faster delivery
      }
    };

    this.log.info({ event: 'sending_session_update', config: { voice: config.openai.voice, modalities: ['text', 'audio'] } });
    this.send(sessionConfig);
    this.log.info({ event: 'session_update_sent' });

    // Note: The greeting will be triggered after session.updated is received
  }

  private triggerInitialGreeting(): void {
    this.log.info({ event: 'triggering_initial_greeting', timestamp: new Date().toISOString() });

    // Start the conversation - Twilio already said "Hello, one moment please"
    // so OpenAI should continue naturally without repeating hello
    const conversationItem = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: '[SYSTEM: Call connected. The caller just heard "Hello, one moment please." Now introduce yourself and ask how you can help. Do NOT say hello again.]'
        }]
      }
    };

    this.log.info({ event: 'sending_conversation_item', message: 'Creating initial greeting prompt' });
    this.send(conversationItem);
    this.log.info({ event: 'conversation_item_sent' });

    // Trigger response with explicit audio modality
    const responseRequest = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    };

    this.log.info({ event: 'sending_response_create', message: 'Requesting audio response from OpenAI' });
    this.send(responseRequest);
    this.log.info({ event: 'response_create_sent', message: 'Now waiting for response.audio.delta events...' });
  }

  private handleMessage(data: string): void {
    try {
      const event: RealtimeEvent = JSON.parse(data);

      switch (event.type) {
        case 'session.created':
          this.log.info({ event: 'session_created' });
          break;

        case 'session.updated':
          this.log.info({ event: 'session_updated' });
          // Now that session is configured, trigger the initial greeting
          this.triggerInitialGreeting();
          break;

        case 'response.audio.delta':
          // Stream audio back to Twilio
          this.audioChunkCount++;
          if (this.audioChunkCount === 1) {
            this.log.info({ event: 'first_audio_chunk_received', message: 'OpenAI is now streaming audio!' });
          }
          if (this.audioChunkCount % 50 === 0) {
            this.log.debug({ event: 'audio_chunks_received', count: this.audioChunkCount });
          }
          const audioDelta = event as unknown as AudioDelta;
          this.options.onAudioResponse(audioDelta.delta);
          break;

        case 'response.audio.done':
          this.log.debug({ event: 'audio_response_complete' });
          break;

        case 'response.audio_transcript.delta':
          // AI's speech transcript
          const transcriptDelta = event as TranscriptDelta;
          if (transcriptDelta.delta) {
            this.currentTranscript += transcriptDelta.delta;
          }
          break;

        case 'response.audio_transcript.done':
          if (this.currentTranscript) {
            this.options.onTranscript('assistant', this.currentTranscript);
            this.currentTranscript = '';
          }
          break;

        case 'conversation.item.input_audio_transcription.completed':
          // User's speech transcript - reset silence counter since they spoke
          const userTranscript = event as TranscriptDelta;
          if (userTranscript.transcript) {
            this.options.onTranscript('user', userTranscript.transcript);
            this.resetSilenceCounter(); // User successfully responded
          }
          break;

        case 'response.function_call_arguments.done':
          // Handle function calls
          this.handleFunctionCall(event as unknown as FunctionCallArguments);
          break;

        case 'input_audio_buffer.speech_started':
          // User started speaking - cancel silence timeout
          this.log.debug({ event: 'user_speech_started' });
          this.clearSilenceTimeout();
          break;

        case 'input_audio_buffer.speech_stopped':
          this.log.debug({ event: 'user_speech_stopped' });
          break;

        case 'response.done':
          this.log.debug({ event: 'response_complete' });
          // Start silence timeout - if user doesn't respond within X seconds, re-prompt
          this.startSilenceTimeout();
          break;

        case 'rate_limits.updated':
          // Rate limit info
          break;

        case 'response.created':
          this.log.info({ event: 'response_created' });
          break;

        case 'response.output_item.added':
          this.log.info({ event: 'response_output_item_added', item: event });
          break;

        case 'error':
          this.log.error({
            event: 'openai_api_error',
            error: event.error
          });
          break;

        default:
          this.log.info({ event: 'unhandled_event', type: event.type, data: event });
      }
    } catch (error) {
      this.log.error({ event: 'message_parse_error', error });
    }
  }

  private async handleFunctionCall(event: FunctionCallArguments): Promise<void> {
    try {
      const args = JSON.parse(event.arguments);
      this.log.info({
        event: 'function_call',
        name: event.name,
        args
      });

      // Execute the function
      const result = await this.options.onFunctionCall(event.name, args);

      // Send the result back to OpenAI
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify(result)
        }
      });

      // Trigger continuation of conversation
      this.send({
        type: 'response.create'
      });

    } catch (error) {
      this.log.error({ event: 'function_call_error', error });

      // Send error result
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify({ error: 'Function execution failed' })
        }
      });

      this.send({
        type: 'response.create'
      });
    }
  }

  sendAudio(audioBase64: string): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'input_audio_buffer.append',
      audio: audioBase64
    });
  }

  commitAudio(): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'input_audio_buffer.commit'
    });
  }

  cancelResponse(): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'response.cancel'
    });

    this.options.onInterruption();
  }

  sendText(text: string): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text
        }]
      }
    });

    this.send({
      type: 'response.create'
    });
  }

  private send(event: RealtimeEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  // Silence timeout handling - re-prompt if user doesn't respond
  private startSilenceTimeout(): void {
    this.clearSilenceTimeout();

    // Don't start silence timer if call is ending (prevents "I'm still here" after goodbye)
    if (this.callEnding) {
      this.log.debug({ event: 'silence_timer_skipped', reason: 'call_ending' });
      return;
    }

    if (this.silencePromptCount >= MAX_SILENCE_PROMPTS) {
      this.log.info({ event: 'max_silence_prompts_reached', count: this.silencePromptCount });
      return; // Don't keep prompting forever
    }

    // Use longer timeout for first prompt, shorter for subsequent
    const timeoutMs = this.silencePromptCount === 0 ? FIRST_SILENCE_TIMEOUT_MS : SILENCE_TIMEOUT_MS;

    this.silenceTimeout = setTimeout(() => {
      this.handleSilenceTimeout();
    }, timeoutMs);

    this.log.debug({ event: 'silence_timer_started', timeout_ms: timeoutMs, prompt_count: this.silencePromptCount });
  }

  private clearSilenceTimeout(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
      this.log.debug({ event: 'silence_timer_cleared' });
    }
  }

  private handleSilenceTimeout(): void {
    // Double-check call isn't ending (in case timing edge case)
    if (this.callEnding) {
      this.log.debug({ event: 'silence_timeout_skipped', reason: 'call_ending' });
      return;
    }

    this.silencePromptCount++;
    const timeoutUsed = this.silencePromptCount === 1 ? FIRST_SILENCE_TIMEOUT_MS : SILENCE_TIMEOUT_MS;
    this.log.info({ event: 'silence_timeout_triggered', prompt_count: this.silencePromptCount, timeout_ms: timeoutUsed });

    // Send a gentle prompt to get the user to respond
    const prompts = [
      "Are you still there? Take your time, I'm listening.",
      "Hello? I want to make sure we're still connected."
    ];

    const promptText = prompts[Math.min(this.silencePromptCount - 1, prompts.length - 1)];

    // Create a system message asking AI to re-prompt
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: `[SYSTEM: The caller has been quiet. Very gently check if they're still there. Say something natural like: "${promptText}" Then wait patiently for their response.]`
        }]
      }
    });

    // Trigger a response
    this.send({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    });
  }

  // Reset silence counter when user actually responds
  private resetSilenceCounter(): void {
    this.silencePromptCount = 0;
  }

  /**
   * Mark the call as ending - prevents further silence prompts
   * Call this when the AI says goodbye or the call is concluding
   */
  markCallEnding(): void {
    this.callEnding = true;
    this.clearSilenceTimeout();
    this.log.info({ event: 'call_marked_ending', message: 'Silence prompts disabled for call conclusion' });
  }

  close(): void {
    this.clearSilenceTimeout();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
