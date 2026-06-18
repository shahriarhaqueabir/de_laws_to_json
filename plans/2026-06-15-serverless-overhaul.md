# German Law Vault — Serverless Overhaul Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild German Law Vault from a monolithic Flask/Ollama/SQLite app into a serverless architecture with Vercel (Next.js), Qdrant Cloud (managed E5-small vector search), and Supabase (DB, Auth).

**Architecture:** The new system has four layers: (1) a Next.js frontend on Vercel with client-side AI via Transformers.js, (2) Supabase for law metadata, auth, and conversation persistence, (3) Qdrant Cloud with managed `intfloat/multilingual-e5-small` embeddings for semantic paragraph search, and (4) an optional local FastAPI broker that proxies chat requests to Ollama for AI-powered legal guidance. The app works fully without the local broker — search, browse, translate all via cloud + browser AI.

**Tech Stack:** Next.js 16+ (App Router), TypeScript, Supabase (Postgres + Auth via `@supabase/ssr`), Qdrant Cloud (managed E5-small inference via `@qdrant/js-client-rest`), Transformers.js (`@huggingface/transformers` browser AI via Web Worker), FastAPI + Pydantic (local broker), Ollama (local LLM).

## Execution Log

Use this section as the lightweight ticket trail for completed slices. Keep entries outcome-based and explicit about setup gaps.

| Date | Slice | Outcome | Blocked by | Do | Don't |
|---|---|---|---|---|---|
| 2026-06-17 | Laws schema honesty | Replaced the silent `/laws` fallback with an explicit `SETUP_REQUIRED` error path in the data layer, API routes, and UI state. | Supabase `public.laws` table missing in this environment. | Surface setup failures immediately and preserve browser-test truthfulness. | Don't convert missing schema into an empty-state success path. |
| 2026-06-17 | Bookmarks and detail guardrails | Added setup-aware fallbacks for the bookmarks page and law detail flow so the missing schema is visible instead of hidden. | Same missing Supabase law metadata table. | Share one setup-state component across routes. | Don't suppress table-missing errors with generic empty lists. |
| 2026-06-18 | Qdrant collection check | Added an explicit collection-existence guard so search now reports that `german_norms` does not exist instead of falling back to a generic temporary failure. | Qdrant cluster is reachable but `german_norms` is not created yet. | Check collection readiness before querying and surface a seeding/setup action. | Don't treat a missing vector collection as a transient outage. |
| 2026-06-17 | Cleanup pass | Removed generated debug artifacts from the workspace and kept the branch focused on source changes. | None. | Delete temporary logs and generated investigation dumps when they are no longer needed. | Don't leave scratch output in the repo once it has served its purpose. |

---

## Data Model

### Qdrant Collection: `german_norms`

```
vectors:     384-dim float32 (managed intfloat/multilingual-e5-small inference)
distance:    Cosine

payload:
  law_key:      str   # "BGB"
  law_title:    str   # "Bürgerliches Gesetzbuch"
  category:     str   # "housing"
  norm_id:      str   # "§ 7"
  norm_title:   str   # "Verbraucher, Unternehmer"
  content:      str   # Full paragraph text (truncated to 4096 chars)
  token_count:  int
```

### Supabase Tables

```sql
-- Law metadata (one row per law)
CREATE TABLE laws (
  key          TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  alt_title    TEXT DEFAULT '',
  category     TEXT DEFAULT 'other',
  authority    TEXT DEFAULT '',
  status       TEXT DEFAULT 'Active',
  jurisdiction TEXT DEFAULT 'Germany (Federal)',
  last_changed TEXT DEFAULT '',
  total_norms  INT  DEFAULT 0
);

-- User conversations
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  title       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Messages within conversations
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations ON DELETE CASCADE NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  cited_laws      JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Saved bookmarks
CREATE TABLE bookmarks (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  law_key TEXT NOT NULL,
  norm_id TEXT DEFAULT '',
  note    TEXT DEFAULT '',
  UNIQUE(user_id, law_key, norm_id)
);
```

### Frontend Route Map

| Route | Purpose |
|---|---|
| `/` | Search landing + category browse |
| `/search?q=...&category=...` | Search results |
| `/laws/[key]` | Law detail with norm list |
| `/laws/[key]/[normId]` | Single norm viewer |
| `/chat` | AI guidance conversation |
| `/chat/[id]` | Existing conversation |
| `/bookmarks` | User bookmarks |
| `/settings` | Preferences + broker config |

---

## Task Breakdown

### Task 1: Supabase Project Setup

**Files:**
- Create: `supabase/migrations/00001_initial_schema.sql`

- [ ] **Step 1: Create Supabase project + schema**

Create a new Supabase project (free tier). Run this migration:

