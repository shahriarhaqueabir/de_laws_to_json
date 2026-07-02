# Sprint 6: Search Quality + Browser AI + Full-Text Search

> **For agentic workers:** This plan is organized as a Kanban sprint. Execute tasks sequentially within each workstream. Workstreams C and D are independent of A and B and can be parallelized.

**Goal:** Fix Browser AI WASM loading, improve Qdrant search with hybrid BM25 + evaluation benchmark, and ship full-text search migration to users.

**Architecture:** Three workstreams — (A) Browser AI web worker wiring, (B) Qdrant hybrid search + evaluation, (C) Full-text search norms table. Preceded by (D) evaluation benchmark from GerLayQA to measure B quantitatively.

**Tech Stack:** Next.js 16, TypeScript, Qdrant, PostgreSQL (Supabase), Transformers.js, Python (eval)

---

## Kanban Board

### ── Sprint Backlog (13 items, 3 workstreams) ──

#### Workstream D: Evaluation Benchmark (pre-requisite for B — measure before/after)

| Card | Task | Est. | Deps |
|------|------|------|------|
| D1 | Write eval script using GerLayQA dataset | 2h | — |
| D2 | Run baseline eval against current Qdrant E5-small | 1h | D1 |

#### Workstream A: Browser AI WASM Fix

| Card | Task | Est. | Deps |
|------|------|------|------|
| A1 | Wire browser mode to web worker in chat-context | 2h | — |
| A2 | Add WASM loading fallback path in worker | 1.5h | A1 |
| A3 | Relax COOP/COEP + verify CSP with browser smoke test | 1h | A1 |

#### Workstream B: Hybrid BM25 Search

| Card | Task | Est. | Deps |
|------|------|------|------|
| B1 | Re-index Qdrant with sparse BM25 vectors | 3h | D1, D2 |
| B2 | Update searchNorms() for hybrid dense+sparse query | 2h | B1 |
| B3 | Tune hybrid alpha parameter + run eval comparison | 1.5h | B2, D2 |

#### Workstream C: Full-Text Search Migration

| Card | Task | Est. | Deps |
|------|------|------|------|
| C1 | Create norms Postgres table + migration | 2h | — |
| C2 | Backfill norms from Qdrant scroll | 1.5h | C1 |
| C3 | Add full-text fallback in search API route | 1.5h | C2 |
| C4 | End-to-end verification | 1h | C3 |

---

### ── Sprint Board ──

| Backlog (13) | In Progress (max 3) | Review | Done |
|---|---|---|---|
| D1, D2, A1, A2, A3, B1, B2, B3, C1, C2, C3, C4 | — | — | — |

---

## Task Details

---

### Card D1: Write evaluation script using GerLayQA dataset

**Files:**
- Create: `scripts/evaluate_search.py`
- Create: `scripts/eval_requirements.txt`

**Context:** The GerLayQA dataset (from `trusthlt/eacl24-german-legal-questions`) contains layperson questions about BGB with annotated relevant paragraph IDs. We'll use `bgb_eval.json` to measure our search Recall@k and MRR. This gives us a quantitative baseline before and after Workstream B.

**Acceptance Criteria:**
- Script loads `bgb_eval.json` and runs our Qdrant search (`searchNorms`) against each question
- Reports Recall@1, Recall@3, Recall@5, Recall@10, and MRR
- Outputs JSON results file for diff comparison
- Gracefully handles missing Qdrant config (reports "not configured" instead of crashing)

**Implementation:**

- [ ] **Step 1: Create the eval script**

