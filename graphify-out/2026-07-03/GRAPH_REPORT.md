# Graph Report - .  (2026-07-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 861 nodes · 1515 edges · 96 communities (65 shown, 31 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2abd76b7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_API Responses and Utilities|API Responses and Utilities]]
- [[_COMMUNITY_User Authentication and UI Components|User Authentication and UI Components]]
- [[_COMMUNITY_Database Connection Management|Database Connection Management]]
- [[_COMMUNITY_Qdrant Search and Retrieval|Qdrant Search and Retrieval]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Session Handling and Risk Assessment|Session Handling and Risk Assessment]]
- [[_COMMUNITY_Settings and Configuration Pages|Settings and Configuration Pages]]
- [[_COMMUNITY_Guidance and Playbook Generation|Guidance and Playbook Generation]]
- [[_COMMUNITY_TypeScript Configuration|TypeScript Configuration]]
- [[_COMMUNITY_Translation Services Integration|Translation Services Integration]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_AI Provider Functions|AI Provider Functions]]
- [[_COMMUNITY_Authentication and Authorization|Authentication and Authorization]]
- [[_COMMUNITY_Layout and Language Management|Layout and Language Management]]
- [[_COMMUNITY_Remediation Roadmap|Remediation Roadmap]]
- [[_COMMUNITY_Chat Interface Components|Chat Interface Components]]
- [[_COMMUNITY_Browser AI Integration|Browser AI Integration]]
- [[_COMMUNITY_Folder Management UI|Folder Management UI]]
- [[_COMMUNITY_Chat Context and Navigation|Chat Context and Navigation]]
- [[_COMMUNITY_Home Page and Search Bar|Home Page and Search Bar]]
- [[_COMMUNITY_Bookmarks Management Tests|Bookmarks Management Tests]]
- [[_COMMUNITY_Law Download and Processing|Law Download and Processing]]
- [[_COMMUNITY_Search Results Page|Search Results Page]]
- [[_COMMUNITY_Conversation List Testing|Conversation List Testing]]
- [[_COMMUNITY_Translation Functionality|Translation Functionality]]
- [[_COMMUNITY_Test Suite Execution|Test Suite Execution]]
- [[_COMMUNITY_Broker and Ollama Integration|Broker and Ollama Integration]]
- [[_COMMUNITY_Cost-Risk Calculator|Cost-Risk Calculator]]
- [[_COMMUNITY_Setup Script for AI Environment|Setup Script for AI Environment]]
- [[_COMMUNITY_Database Migration and Search Improvements|Database Migration and Search Improvements]]
- [[_COMMUNITY_Project Scripts|Project Scripts]]
- [[_COMMUNITY_Local AI Setup Script|Local AI Setup Script]]
- [[_COMMUNITY_Bookmarks Folders Testing|Bookmarks Folders Testing]]
- [[_COMMUNITY_Norm Viewer Component Tests|Norm Viewer Component Tests]]
- [[_COMMUNITY_Vitest Worker Configuration|Vitest Worker Configuration]]
- [[_COMMUNITY_Supabase Norms Backfill|Supabase Norms Backfill]]
- [[_COMMUNITY_Project Metadata and Configuration|Project Metadata and Configuration]]
- [[_COMMUNITY_Chat API Testing|Chat API Testing]]
- [[_COMMUNITY_Chat Hook and Context|Chat Hook and Context]]
- [[_COMMUNITY_Law Card Component Tests|Law Card Component Tests]]
- [[_COMMUNITY_Category Detection Logic|Category Detection Logic]]
- [[_COMMUNITY_Translation Worker Implementation|Translation Worker Implementation]]
- [[_COMMUNITY_Data Seeding Script|Data Seeding Script]]
- [[_COMMUNITY_Broker Stability Quick Wins Implementation Plan|Broker Stability Quick Wins Implementation Plan]]
- [[_COMMUNITY_Diagnostics Testing|Diagnostics Testing]]
- [[_COMMUNITY_Explanation Generation Testing|Explanation Generation Testing]]
- [[_COMMUNITY_Search Functionality Testing|Search Functionality Testing]]
- [[_COMMUNITY_Translation Worker Testing|Translation Worker Testing]]
- [[_COMMUNITY_Embedding Diagnostics|Embedding Diagnostics]]
- [[_COMMUNITY_Official Codes Ingestion|Official Codes Ingestion]]
- [[_COMMUNITY_Official GG Ingestion|Official GG Ingestion]]
- [[_COMMUNITY_Re-embedding Law Prefixes|Re-embedding Law Prefixes]]
- [[_COMMUNITY_Norms Seeding to Qdrant|Norms Seeding to Qdrant]]
- [[_COMMUNITY_Project Configuration Files|Project Configuration Files]]
- [[_COMMUNITY_Route Handling and Detection|Route Handling and Detection]]
- [[_COMMUNITY_Laws Key Testing|Laws Key Testing]]
- [[_COMMUNITY_Translation Worker Tests|Translation Worker Tests]]
- [[_COMMUNITY_Vercel Configuration|Vercel Configuration]]
- [[_COMMUNITY_Qdrant Visualization Diagnostics|Qdrant Visualization Diagnostics]]
- [[_COMMUNITY_Fixing Short Content in Qdrant|Fixing Short Content in Qdrant]]
- [[_COMMUNITY_QA Translation Review|QA Translation Review]]
- [[_COMMUNITY_Process Monitoring Route|Process Monitoring Route]]
- [[_COMMUNITY_API Documentation Page|API Documentation Page]]
- [[_COMMUNITY_OpenAPI Specification Route|OpenAPI Specification Route]]
- [[_COMMUNITY_Laws Testing|Laws Testing]]
- [[_COMMUNITY_Qdrant Client Mocking|Qdrant Client Mocking]]
- [[_COMMUNITY_Chat Worker Implementation|Chat Worker Implementation]]
- [[_COMMUNITY_Chat Worker Tests|Chat Worker Tests]]
- [[_COMMUNITY_Qdrant Analysis Script|Qdrant Analysis Script]]
- [[_COMMUNITY_Qdrant Index Creation|Qdrant Index Creation]]
- [[_COMMUNITY_Fix Qdrant Search Issues|Fix Qdrant Search Issues]]
- [[_COMMUNITY_GitHub Clone and Merge|GitHub Clone and Merge]]
- [[_COMMUNITY_ESLint Configuration|ESLint Configuration]]
- [[_COMMUNITY_Next.js Configuration|Next.js Configuration]]
- [[_COMMUNITY_PostCSS Configuration|PostCSS Configuration]]
- [[_COMMUNITY_Supabase Edge Function Cleanup|Supabase Edge Function Cleanup]]
- [[_COMMUNITY_Browser AI WASM Loading Fix|Browser AI WASM Loading Fix]]
- [[_COMMUNITY_Postgres Connection Error Investigation|Postgres Connection Error Investigation]]
- [[_COMMUNITY_RLS Tightening for norm_explanations|RLS Tightening for norm_explanations]]
- [[_COMMUNITY_Globe SVG|Globe SVG]]
- [[_COMMUNITY_Next SVG|Next SVG]]
- [[_COMMUNITY_Vercel SVG|Vercel SVG]]
- [[_COMMUNITY_Window SVG|Window SVG]]
- [[_COMMUNITY_Evaluation Requirements|Evaluation Requirements]]

