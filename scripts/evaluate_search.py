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
    return norm_id.strip().lstrip("\u00a7").strip()


def search_qdrant(client: QdrantClient, query: str, top_k: int = 50) -> list[dict]:
    """Run a Qdrant search matching our searchNorms() logic.

    Uses Qdrant managed inference (cloud_inference=True) with e5-small.
    Replicates the core query from qdrant.ts for benchmark purposes.
    """
    prefixed = f"query: {query}"
    try:
        result = client.query_points(
            collection_name=COLLECTION,
            query=models.Document(text=prefixed, model=INFERENCE_MODEL),
            limit=top_k,
            with_payload=True,
        )
        resp = result.model_dump()
        points = resp.get("points", [])
        return [
            {
                "norm_id": normalize_norm_id(
                    (p.get("payload", {}) or {}).get("norm_id", "")
                ),
                "law_key": (p.get("payload", {}) or {}).get("law_key", ""),
                "score": p.get("score", 0) or 0,
            }
            for p in points
            if p.get("payload")
        ]
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
    print(f"Loaded {len(data)} evaluation questions\n")

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

        print(f"  [{i + 1}/{len(data)}] Q: {question[:60]}...", end=" ")

        start = time.time()
        results = search_qdrant(client, question)
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
    print(f"RESULTS (E5-small, {len(all_mrr)} queries)")
    print("=" * 50)
    print(f"  MRR       = {avg_mrr:.4f}")
    for k in [1, 3, 5, 10]:
        print(f"  Recall@{k} = {avg_recall[k]:.4f}")
    print("=" * 50)

    # Save results
    report = {
        "model": INFERENCE_MODEL,
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