```python
#!/usr/bin/env python3
"""Evaluate Qdrant search quality against the GerLayQA benchmark.

Usage:
    python scripts/evaluate_search.py [--qdrant-url URL] [--qdrant-key KEY]

Requires:
    QDRANT_URL, QDRANT_API_KEY env vars (or --qdrant-url, --qdrant-key)

Output:
    Prints metrics table + saves results/qdrant_eval_results.json
"""

import json
import os
import sys
import time
import argparse
from pathlib import Path

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Filter, FieldCondition, MatchValue
except ImportError:
    print("ERROR: qdrant_client not installed. Run: pip install qdrant-client")
    sys.exit(1)

COLLECTION = "german_norms"
INFERENCE_MODEL = "intfloat/multilingual-e5-small"
METRICS_FILE = Path(__file__).parent.parent / "docs" / "eval_results.json"


def load_benchmark() -> dict:
    """Load the GerLayQA bgb_eval.json."""
    path = Path(__file__).parent / "bgb_eval.json"
    if not path.exists():
        # Fallback: look relative to project root
        alt = Path(__file__).parent.parent / "data" / "bgb_eval.json"
        if alt.exists():
            path = alt
        else:
            print(f"ERROR: bgb_eval.json not found at {path} or {alt}")
            sys.exit(1)

    with open(path) as f:
        return json.load(f)


def normalize_norm_id(norm_id: str) -> str:
    """Normalize norm IDs to match Qdrant payload format.

    GerLayQA uses e.g. "433" for § 433 BGB.
    Qdrant payload uses "norm_id" like "433" or "433_1".
    """
    return norm_id.strip().lstrip("§").strip()


def search_qdrant(client: QdrantClient, query: str, top_k: int = 50) -> list[dict]:
    """Run a Qdrant search matching our searchNorms() logic."""
    prefixed = f"query: {query}"
    try:
        results = client.query(
            COLLECTION,
            query={"text": prefixed, "model": INFERENCE_MODEL},
            limit=top_k,
            with_payload=True,
        )
        return [
            {
                "norm_id": (r.payload or {}).get("norm_id", ""),
                "law_key": (r.payload or {}).get("law_key", ""),
                "score": r.score or 0,
            }
            for r in results.points
            if r.payload
        ]
    except Exception as e:
        print(f"  [ERROR] Qdrant search failed: {e}")
        return []


def compute_metrics(
    results: list[dict], relevant_ids: set[str]
) -> dict:
    """Compute Recall@k and MRR."""
    # Extract norm_ids in rank order
    ranked = [r["norm_id"] for r in results]

    recall_at = {}
    for k in [1, 3, 5, 10]:
        if len(ranked) == 0:
            recall_at[k] = 0.0
        else:
            hits = sum(1 for n in ranked[:k] if n in relevant_ids)
            recall_at[k] = hits / max(len(relevant_ids), 1)

    # MRR
    mrr = 0.0
    for i, nid in enumerate(ranked):
        if nid in relevant_ids:
            mrr = 1.0 / (i + 1)
            break

    return {"recall": recall_at, "mrr": mrr, "total_relevant": len(relevant_ids)}


def main():
    parser = argparse.ArgumentParser(description="Evaluate Qdrant search on GerLayQA")
    parser.add_argument("--qdrant-url", default=os.environ.get("QDRANT_URL", ""))
    parser.add_argument("--qdrant-key", default=os.environ.get("QDRANT_API_KEY", ""))
    parser.add_argument("--output", default=str(METRICS_FILE))
    args = parser.parse_args()

    if not args.qdrant_url or not args.qdrant_key:
        print("ERROR: QDRANT_URL and QDRANT_API_KEY required")
        sys.exit(1)

    client = QdrantClient(url=args.qdrant_url, api_key=args.qdrant_key)

    # Verify collection exists
    collections = client.get_collections()
    if COLLECTION not in [c.name for c in collections.collections]:
        print(f"ERROR: Collection '{COLLECTION}' not found")
        sys.exit(1)

    print(f"Loading benchmark data...")
    data = load_benchmark()
    print(f"Loaded {len(data)} evaluation questions\n")

    all_recall = {1: [], 3: [], 5: [], 10: []}
    all_mrr = []
    per_query = []

    for i, item in enumerate(data):
        question = item.get("question", "")
        relevant = item.get("relevant_paragraphs", [])

        if isinstance(relevant, list):
            relevant_ids = {normalize_norm_id(r) for r in relevant}
        elif isinstance(relevant, str):
            relevant_ids = {normalize_norm_id(relevant)}
        else:
            relevant_ids = set()

        if not question or not relevant_ids:
            continue

        print(f"  [{i+1}/{len(data)}] Q: {question[:60]}...")

        start = time.time()
        results = search_qdrant(client, question)
        elapsed = time.time() - start

        metrics = compute_metrics(results, relevant_ids)
        all_mrr.append(metrics["mrr"])
        for k in [1, 3, 5, 10]:
            all_recall[k].append(metrics["recall"][k])

        per_query.append({
            "question": question,
            "relevant": list(relevant_ids),
            "top_norm_ids": [r["norm_id"] for r in results[:10]],
            "metrics": metrics,
            "elapsed_s": round(elapsed, 2),
        })

        print(f"         MRR={metrics['mrr']:.3f} "
              f"R@1={metrics['recall'][1]:.3f} "
              f"R@5={metrics['recall'][5]:.3f} "
              f"R@10={metrics['recall'][10]:.3f} "
              f"({elapsed:.1f}s)")

    # Aggregate
    avg_recall = {k: sum(v) / max(len(v), 1) for k, v in all_recall.items()}
    avg_mrr = sum(all_mrr) / max(len(all_mrr), 1)

    print(f"\n{'='*50}")
    print(f"RESULTS (E5-small, {len(all_mrr)} queries)")
    print(f"{'='*50}")
    print(f"  MRR       = {avg_mrr:.4f}")
    for k in [1, 3, 5, 10]:
        print(f"  Recall@{k} = {avg_recall[k]:.4f}")
    print(f"{'='*50}\n")

    # Save results
    report = {
        "model": INFERENCE_MODEL,
        "date": time.strftime("%Y-%m-%d"),
        "num_queries": len(all_mrr),
        "avg_mrr": round(avg_mrr, 4),
        "avg_recall": {str(k): round(v, 4) for k, v in avg_recall.items()},
        "per_query": per_query,
    }
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Results saved to {args.output}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create requirements file**

```
scripts/eval_requirements.txt:
qdrant-client>=1.12,<2.0
```

Save to `scripts/eval_requirements.txt`

---

### Card D2: Run baseline eval against current Qdrant

- [ ] **Step 1: Download GerLayQA dataset**

```bash
# From project root
curl -L -o data/bgb_eval.json https://raw.githubusercontent.com/trusthlt/eacl24-german-legal-questions/main/data/bgb_eval.json
mkdir -p data
```

- [ ] **Step 2: Install deps and run**

```bash
pip install -r scripts/eval_requirements.txt
python scripts/evaluate_search.py
```

Expected: Prints metrics table for E5-small baseline. Save results to `docs/eval_results.json`.

- [ ] **Step 3: Commit baseline**

```bash
git add data/bgb_eval.json docs/eval_results.json scripts/evaluate_search.py scripts/eval_requirements.txt
git commit -m "bench: add GerLayQA eval baseline for E5-small search"
```

---

### Card A1: Wire browser mode to web worker

**Files:**
- Modify: `nextjs/src/components/chat-context.tsx`
- Create: `nextjs/src/hooks/useBrowserAI.ts`

**Context:** The `browser` chat mode is defined in `types.ts` but has no UI-to-worker bridge. The web worker (`chat.worker.ts`) exists but is never instantiated. We need a hook that manages the worker lifecycle, sends prompts, and returns responses.

**Acceptance Criteria:**
- `useBrowserAI` hook creates and manages a `Worker` instance for `chat.worker.ts`
- Exposes: `{ generate, isReady, isGenerating, error, progress }`
- Handles worker lifecycle (terminate on unmount)
- Integrates with `ChatContext` so `mode === "browser"` routes through it

**Implementation:**

- [ ] **Step 1: Write the failing test**

Create `nextjs/src/hooks/__tests__/useBrowserAI.test.ts`:

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBrowserAI } from "../useBrowserAI";

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

describe("useBrowserAI", () => {
  let mockWorker: MockWorker;

  beforeEach(() => {
    mockWorker = new MockWorker();
    vi.spyOn(window, "Worker").mockImplementation(() => mockWorker as unknown as Worker);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a worker on mount", () => {
    const { result } = renderHook(() => useBrowserAI());
    expect(window.Worker).toHaveBeenCalledWith(
      expect.stringContaining("chat.worker")
    );
    expect(result.current.isReady).toBe(false);
  });

  it("sets isReady when worker sends ready status", async () => {
    const { result } = renderHook(() => useBrowserAI());

    act(() => {
      mockWorker.onmessage?.({ data: { status: "ready" } } as MessageEvent);
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.isGenerating).toBe(false);
  });

  it("sets isGenerating during generation", async () => {
    const { result } = renderHook(() => useBrowserAI());

    expect(result.current.isGenerating).toBe(false);

    act(() => {
      result.current.generate("test prompt");
    });

    expect(result.current.isGenerating).toBe(true);
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "test prompt" })
    );
  });

  it("returns generated text on completion", async () => {
    const { result } = renderHook(() => useBrowserAI());

    act(() => {
      result.current.generate("test");
    });

    act(() => {
      mockWorker.onmessage?.({ data: { status: "complete", output: "response text" } } as MessageEvent);
    });

    expect(result.current.isGenerating).toBe(false);
    expect(result.current.response).toBe("response text");
  });

  it("sets error on worker error", async () => {
    const { result } = renderHook(() => useBrowserAI());

    act(() => {
      mockWorker.onmessage?.({ data: { status: "error", error: "Model load failed" } } as MessageEvent);
    });

    expect(result.current.error).toBe("Model load failed");
    expect(result.current.isGenerating).toBe(false);
  });

  it("terminates worker on unmount", () => {
    const { unmount } = renderHook(() => useBrowserAI());
    unmount();
    expect(mockWorker.terminate).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd nextjs && npx vitest run src/hooks/__tests__/useBrowserAI.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the hook**

Create `nextjs/src/hooks/useBrowserAI.ts`:

```typescript
"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseBrowserAIReturn {
  generate: (prompt: string) => void;
  isReady: boolean;
  isGenerating: boolean;
  response: string;
  error: string | null;
  progress: number;
}

