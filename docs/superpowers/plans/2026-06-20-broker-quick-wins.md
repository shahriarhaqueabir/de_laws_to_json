# Broker Stability Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four targeted improvements to harden the browser-to-local-Ollama broker connection: timeouts, pre-flight health checks, typed parameter validation, and streaming.

**Architecture:** The broker path has two code paths: (A) client-side path `chat/page.tsx` → broker directly, and (B) server-side path `chat/route.ts` → broker. Quick wins 1, 2, and 4 target path A (the main UX). Quick win 3 targets path B.

**Tech Stack:** Next.js 16+ (App Router), TypeScript, FastAPI, Pydantic, Vitest, pytest

---

## File Map

| File | Role | Changes |
|---|---|---|
| `nextjs/src/app/chat/page.tsx` | Chat UI — local mode calls broker directly from browser | Add timeout, pre-send health check, streaming |
| `nextjs/src/app/api/chat/route.ts` | Server-side chat API (used by cloud/basic/browser modes) | Typed Zod schema for ollamaParams |
| `broker/broker.py` | FastAPI proxy to Ollama | Add streaming support |
| `nextjs/src/app/api/__tests__/chat.test.ts` | Server route tests | Update for typed ollamaParams |
| `tests/test_broker.py` | Broker API tests | Add streaming test |

### Quick Win 1: Client-Side Broker Fetch Timeout

The local mode broker fetch at `chat/page.tsx:227` has no timeout. The browser default fetch timeout is ~300s (Chrome). Add `AbortSignal.timeout(30000)` so users see a failure in 30s instead of waiting minutes.

- [ ] **Step 1: Add timeout to broker fetch**

In `nextjs/src/app/chat/page.tsx`, modify the broker fetch (line ~227) to include an AbortSignal timeout:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const brokerRes = await fetch(`${settings.brokerUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: userMsg,
      context: contextStr,
      conversationId: currentConvId || undefined,
      model: settings.ollamaModel || undefined,
      language: langName,
      temperature: settings.ollamaParams?.temperature ?? 0.3,
      top_p: settings.ollamaParams?.top_p ?? 0.9,
      top_k: settings.ollamaParams?.top_k ?? 40,
      max_tokens: settings.ollamaParams?.max_tokens ?? 1024,
      system_prompt: settings.ollamaParams?.system_prompt || undefined,
    }),
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeoutId);
}
```

- [ ] **Step 2: Verify by inspecting the file**

Run: grep to confirm the timeout exists
```bash
rg "AbortSignal\|controller\.signal\|timeoutId" nextjs/src/app/chat/page.tsx
```
Expected: The new timeout and signal wiring appear.

### Quick Win 2: Pre-Send Broker Health Check

The chat page has a 15s health-check interval (lines 109-120), but it's possible to send a message between checks. Add an immediate health check before the broker fetch in local mode, and block sending if the broker is clearly offline with a visible error.

- [ ] **Step 1: Add pre-send health check**

Modify the local mode handler in `chat/page.tsx` to do an immediate health check before the broker fetch:

```typescript
if (mode === "local") {
  // Pre-flight health check — quick probe before the full request
  let healthOk = brokerOnline;
  if (healthOk === null || healthOk === undefined) {
    try {
      const healthRes = await fetch(`${settings.brokerUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      healthOk = healthRes.ok;
    } catch {
      healthOk = false;
    }
  }
  if (!healthOk) {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "⚠️ **Local AI Broker is offline.**\n\nStart the broker:\n```bash\ncd broker && python broker.py\n```\n\nThen try again. Or switch to another chat mode in Settings.",
      },
    ]);
    setBrokerOnline(false);
    setLoading(false);
    return;
  }
  // ...rest of local mode handler...
}
```

- [ ] **Step 2: Verify the health check fires**

Re-run the chat page. The offline message should appear within ~3s instead of waiting 30s+.

### Quick Win 3: Typed Zod Schema for ollamaParams

The server-side `/api/chat` route uses `z.record(z.string(), z.unknown())` for `ollamaParams`. Replace it with a proper typed schema that catches misspelled field names.

- [ ] **Step 1: Define the Zod schema in the route file**

In `nextjs/src/app/api/chat/route.ts`, replace the `ollamaParams` zod definition:

```typescript
const OllamaParamsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().min(0).optional(),
  max_tokens: z.number().int().min(1).max(4096).optional(),
  system_prompt: z.string().optional(),
}).strict().optional();

