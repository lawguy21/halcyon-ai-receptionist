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

export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null;
  private options: OpenAIRealtimeClientOptions;
  private log;
  private isConnected = false;
  private pendingAudioChunks: string[] = [];
  private currentTranscript = '';

  constructor(options: OpenAIRealtimeClientOptions) {
    this.options = options;
    this.log = createCallLogger(options.callId);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${config.openai.realtimeModel}`;

      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${config.openai.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        this.log.info({ event: 'openai_ws_open' });
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
    // Configure the session
    this.send({
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
          threshold: 0.5,           // Slightly higher = less sensitive to background noise
          prefix_padding_ms: 300,   // Capture more audio before detected speech
          silence_duration_ms: 300  // Quick response after user stops speaking
        },
        tools: INTAKE_TOOLS,
        tool_choice: 'auto',
        temperature: 0.4,           // Lower for more consistent, predictable responses
        max_response_output_tokens: 512  // Shorter responses = faster delivery
      }
    });

    // Note: The greeting will be triggered after session.updated is received
  }

  private triggerInitialGreeting(): void {
    this.log.info({ event: 'triggering_initial_greeting' });

    // Start the conversation - Twilio already said "Hello, one moment please"
    // so OpenAI should continue naturally without repeating hello
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: '[SYSTEM: Call connected. The caller just heard "Hello, one moment please." Now introduce yourself and ask how you can help. Do NOT say hello again.]'
        }]
      }
    });

    // Trigger response with explicit audio modality
    this.send({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    });
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
          // User's speech transcript
          const userTranscript = event as TranscriptDelta;
          if (userTranscript.transcript) {
            this.options.onTranscript('user', userTranscript.transcript);
          }
          break;

        case 'response.function_call_arguments.done':
          // Handle function calls
          this.handleFunctionCall(event as unknown as FunctionCallArguments);
          break;

        case 'input_audio_buffer.speech_started':
          // User started speaking - potential interruption
          this.log.debug({ event: 'user_speech_started' });
          break;

        case 'input_audio_buffer.speech_stopped':
          this.log.debug({ event: 'user_speech_stopped' });
          break;

        case 'response.done':
          this.log.debug({ event: 'response_complete' });
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

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