export function useBrowserAI(): UseBrowserAIReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../workers/chat.worker.ts", import.meta.url)
    );

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { status, output, error: workerError, ...rest } = event.data;

      switch (status) {
        case "ready":
          setIsReady(true);
          setIsGenerating(false);
          break;
        case "progress":
          setProgress(rest.progress || 0);
          break;
        case "complete":
          setResponse(output || "");
          setIsGenerating(false);
          setProgress(1);
          break;
        case "error":
          setError(workerError || "Unknown worker error");
          setIsGenerating(false);
          break;
      }
    };

    workerRef.current.onerror = (err: ErrorEvent) => {
      setError(err.message || "Worker error");
      setIsGenerating(false);
    };

    // Send init signal
    workerRef.current.postMessage({ prompt: "INIT_ONLY", id: "init" });

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const generate = useCallback((prompt: string) => {
    if (!workerRef.current) {
      setError("Worker not initialized");
      return;
    }
    setError(null);
    setResponse("");
    setIsGenerating(true);
    setProgress(0);
    workerRef.current.postMessage({ prompt, id: Date.now().toString() });
  }, []);

  return { generate, isReady, isGenerating, response, error, progress };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd nextjs && npx vitest run src/hooks/__tests__/useBrowserAI.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate with ChatContext**