```sql
-- laws metadata table
CREATE TABLE laws (
  key          TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  alt_title    TEXT DEFAULT '',
  category     TEXT DEFAULT 'other',
  authority    TEXT DEFAULT '',
  status       TEXT DEFAULT 'Active',
  jurisdiction TEXT DEFAULT 'Germany (Federal)',
  last_changed TEXT DEFAULT '',
  total_norms  INT  DEFAULT 0
);

CREATE INDEX idx_laws_category ON laws (category);

-- conversations
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  title       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- messages
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations ON DELETE CASCADE NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  cited_laws      JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- bookmarks
CREATE TABLE bookmarks (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  law_key TEXT NOT NULL,
  norm_id TEXT DEFAULT '',
  note    TEXT DEFAULT '',
  UNIQUE(user_id, law_key, norm_id)
);
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS: users see only their own data
CREATE POLICY "users own conversations"
  ON conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own messages"
  ON messages FOR ALL USING (conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  ));
CREATE POLICY "users own bookmarks"
  ON bookmarks FOR ALL USING (auth.uid() = user_id);

-- Books table is publicly readable (law metadata is non-sensitive)
CREATE POLICY "laws are public"
  ON laws FOR SELECT USING (true);
```

- [ ] **Step 2: Enable Supabase Auth (magic link)**

In Supabase dashboard: Authentication → Settings → enable "Email OTP" (magic link).
Disable email confirmations for free tier simplicity.

- [ ] **Step 3: Capture Supabase project credentials**

Get `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Supabase dashboard → Settings → API.
Save for use in Next.js environment variables.

---

### Task 2: Qdrant Cloud Setup + Collection

**Files:**
- Create: `scripts/create_qdrant_collection.py`
- Create: `scripts/seed_norms_to_qdrant.py`

- [ ] **Step 1: Create Qdrant Cloud free cluster**

Sign up at cloud.qdrant.io, create a free 1GB cluster.
Get `QDRANT_URL` and `QDRANT_API_KEY`.

- [ ] **Step 2: Create collection with managed E5-small**

Write and run:

```python
# scripts/create_qdrant_collection.py
from qdrant_client import QdrantClient, models

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

# Create collection with scalar quantization for memory efficiency
client.recreate_collection(
    collection_name="german_norms",
    vectors_config=models.VectorParams(
        size=384,
        distance=models.Distance.COSINE,
    ),
    quantization_config=models.ScalarQuantization(
        scalar=models.ScalarQuantizationConfig(
            type=models.ScalarQuantizationType.INT8,
        )
    ),
)

# Create payload indexes for filtered queries (critical for performance)
client.create_payload_index(
    collection_name="german_norms",
    field_name="law_key",
    field_schema=models.PayloadSchemaType.KEYWORD,
)
client.create_payload_index(
    collection_name="german_norms",
    field_name="category",
    field_schema=models.PayloadSchemaType.KEYWORD,
)
```

> **Note:** Managed inference (auto-embedding on upsert/query) is configured in the **Qdrant Cloud dashboard**
> when creating the collection — select "intfloat/multilingual-e5-small" as the embedding model.
> The `set_model()` API is not available in the Python SDK; embedding is handled server-side by Qdrant Cloud.
> The seeding script must pre-compute 384-dim vectors (using the `sentence-transformers` library)
> and upload them as raw vectors, or upload text and let Qdrant Cloud's inference pipeline handle it
> if configured in the dashboard.

- [ ] **Step 3: Verify collection is ready**

```bash
python -c "
from qdrant_client import QdrantClient
c = QdrantClient(url='$QDRANT_URL', api_key='$QDRANT_API_KEY')
print(c.get_collection('german_norms'))
"
```

Expected: 404 size=384, distance=Cosine, managed inference model configured.

---

### Task 3: Data Seeding — Norms to Qdrant

**Files:**
- Create: `scripts/seed_norms_to_qdrant.py`
- Create: `scripts/extract_laws_metadata.py`

- [ ] **Step 1: Write seeder script to extract from SQLite**

```python
# scripts/seed_norms_to_qdrant.py
"""
One-time script: reads from laws.db
and upserts them as points into Qdrant with managed E5-small embedding.
"""
import sqlite3, os, uuid
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from tqdm import tqdm

QDRANT_URL = os.environ["QDRANT_URL"]
QDRANT_API_KEY = os.environ["QDRANT_API_KEY"]
BATCH_SIZE = 100

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

# Wait for Qdrant inference to auto-embed when upserting text payloads
# by using the universal query API later, we can also use 'text' property in PointStruct
# but for standard points, we need to upload the payload and ensure Qdrant does the inference on upsert
# Since the user confirmed they will setup Qdrant with managed inference, we just push the payloads.

