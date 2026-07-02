#!/usr/bin/env python3
"""Evaluate Qdrant search quality against the GerLayQA benchmark.

Usage:
    python scripts/evaluate_search.py [--qdrant-url URL] [--qdrant-key KEY]

Requires:
    QDRANT_URL, QDRANT_API_KEY env vars (or --qdrant-url, --qdrant-key)

Output:
    Prints metrics table + saves docs/eval_results.json
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

try:
    from qdrant_client import QdrantClient, models
except ImportError:
    print("ERROR: qdrant_client not installed. Run: pip install qdrant-client")
    sys.exit(1)

COLLECTION = "german_norms"
INFERENCE_MODEL = "intfloat/multilingual-e5-small"
# Resolve project root (two levels up from scripts/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
METRICS_FILE = PROJECT_ROOT / "docs" / "eval_results.json"


def load_benchmark() -> dict:
    """Load the GerLayQA bgb_eval.json from data/."""
    paths = [
        PROJECT_ROOT / "data" / "bgb_eval.json",
        Path("data/bgb_eval.json"),
        Path("bgb_eval.json"),
    ]
    for p in paths:
        if p.exists():
            with open(p) as f:
                return json.load(f)

    print(f"ERROR: bgb_eval.json not found. Tried: {[str(p) for p in paths]}")
    sys.exit(1)


def normalize_norm_id(norm_id: str) -> str:
    """Normalize norm IDs to match Qdrant payload format.

    GerLayQA uses e.g. '433' for 433 BGB.
    Qdrant payload uses 'norm_id' like '433' or '433_1'.
    """
    return str(norm_id).strip().lstrip("\u00a7").strip()


def tokenize_for_bm25(text: str) -> list[str]:
    """Tokenize text for BM25 scoring."""
    return re.findall(r"[\wäöüß]+", text.lower())


def extract_query_terms(query: str) -> set[str]:
    """Extract search terms from a query for BM25 scoring."""
    terms = set()
    for word in query.lower().split():
        clean = re.sub(r"^[^a-zäöüß0-9]+|[^a-zäöüß0-9]+$", "", word)
        if len(clean) >= 2:
            terms.add(clean)
    return terms


def extract_query_keywords(query: str) -> set[str]:
    """Extract significant keywords from a query for reranking purposes."""
    STOP_WORDS = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "shall",
        "should", "may", "might", "must", "can", "could", "i", "me", "my",
        "we", "our", "you", "your", "he", "she", "it", "they", "them", "their",
        "this", "that", "these", "those", "in", "on", "at", "by", "to", "for",
        "of", "with", "from", "into", "about", "and", "or", "but", "not",
        "what", "which", "who", "whom", "how", "when", "where", "why", "if",
        "then", "else", "so", "no", "off", "out", "up", "down", "just", "very",
        "too", "really", "already", "also", "get", "got", "need", "want",
        "ask", "tell", "know", "think", "oh", "hi", "hello", "hey",
        # German stop words
        "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen",
        "einem", "eines", "und", "oder", "aber", "nicht", "ist", "sind",
        "war", "waren", "hat", "haben", "hatte", "wird", "werden", "wurde",
        "kann", "können", "muss", "müssen", "bei", "mit", "nach", "vor",
        "zu", "auf", "aus", "in", "über", "unter", "für", "gegen", "ohne",
        "um", "durch",
    }
    keywords = set()
    for word in query.lower().split():
        clean = re.sub(r"^[^a-zäöüß]+|[^a-zäöüß]+$", "", word)
        if len(clean) >= 3 and clean not in STOP_WORDS:
            keywords.add(clean)
    return keywords


def rerank_by_keywords(results: list[dict], query: str) -> list[dict]:
    """Rerank search results by boosting results with keyword matches."""
    if not results or not query.strip():
        return results

    keywords = extract_query_keywords(query)
    if not keywords:
        return results

    for r in results:
        boost = 0
        search_text = (
            f"{r.get('law_title', '')} {r.get('norm_title', '')} "
            f"{r.get('law_key', '')} {r.get('norm_id', '')}"
        ).lower()

        for kw in keywords:
            if kw in search_text:
                boost += 0.1

        boost = min(boost, 0.5)
        r["score"] = r["score"] * (1 + boost)

    results.sort(key=lambda x: x["score"], reverse=True)
    return results


def boost_law_diversity(results: list[dict], top_k: int) -> list[dict]:
    """Apply diversity boost and per-law cap."""
    if not results:
        return results

    law_counts = {}
    for r in results:
        lk = r.get("law_key", "")
        law_counts[lk] = law_counts.get(lk, 0) + 1

    max_per_law = max(3, int(top_k * 0.25))
    per_law_count = {}
    boosted = []

    for r in results:
        lk = r.get("law_key", "")
        count = law_counts.get(lk, 1)
        diversity_boost = 1 + min(0.2, (count - 1) * 0.02)
        r["score"] = r["score"] * diversity_boost

    # Re-sort after boost
    results.sort(key=lambda x: x["score"], reverse=True)

    for r in results:
        lk = r.get("law_key", "")
        current = per_law_count.get(lk, 0)
        if current >= max_per_law:
            continue
        per_law_count[lk] = current + 1
        boosted.append(r)

    return boosted[:top_k]


def search_qdrant(
    client: QdrantClient, query: str, top_k: int = 50, alpha: float = 1.0
) -> list[dict]:
    """Run a Qdrant search matching our searchNorms() hybrid logic."""
    prefixed = f"query: {query}"
    # Match app's pool size (top_k * 2)
    pool_size = top_k * 2

    try:
        result = client.query_points(
            collection_name=COLLECTION,
            query=models.Document(text=prefixed, model=INFERENCE_MODEL),
            limit=pool_size,
            with_payload=True,
        )
        resp = result.model_dump()
        points = resp.get("points", [])

        parsed = []
        for p in points:
            payload = p.get("payload", {}) or {}
            parsed.append(
                {
                    "norm_id": normalize_norm_id(payload.get("norm_id", "")),
                    "law_key": payload.get("law_key", ""),
                    "law_title": payload.get("law_title", ""),
                    "norm_title": payload.get("norm_title", ""),
                    "content": payload.get("content", ""),
                    "dense_score": p.get("score", 0) or 0,
                }
            )

        if not parsed:
            return []

        # Client-side BM25 Re-ranking
        if alpha < 1.0:
            query_terms = extract_query_terms(query)
            if query_terms:
                doc_term_freqs = []
                for doc in parsed:
                    text = f"{doc['law_title']} {doc['norm_title']} {doc['content']}"
                    tokens = tokenize_for_bm25(text)
                    tf = {}
                    for t in tokens:
                        tf[t] = tf.get(t, 0) + 1
                    doc_term_freqs.append({"len": len(tokens), "tf": tf})

                num_docs = len(parsed)
                df = {}
                for term in query_terms:
                    df[term] = sum(1 for d in doc_term_freqs if term in d["tf"])

                import math

                bm25_scores = []
                k1 = 1.2
                b = 0.75
                avgdl = 600  # Matching qdrant.ts

                for i, doc_info in enumerate(doc_term_freqs):
                    score = 0
                    for term in query_terms:
                        tf = doc_info["tf"].get(term, 0)
                        if tf == 0:
                            continue
                        d_f = df.get(term, 1)
                        idf = math.log(1 + (num_docs - d_f + 0.5) / (d_f + 0.5))
                        num = tf * (k1 + 1)
                        den = tf + k1 * (1 - b + b * (doc_info["len"] / avgdl))
                        score += idf * (num / den)
                    bm25_scores.append(score)

                # Normalize and fuse
                max_dense = max((d["dense_score"] for d in parsed), default=1e-10)
                max_bm25 = max(bm25_scores, default=1e-10)

                for i, doc in enumerate(parsed):
                    norm_dense = doc["dense_score"] / max_dense
                    norm_bm25 = bm25_scores[i] / max_bm25
                    doc["score"] = alpha * norm_dense + (1 - alpha) * norm_bm25
            else:
                for doc in parsed:
                    doc["score"] = doc["dense_score"]
        else:
            for doc in parsed:
                doc["score"] = doc["dense_score"]

        # Sort by final score
        parsed.sort(key=lambda x: x["score"], reverse=True)

        # Apply keyword reranking + law diversity (matching qdrant.ts)
        parsed = rerank_by_keywords(parsed, query)
        parsed = boost_law_diversity(parsed, top_k)

        return parsed

    except Exception as e:
        print(f"  [ERROR] Qdrant search failed: {e}")
        return []


def compute_metrics(results: list[dict], relevant_ids: set[str]) -> dict:
    """Compute Recall@k and MRR."""
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
    parser.add_argument("--alpha", type=float, default=1.0, help="Hybrid alpha (1.0 = dense only, 0.0 = BM25 only)")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of evaluation queries (0 = all)")
    args = parser.parse_args()

    if not args.qdrant_url or not args.qdrant_key:
        print("ERROR: QDRANT_URL and QDRANT_API_KEY required via env or --flags")
        sys.exit(1)

    client = QdrantClient(
        url=args.qdrant_url,
        api_key=args.qdrant_key,
        cloud_inference=True,
    )

    # Verify collection exists
    collections = client.get_collections()
    if COLLECTION not in [c.name for c in collections.collections]:
        print(f"ERROR: Collection '{COLLECTION}' not found on this Qdrant instance")
        sys.exit(1)

    print("Loading benchmark data...")
    data = load_benchmark()
    if args.limit > 0:
        data = data[:args.limit]
    print(f"Evaluating {len(data)} questions with alpha={args.alpha}\n")

    all_recall = {1: [], 3: [], 5: [], 10: []}
    all_mrr = []
    per_query = []

    for i, item in enumerate(data):
        question = item.get("Question_text", "")
        relevant = item.get("Paragraphs", [])

        if isinstance(relevant, list):
            relevant_ids = {normalize_norm_id(r) for r in relevant}
        elif isinstance(relevant, str):
            relevant_ids = {normalize_norm_id(relevant)}
        else:
            relevant_ids = set()

        if not question or not relevant_ids:
            continue

        print(f"  [{i + 1}/{len(data)}] Q: {question[:60].replace('\n', ' ')}...", end=" ")

        start = time.time()
        results = search_qdrant(client, question, alpha=args.alpha)
        elapsed = time.time() - start

        metrics = compute_metrics(results, relevant_ids)
        all_mrr.append(metrics["mrr"])
        for k in [1, 3, 5, 10]:
            all_recall[k].append(metrics["recall"][k])

        per_query.append(
            {
                "question": question,
                "relevant": list(relevant_ids),
                "top_norm_ids": [r["norm_id"] for r in results[:10]],
                "metrics": metrics,
                "elapsed_s": round(elapsed, 2),
            }
        )

        print(
            f"MRR={metrics['mrr']:.3f} "
            f"R@1={metrics['recall'][1]:.3f} "
            f"R@5={metrics['recall'][5]:.3f} "
            f"R@10={metrics['recall'][10]:.3f} "
            f"({elapsed:.1f}s)"
        )

    # Aggregate
    avg_recall = {k: sum(v) / max(len(v), 1) for k, v in all_recall.items()}
    avg_mrr = sum(all_mrr) / max(len(all_mrr), 1)

    print()
    print("=" * 50)
    print(f"RESULTS (alpha={args.alpha}, {len(all_mrr)} queries)")
    print("=" * 50)
    print(f"  MRR       = {avg_mrr:.4f}")
    for k in [1, 3, 5, 10]:
        print(f"  Recall@{k} = {avg_recall[k]:.4f}")
    print("=" * 50)

    # Save results
    report = {
        "model": INFERENCE_MODEL,
        "alpha": args.alpha,
        "date": time.strftime("%Y-%m-%d"),
        "num_queries": len(all_mrr),
        "avg_mrr": round(avg_mrr, 4),
        "avg_recall": {str(k): round(v, 4) for k, v in avg_recall.items()},
        "per_query": per_query,
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nFull results saved to {output_path}")


if __name__ == "__main__":
    main()