Modify `nextjs/src/components/chat-context.tsx`:

When `mode === "browser"`, route user messages through `useBrowserAI().generate` instead of the current basic/cloud/local paths.

Find the section where `handleSend` or the chat submission logic lives and add a `case "browser":` branch.

See the chat-context file — look for the send/submit function:

```typescript
// Inside the chat submit handler, add this branch:
if (settings.mode === "browser") {
  const { generate, isReady, response, error } = useBrowserAI();
  if (!isReady) {
    // Show loading state — model still downloading
    return { type: "status", message: "Browser AI model is loading..." };
  }
  generate(formattedPrompt);
  // The response will be set asynchronously via state
  return response;
}
```

(Note: This is a sketch — the actual integration point depends on how chat-context currently handles message submission. Inspect the file and add the browser branch matching the existing pattern.)

- [ ] **Step 6: Verify existing tests still pass**

```bash
cd nextjs && npm test
```

Expected: All existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add nextjs/src/hooks/useBrowserAI.ts nextjs/src/hooks/__tests__/useBrowserAI.test.ts nextjs/src/components/chat-context.tsx
git commit -m "feat: wire browser AI mode to web worker via useBrowserAI hook"
```

---

### Card A2: Add WASM loading fallback in worker

**Files:**
- Modify: `nextjs/src/workers/chat.worker.ts`

**Context:** Transformers.js downloads WASM binaries from HuggingFace CDN, but CSP blocks them. We need to configure a fallback WASM path and add error handling.

**Acceptance Criteria:**
- Worker sets `env.backends.onnx.wasm.wasmPaths` to a CDN URL that CSP allows
- Worker catches WASM loading errors and reports them via `postMessage({ status: "error", ... })`
- No CSP violations in browser console when worker loads

**Implementation:**

- [ ] **Step 1: Update the worker with WASM fallback**

Modify `nextjs/src/workers/chat.worker.ts`:

```typescript
import { pipeline, env } from "@huggingface/transformers";

// Configure WASM paths for CSP compatibility
// The 'wasm-unsafe-eval' CSP directive allows WASM from trusted CDNs
env.allowLocalModels = false;

// Try multiple CDN sources for WASM binaries
// HuggingFace CDN is preferred; unpkg is the fallback if CSP blocks it
const WASM_CDNS = [
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest/dist/",
  "https://unpkg.com/@huggingface/transformers@latest/dist/",
];

