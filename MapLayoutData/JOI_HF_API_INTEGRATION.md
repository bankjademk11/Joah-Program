# Joi AI — Hugging Face API Integration Specification

## 0. Goal

Refactor the existing React AI chatbot so that the chat model is provided by the user's Hugging Face Space running:

- **Model:** `Qwen/Qwen3.5-4B`
- **Hugging Face Space:** use the owner's actual `username/space-name`
- **Gradio API endpoint:** `/joi_chat`
- **Client:** `@gradio/client`

The React application must stop calling DeepSeek directly for normal chat.

The goal is to keep the current UI/UX while replacing the direct DeepSeek chat layer with Joi on Hugging Face.

---

# 1. Target Architecture

Current architecture:

```text
React UI
   ↓
DeepSeek API
   ↓
Tool Calling
   ↓
Supabase
```

Target architecture for this phase:

```text
React UI
   ↓
@gradio/client
   ↓
Hugging Face Space
   ↓
Joi AI (Qwen3.5-4B)
```

Do NOT expose secret API keys in the browser.

Do NOT put Hugging Face tokens, DeepSeek API keys, Gemini API keys, or Supabase service-role keys into Vite `VITE_*` variables unless the value is intentionally public.

---

# 2. Existing Project Context

The current component is an AI chatbot similar to:

```text
AIChatBot.jsx
```

It currently contains:

- React state for messages
- localStorage chat history
- file attachments
- Excel parsing
- image preview
- browser TTS
- Markdown rendering
- Supabase queries
- DeepSeek tool calling
- optional Gemini image handling

Preserve the existing visual design and user experience unless a change is required for API integration.

---

# 3. Model

Use:

```text
Qwen/Qwen3.5-4B
```

Do NOT replace it with:

- Gemma 2 9B
- Qwen2.5-7B
- DeepSeek-R1
- DeepSeek Chat
- Gemini

unless explicitly requested later.

The Hugging Face Space already runs Joi successfully. The React project should consume that Space as an API.

---

# 4. Required NPM Dependency

Install:

```bash
npm install @gradio/client
```

Do not implement the Gradio queue protocol manually unless `@gradio/client` cannot support a required feature.

---

# 5. Create Joi API Service

Create:

```text
src/services/joiApi.js
```

The service should:

1. Connect to the Hugging Face Space.
2. Keep a reusable connection promise.
3. Call `/joi_chat`.
4. Support streaming responses.
5. Convert React message history into the format expected by the Gradio endpoint.
6. Return the final assistant text.
7. Expose callbacks for streaming/status updates.
8. Throw clear errors when the Space is offline or the API call fails.

Base structure:

```js
import { Client } from '@gradio/client';

export const JOI_SPACE = 'YOUR_USERNAME/YOUR_SPACE';
const JOI_API_NAME = '/joi_chat';

let clientPromise = null;

export async function getJoiClient() {
  if (!clientPromise) {
    clientPromise = Client.connect(JOI_SPACE);
  }
  return clientPromise;
}
```

Do not hard-code private credentials into this file.

If authentication is required later, move authentication to a secure backend instead of exposing the token in the browser.

---

# 6. Joi API Contract

The current Python `predict()` function has this logical input order:

```text
1. message
2. history
3. system_prompt
4. max_tokens
5. temperature
6. deep_thinking
```

The endpoint must therefore be called with the equivalent payload/order unless the Hugging Face Space API schema proves that the generated API signature differs.

Before final integration, inspect the Space API schema from:

```text
https://YOUR-SPACE-DOMAIN/gradio_api/openapi.json
```

or use the Hugging Face Space's **Use via API** documentation.

Never guess the endpoint signature.

---

# 7. React Message History

The React app stores messages like:

```js
{
  role: 'user',
  content: '...'
}
```

and:

```js
{
  role: 'assistant',
  content: '...'
}
```

Only send real user/assistant messages to Joi.

Do NOT send UI-only metadata such as:

```text
hasFile
fileName
imagePreview
isLoading
```

unless the file itself is intentionally converted into a model-readable payload.

Do NOT send the old DeepSeek system prompt as a fake user message.

The Hugging Face Joi Space already has a system prompt. The React app may send an additional application-specific system prompt only if this is intentionally supported by the API contract.

---

# 8. System Prompt for React

Use a compact application prompt only when needed.

Example:

```text
You are Joi, the AI assistant for Joah Inventory System.

Reply in the same language as the user's latest message:
- Lao → Lao
- Thai → Thai
- English → English

Be natural, concise for simple questions, and detailed for complex questions.
Do not greet repeatedly.
Do not introduce yourself repeatedly.
Do not fabricate real inventory data.
Do not invent stock, product names, prices, branch data, or barcodes.
```

However, avoid duplicating a very large system prompt on every request when the Hugging Face Space already contains the canonical Joi system instructions.

Prefer a short app-specific instruction or no extra system prompt if the Space already handles it correctly.

---

# 9. Replace DeepSeek Chat Layer

The existing code contains:

```js
const DEEPSEEK_API_KEY = ...
```

and calls:

```text
https://api.deepseek.com/v1/chat/completions
```

Remove this as the primary chat path.

Do not call DeepSeek for ordinary Joi conversations after this migration.

Do not leave a real secret key in source code.

If a legacy DeepSeek integration remains temporarily for a fallback, it must be clearly isolated and MUST NOT contain a hard-coded API key.

---

# 10. Streaming Behavior

Joi's Python function uses `yield`, so React should support streaming.

Expected flow:

```text
User sends message
   ↓
Insert user message into UI
   ↓
Insert empty assistant placeholder
   ↓
Call Joi API
   ↓
Receive incremental output
   ↓
Update assistant placeholder
   ↓
Receive final output
   ↓
Save final assistant message
```

Do not append a new assistant message for every token/chunk.

Update the same assistant message while streaming.

Example logic:

```js
setMessages(prev => {
  const next = [...prev];
  const last = next.length - 1;

  if (last >= 0 && next[last].role === 'assistant') {
    next[last] = {
      ...next[last],
      content: streamedText,
    };
  }

  return next;
});
```

---

# 11. Example `askJoi()` API

Use a function shaped approximately like this:

```js
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

  const history = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
    }))
    .filter(m => m.content.trim());

  const job = app.submit('/joi_chat', [
    message,
    history,
    systemPrompt,
    maxTokens,
    temperature,
    deepThinking,
  ]);

  let finalText = '';

  for await (const event of job) {
    if (event.type === 'status') {
      onStatus?.(event);
      continue;
    }

    if (event.type === 'data') {
      const data = event.data;
      const text = Array.isArray(data) ? (data[0] ?? '') : String(data ?? '');
      finalText = text;
      onToken?.(finalText);
    }
  }

  return finalText;
}
```

The exact `data` shape must be verified against the actual deployed Space API schema.

---

# 12. `handleSend()` Integration

Refactor `handleSend()` so that normal text chat uses `askJoi()`.

Required sequence:

```text
1. Read input.
2. Validate that there is a message or supported attachment.
3. Push user message into React state.
4. Clear input.
5. Set loading state.
6. Add empty assistant placeholder.
7. Call Joi.
8. Stream output into the placeholder.
9. Replace placeholder with final answer.
10. Speak final answer with existing TTS if enabled.
11. Save conversation to localStorage.
12. Clear loading state.
```

---

# 13. TTS

Keep the existing browser speech synthesis system.

Do not send TTS data to Hugging Face.

Current behavior:

```js
window.speechSynthesis
```

can remain local to the browser.

Important:

The existing line:

```js
ut.lang = language === 'la' ? 'th-TH' : 'th-TH';
```

means both Lao and Thai use Thai speech synthesis.

Do not claim that this is true Lao TTS.

Leave it unchanged unless a real Lao TTS provider is added later.

---

# 14. Local Chat History

Keep:

```text
localStorage key:
joah_ai_history
```

Do not send the entire localStorage database to the Hugging Face Space.

For each request, send only the relevant recent conversation context.

Suggested maximum:

```js
const MAX_JOI_HISTORY = 20;
```

Before sending:

```js
const history = messages
  .filter(m => m.role === 'user' || m.role === 'assistant')
  .slice(-MAX_JOI_HISTORY);
```

---

# 15. File Attachments

The current application supports:

- Excel
- text files
- images

Do not pretend that Joi automatically receives uploaded files just because the React UI has a file picker.

Current text-file/Excel processing can remain local:

```text
file
 ↓
React parses file
 ↓
text extracted
 ↓
text included in Joi message
```

For example:

```text
[File: inventory.xlsx]
<extracted rows here>

User question: ...
```

Keep payload size under control.

Do not send huge spreadsheet dumps.

Keep the current 1 MB client-side file limit unless explicitly changed.

---

# 16. Image Support

The current React UI has image support and currently uses Gemini for images.