## God Nodes (most connected - your core abstractions)
1. `getServerClient()` - 42 edges
2. `errorResponse()` - 39 edges
3. `sanitizeErrorMessage()` - 30 edges
4. `useAuth()` - 21 edges
5. `successResponse()` - 18 edges
6. `compilerOptions` - 17 edges
7. `useLanguage()` - 16 edges
8. `checkRateLimit()` - 16 edges
9. `decryptApiKey()` - 15 edges
10. `useChat()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Add Full-Text Search Migration (tsvector on laws table)` --references--> `Search API Route`  [EXTRACTED]
  docs/issues/add-fulltext-search.md → nextjs/src/app/api/search/route.ts
- `Improve Qdrant Search Relevance — Re-index with Better Embedding Model` --references--> `Qdrant Library`  [EXTRACTED]
  docs/issues/improve-qdrant-search.md → nextjs/src/lib/qdrant.ts
- `Broker Stability Quick Wins Implementation Plan` ----> `Broker`  [EXTRACTED]
  docs/superpowers/plans/2026-06-20-broker-quick-wins.md → broker/broker.py
- `Broker Stability Quick Wins Implementation Plan` ----> `Server-side chat API (used by cloud/basic/browser modes)`  [EXTRACTED]
  docs/superpowers/plans/2026-06-20-broker-quick-wins.md → nextjs/src/app/api/chat/route.ts