// Set wasmPaths early, before any pipeline() call
// This must happen synchronously before the first pipeline() call
env.backends = {
  onnx: {
    wasm: {
      wasmPaths: WASM_CDNS[0],
      // Number of threads (0 = auto, 1 = single-threaded for WASM compat)
      numThreads: 1,
    },
  },
};
```

The rest of the worker stays the same.

- [ ] **Step 2: Run existing worker tests (if any)**

```bash
cd nextjs && npm test
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add nextjs/src/workers/chat.worker.ts
git commit -m "fix: add WASM loading fallback paths in browser AI worker"
```

---

### Card A3: Relax COOP/COEP + verify CSP

**Files:**
- Modify: `nextjs/next.config.ts`

**Context:** The `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` headers force cross-origin isolation, which blocks WASM SharedArrayBuffer usage. Since we don't use SharedArrayBuffer, we can remove or relax these.

**Acceptance Criteria:**
- COOP/COEP headers removed from next.config.ts
- CSP still blocks untrusted sources
- WASM loads on Vercel deployment

**Implementation:**

- [ ] **Step 1: Remove COOP/COEP headers**

In `nextjs/next.config.ts`, remove the two header blocks:

```typescript
// REMOVE these two blocks from async headers():
{
  key: "Cross-Origin-Opener-Policy",
  value: "same-origin",
},
{
  key: "Cross-Origin-Embedder-Policy",
  value: "credentialless",
},
```

The CSP `worker-src` and `'wasm-unsafe-eval'` entries already cover WASM loading from trusted CDNs.

- [ ] **Step 2: Verify with type check**

```bash
cd nextjs && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add nextjs/next.config.ts
git commit -m "fix: relax COOP/COEP to allow WASM loading in browser AI mode"
```

---

### Card B1: Re-index Qdrant with sparse BM25 vectors

**Files:**
- Modify: `scripts/reindex_qdrant.py`

**Context:** Qdrant supports hybrid search by combining dense vectors (E5-small, 384d) with sparse vectors (BM25). The current collection has only dense vectors. We need to add a sparse vector index to the collection and re-index with both.

**Acceptance Criteria:**
- Qdrant collection `german_norms` has a sparse vector config named `bm25`
- Re-index script uploads both dense + sparse vectors per point
- Existing dense vectors are preserved (we upsert, not recreate)

**Implementation:**

- [ ] **Step 1: Update the collection schema**

Create `scripts/add_sparse_index.py`:

```python
#!/usr/bin/env python3
"""Add sparse vector index to the german_norms Qdrant collection.

Run before reindexing to enable hybrid search support.

Usage:
    export QDRANT_URL=... QDRANT_API_KEY=...
    python scripts/add_sparse_index.py
"""

import os
from qdrant_client import QdrantClient
from qdrant_client.models import SparseVectorParams, SparseIndexParams, SparseVectorConfig

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
COLLECTION = "german_norms"

if not QDRANT_URL or not QDRANT_API_KEY:
    raise ValueError("QDRANT_URL and QDRANT_API_KEY required")

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

# Get current collection info
info = client.get_collection(COLLECTION)
print(f"Current collection: {COLLECTION}")
print(f"  Dense vectors: {info.config.params.vectors}")
print(f"  Existing sparse vectors: {info.config.params.sparse_vectors}")

# Check if sparse bm25 already exists
existing_sparse = info.config.params.sparse_vectors or {}
if "bm25" in existing_sparse:
    print("Sparse 'bm25' vector already configured. No changes needed.")
else:
    # Add sparse vector configuration
    client.update_collection(
        COLLECTION,
        sparse_vectors_config=SparseVectorConfig(
            vectors={
                "bm25": SparseVectorParams(
                    index=SparseIndexParams(
                        on_disk=False,
                    )
                )
            }
        ),
    )
    print("Added 'bm25' sparse vector configuration.")

# Verify
info = client.get_collection(COLLECTION)
print(f"\nUpdated collection sparse vectors: {info.config.params.sparse_vectors}")
```

- [ ] **Step 2: Update reindex script for hybrid vectors**

Modify `scripts/reindex_qdrant.py` to add:

In the `__main__` block, after scrolling a point and generating its dense embedding, also compute a BM25 sparse vector:

```python
# After computing the dense embedding, add BM25 sparse vector
from sklearn.feature_extraction.text import CountVectorizer
from scipy.sparse import csr_array
import numpy as np

def compute_bm25_vector(text: str, vocabulary: dict[str, int] | None = None):
    """Compute a simple BM25-like sparse vector from text."""
    # Tokenize and count
    import re
    from collections import Counter
    tokens = re.findall(r'\w+', text.lower())
    counts = Counter(tokens)
    
    # Build sparse indices
    indices = []
    values = []
    for token, count in counts.items():
        if vocabulary and token in vocabulary:
            indices.append(vocabulary[token])
            values.append(count)
    
    return {"indices": indices, "values": values}
