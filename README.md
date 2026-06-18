# German Law Vault ⚖️

**6,000+ German Federal Laws — Powered by Serverless AI & Semantic Search**

German Law Vault is a high-performance legal search platform. It enables natural language search in English and German, making German legal texts accessible to everyone. 

This project has recently been overhauled from a monolithic Flask app into a modern, **Serverless architecture** using Next.js, Supabase, and Qdrant Cloud.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15+-black.svg)
![Laws](https://img.shields.io/badge/laws-6000+-green.svg)
![Search](https://img.shields.io/badge/search-Semantic-blue.svg)

## ✨ Modern Features

- **Semantic Vector Search**: Powered by Qdrant Cloud with managed `E5-small` embeddings. Search by meaning, not just keywords.
- **Offline Private Translation**: Browser-based translation using **Transformers.js** (`NLLB-200`). Your legal queries never leave your browser for translation.
- **Serverless Performance**: Hosted on Vercel with Supabase for law metadata and persistence.
- **AI Legal Assistant**: Optional local AI integration via a **FastAPI Broker** and **Ollama** for private legal reasoning.
- **6,000+ Federal Laws**: Always up-to-date collection of German federal legislation.

## 🏗️ New Architecture

```
                      ┌───────────────────┐
                      │   Vercel (Next.js)│
                      │   Web Interface   │
                      └─────────┬─────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
      ┌─────────▼─────────┐           ┌─────────▼─────────┐
      │   Supabase (DB)   │           │   Qdrant Cloud    │
      │   Law Metadata    │           │   Vector Search   │
      └───────────────────┘           └───────────────────┘
                │                               │
        (Optional Local)                (Browser Side AI)
      ┌─────────▼─────────┐           ┌─────────▼─────────┐
      │   FastAPI Broker  │           │  Transformers.js  │
      │   (Ollama Proxy)  │           │  Local Translation│
      └───────────────────┘           └───────────────────┘
```

## 🚀 Getting Started

To get the modern serverless version running, please follow our new setup guide:

👉 **[SETUP_SERVERLESS.md](./SETUP_SERVERLESS.md)**

### Prerequisites
- Node.js 18+
- Python 3.10+
- Free Tier accounts for Supabase & Qdrant Cloud

## 🔧 Legacy Version
The original monolithic Flask/SQLite version is preserved in the `_archive/` directory for reference or local-only deployments without cloud dependencies.

## 📁 Project Structure

```
AI-Assisted-German-Law/
├── nextjs/                 # Modern Next.js Frontend & API Routes
├── broker/                 # FastAPI Broker for Local Ollama AI
├── scripts/                # Data Seeding & Migration Scripts
├── supabase/               # Database Migrations & Schema
├── de_federal_raw/         # Raw XML files (for re-processing)
├── SETUP_SERVERLESS.md     # Installation & Cloud Setup
├── DEVELOPMENT_REPORT.md   # Lessons learned during the overhaul
└── _archive/               # Original Flask/SQLite implementation
```

## 🔒 Security & Privacy
- **Vector Search**: Queries are sent to Qdrant Cloud for semantic matching.
- **Translation**: Happens **locally** in your browser via WASM. No external API calls.
- **AI Chat**: If used with the local broker, your data stays on your machine (via Ollama).
- **Metadata**: All law text is hosted on Supabase (Public).

## 📝 License
This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for accessible legal information**