- `Broker Stability Quick Wins Implementation Plan` ----> `Chat UI — local mode calls broker directly from browser`  [EXTRACTED]
  docs/superpowers/plans/2026-06-20-broker-quick-wins.md → nextjs/src/app/chat/page.tsx

## Import Cycles
- None detected.

## Communities (96 total, 31 thin omitted)

### Community 0 - "API Responses and Utilities"
Cohesion: 0.06
Nodes (88): CreateFolderSchema, DELETE(), FolderStatusEnum, GET(), handleError(), PATCH(), POST(), UpdateFolderSchema (+80 more)

### Community 1 - "User Authentication and UI Components"
Cohesion: 0.06
Nodes (49): BookmarksPage(), FolderGroup, groupBookmarksByFolder(), GuidanceHistoryPage(), GuidancePathSummary, GuidanceSession, Pagination, RISK_COLORS (+41 more)

### Community 2 - "Database Connection Management"
Cohesion: 0.10
Nodes (31): Connection, get_connection(), init_db(), SQLite database initialization and connection management for law processing., Get a thread-local database connection., Create tables if they don't exist., _append_or_extend_paragraph(), _categorize() (+23 more)

### Community 3 - "Qdrant Search and Retrieval"
Cohesion: 0.10
Nodes (26): QdrantClient, boost_law_diversity(), compute_metrics(), extract_query_keywords(), extract_query_terms(), load_benchmark(), main(), normalize_norm_id() (+18 more)

### Community 4 - "Project Dependencies"
Cohesion: 0.09
Nodes (23): devDependencies, eslint, eslint-config-next, jsdom, knip, msw, @next/bundle-analyzer, prettier (+15 more)

### Community 5 - "Session Handling and Risk Assessment"
Cohesion: 0.12
Nodes (13): formatDate(), SessionData, SessionDetailPage(), SessionResponse, GuidancePathsDisplayProps, TIMELINE_HINTS, mockFolder, mockPaths (+5 more)

### Community 6 - "Settings and Configuration Pages"
Cohesion: 0.14
Nodes (17): MODE_ICONS, MODE_LIMITATIONS, MODE_STATUS_NOTE, SettingsPage(), ChatContextType, NormViewerProps, BROWSER_MODELS, ChatSettings (+9 more)

### Community 7 - "Guidance and Playbook Generation"
Cohesion: 0.14
Nodes (18): attachCostEstimates(), buildGuidancePrompt(), buildPlaybookContext(), callLocalBroker(), CATEGORY_PLAYBOOK_MAP, DeadlineWarning, GeneratedDocument, generateGuidancePaths() (+10 more)

### Community 8 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 9 - "Translation Services Integration"
Cohesion: 0.17
Nodes (16): cacheKey(), callLibreTranslate(), callOllamaTranslate(), DE_EN_TERM_MAP, EN_DE_TERM_MAP, findAllEnDeMatches(), findDeEnTermMatch(), GERMAN_WORDS (+8 more)

### Community 10 - "Project Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, date-fns, geist, @huggingface/transformers, ky, lucide-react, motion, next (+10 more)

### Community 11 - "AI Provider Functions"
Cohesion: 0.24
Nodes (12): callAnthropic(), callOpenAI(), callOpenAICompatible(), validateEndpointUrl(), buildUserPrompt(), ExplainParams, generateChatResponse(), generateNormExplanation() (+4 more)

### Community 12 - "Authentication and Authorization"
Cohesion: 0.17
Nodes (10): AuthPage(), GuidancePage(), mockPush, mockSignIn, mockSignUp, Footer(), MODE_META, NavBar() (+2 more)

### Community 13 - "Layout and Language Management"
Cohesion: 0.18
Nodes (7): metadata, serif, Diagnostics(), DIR_MAP, LangProvider(), Providers(), mockStore

### Community 14 - "Remediation Roadmap"
Cohesion: 0.21
Nodes (10): RemediationRoadmapProps, Step, mockDiagnosis, calculateDeadline(), diagnoseCase(), DiagnosisResult, LABOR_DIAGNOSIS_FLOW, Question (+2 more)

### Community 15 - "Chat Interface Components"
Cohesion: 0.21
Nodes (11): ChatApiResponse, ConversationData, ConversationPage(), ConversationResponse, mapMessage(), MessageData, MODE_META, Message (+3 more)