Do NOT automatically send images to the Qwen3.5 Space unless the Hugging Face API is explicitly changed to accept image inputs.

For this migration phase:

```text
Text question → Joi / Qwen3.5-4B
Image question → keep existing image path OR implement a separate verified vision endpoint
```

Do not break image support merely to replace DeepSeek text chat.

Also verify that the hidden image input exists. If `handleSend()` references:

```js
ai-img-input
```

make sure the JSX actually contains a corresponding file input.

---

# 17. Supabase Tool Calling

IMPORTANT:

The current React application has functions such as:

```text
searchProductByName
fetchStockData
fetchDailyRequests
fetchRequestHistoryByBarcode
fetchLowStockAlerts
suggestStockTransfers
getStoreAnalytics
getSalesAndImportSummary
```

These are application tools, not part of the Hugging Face chat model automatically.

Do NOT assume that simply calling Joi gives it access to these functions.

The current phase should separate:

### Phase A

```text
React → Joi API
```

### Phase B

Add secure server-side tool orchestration:

```text
React
 ↓
Backend / Edge Function
 ↓
Joi
 ↓
tool call
 ↓
Supabase
 ↓
tool result
 ↓
Joi
 ↓
final answer
```

Do not expose Supabase service-role credentials to the browser.

Do not move privileged database credentials into `VITE_*` variables.

If current Supabase queries are performed client-side with an anon key and RLS, keep them only where security policy permits.

---

# 18. Security Requirements

Never hard-code secrets like:

```js
sk-xxxxxxxx
```

or:

```js
hf_xxxxxxxxx
```

or:

```js
AIza...
```

inside source code that is shipped to browsers.

The current code contains a fallback like:

```js
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || 'sk-...';
```

This MUST be removed.

Assume any browser-visible secret is compromised.

If an actual key was previously committed or deployed, rotate/revoke it.

---

# 19. Error Handling

Show friendly UI errors for:

### Space unavailable

```text
ไม่สามารถเชื่อมต่อ Joi ได้ในขณะนี้ค่ะ
```

or Lao equivalent according to UI language.

### ZeroGPU quota exceeded

Recognize messages containing:

```text
ZeroGPU quota exceeded
```

Do not retry in an infinite loop.

Display a useful message such as:

```text
Joi AI ใช้งาน GPU ชั่วคราวไม่ได้ เนื่องจาก ZeroGPU quota ของ Hugging Face หมดค่ะ
```

### API schema mismatch

Log detailed error to console but show a short user-facing error.

### Network failure

Allow the user to send again after the current loading state is cleared.

---

# 20. ZeroGPU Expectations

The Hugging Face Space uses ZeroGPU.

The Python function is intentionally configured around a short GPU duration.

Do NOT try to solve quota problems by adding automatic retries.

Do NOT start multiple simultaneous Joi generation requests from one user action.

Disable the Send button while a request is active.

Avoid duplicate submits from Enter + button click.

---

# 21. Do Not Break Existing Features

Preserve:

- Markdown rendering
- ReactMarkdown
- remarkGfm
- TTS toggle
- speaking state
- chat history sidebar
- new chat
- delete chat
- file attachment preview
- Excel parsing
- dark mode classes
- current layout
- current branch/store UI
- Supabase client initialization

Only replace the AI transport layer unless a small change is required for compatibility.

---

# 22. Remove Unused DeepSeek Imports/Variables

After migration, search the project for:

```text
DEEPSEEK_API_KEY
api.deepseek.com
DeepSeek
```

Remove obsolete direct-chat logic.

Do not remove business tool functions unless they are being intentionally migrated elsewhere.

---

# 23. Environment Variables

The browser-safe configuration may contain a public Space identifier, for example:

```env
VITE_JOI_SPACE=your-username/your-space
```

A public Hugging Face Space identifier is not a secret.

Do NOT put a private Hugging Face token into:

```env
VITE_HF_TOKEN=
```

unless you explicitly accept exposing it to every website visitor.

Prefer:

```js
const JOI_SPACE = import.meta.env.VITE_JOI_SPACE;
```

with a fallback only to a non-secret public identifier if desired.

---

# 24. Recommended File Structure

```text
src/
├─ components/
│  └─ AIChatBot.jsx
│
├─ services/
│  └─ joiApi.js
│
├─ contexts/
│  └─ LanguageContext.jsx
│
├─ utils/
│  ├─ excelProcessor.js
│  └─ supabaseClient.js
│
└─ ...
```

