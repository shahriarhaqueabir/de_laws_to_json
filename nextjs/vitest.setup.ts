import "@testing-library/jest-dom/vitest";

// Provide a minimal Worker polyfill for jsdom so that code which
// references `Worker` globally doesn't crash during tests. Individual
// tests should stub their own Worker implementation via vi.stubGlobal.
if (typeof globalThis.Worker === "undefined") {
  class WorkerPolyfill {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;
    postMessage = () => {};
    terminate = () => {};
    addEventListener = () => {};
    removeEventListener = () => {};
    dispatchEvent = () => false;
  }
  (globalThis as any).Worker = WorkerPolyfill;
}

// Set test environment variables for tests that import supabase-server or use Qdrant/Supabase
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.QDRANT_URL = "http://localhost:6333";
process.env.QDRANT_API_KEY = "test-qdrant-key";
process.env.SERVER_ENCRYPTION_KEY =
  "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd1234";
