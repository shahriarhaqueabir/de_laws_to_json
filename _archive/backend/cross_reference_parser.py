"""
cross_reference_parser.py — Extract in-law citations from norm contents and store them
in the database for the cross-reference graph.
"""

import re
import logging
from typing import List, Dict, Tuple
from database.db import get_connection, get_db

logger = logging.getLogger("cross_reference")
logger.setLevel(logging.INFO)

# Regex patterns for matching German legal citations
PATTERNS = [
    # Match "§ 242 BGB", "§ 823 Abs. 1 BGB", "§ 123 S. 2 StGB"
    r'§\s*(\d+[a-z]*)\s+(?:Abs\.\s*\d+\s+)?(?:S\.\s*\d+\s+)?(BGB|StGB|GG|ZPO|StPO|HGB|SGB|OWiG|VwGO|BetrVG)',
    # Match "BGB § 242"
    r'(BGB|StGB|GG|ZPO|StPO|HGB|SGB|OWiG|VwGO|BetrVG)\s*§\s*(\d+[a-z]*)',
    # Match "Art. 1 GG", "Art. 5 EUV"
    r'Art\.\s*(\d+[a-z]*)\s+(GG|AEUV|EUV)',
    # Match "i.V.m. § 242 BGB"
    r'i\.V\.m\.\s*§\s*(\d+[a-z]*)\s+(BGB|StGB|GG|ZPO)',
]

def extract_references(source_norm_id: int, content: str) -> List[Dict]:
    """
    Scan content for references to other laws/norms.
    Returns a list of dicts: [{'source_norm_id': x, 'target_law': y, 'target_norm': z}]
    """
    if not content:
        return []

    references = []
    seen = set()  # avoid duplicate relations within the same norm

    for pattern in PATTERNS:
        matches = re.findall(pattern, content, re.IGNORECASE)
        for match in matches:
            # Reconstruct target_law and target_norm based on pattern group layout
            if len(match) == 2:
                # Group 1 can be norm number or law name depending on pattern
                val1, val2 = match
                val1_is_digit = bool(re.match(r'^\d', val1))
                
                if val1_is_digit:
                    target_norm = f"§{val1}"
                    target_law = val2.upper()
                else:
                    target_law = val1.upper()
                    target_norm = f"§{val2}"
            else:
                continue

            ref_sig = (target_law, target_norm)
            if ref_sig not in seen:
                seen.add(ref_sig)
                references.append({
                    "source_norm_id": source_norm_id,
                    "target_law": target_law,
                    "target_norm": target_norm
                })

    return references

def parse_all_cross_references() -> None:
    """
    Scan all norms in the SQLite database, extract cross-references,
    and bulk-insert them into the cross_references table.
    """
    logger.info("Scanning norms for cross-references...")
    
    conn = get_connection()
    try:
        # Load all norms
        norms = conn.execute("SELECT id, content FROM norms").fetchall()
        
        all_refs = []
        for norm in norms:
            norm_id = norm["id"]
            content = norm["content"] or ""
            refs = extract_references(norm_id, content)
            all_refs.extend(refs)

        # Clear existing cross-references to avoid duplicates on re-run
        conn.execute("DELETE FROM cross_references")
        
        # Bulk insert
        if all_refs:
            conn.executemany(
                """
                INSERT INTO cross_references (source_norm_id, target_law, target_norm)
                VALUES (:source_norm_id, :target_law, :target_norm)
                """,
                all_refs
            )
            conn.commit()
            logger.info(f"Parsed references in {len(norms)} norms. Found {len(all_refs)} cross-references.")
        else:
            logger.info("No cross-references found.")
            
    except Exception as e:
        logger.error(f"Error parsing cross-references: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()