### Community 16 - "Browser AI Integration"
Cohesion: 0.21
Nodes (8): ChatContent(), ChatRequestBody, LIMITATION_BANNERS, MODE_META, MockWorker, useBrowserAI(), UseBrowserAIReturn, ChatMode

### Community 17 - "Folder Management UI"
Cohesion: 0.23
Nodes (8): CATEGORIES, DEFAULT_FORM, FolderFormData, FolderModalProps, defaultProps, FOLDER_STATUS_LABELS, FolderStatus, GuidanceResult

### Community 18 - "Chat Context and Navigation"
Cohesion: 0.22
Nodes (9): buildDefaultSettings(), ChatContext, ChatProvider(), isValidBrokerUrl(), loadSavedSettings(), sanitizeBrokerUrl(), mockPathname, mockSignOut (+1 more)

### Community 19 - "Home Page and Search Bar"
Cohesion: 0.20
Nodes (5): LAW_QUOTES, modes, categories, CategoryGrid(), mockPush

### Community 20 - "Bookmarks Management Tests"
Cohesion: 0.32
Nodes (8): mockBookmarks, addBookmark(), Bookmark, getBookmarks(), isBookmarked(), removeBookmark(), mockStore, sampleBookmark

### Community 21 - "Law Download and Processing"
Cohesion: 0.26
Nodes (11): main(), _make_session(), process_law(), process_with_delay(), Downloads all (>6000) federal laws from https://www.gesetze-im-internet.de/gii-t, Build a requests Session with automatic retry on transient HTTP errors., Derive a unique subdirectory name based on the law's path in the URL., Added a small delay to avoid triggering server-side rate limits. (+3 more)

### Community 22 - "Search Results Page"
Cohesion: 0.22
Nodes (6): SearchResults(), mockGet, mockResults, AuthProvider(), ToastProvider(), LawSearchResult

### Community 23 - "Conversation List Testing"
Cohesion: 0.18
Nodes (8): mockKyDelete, mockKyGet, mockToastCustom, mockToastDismiss, mockToastError, mockToastSuccess, mockUseAuth, sampleConversations

### Community 24 - "Translation Functionality"
Cohesion: 0.22
Nodes (7): mockTranslateText, useTranslation(), pending, PendingRequest, TranslateOptions, translateText(), TranslationProgress

