# Qwen3-0.6B-ONNX Browser LLM Switch

**Date**: 2026-07-03
**Status**: Complete

## What

Switched the browser AI model from `HuggingFaceTB/SmolLM2-360M-Instruct` to
`onnx-community/Qwen3-0.6B-ONNX` as the default Transformers.js model.

## Why Qwen3-0.6B-ONNX?

| Model | Params | Downloads/mo | Likes | ChatML Native | Verdict |
|-------|--------|-------------|-------|---------------|---------|
| **Qwen3-0.6B-ONNX** | 0.6B | 2,600 | 39 | ✅ Yes | ✅ **Winner** |
| SmolLM2-360M-Instruct | 360M | — | — | ✅ Yes | Replaced (smaller) |
| LaMini-Flan-T5-783M | 783M | — | — | ❌ No (encoder-decoder) | Removed (wrong arch) |
| Phi-3.5-mini-instruct | 3.8B | 336 | 15 | ❌ Custom format | Rejected (larger, custom format) |
| whisper-large-v3-ONNX | — | 153 | 10 | ❌ Speech model | Rejected (wrong task) |

Qwen3 is:
- A causal LM (same pipeline as SmolLM2 — no pipeline changes needed)
- ChatML native (`<|im_start|>` format — same prompt format already in use)
- ~1GB download (vs ~800MB for SmolLM2, but better quality)
- Apr 2026 release — newer architecture
- Strong multilingual capabilities (important for our 9-language app)

## Files Changed

1. `nextjs/src/workers/chat.worker.ts` — DEFAULT_MODEL → `onnx-community/Qwen3-0.6B-ONNX`
2. `nextjs/src/lib/types.ts` — BROWSER_MODELS: Qwen3 added as first entry, LaMini-Flan-T5 removed
3. `nextjs/src/lib/types.ts` — DEFAULT_CHAT_SETTINGS.browserModel updated

## Turbopack Crash Fix (Windows)

**Root Cause**: `@plugin "@tailwindcss/typography"` in `globals.css` combined with
`@tailwindcss/typography@0.5.20` (a Tailwind v3 plugin) running under Turbopack on Windows
caused a path resolution bug where a file path becomes literal `NUL` (Windows reserved device name).

Crash error:
```
reading file "E:\...\nextjs\NUL"
Incorrect function. (os error 1)
```

**Fix**: Removed `@plugin "@tailwindcss/typography"` from `globals.css` and removed the
`@tailwindcss/typography` dependency. The `prose` class is not used anywhere in the codebase.
Workaround for Windows: `npm run dev -- --no-turbopack` also works.

## Search Performance Issue

**Problem**: The `search/page.tsx` `useEffect` had `language` in its dependency array.
Since `language` from `useLanguage()` is always `"en"` (hardcoded constant), this caused
a duplicate fetch on every render cycle due to reference instability.

**Fix**: Removed `language` from the useEffect dependency array since it never changes.

## Memory

- Qwen3-0.6B-ONNX is a causal LM — the existing `pipeline("text-generation", ...)` call
  and `gen(prompt, { max_new_tokens, temperature, do_sample })` pattern work unchanged.
- SmolLM2-360M-Instruct kept in BROWSER_MODELS as a lightweight fallback for low-memory devices.
- LaMini-Flan-T5-783M removed — encoder-decoder architecture incompatible with ChatML format.