def seed_db():
    conn = sqlite3.connect("laws.db")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # We need category from the laws table. laws table might not have it or it's hardcoded
    # Let's just fetch everything
    
    cur.execute("SELECT n.law_key, l.title as law_title, n.norm_id, n.title as norm_title, n.content, l.category FROM norms n JOIN laws l ON n.law_key = l.key")
    rows = cur.fetchall()
    
    norm_points = []
    for row in rows:
        norm = dict(row)
        norm_points.append(PointStruct(
            id=str(uuid.uuid5(uuid.NAMESPACE_DNS, f"german-norm:{norm['law_key']}:{norm['norm_id']}")),
            payload={
                "law_key": norm["law_key"],
                "law_title": norm["law_title"],
                "category": norm["category"] if norm.get("category") else "other",
                "norm_id": norm["norm_id"],
                "norm_title": norm["norm_title"],
                "content": norm["content"][:4096],
            },
            # Dummy vector for now if managed inference doesn't auto-embed on empty vector, but 
            # qdrant python client requires vector unless it's configured for pure payload.
            # Actually, with managed inference, Qdrant will generate the vector if you omit it 
            # and provide the source field in the payload. We will let Qdrant handle it.
            vector={}
        ))
        
    print(f"Loaded {len(norm_points)} norms")

    # Upsert in batches
    for i in tqdm(range(0, len(norm_points), BATCH_SIZE)):
        batch = norm_points[i:i + BATCH_SIZE]
        client.upsert(collection_name="german_norms", points=batch)

if __name__ == '__main__':
    seed_db()
```

- [ ] **Step 2: Extract laws metadata for Supabase from SQLite**

```python
# scripts/extract_laws_metadata.py
"""
Reads laws table from SQLite and outputs JSONL for Supabase seeding.
"""
import sqlite3, json

OUTPUT = "laws_metadata.jsonl"

def extract():
    conn = sqlite3.connect("laws.db")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM laws")
    rows = cur.fetchall()
    
    with open(OUTPUT, "w", encoding="utf-8") as out:
        for row in rows:
            record = dict(row)
            # Ensure required fields
            record["total_norms"] = record.get("total_norms", 0)
            if "category" not in record or not record["category"]:
                record["category"] = "other"
            out.write(json.dumps(record) + "\\n")
            
if __name__ == '__main__':
    extract()
```

- [ ] **Step 3: Run seeders**

```bash
# 1. Export JSON files (if not already done — check process_de_laws.py)
# 2. Seed Qdrant
python scripts/seed_norms_to_qdrant.py

# 3. Extract + upload laws metadata to Supabase
python scripts/extract_laws_metadata.py

# Upload via Supabase CLI or dashboard SQL editor
# (import the JSONL into the laws table)
```

- [ ] **Step 4: Verify data counts**

```bash
python -c "
from qdrant_client import QdrantClient
c = QdrantClient(url='$QDRANT_URL', api_key='$QDRANT_API_KEY')
print(c.get_collection('german_norms').points_count)
"
```

Expected: ~100K norms (matches current `norms` table count).

---

### Task 4: Next.js Project Scaffold

**Files:**
- Create: `nextjs/` (new project directory at repo root)

- [x] **Step 1: Create Next.js app**

```bash
npx create-next-app@latest nextjs --typescript --tailwind --eslint --app --src-dir --no-import-alias
cd nextjs
```

- [x] **Step 2: Install dependencies**

```bash
npm install @supabase/ssr @qdrant/js-client-rest
npm install @huggingface/transformers uuid
npm install lucide-react  # icons
```

- [ ] **Step 3: Configure environment variables**

Create `nextjs/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Qdrant
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key

# Optional: Broker (local Ollama)
NEXT_PUBLIC_BROKER_URL=http://localhost:9090
```

- [x] **Step 4: Set up project structure**

```
nextjs/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with Supabase provider
│   │   ├── page.tsx            # Landing page (search + categories)
│   │   ├── search/page.tsx     # Search results
│   │   ├── laws/[key]/page.tsx # Law detail
│   │   └── chat/page.tsx       # AI chat
│   ├── components/
│   │   ├── search-bar.tsx
│   │   ├── law-card.tsx
│   │   ├── norm-viewer.tsx
│   │   ├── category-grid.tsx
│   │   ├── chat-panel.tsx
│   │   ├── translation-badge.tsx
│   │   └── auth-provider.tsx
│   ├── workers/
│   │   └── translate.worker.ts   # Web Worker (Transformers.js)
│   ├── lib/
│   │   ├── supabase.ts         # Supabase SSR client
│   │   ├── qdrant.ts           # Qdrant client (@qdrant/js-client-rest)
│   │   ├── translate.ts        # Transformers.js (worker bridge)
│   │   └── types.ts            # Shared types
│   └── middleware.ts           # Auth middleware (@supabase/ssr)
├── .env.local
└── next.config.js
```

- [ ] **Step 5: Commit scaffold**

```bash
cd nextjs
git init && git add -A && git commit -m "feat: scaffold Next.js project"
```

---

### Task 5: Supabase Client + Auth Middleware

**Files:**
- Create: `nextjs/src/lib/supabase.ts`
- Create: `nextjs/src/middleware.ts`

- [x] **Step 1: Create Supabase server + browser clients**

```typescript
// src/lib/supabase.ts
import { createBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client (public anon key, SSR-compatible cookie handling)
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

// Server client for API routes (instantiated per-request with cookie store)
export function getServerClient(cookieStore: { getAll: () => { name: string; value: string }[] }) {
  return createSSRServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
    },
  });
}
```

- [x] **Step 2: Create auth middleware**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [x] **Step 3: Create auth provider component**

Create `src/components/auth-provider.tsx` with:
- Sign in / sign out buttons
- Magic link email form
- Display user avatar or initials in header

- [ ] **Step 4: Verify auth flow**

```bash
npm run dev
# Visit localhost:3000, confirm sign-in with magic link works
```

---

### Task 6: Qdrant Search API Route

**Files:**
- Create: `nextjs/src/lib/qdrant.ts`
- Create: `nextjs/src/app/api/search/route.ts`

- [x] **Step 1: Create Qdrant client wrapper**

```typescript
// src/lib/qdrant.ts
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantUrl = process.env.QDRANT_URL!;
const qdrantKey = process.env.QDRANT_API_KEY!;