### Community 25 - "Test Suite Execution"
Cohesion: 0.29
Nodes (9): main(), print_header(), print_test_info(), Print test suite header., Print information about a test., Run a single test file.      Returns:         tuple: (success: bool, duration, Run all tests or specific test.      Args:         quick_only: If True, skip, run_all_tests() (+1 more)

### Community 26 - "Broker and Ollama Integration"
Cohesion: 0.28
Nodes (8): build_ollama_messages(), chat(), health(), German Law Vault — Local Ollama Broker ======================================, Check broker and Ollama connectivity., Proxy a chat request to Ollama., stream_ollama(), Request

### Community 27 - "Cost-Risk Calculator"
Cohesion: 0.44
Nodes (4): calculateCourtFees(), calculateLawyerFees(), calculateTotalLegalRisk(), LegalFees

### Community 28 - "Setup Script for AI Environment"
Cohesion: 0.42
Nodes (8): command_exists(), create_temp_directory(), download_model(), get_user_confirmation(), install_ollama(), setup.sh script, start_broker(), verify_setup()

### Community 29 - "Database Migration and Search Improvements"
Cohesion: 0.29
Nodes (8): Add Full-Text Search Migration (tsvector on laws table), Improve Qdrant Search Relevance — Re-index with Better Embedding Model, Search API Route, Qdrant Library, Sprint 6b Kanban Plan, Backfill Norms Script, Evaluate Search Script, Norms Migration Script

### Community 30 - "Project Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, start, test, test:coverage, test:watch

### Community 32 - "Bookmarks Folders Testing"
Cohesion: 0.29
Nodes (5): mockFolders, mockNewFolder, MockResponse, mockSupabase, mockUser

### Community 33 - "Norm Viewer Component Tests"
Cohesion: 0.29
Nodes (5): defaultProps, mockExplanation, mockExplanationOfficial, mockToast, mockTranslateText

### Community 35 - "Supabase Norms Backfill"
Cohesion: 0.38
Nodes (6): main(), Backfill all norms from Qdrant scroll into Supabase norms table.  Scrolls Qdra, Scroll all points from Qdrant (payload only)., Upsert a batch of norms into Supabase via Management API., scroll_all_norms(), upsert_batch()

### Community 36 - "Project Metadata and Configuration"
Cohesion: 0.33
Nodes (5): name, overrides, postcss, private, version

### Community 37 - "Chat API Testing"
Cohesion: 0.33
Nodes (4): mockFetch, mockGenerateChatResponse, mockSearchNorms, mockSupabaseResult

### Community 38 - "Chat Hook and Context"
Cohesion: 0.47
Nodes (4): useChat(), BadComponent(), mockStore, TestConsumer()

### Community 39 - "Law Card Component Tests"
Cohesion: 0.33
Nodes (5): mockLaw, mockLawFewNorms, mockRouter, mockStore, mockToast

### Community 40 - "Category Detection Logic"
Cohesion: 0.33
Nodes (4): CATEGORIES, CATEGORY_KEYWORDS, CategoryEntry, CategoryMatch

### Community 41 - "Translation Worker Implementation"
Cohesion: 0.33
Nodes (3): ModelConfig, MODELS, NLLB_LANG_CODES

### Community 42 - "Data Seeding Script"
Cohesion: 0.33
Nodes (4): { createClient }, playbooks, supabase, templates

### Community 43 - "Broker Stability Quick Wins Implementation Plan"
Cohesion: 0.40
Nodes (5): Broker, Broker Stability Quick Wins Implementation Plan, Server-side chat API (used by cloud/basic/browser modes), Chat UI — local mode calls broker directly from browser, Broker Tests

### Community 44 - "Diagnostics Testing"
Cohesion: 0.40
Nodes (3): mockSearchNorms, mockSupabaseResult, ORIGINAL_ENV

### Community 45 - "Explanation Generation Testing"
Cohesion: 0.40
Nodes (3): mockFetch, mockGenerateNormExplanation, mockSupabaseResult

### Community 46 - "Search Functionality Testing"
Cohesion: 0.40
Nodes (3): mockSearchNorms, mockSupabaseChain, mockSupabaseResult

### Community 49 - "Official Codes Ingestion"
Cohesion: 0.50
Nodes (3): normalize_section_id(), Convert 'Section 1' -> '§ 1', 'Section 651l' -> '§ 651l'., scrape_code()

### Community 50 - "Official GG Ingestion"
Cohesion: 0.50
Nodes (3): normalize_id(), Convert 'Article 1' -> 'Art 1' to match existing German DB schema., scrape_gg()

### Community 52 - "Norms Seeding to Qdrant"
Cohesion: 0.50
Nodes (4): Seed norms from SQLite into Qdrant with pre-computed E5-small embeddings.  Gen, Write current progress to a JSON status file for external monitoring., seed_db(), write_status()

### Community 53 - "Project Configuration Files"
Cohesion: 0.50
Nodes (4): Dependabot Configuration, Bug Report Issue Template, Feature Request Issue Template, Pull Request Template

### Community 54 - "Route Handling and Detection"
Cohesion: 0.83
Nodes (3): detectPythonCommand(), getBrokerDir(), POST()

### Community 56 - "Translation Worker Tests"
Cohesion: 0.50
Nodes (3): mockPipeline, mockTranslator, { progressCallbackRef }

### Community 57 - "Vercel Configuration"
Cohesion: 0.50
Nodes (3): framework, regions, version

### Community 60 - "QA Translation Review"
Cohesion: 0.50
Nodes (3): call_endpoint(), Translation System QA Review ============================= Comprehensive quali, Call a Flask endpoint and return (status_code, response_data, time_ms)

## Knowledge Gaps
- **269 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+264 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Project Dependencies` to `Project Metadata and Configuration`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `supabase` connect `Project Dependencies` to `User Authentication and UI Components`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Project Dependencies` to `Project Metadata and Configuration`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `German Law Vault — Local Ollama Broker ======================================`, `Check broker and Ollama connectivity.`, `Proxy a chat request to Ollama.` to the rest of the system?**
  _317 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Responses and Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.055048529624800814 - nodes in this community are weakly interconnected._
- **Should `User Authentication and UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05970149253731343 - nodes in this community are weakly interconnected._
- **Should `Database Connection Management` be split into smaller, more focused modules?**
  _Cohesion score 0.10227272727272728 - nodes in this community are weakly interconnected._