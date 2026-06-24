import "@testing-library/jest-dom/vitest";

// Set test environment variables for tests that import supabase-server or use Qdrant/Supabase
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.QDRANT_URL = "http://localhost:6333";
process.env.QDRANT_API_KEY = "test-qdrant-key";
process.env.SERVER_ENCRYPTION_KEY =
  "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd1234";
