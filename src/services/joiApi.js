/**
 * joiApi.js
 * Joi AI — Hugging Face Space API Service
 *
 * Connects to the Hugging Face Gradio Space running Qwen3.5-4B
 * and provides a streaming `askJoi()` interface for AIChatBot.jsx.
 *
 * Architecture:
 *   React UI → joiApi.js → @gradio/client → HF Space → Joi (Qwen3.5-4B)
 */

import { Client } from '@gradio/client';

// ──────────────────────────────────────────────────────────────
// Space Config
// ──────────────────────────────────────────────────────────────

export const JOI_SPACE = import.meta.env.VITE_JOI_SPACE || 'bankjademk11/joah-joi-chat';

// Gradio ChatInterface default named endpoint is "/chat"
const JOI_API_NAME = '/chat';

// Max recent messages to send as context
const MAX_JOI_HISTORY = 20;

// ──────────────────────────────────────────────────────────────
// Singleton client connection
// ──────────────────────────────────────────────────────────────

let clientPromise = null;

export async function getJoiClient() {
  if (!clientPromise) {
    clientPromise = Client.connect(JOI_SPACE).catch((err) => {
      // Reset so next call can retry
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

// ──────────────────────────────────────────────────────────────
// Normalize React message history → Gradio format
// ──────────────────────────────────────────────────────────────

export function normalizeJoiHistory(messages = []) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_JOI_HISTORY)
    .map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
    }))
    .filter((m) => m.content.trim().length > 0);
}

// ──────────────────────────────────────────────────────────────
// Check if this is a ZeroGPU quota error
// ──────────────────────────────────────────────────────────────

export function isZeroGPUQuotaError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('ZeroGPU quota exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('180s requested') ||
    msg.includes('Subscribe to Hugging Face PRO')
  );
}

// ──────────────────────────────────────────────────────────────
// Custom error class for ZeroGPU quota
// ──────────────────────────────────────────────────────────────

export class ZeroGPUQuotaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ZeroGPUQuotaError';
  }
}

// ──────────────────────────────────────────────────────────────
// Reset the connection (useful after errors)
// ──────────────────────────────────────────────────────────────

export function resetJoiClient() {
  clientPromise = null;
}

// ──────────────────────────────────────────────────────────────
// Main API call
// ──────────────────────────────────────────────────────────────

/**
 * askJoi — Call Joi AI on Hugging Face with streaming support
 *
 * @param {object} params
 * @param {string}   params.message       - The user's current message
 * @param {Array}    params.messages       - Full React messages array (for history context)
 * @param {string}   [params.systemPrompt] - Optional short app-specific prompt (HF Space has its own)
 * @param {number}   [params.maxTokens]    - Max tokens (default 768)
 * @param {number}   [params.temperature]  - Temperature (default 0.7)
 * @param {boolean}  [params.deepThinking] - Enable deep thinking mode (default false)
 * @param {Function} [params.onToken]      - Called with streamed text so far
 * @param {Function} [params.onStatus]     - Called with Gradio status events
 * @returns {Promise<string>} Final complete assistant text
 */
export async function askJoi({
  message,
  messages = [],
  systemPrompt = '',
  maxTokens = 768,
  temperature = 0.7,
  deepThinking = false,
  onToken,
  onStatus,
}) {
  const app = await getJoiClient();

  // Build history excluding the current user message (last one)
  // We send all previous messages as context, not the current one
  const history = normalizeJoiHistory(
    // Exclude last message if it's the one we're sending now
    messages.filter((m) => !(m.role === 'user' && m.content === message))
  );

  // Gradio ChatInterface predict() signature:
  // predict(message, history, system_prompt, max_tokens, temperature, deep_thinking)
  const job = app.submit(JOI_API_NAME, [
    message,       // 1. message (string)
    history,       // 2. history (array of {role, content})
    systemPrompt,  // 3. system_prompt (string) — empty = use Space's built-in prompt
    maxTokens,     // 4. max_tokens (int)
    temperature,   // 5. temperature (float)
    deepThinking,  // 6. deep_thinking (bool)
  ]);

  let finalText = '';

  for await (const event of job) {
    if (event.type === 'status') {
      onStatus?.(event);

      // Check for quota error in status message
      const stageName = event?.stage || '';
      if (stageName === 'error') {
        const errMsg = event?.message || 'Unknown error';
        if (isZeroGPUQuotaError({ message: errMsg })) {
          throw new ZeroGPUQuotaError(errMsg);
        }
        throw new Error(`Joi Space error: ${errMsg}`);
      }
      continue;
    }

    if (event.type === 'data') {
      const data = event.data;
      // Gradio ChatInterface returns the full updated text each time
      const text = Array.isArray(data) ? (data[0] ?? '') : String(data ?? '');
      finalText = text;
      onToken?.(finalText);
    }
  }

  return finalText;
}
