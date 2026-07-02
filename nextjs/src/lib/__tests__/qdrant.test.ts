import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockQuery = vi.fn();

const MockQdrantClient = vi.fn(function (this: { query: typeof mockQuery }) {
  this.query = mockQuery;
}) as unknown as { new (): { query: typeof mockQuery }; mockClear: () => void };

vi.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: MockQdrantClient,
}));

const ORIGINAL_URL = process.env.QDRANT_URL;
const ORIGINAL_API_KEY = process.env.QDRANT_API_KEY;

beforeEach(() => {
  process.env.QDRANT_URL = "http://localhost:6333";
  process.env.QDRANT_API_KEY = "test-key-123";
  mockQuery.mockReset();
});

afterEach(() => {
  process.env.QDRANT_URL = ORIGINAL_URL;
  process.env.QDRANT_API_KEY = ORIGINAL_API_KEY;
});

describe("searchNorms", () => {
  it("returns results for a plain query (no filter)", async () => {
    mockQuery.mockResolvedValue({
      points: [
        {
          id: 1,
          score: 0.95,
          payload: {
            law_key: "BGB",
            law_title: "Bürgerliches Gesetzbuch",
            category: "civil",
            norm_id: "§ 433",
            norm_title: "Kaufvertrag",
            content: "Der Verkäufer einer Sache...",
          },
        },
      ],
    });

    const { searchNorms } = await import("../qdrant");
    const results = await searchNorms("Kaufvertrag");

    // New hybrid search: single dense query, no prefetch
    expect(mockQuery).toHaveBeenCalledWith("german_norms", {
      query: {
        text: "query: Kaufvertrag",
        model: "intfloat/multilingual-e5-small",
      },
      limit: 100, // topK * 2 = 50 * 2 = 100
      offset: 0,
      filter: undefined,
      with_payload: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].law_key).toBe("BGB");
    // After BM25 fusion (alpha=0.7) + keyword boost:
    // Dense norm = 1.0, BM25 norm = 1.0, fused = 1.0, keywords boost +10% = 1.1
    expect(results[0].score).toBeCloseTo(1.1, 2);
  });

  it("adds category filter when category is provided", async () => {
    mockQuery.mockResolvedValue({ points: [] });

    const { searchNorms } = await import("../qdrant");
    await searchNorms("Miete", "housing");

    // Should pass the category filter in the single dense query
    expect(mockQuery).toHaveBeenCalledWith("german_norms", {
      query: {
        text: "query: Mietrecht Wohnung Miete Vermieter Mieter BGB Mietvertrag Nebenkosten Miete",
        model: "intfloat/multilingual-e5-small",
      },
      limit: 100,
      offset: 0,
      filter: { must: [{ key: "category", match: { value: "housing" } }] },
      with_payload: true,
    });
  });

  it("maps Qdrant response to SearchResult shape", async () => {
    mockQuery.mockResolvedValue({
      points: [
        {
          id: 101,
          score: 0.88,
          payload: {
            law_key: "StGB",
            law_title: "Strafgesetzbuch",
            category: "criminal",
            norm_id: "§ 123",
            norm_title: "Hausfriedensbruch",
            content: "Wer in die Wohnung eines anderen...",
          },
        },
        {
          id: 102,
          score: 0.72,
          payload: {
            law_key: "StGB",
            law_title: "Strafgesetzbuch",
            category: "criminal",
            norm_id: "§ 124",
            norm_title: "Schwerer Hausfriedensbruch",
            content: "Wer sich zur Begehung einer Straftat...",
          },
        },
      ],
    });

    const { searchNorms } = await import("../qdrant");
    const results = await searchNorms("Hausfriedensbruch", "criminal", 10);

    expect(results).toHaveLength(2);
    // After BM25 fusion, § 124 ("Schwerer Hausfriedensbruch") may rank
    // higher because its content matches more query terms from the
    // domain-expanded query (StGB, Straftat, Hausfriedensbruch, etc.)
    expect(results[0].law_key).toBe("StGB");
    expect(results[0].norm_title).toBeTruthy();
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[1].law_key).toBe("StGB");
    expect(results[1].score).toBeGreaterThan(0);
  });

  it("passes topK and offset correctly", async () => {
    mockQuery.mockResolvedValue({ points: [] });

    const { searchNorms } = await import("../qdrant");
    await searchNorms("test", undefined, 5, 20);

    // topK=5 → limit=10 (5*2), offset=20
    expect(mockQuery).toHaveBeenCalledWith("german_norms", {
      query: { text: "query: test", model: "intfloat/multilingual-e5-small" },
      limit: 10,
      offset: 20,
      filter: undefined,
      with_payload: true,
    });
  });
});

describe("getQdrant singleton", () => {
  it("creates only one client instance on repeated calls", async () => {
    mockQuery.mockResolvedValue({ points: [] });

    // Clear mock call history to isolate this test
    MockQdrantClient.mockClear();
    // Use resetModules to get a fresh import so the singleton starts null
    vi.resetModules();
    const { searchNorms } = await import("../qdrant");

    // First call creates the client
    await searchNorms("test1");
    // Second call should reuse the same client
    await searchNorms("test2");

    // Constructor should have been called exactly once
    expect(MockQdrantClient).toHaveBeenCalledTimes(1);
  });
});

describe("searchNorms — graceful fallback", () => {
  it("returns empty array when env vars are missing (graceful degradation)", async () => {
    vi.resetModules();
    delete process.env.QDRANT_URL;
    delete process.env.QDRANT_API_KEY;

    const { searchNorms } = await import("../qdrant");
    const results = await searchNorms("test");
    expect(results).toEqual([]);
  });
});