```

And when upserting points, include both vector types:

```python
points = []
for item in batch:
    dense_vector = model.encode(texts)  # existing
    sparse_vector = compute_bm25_vector(combined_text)
    
    points.append(PointStruct(
        id=item["id"],
        vector={
            "": dense_vector.tolist(),  # default dense (E5-small)
            "bm25": sparse_vector,      # sparse (BM25)
        },
        payload=item["payload"],
    ))
```

- [ ] **Step 3: Run the sparse index setup**

```bash
pip install scikit-learn scipy
python scripts/add_sparse_index.py
```

- [ ] **Step 4: Run the re-index**

```bash
python scripts/reindex_qdrant.py
```

Expected: All 103,586 points re-indexed with both dense + sparse vectors.

- [ ] **Step 5: Verify collection**

```bash
python scripts/verify_collection.py
# (one-off script to check a sample point has both vector types)
```

- [ ] **Step 6: Commit**

```bash
git add scripts/add_sparse_index.py scripts/reindex_qdrant.py
git commit -m "feat: add BM25 sparse vectors to Qdrant for hybrid search"
```

---

### Card B2: Update searchNorms() for hybrid query

**Files:**
- Modify: `nextjs/src/lib/qdrant.ts`

**Context:** Update `searchNorms()` to use Qdrant's hybrid search API — combine dense (E5-small) and sparse (BM25) queries with prefetch + weights.

**Acceptance Criteria:**
- `searchNorms()` sends both a dense text query (E5-small) and a sparse text query (BM25)
- Results are merged via Qdrant's `prefetch` with configurable weights
- If Qdrant client version doesn't support hybrid, falls back to dense-only

**Implementation:**

- [ ] **Step 1: Update the searchNorms function**

In `nextjs/src/lib/qdrant.ts`, replace the `client.query()` call:

```typescript
// Replace the single client.query() call with hybrid dense+sparse

// ── Hybrid Search: Dense (E5-small) + Sparse (BM25) ──
// Qdrant prefetch API merges results from multiple queries with weights.
// Dense captures semantics, sparse captures keyword precision.
const HYBRID_ALPHA = 0.7; // Weight toward dense (0.7) vs sparse (0.3)
// TODO: Tune this after running eval — see Card B3

