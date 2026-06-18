# Technical Documentation: German Law Vault

## Architecture Overview
The system is built on a distributed serverless architecture designed for privacy, speed, and cost-efficiency.

### 1. Frontend: Next.js (App Router)
- **Framework**: Next.js 15+
- **Styling**: Tailwind CSS
- **State Management**: React Hooks + Supabase Auth
- **AI Integration**:
    - **Transformers.js**: Runs `Xenova/nllb-200-distilled-600M` in a Web Worker for client-side translation.
    - **Qdrant JS Client**: Direct communication with Qdrant Cloud via the Universal Query API.

### 2. Data Layer: Supabase & Qdrant
- **Supabase (PostgreSQL)**:
    - Stores law metadata (title, key, category).
    - Manages user sessions and bookmarks.
    - Persists chat history.
- **Qdrant Cloud (Vector Store)**:
    - Stores ~100k law paragraph embeddings.
    - **Managed Inference**: Uses `intfloat/multilingual-e5-small`.
    - **Quantization**: `int8` scalar quantization for memory efficiency.

### 3. Local Reasoning: FastAPI Broker
- **Role**: A middleware that bridges the cloud frontend to a local **Ollama** instance.
- **Privacy**: Ensures that sensitive legal reasoning happens on the user's hardware.
- **Prompt Engineering**: Uses a system prompt that enforces strict citation of the provided legal context.

## Data Pipeline
1. **Download**: `download_de_laws.py` fetches XML from *gesetze-im-internet.de*.
2. **Process**: `process_de_laws.py` converts XML to structured JSON.
3. **Migrate**:
    - `scripts/extract_laws_metadata.py` creates a JSON for Supabase.
    - `scripts/seed_norms_to_qdrant.py` uploads text to Qdrant Cloud (vectors are generated on the server).

## Security Checks
- **CORS**: Next.js API routes are protected. The FastAPI broker only allows requests from the Next.js origin.
- **RLS (Supabase)**: Row Level Security ensures users can only see their own bookmarks and conversations.
- **Environment Variables**: All API keys are managed via `.env` files and never committed to version control.

## Performance Optimization
- **Web Workers**: Translation runs in the background to prevent UI lag.
- **Partial Prerendering (PPR)**: Law detail pages are statically optimized where possible.
- **Quantized Vectors**: Reduces RAM usage in Qdrant, allowing the entire 100k norm dataset to fit in the free tier.