const ChatBodySchema = z.object({
  message: z.string().min(1, "message is required"),
  conversationId: z.string().optional(),
  mode: z.string().optional(),
  model: z.string().optional(),
  customEndpoint: z.string().optional(),
  language: z.string().optional(),
  ollamaModel: z.string().optional(),
  ollamaParams: OllamaParamsSchema,
});
```

The `.strict()` ensures unknown keys (e.g., `temprature`) are rejected at validation time.

- [ ] **Step 2: Run existing tests to ensure nothing breaks**

```bash
cd nextjs && npx vitest run src/app/api/__tests__/chat.test.ts
```
Expected: All tests pass.

### Quick Win 4: Streaming from Broker to Browser

The local mode currently waits for the full response body (`await brokerRes.json()`). Add streaming so the user sees the response incrementally.

**Broker changes (broker/broker.py):**
- The broker already supports streaming conceptually (Ollama's `/api/generate` with `"stream": True` returns NDJSON). Add a streaming endpoint or a `stream` parameter to `/api/chat`.

**Chat page changes (chat/page.tsx):**
- When `stream: true` is set (we can add a query param or header), use `res.body.getReader()` to read the stream incrementally and update the message content as chunks arrive.

- [ ] **Step 1: Update broker.py to support streaming**

Add a streaming response option to the broker. When `stream: true` is in the request body, return a `StreamingResponse` with SSE:

```python
from fastapi.responses import StreamingResponse

@app.post("/api/chat")
async def chat(req: ChatRequest):
    # ... build payload as before ...
    payload["stream"] = req.stream  # Add stream field to ChatRequest

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            if req.stream:
                return StreamingResponse(
                    stream_ollama_response(client, payload),
                    media_type="text/event-stream",
                )
            # ... existing non-streaming logic ...
    except Exception as e:
        logger.error("Ollama request failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Ollama unavailable: {str(e)}")

async def stream_ollama_response(client, payload):
    async with client.stream("POST", f"{OLLAMA_URL}/api/generate", json=payload) as resp:
        async for line in resp.aiter_lines():
            if line:
                try:
                    chunk = json.loads(line)
                    if "response" in chunk:
                        yield f"data: {json.dumps({'response': chunk['response']})}\n\n"
                    if chunk.get("done"):
                        break
                except json.JSONDecodeError:
                        continue
```

Add `stream: bool = False` to `ChatRequest` model.

- [ ] **Step 2: Add streaming test to broker tests**

In `tests/test_broker.py`:

```python
@pytest.mark.asyncio
async def test_chat_streaming_returns_sse(client):
    fake_chunks = [
        {"response": "Legal ", "done": False},
        {"response": "guidance ", "done": False},
        {"response": "here.", "done": True},
    ]
    fake_ndjson = "\n".join(json.dumps(c) for c in fake_chunks)

    async def mock_post(url, **kwargs):
        class FakeStreamResponse:
            status_code = 200
            async def aiter_lines(self):
                for chunk in fake_ndjson.split("\n"):
                    yield chunk
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            def raise_for_status(self):
                pass
        return FakeStreamResponse()

    def make_mock_client(**kwargs):
        c = _MockHttpClient(**kwargs)
        c.post_handler = mock_post
        return c

    with patch("httpx.AsyncClient", side_effect=make_mock_client):
        resp = await client.post(
            "/api/chat",
            json={"message": "Test", "stream": True},
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")
```

- [ ] **Step 3: Update chat page to consume streaming response**

In `chat/page.tsx`, modify the local mode handler to use streaming when `stream: true`:

```typescript
if (mode === "local") {
  // ... health check code ...
  // ... search norms code ...

  const timeoutMs = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const brokerRes = await fetch(`${settings.brokerUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMsg,
        context: contextStr,
        conversationId: currentConvId || undefined,
        model: settings.ollamaModel || undefined,
        language: langName,
        temperature: settings.ollamaParams?.temperature ?? 0.3,
        top_p: settings.ollamaParams?.top_p ?? 0.9,
        top_k: settings.ollamaParams?.top_k ?? 40,
        max_tokens: settings.ollamaParams?.max_tokens ?? 1024,
        system_prompt: settings.ollamaParams?.system_prompt || undefined,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!brokerRes.ok) {
      throw new Error(`Local broker error: ${brokerRes.status}`);
    }

    // Add an initial empty assistant message to show the response is loading
    const citedLaws = searchData.citedLaws || [];
    const assistantMsgIdx = messages.length;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", citedLaws },
    ]);
    setBrokerOnline(true);

    // Stream the response
    const reader = brokerRes.body?.getReader();
    if (!reader) throw new Error("Response body not readable");

    const decoder = new TextDecoder();
    let accumulatedContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });

      // Parse SSE data lines
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.response) {
              accumulatedContent += parsed.response;
              setMessages((prev) => {
                const updated = [...prev];
                updated[assistantMsgIdx] = {
                  ...updated[assistantMsgIdx],
                  content: accumulatedContent,
                };
                return updated;
              });
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    }

    // Append source disclaimer
    setMessages((prev) => {
      const updated = [...prev];
      const idx = updated.length - 1;
      updated[idx] = {
        ...updated[idx],
        content: updated[idx].content + "\n\n---\n*Generated by Local AI (Ollama).*",
      };
      return updated;
    });

    setLoading(false);
    return;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 4: Run broker tests**

```bash
cd tests && python -m pytest test_broker.py -v
```
Expected: All tests pass, including the new streaming test.

- [ ] **Step 5: Run server route tests**

```bash
cd nextjs && npx vitest run src/app/api/__tests__/chat.test.ts
```
Expected: All tests pass.