try {
  const results = await client.query(COLLECTION, {
    query: {
      text: prefixedQuery,
      model: INFERENCE_MODEL,
    },
    prefetch: [
      {
        query: {
          text: prefixedQuery,
          model: INFERENCE_MODEL,
        },
        limit: topK * 2,
        filter: queryFilter,
      },
      {
        query: {
          text: expandedQuery, // BM25 works better without "query:" prefix
          sparse: "bm25",
        } as any, // sparse query
        limit: topK * 2,
        filter: queryFilter,
      },
    ],
    // prefetch with weights auto-merge — dense gets HYBRID_ALPHA weight
    // The combined results are re-ranked by Qdrant
    limit: topK,
    with_payload: true,
  });

  console.log(
    `[Qdrant lib] Hybrid search success. Points: ${results.points.length}`,
  );
```

Note: The exact API may differ slightly depending on Qdrant client version. If `prefetch` with sparse is not available, we fall back to the existing dense-only call.

- [ ] **Step 2: Run tests**

```bash
cd nextjs && npm test
```

Expected: All tests pass (search returns may differ but structure should be the same).

- [ ] **Step 3: Commit**

```bash
git add nextjs/src/lib/qdrant.ts
git commit -m "feat: hybrid dense+sparse search with BM25"
```

---

### Card B3: Tune hybrid alpha + run eval comparison

**Files:**
- Modify: `scripts/evaluate_search.py` (or copy for hybrid)
- Run comparison against D1/D2 baseline

**Acceptance Criteria:**
- Run eval with alpha = [0.5, 0.6, 0.7, 0.8, 0.9]
- Compare Recall@k and MRR against baseline (E5-small only)
- Document the winning alpha value

**Implementation:**

- [ ] **Step 1: Create hybrid eval variant**

Copy `scripts/evaluate_search.py` to `scripts/evaluate_search_hybrid.py` and update to use the hybrid query (same as B2).

- [ ] **Step 2: Run sweep**

```bash
for ALPHA in 0.5 0.6 0.7 0.8 0.9; do
  python scripts/evaluate_search_hybrid.py --alpha $ALPHA
done
```

- [ ] **Step 3: Report results**

Compare the `docs/eval_results.json` files. Update `docs/retrospective.md` with the comparison table:

```
| Model | MRR | R@1 | R@5 | R@10 |
|-------|-----|-----|-----|------|
| E5-small only | 0.XXXX | 0.XXXX | 0.XXXX | 0.XXXX |
| Hybrid α=0.7   | 0.XXXX | 0.XXXX | 0.XXXX | 0.XXXX |
```

- [ ] **Step 4: Update the alpha constant in qdrant.ts**

Set `HYBRID_ALPHA` to the best-performing value.

- [ ] **Step 5: Commit**

```bash
git add scripts/evaluate_search_hybrid.py docs/eval_results.json
git commit -m "bench: tune hybrid search alpha, document Results in retrospective"
```

---

### Card C1: Create norms Postgres table + migration

**Files:**
- Create: `supabase/migrations/00012_norms_table.sql`
- Create: `scripts/backfill_norms.py`

**Context:** Currently norms live only in Qdrant. To support PostgreSQL full-text search on norm content, we need a `norms` Postgres table with a `tsvector` column covering `norm_id`, `law_key`, `title`, and `content`.

**Acceptance Criteria:**
- `norms` table created in Supabase with columns: `id` (UUID PK), `norm_id` (text), `law_key` (text FK → laws.key), `title` (text), `content` (text), `category` (text), `search_vector` (tsvector, generated)
- GIN index on `search_vector`
- RLS: public read (same as laws)
- Migration 00012 is idempotent

**Implementation:**

- [ ] **Step 1: Write the migration**

```sql
-- Migration 00012: Create norms table with full-text search vector
-- Mirrors the norm data from Qdrant in PostgreSQL for full-text search fallback.

create table if not exists public.norms (
  id uuid primary key default gen_random_uuid(),
  norm_id text not null,
  law_key text not null references public.laws ("key") on delete cascade,
  title text not null default '',
  content text not null default '',
  category text not null default 'other',
  search_vector tsvector
    generated always as (
      to_tsvector('german',
        coalesce(norm_id, '') || ' ' ||
        coalesce(title, '') || ' ' ||
        coalesce(content, '')
      )
    ) stored,
  created_at timestamptz not null default now(),
  unique (norm_id, law_key)
);

create index if not exists idx_norms_search_vector
  on public.norms using gin (search_vector);

create index if not exists idx_norms_law_key
  on public.norms (law_key);

create index if not exists idx_norms_category
  on public.norms (category);

-- RLS: norms are public read-only
alter table public.norms enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'norms'
      and policyname = 'norms are public read'
  ) then
    create policy "norms are public read"
      on public.norms
      for select
      using (true);
  end if;
end
$$;
```

Save to `supabase/migrations/00012_norms_table.sql`.

- [ ] **Step 2: Apply migration**

Since `execute_sql` is unavailable on this machine (per retrospective), document the SQL for manual application via Supabase Dashboard → SQL Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00012_norms_table.sql
git commit -m "feat: add norms table with full-text search vector migration"
```

---

### Card C2: Backfill norms from Qdrant scroll

**Files:**
- Create: `scripts/backfill_norms.py`

**Context:** Backfill the `norms` Postgres table by scrolling all points from Qdrant and inserting them.

**Acceptance Criteria:**
- Script scrolls all 103,586 Qdrant points
- Inserts into Supabase `norms` table in batches of 100
- Idempotent (upserts on conflict (norm_id, law_key))
- Reports progress

**Implementation:**

- [ ] **Step 1: Write the backfill script**

```python
#!/usr/bin/env python3
"""Backfill norms table from Qdrant to Supabase.

Usage:
    export QDRANT_URL=... QDRANT_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=...
    python scripts/backfill_norms.py
"""

import os
import sys
import time
from qdrant_client import QdrantClient
import requests

QDRANT_URL = os.environ.get("QDRANT_URL", "")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
COLLECTION = "german_norms"
BATCH_SIZE = 100

def main():
    if not all([QDRANT_URL, QDRANT_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
        print("ERROR: QDRANT_URL, QDRANT_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY required")
        sys.exit(1)

    qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # Scroll all points
    total = 0
    next_offset = None
    batch = []

    print("Scrolling Qdrant collection...")
    while True:
        results = qdrant.scroll(
            COLLECTION,
            limit=BATCH_SIZE,
            offset=next_offset,
            with_payload=True,
        )
        points, next_offset = results

        if not points:
            break

        for p in points:
            payload = p.payload or {}
            batch.append({
                "norm_id": payload.get("norm_id", ""),
                "law_key": payload.get("law_key", ""),
                "title": payload.get("norm_title", ""),
                "content": payload.get("content", ""),
                "category": payload.get("category", "other"),
            })

        if len(batch) >= 100:
            count = upsert_batch(headers, batch)
            total += count
            print(f"  Inserted {total} norms...")
            batch = []

    if batch:
        count = upsert_batch(headers, batch)
        total += count

    print(f"\nDone. Backfilled {total} norms.")


def upsert_batch(headers: dict, batch: list[dict]) -> int:
    """Insert batch into Supabase norms table."""
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/norms",
        json=batch,
        headers=headers,
    )
    if resp.status_code not in (200, 201):
        print(f"  WARNING: Upsert returned {resp.status_code}: {resp.text[:200]}")
    return len(batch)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the backfill**

```bash
pip install requests
python scripts/backfill_norms.py
```

Expected: Scrolls 103,586 points, inserts into Supabase norms table.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill_norms.py
git commit -m "feat: add norms backfill script from Qdrant to Supabase"
```