If the project uses a different naming convention, follow the existing convention rather than creating duplicate folders.

---

# 25. React Service Requirements

`joiApi.js` should provide:

```js
getJoiClient()
askJoi()
```

Optional helper:

```js
normalizeJoiHistory()
```

Avoid putting UI state directly into the service.

The service should not import React state hooks.

---

# 26. Testing Checklist

After implementation, test these in order.

### Test 1 — Simple Lao

```text
ໝາມີຈັກຂາ
```

Expected behavior:

- Answer directly.
- Do not start with another greeting.
- Respond in Lao.

### Test 2 — Simple Thai

```text
หมามีกี่ขา
```

Expected behavior:

- Direct answer.
- Thai response.

### Test 3 — Conversation memory

```text
ฉันมีสินค้า 20 ชิ้น
```

then:

```text
ขายไป 7 ชิ้น
```

Expected:

```text
เหลือ 13 ชิ้น
```

### Test 4 — No repeated greeting

Send 3-5 consecutive questions.

Expected:

- No repeated self-introduction.
- No generic greeting on every message.

### Test 5 — Streaming

Confirm the assistant message updates progressively instead of appearing as duplicate messages.

### Test 6 — TTS

Verify TTS speaks only the final assistant answer once.

### Test 7 — Chat history

Reload the browser.

Expected:

- Existing chats remain in localStorage.

### Test 8 — Quota error

Simulate or inspect ZeroGPU quota errors.

Expected:

- No infinite retry loop.
- `isLoading` becomes false.
- User can retry later.

### Test 9 — File

Attach a small text/Excel file.

Expected:

- Current parser still works.
- Extracted content is passed as text to Joi.

### Test 10 — Security

Search built output/source for:

```text
sk-
hf_
AIza
```

No private keys should appear.

---

# 27. Important API Verification Step

Before assuming the endpoint works, inspect the actual Gradio Space API.

The code may use:

```text
/joi_chat
```

only if the Hugging Face Space has:

```python
api_name="joi_chat"
```

Do not blindly trust an endpoint name.

Use the actual deployed Space API schema.

---

# 28. Expected Final Flow

After migration:

```text
User
 ↓
AIChatBot.jsx
 ↓
joiApi.js
 ↓
@gradio/client
 ↓
Hugging Face Space
 ↓
/joi_chat
 ↓
Joi
 ↓
Qwen3.5-4B
 ↓
streaming text
 ↓
AIChatBot.jsx
 ↓
Markdown + TTS
```

---

# 29. Future Architecture: Secure Inventory Agent

After the basic chat API works, the recommended next step is to move inventory tool orchestration to a backend.

Desired architecture:

```text
React
  ↓
Secure API / Edge Function
  ↓
Joi model
  ↓
Tool Router
  ├─ search_product_by_name
  ├─ check_stock_by_barcode
  ├─ get_daily_requests
  ├─ get_request_history_by_barcode
  ├─ get_low_stock_alerts
  ├─ suggest_stock_transfers
  ├─ get_store_analytics
  └─ get_sales_and_import_summary
  ↓
Supabase
```

This keeps privileged data access away from the browser and allows Joi to become a true inventory agent rather than a plain chatbot.

Do not implement this phase unless explicitly requested.

---

# 30. Final Instruction to IDE / AI Agent

Implement the migration carefully.

### MUST DO

- Use `Qwen/Qwen3.5-4B` via the existing Hugging Face Joi Space.
- Use `@gradio/client`.
- Call `/joi_chat` only after verifying the deployed API schema.
- Preserve existing UI/UX.
- Preserve TTS.
- Preserve chat history.
- Support streaming.
- Remove direct DeepSeek chat usage.
- Do not expose secrets.
- Handle ZeroGPU quota errors gracefully.

### MUST NOT DO

- Do not replace Joi with another model.
- Do not hard-code API keys.
- Do not put Hugging Face private tokens in browser code.
- Do not assume Joi has Supabase tool access automatically.
- Do not send UI metadata as conversation history.
- Do not create duplicate assistant messages during streaming.
- Do not add infinite retry loops.
- Do not break the existing chat UI.

### Deliverables

1. `src/services/joiApi.js`
2. Updated `AIChatBot.jsx`
3. Updated `package.json` via `npm install @gradio/client`
4. Optional `.env.example` with public `VITE_JOI_SPACE`
5. No secrets committed to source control

After making changes, run the project's normal build/lint checks and fix any compile/runtime errors before finishing.
