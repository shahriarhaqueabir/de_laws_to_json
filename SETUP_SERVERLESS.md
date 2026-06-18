# Setup Guide: Serverless German Law Vault

This guide helps you set up the modern serverless stack for the German Law Vault.

## Prerequisites
- Node.js 18+
- Python 3.10+
- A [Supabase](https://supabase.com/) account
- A [Qdrant Cloud](https://cloud.qdrant.io/) account

## 1. Cloud Setup

### Supabase
1. Create a new project.
2. Go to the **SQL Editor** and run the script in `supabase/migrations/00001_initial_schema.sql`.
3. Enable **Magic Link** authentication in **Auth -> Settings -> Providers**.

### Qdrant Cloud
1. Create a free 1GB cluster.
2. In the Dashboard, ensure you have an API key.
3. Note your Cluster URL.

## 2. Environment Variables
Copy `.env.example` to `nextjs/.env.local` and root `.env`, then fill in your keys:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...
```

## 3. Data Seeding
Populate your cloud databases from your local data.

1. **Initialize Collection**:
   ```bash
   python scripts/create_qdrant_collection.py
   ```
2. **Seed Vectors**:
   ```bash
   python scripts/seed_norms_to_qdrant.py
   ```
3. **Import Metadata**:
   - Run `python scripts/extract_laws_metadata.py` to get `laws_metadata.json`.
   - Upload this file to the `laws` table in the Supabase Dashboard.

## 4. Running the Frontend
```bash
cd nextjs
npm install
npm run dev
```
Open `http://localhost:3000`.

## 5. Local AI Broker (Optional)
To enable the AI Chat with local LLMs (Ollama):
```bash
cd broker
pip install -r requirements.txt
python broker.py
```
Ensure Ollama is running with `qwen2.5:1.5b`.