export const qdrant = new QdrantClient({
  url: qdrantUrl,
  apiKey: qdrantKey,
});

const COLLECTION = 'german_norms';
const LIMIT = 50;

export interface SearchResult {
  law_key: string;
  law_title: string;
  category: string;
  norm_id: string;
  norm_title: string;
  content: string;
  score: number;
}

export async function searchNorms(
  query: string,
  category?: string,
  topK: number = 50,
): Promise<SearchResult[]> {
  // Use Universal Query API to query by text
  // Qdrant will use the configured managed inference model to embed the text
  const filter: Record<string, unknown> = {};
  if (category) {
    filter.must = [{ key: 'category', match: { value: category } }];
  }

  // Using query() instead of search() to support text inference
  const results = await qdrant.query(COLLECTION, {
    query: { text: query },
    limit: topK,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  return results.points.map((r) => ({
    law_key:      r.payload!.law_key as string,
    law_title:    r.payload!.law_title as string,
    category:     r.payload!.category as string,
    norm_id:      r.payload!.norm_id as string,
    norm_title:   r.payload!.norm_title as string,
    content:      r.payload!.content as string,
    score:        r.score ?? 0,
  }));
}
```

- [x] **Step 2: Create search API route**

```typescript
// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchNorms } from '@/lib/qdrant';

export async function GET(req: NextRequest) {
  const query  = req.nextUrl.searchParams.get('q') || '';
  const category = req.nextUrl.searchParams.get('category') || '';
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const pageSize = 20;

  if (!query.trim() && !category) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Get top 50 from Qdrant (managed E5-small)
    const allResults = await searchNorms(query, category, 50);

    // Paginate
    const start = (page - 1) * pageSize;
    const results = allResults.slice(start, start + pageSize);

    // Group by law_key for law-level results
    const lawMap = new Map<string, { hits: number; topScore: number; norms: typeof results }>();
    for (const r of allResults) {
      if (!lawMap.has(r.law_key)) {
        lawMap.set(r.law_key, { hits: 0, topScore: 0, norms: [] });
      }
      const entry = lawMap.get(r.law_key)!;
      entry.hits++;
      entry.topScore = Math.max(entry.topScore, r.score);
      if (entry.norms.length < 3) entry.norms.push(r);
    }

    const lawResults = Array.from(lawMap.entries())
      .map(([key, data]) => ({
        key,
        title: data.norms[0]?.law_title || '',
        category: data.norms[0]?.category || '',
        relevance: Math.round(data.topScore * 100),
        normHits: data.hits,
        relevantNorms: data.norms.map((n) => ({
          normId: n.norm_id,
          title: n.norm_title,
          content: n.content.slice(0, 300),
        })),
      }))
      .sort((a, b) => b.relevance - a.relevance);

    return NextResponse.json({
      results: lawResults.slice(0, 20),
      total: allResults.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Test search endpoint**

```bash
curl "http://localhost:3000/api/search?q=mietrecht"
```

Expected: 200 with JSON results array.

---

### Task 7: Laws API Routes

**Files:**
- Create: `nextjs/src/app/api/laws/route.ts` (list, filter by category)
- Create: `nextjs/src/app/api/laws/[key]/route.ts` (single law + norms)

- [x] **Step 1: Create laws list endpoint**

```typescript
// src/app/api/laws/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') || '';
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);
  let query = supabase
    .from('laws')
    .select('*', { count: 'exact' })
    .order('key')
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data, total: count });
}
```

- [x] **Step 2: Create law detail endpoint**

```typescript
// src/app/api/laws/[key]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ key: string }> },
) {
  const { key } = await segmentData.params;

  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);

  // Get law metadata
  const { data: law, error } = await supabase
    .from('laws')
    .select('*')
    .eq('key', key)
    .single();

  if (error) return NextResponse.json({ error: 'Law not found' }, { status: 404 });

  // Get norms from Qdrant by law_key filter
  const { qdrant } = await import('@/lib/qdrant');
  const norms = await qdrant.scroll('german_norms', {
    filter: { must: [{ key: 'law_key', match: { value: key } }] },
    limit: 500,
  });

  return NextResponse.json({
    ...law,
    norms: norms.points.map((p: any) => p.payload),
  });
}
```

- [ ] **Step 3: Test both endpoints**

```bash
curl "http://localhost:3000/api/laws?category=housing"
curl "http://localhost:3000/api/laws/BGB"
```

---

### Task 8: Frontend — Landing Page

**Files:**
- Create: `nextjs/src/app/page.tsx` (landing page)
- Create: `nextjs/src/components/search-bar.tsx`
- Create: `nextjs/src/components/category-grid.tsx`
- Create: `nextjs/src/components/law-card.tsx`

- [ ] **Step 1: Create search bar component**

```tsx
// src/components/search-bar.tsx
'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, router]);

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search German laws… Describe your situation in English or German"
          className="w-full px-4 py-3 pr-12 text-lg border rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     dark:bg-gray-800 dark:border-gray-700"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2
                     text-gray-500 hover:text-blue-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor"
               viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
                  strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create category grid**

The 12 categories from the current system: housing (Wohnen & Miete), labor (Arbeit & Beruf), consumer (Einkaufen & Verträge), traffic (Verkehr & Transport), family (Familie & Leben), criminal (Strafrecht), finance (Steuern & Finanzen), social (Gesundheit & Soziales), public (Staat & Rechte), tech (Innovation & Umwelt), berlin (Berlin).

Each category card shows: icon, German name, English name, law count.

- [ ] **Step 3: Assemble landing page with search + categories**

```tsx
// src/app/page.tsx
export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-2
                       text-gray-900 dark:text-white">
          German Law Vault
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Search 6,000+ German federal laws in English or German
        </p>
        <SearchBar />
        <CategoryGrid />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify landing page renders at `/`**

```bash
npm run dev
# Open http://localhost:3000
```

---

### Task 9: Frontend — Search Results + Law Detail

**Files:**
- Create: `nextjs/src/app/search/page.tsx`
- Create: `nextjs/src/app/laws/[key]/page.tsx`
- Create: `nextjs/src/components/norm-viewer.tsx`
- Create: `nextjs/src/components/translation-badge.tsx`

- [ ] **Step 1: Create search results page**

```tsx
// src/app/search/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import LawCard from '@/components/law-card';
import { supabase } from '@/lib/supabase';

interface LawResult {
  key: string; title: string; relevance: number;
  category: string; normHits: number;
  relevantNorms: Array<{ normId: string; title: string; content: string }>;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<LawResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => setResults(data.results || []))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        Results for &ldquo;{query}&rdquo;
      </h1>
      {loading ? (
        <p className="text-gray-500">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-gray-500">No results found.</p>
      ) : (
        <div className="space-y-4">
          {results.map((law) => (
            <LawCard key={law.key} law={law} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create law detail page**

Shows law metadata + full list of norms sourced from Qdrant scroll query.
Each norm item is expandable and shows content.
"Translate this section" button triggers Transformers.js.

- [ ] **Step 3: Create norm viewer with Translate button**

```tsx
// src/components/norm-viewer.tsx
'use client';
import { useState } from 'react';
import TranslationBadge from './translation-badge';

interface NormViewerProps {
  normId: string;
  title: string;
  content: string;
}

export default function NormViewer({ normId, title, content }: NormViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const { translate } = await import('@/lib/translate');
      const result = await translate(content, 'de', 'en');
      setTranslation(result);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 mb-3 dark:border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left font-medium text-blue-700 dark:text-blue-400"
      >
        {normId} — {title}
      </button>
      {expanded && (
        <div className="mt-2">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {content}
          </p>
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {translating ? 'Translating…' : 'Translate to English'}
          </button>
          {translation && <TranslationBadge text={translation} />}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify search + detail pages**

Search for "Mietrecht", click a law, expand a norm, try translate.

---

### Task 10: Client-Side Translation (Transformers.js via Web Worker)

**Files:**
- Create: `nextjs/src/workers/translate.worker.ts`
- Create: `nextjs/src/lib/translate.ts`
- Create: `nextjs/src/hooks/useTranslation.ts`

> **Important:** The NLLB-200-distilled-600M model (~600MB) blocks the main thread if loaded directly.
> We use a **Web Worker** pattern — the model loads and runs in a background thread,
> keeping the UI fully responsive.

- [x] **Step 1: Create Web Worker for translation**

```typescript
// src/workers/translate.worker.ts
/**
 * Web Worker for client-side translation via Transformers.js.
 * Runs NLLB model off the main thread — UI stays responsive.
 */
import { pipeline, TextStreamer } from '@huggingface/transformers';

class TranslationWorker {
  static task = 'translation';
  static model = 'Xenova/nllb-200-distilled-600M';
  static instance: any = null;

  static async getInstance(progress_callback?: (x: any) => void) {
    if (!this.instance) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback,
      });
    }
    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const translator = await TranslationWorker.getInstance((x) => {
    self.postMessage({ status: 'progress', ...x });
  });

  const output = await translator(event.data.text, {
    src_lang: event.data.src_lang,
    tgt_lang: event.data.tgt_lang,
  });

  self.postMessage({
    status: 'complete',
    output: Array.isArray(output) ? output[0].translation_text : output.translation_text,
  });
});
```

- [x] **Step 2: Create main-thread translation API**

```typescript
// src/lib/translate.ts
/**
 * Client-side German↔English translation via Transformers.js Web Worker.
 * Sends messages to the worker, receives results asynchronously.
 * Zero cost, zero server round-trips, fully private.
 */

let worker: Worker | null = null;
let pending: Map<string, { resolve: (v: string) => void; reject: (e: any) => void }> = new Map();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('@/workers/translate.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event) => {
      const { status, output, ...rest } = event.data;
      if (status === 'progress') {
        // Could emit progress events here
        return;
      }
      // Resolve the oldest pending request
      const firstKey = pending.keys().next().value;
      if (firstKey) {
        const entry = pending.get(firstKey)!;
        pending.delete(firstKey);
        if (status === 'complete') entry.resolve(output);
        else entry.reject(new Error('Translation failed'));
      }
    };
  }
  return worker;
}

export async function translate(
  text: string,
  sourceLang: string = 'deu_Latn',
  targetLang: string = 'eng_Latn',
): Promise<string> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, text, src_lang: sourceLang, tgt_lang: targetLang });
  });
}

// Language codes compatible with NLLB
export const LANG_CODES = {
  de: 'deu_Latn',
  en: 'eng_Latn',
  fr: 'fra_Latn',
  es: 'spa_Latn',
} as const;
```

- [x] **Step 3: Create React hook**

```typescript
// src/hooks/useTranslation.ts
'use client';
import { useState, useCallback } from 'react';
import { translate, LANG_CODES } from '@/lib/translate';

export function useTranslation() {
  const [translating, setTranslating] = useState(false);
  const [cache] = useState(() => new Map<string, string>());

  const translateText = useCallback(async (
    text: string,
    from: keyof typeof LANG_CODES = 'de',
    to: keyof typeof LANG_CODES = 'en',
  ) => {
    const key = `${from}:${to}:${text.slice(0, 100)}`;
    if (cache.has(key)) return cache.get(key)!;

    setTranslating(true);
    try {
      const result = await translate(text, LANG_CODES[from], LANG_CODES[to]);
      cache.set(key, result);
      return result;
    } finally {
      setTranslating(false);
    }
  }, [cache]);

  return { translateText, translating };
}
```

- [x] **Step 4: Create TranslationBadge component**

```tsx
// src/components/translation-badge.tsx
interface Props { text: string; }
export default function TranslationBadge({ text }: Props) {
  return (
    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border
                    border-blue-200 dark:border-blue-800">
      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
        English Translation
      </p>
      <p className="text-gray-700 dark:text-gray-300">{text}</p>
    </div>
  );
}
```

- [ ] **Step 5: Verify translation in browser**

Open law detail, click "Translate to English" on any norm. First load downloads the model in a background worker (~600MB), subsequent translates are instant. Check that the UI remains responsive during loading.

---

### Task 11: Chat API Route + Frontend

**Files:**
- Create: `nextjs/src/app/api/chat/route.ts`
- Create: `nextjs/src/app/chat/page.tsx`
- Create: `nextjs/src/app/chat/[id]/page.tsx`
- Create: `nextjs/src/components/chat-panel.tsx`

- [x] **Step 1: Create chat API route (server-side + broker proxy)**

```typescript
// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerClient } from '@/lib/supabase';
import { searchNorms } from '@/lib/qdrant';

const BROKER_URL = process.env.NEXT_PUBLIC_BROKER_URL || 'http://localhost:9090';

export async function POST(req: NextRequest) {
  const { conversationId, message } = await req.json();
  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);

  // 1. Verify user owns this conversation
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Save user message
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message,
  });

  // 2. Search relevant norms
  const norms = await searchNorms(message, undefined, 5);
  const context = norms.map((n) =>
    `[${n.law_key} ${n.norm_id}] ${n.content.slice(0, 500)}`
  ).join('\n\n');

  // 3. Try local broker first, fall back to basic response
  try {
    const brokerRes = await fetch(`${BROKER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context,
        conversationId,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (brokerRes.ok) {
      const data = await brokerRes.json();
      // Save assistant message
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: data.response,
        cited_laws: JSON.stringify(norms.map((n) => ({
          law: n.law_key,
          norm: n.norm_id,
          title: n.law_title,
        }))),
      });
      return NextResponse.json(data);
    }
  } catch {
    // Broker unavailable — fall through
  }

  // 4. Fallback: simple response without LLM
  const fallback = `I found ${norms.length} relevant paragraphs across ${
    new Set(norms.map((n) => n.law_key)).size
  } laws. Please start the local AI broker (python broker.py) for detailed guidance.`;

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: fallback,
    cited_laws: JSON.stringify(norms.map((n) => ({
      law: n.law_key, norm: n.norm_id, title: n.law_title,
    }))),
  });

  return NextResponse.json({ response: fallback, citedLaws: norms, brokerAvailable: false });
}
```

- [x] **Step 2: Create chat panel component**

```tsx
// src/components/chat-panel.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cited_laws?: Array<{ law: string; norm: string; title: string }>;
}

export default function ChatPanel({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [brokerAvailable, setBrokerAvailable] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load existing messages
    supabase.from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at')
      .then(({ data }) => setMessages(data || []));
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    setLoading(true);

    // Optimistic user message
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(), role: 'user', content: text,
    }]);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, message: text }),
    });

    const data = await res.json();
    setBrokerAvailable(data.brokerAvailable !== false);

    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: data.response,
      cited_laws: data.citedLaws || [],
    }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[70vh] border rounded-lg dark:border-gray-700">
      {!brokerAvailable && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 text-sm
                        text-yellow-800 dark:text-yellow-200">
          Local AI broker not running. Start it with <code>python broker.py</code> for full AI responses.
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
              m.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.cited_laws && m.cited_laws.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600 text-xs">
                  <p className="font-medium mb-1">Cited laws:</p>
                  {m.cited_laws.map((c, i) => (
                    <a key={i} href={`/laws/${c.law}`}
                       className="block text-blue-600 dark:text-blue-400 hover:underline">
                      {c.law} {c.norm} — {c.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe your situation…"
            className="flex-1 px-3 py-2 border rounded-lg
                       dark:bg-gray-800 dark:border-gray-700"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 3: Assemble chat page**

```tsx
// src/app/chat/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatPanel from '@/components/chat-panel';

export default function NewChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return; }
      supabase.from('conversations').insert({
        user_id: user.id,
        title: 'New conversation',
      }).select('id').single().then(({ data }) => {
        if (data) setConversationId(data.id);
      });
    });
  }, [router]);

  if (!conversationId) return <div className="p-8">Starting conversation…</div>;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-4">AI Legal Guidance</h1>
      <p className="text-sm text-gray-500 mb-6">
        Describe your situation. The AI searches relevant laws and provides
        non-legally-binding guidance based on the text.
      </p>
      <ChatPanel conversationId={conversationId} />
    </main>
  );
}
```

---

### Task 12: Local FastAPI Broker (Optional Ollama Proxy)

**Files:**
- Create: `broker.py`
- Create: `broker/requirements.txt`

- [ ] **Step 1: Create broker app**

```python
# broker.py
"""
Local broker — bridges the Next.js app to a local Ollama instance.
Serves as an optional AI guidance layer.

Usage:
    pip install fastapi uvicorn httpx pydantic
    python broker.py
    # Server starts on http://localhost:9090
"""
import os
import logging
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("broker")

app = FastAPI(title="German Law Vault Broker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    context: str = Field(default="")
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    model: str = OLLAMA_MODEL


LEGAL_DISCLAIMER = (
    "\n\n---\n"
    "*This guidance is based on mathematical reasoning and logic applied to the legal text. "
    "It is **not legally binding advice**. Consult a licensed attorney for your specific situation.*"
)

SYSTEM_PROMPT = """You are a German law assistant. Your role is to:
1. Read the user's situation carefully
2. Search through the provided legal context from German federal laws
3. Explain which laws and paragraphs are relevant
4. Apply logical reasoning to explain how the law likely applies
5. Always note that this is non-binding guidance, not legal advice
6. Be clear about uncertainty — if the text is ambiguous, say so
7. Cite specific law keys and section numbers

Always respond in the user's language (German or English).
Keep responses structured and easy to follow.
"""


@app.get("/health")
async def health():
    """Health check — called by the frontend to detect broker availability."""
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Forward a chat request to Ollama with legal context."""
    user_prompt = f"""Context from German laws:
{req.context or "(No specific laws found)"}

User situation:
{req.message}

Provide guidance based on the relevant laws above. Include citations."""

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"{SYSTEM_PROMPT}\n\n{user_prompt}",
        "stream": False,
        "options": {
            "temperature": 0.3,  # Low temp for factual responses
            "num_predict": 1024,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            response_text = data.get("response", "").strip() + LEGAL_DISCLAIMER
            return ChatResponse(response=response_text)
    except httpx.RequestError as e:
        logger.error("Ollama request failed: %s", e)
        raise HTTPException(status_code=503, detail="Ollama unavailable")
```

- [ ] **Step 2: Create requirements file**

```
# broker/requirements.txt
fastapi>=0.115.0
uvicorn>=0.32.0
httpx>=0.28.0
pydantic>=2.0.0
```

- [ ] **Step 3: Verify broker runs**

```bash
cd broker
pip install -r requirements.txt
python -m uvicorn broker:app --host 0.0.0.0 --port 9090

# In another terminal:
curl http://localhost:9090/health
# Expected: {"status":"ok"}

curl -X POST http://localhost:9090/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"My landlord increased rent by 20%","context":"[BGB § 558] Mieterhöhung bis zur ortsüblichen Vergleichsmiete\n[BGB § 558a] Begründung der Mieterhöhung"}'
# Expected: 200 with AI response + disclaimer
```

---

### Task 13: Deployment Configuration

**Files:**
- Create: `nextjs/vercel.json`
- Modify: `nextjs/next.config.js`

- [ ] **Step 1: Configure vercel.json**

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
    "QDRANT_URL": "@qdrant_url",
    "QDRANT_API_KEY": "@qdrant_api_key"
  }
}
```

- [ ] **Step 2: Configure Next.js for static export + serverless**

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Partial Prerendering + ISR for law detail pages (Next.js 16)
  cacheComponents: true,

  images: {
    domains: [],
  },
  // Allow large translation models from CDN + enable SharedArrayBuffer
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

Note: Transformers.js requires COOP/COEP headers for shared memory (shared_array_buffer).
`cacheComponents: true` enables ISR for dynamic law pages, reducing Qdrant API calls.

- [ ] **Step 3: Deploy to Vercel**

```bash
cd nextjs
npx vercel --prod

# Set environment variables in Vercel dashboard:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - QDRANT_URL
# - QDRANT_API_KEY
```

---

### Task 14: README + Documentation Update

**Files:**
- Modify: `README.md`
- Create: `SETUP_SERVERLESS.md`
- Create: `.github/copilot-instructions.md` (update)

- [ ] **Step 1: Update root README.md**

Replace the Flask-centric README with the new architecture overview, including:
- Architecture diagram
- Quick start (two paths: cloud-only vs cloud + local broker)
- Environment variable setup
- Links to new docs

- [ ] **Step 2: Create SETUP_SERVERLESS.md**

Detailed setup guide:
1. Clone + install
2. Supabase project setup
3. Qdrant cluster setup
4. Data seeding
5. Vercel deployment
6. Local broker (optional)

- [ ] **Step 3: Update AI instructions**

Update `.github/copilot-instructions.md` with new architecture and commands.

---

### Task 15: Cleanup — Archive Legacy Code

**Files:**
- Move: `_archive/` (create if needed)

- [ ] **Step 1: Archive old Python backend files (non-destructive)**

```bash
mkdir -p _archive/backend
mv app.py _archive/backend/
mv vector_search.py _archive/backend/
mv unified_translator.py _archive/backend/
mv ai_guardrails.py _archive/backend/
mv server_watchdog.py _archive/backend/
mv logging_config.py _archive/backend/
mv version_tracking.py _archive/backend/
mv cross_reference_parser.py _archive/backend/
mv requirements.txt _archive/backend/
mv database/ _archive/backend/
mv dictionary/ _archive/backend/
mv static/ _archive/backend/
mv templates/ _archive/backend/
mv Logs/ _archive/backend/
```

- [ ] **Step 2: Keep the data pipeline scripts**

```bash
# Keep these in root — still needed for re-processing
# download_de_laws.py
# process_de_laws.py
# dedupe_processed_data.py
```

---

## Dependency Graph

```
Task 1 (Supabase) ──┐
Task 2 (Qdrant) ────┤
                    ├──▶ Task 3 (Seeding) ──▶ Task 4 (Next.js) ──▶ Task 5 (Auth) ──┐
                                                                                   │
Task 6 (Search API) ◀──────────────────────────────────────────────────────────────┤
Task 7 (Laws API)  ◀──────────────────────────────────────────────────────────────┤
                                                                                   ├──▶ Task 8 (Landing) ──▶ Task 9 (Search/Law UI) ──▶ Task 10 (Translation)
                                                                                   │
Task 11 (Chat) ───────────────────────────────────────────────────────────────────┤
Task 12 (Broker) ──▶ independent                                                 │
                                                                                  │
                              Task 13 (Deploy) ◀──────────────────────────────────┘
                              Task 14 (Docs) ◀────────────────────────────────────┘
                              Task 15 (Cleanup) ◀─────────────────────────────────┘
```

**Parallel execution possible:**
- Tasks 1 + 2 (both cloud setup, no dependency on each other)
- Task 12 (broker) is fully independent of any Next.js work
- Tasks 6 + 7 can be done in parallel
- Tasks 8 + 9 + 10 + 11 can be done in parallel once 6 and 7 are complete

---

## Verification Checklist

After all tasks, run these checks:

- [ ] `npm run build` — Next.js builds without errors
- [ ] `npm run dev` — app loads at localhost:3000
- [ ] Landing page shows search bar + category grid
- [ ] `/api/search?q=Mietrecht` returns 200 with results
- [ ] `/api/laws/BGB` returns law with norms
- [ ] `/api/laws?category=housing` returns filtered list
- [ ] Sign in with magic link works
- [ ] Bookmark a law, see it in /bookmarks
- [ ] Translate a norm in browser (Transformers.js)
- [ ] `/api/chat` returns response (with broker running)
- [ ] `/api/chat` returns fallback (without broker)
- [ ] `python broker.py` starts and responds to /health
- [ ] Vercel deployment succeeds with all env vars set
- [ ] Qdrant collection has ~100K points
- [ ] Supabase `laws` table has ~6,000 rows

---

## Cost Breakdown (Free Tier)

| Service | Free Tier Limit | Expected Usage |
|---------|----------------|----------------|
| Vercel | 100 GB bandwidth, 6000 build mins/mo | Well under |
| Supabase | 500 MB DB, 50K MAU, 2 GB bandwidth | ~50 MB DB, low traffic |
| Qdrant Cloud | 1 GB storage, 1 cluster | ~150 MB (384-dim × 100K) |
| Ollama (local) | Free | User's own hardware |
| Transformers.js | Free (browser) | Zero server cost |
| Total | **$0/mo** | |