---

### Card C3: Add full-text fallback in search API route

**Files:**
- Modify: `nextjs/src/app/api/search/route.ts`

**Context:** The current search route queries Qdrant first, then does a limited full-text search on the `laws` table (metadata only). We should add a full-text fallback on the new `norms` table that runs when Qdrant returns < 5 results.

**Acceptance Criteria:**
- After Qdrant search, if results < 5, query `norms` table via `textSearch("search_vector", ...)`
- Full-text results are merged into the response with score 0.7 (below Qdrant, above fallback)
- The existing `laws` full-text search remains as law-level metadata supplement

**Implementation:**

- [ ] **Step 1: Add norms full-text fallback**

In `nextjs/src/app/api/search/route.ts`, after the Qdrant results are collected and before the fallback `ilike` search, add:

```typescript
// ── Norms Full-Text Fallback (when Qdrant returns < 5 results) ──
if (allResults.filter(r => r.norm_id).length < 5 && searchQuery.trim().length > 0) {
  try {
    const normsFTS = await (supabase
      .from("norms")
      .select("norm_id, law_key, title, content, category")
      .textSearch("search_vector", searchQuery, {
        type: "websearch",
        config: "german",
      })
      .limit(10) as unknown as Promise<{
      data: Array<{ norm_id: string; law_key: string; title: string; content: string; category: string }> | null;
      error: any;
    }>);

    if (normsFTS.data && normsFTS.data.length > 0) {
      console.log(
        `[API Search] Norms full-text returned ${normsFTS.data.length} results.`,
      );
      const ftsResults: SearchResult[] = normsFTS.data.map((n) => ({
        law_key: n.law_key,
        law_title: "",
        category: n.category,
        norm_id: n.norm_id,
        norm_title: n.title,
        content: n.content.slice(0, 300),
        score: 0.7, // Below Qdrant (0.5-0.95) but above ilike fallback (0.5)
      }));
      allResults.push(...ftsResults);
    }
  } catch (normsErr) {
    console.warn(`[API Search] Norms full-text search unavailable — skipping.`, normsErr);
  }
}
```

- [ ] **Step 2: Verify with type check**

```bash
cd nextjs && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run tests**

```bash
cd nextjs && npm test
```

Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add nextjs/src/app/api/search/route.ts
git commit -m "feat: add norms full-text search fallback in search API"
```

---

### Card C4: End-to-end verification

- [ ] **Step 1: Run all tests**

```bash
cd nextjs && npm test
```

Expected: All 477+ tests pass.

- [ ] **Step 2: Type check**

```bash
cd nextjs && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Lint**

```bash
cd nextjs && npm run lint
```

Expected: No lint errors.

- [ ] **Step 4: Run eval comparison**

```bash
python scripts/evaluate_search.py
```

Expected: Metrics should match or exceed baseline.

- [ ] **Step 5: Document results**

Update `docs/retrospective.md` (or a new `docs/sprint-6-results.md`) with:

```
## Sprint 6 Results

| Metric | Before (E5-small) | After (Hybrid α=X) | Change |
|--------|-------------------|-------------------|--------|
| MRR    | 0.XXXX            | 0.XXXX            | +XX%   |
| R@1    | 0.XXXX            | 0.XXXX            | +XX%   |
| R@5    | 0.XXXX            | 0.XXXX            | +XX%   |
| R@10   | 0.XXXX            | 0.XXXX            | +XX%   |

Browser AI: [Working / Partial / Blocked]
Full-text search migration: [Applied / Pending]
```

---

## Definition of Done

- [ ] 477+ tests passing
- [ ] TypeScript strict mode — `npx tsc --noEmit` clean
- [ ] ESLint — `npm run lint` clean
- [ ] Eval benchmark shows improvement or no regression
- [ ] All 3 workstreams verified
- [ ] This plan document marked complete
