"""
process_de_laws.py — Parse all XML laws in ./de_federal_raw and write
structured data directly into the SQLite database (laws.db).

Parsing is done in parallel using multiprocessing (worker processes parse
XML and return structured dicts).  Database writes are serialised in the
main process to avoid SQLite locking issues on Windows.

Usage:
    python process_de_laws.py
"""

import json
import logging
import multiprocessing
import os
import re
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Union

from bs4 import BeautifulSoup
from tqdm import tqdm

from database.db import init_db, get_connection, DB_PATH

from category_pipeline import classify_category

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
XML_DIR_PATH = "./de_federal_raw"

# Optional allowlist filter — leave as () to process everything.
FILE_FILTER: tuple = ()

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ---------------------------------------------------------------------------
# Category inference (mirrors the logic that was in app.py)
# ---------------------------------------------------------------------------
_CAT_KEYWORDS = {
    "housing":  ["miet", "wohnung", "pacht", "eigenbedarf", "nachbar", "räumung",
                 "kaution", "betriebskosten", "heizkosten", "modernisierung",
                 "wohngeld", "immobilie", "grundstück", "grundbuch", "makler"],
    "labor":    ["arbeit", "kündigung", "lohn", "gehalt", "tarif", "streik",
                 "urlaub", "arbeitszeit", "überstunden", "abmahnung", "zeugnis",
                 "betriebsrat", "elternzeit", "mutterschutz", "mindestlohn"],
    "consumer": ["kauf", "gewährleistung", "garantie", "mangel", "widerruf",
                 "vertrag", "fernabsatz", "agb", "reklamation", "produkthaftung",
                 "darlehen", "kredit", "inkasso", "mahnung", "verzug"],
    "traffic":  ["verkehr", "stvo", "parken", "unfall", "bußgeld", "führerschein",
                 "geschwindigkeit", "alkohol", "kfz", "versicherung", "bahn",
                 "fahrrad", "e-scooter", "tüv", "zulassung"],
    "family":   ["ehe", "kind", "scheidung", "unterhalt", "erbe", "sorgerecht",
                 "umgang", "jugendamt", "testament", "adoption", "namensrecht",
                 "lebenspartnerschaft", "gewaltschutz", "nachlass"],
    "criminal": ["stgb", "straf", "diebstahl", "betrug", "körperverletzung",
                 "nötigung", "bedrohung", "beleidigung", "raub", "erpressung",
                 "mord", "totschlag", "btmg", "brandstiftung", "hehlerei"],
    "finance":  ["steuer", "finanz", "abgabe", "einkommen", "bank", "zins",
                 "umsatzsteuer", "gewerbe", "körperschaft", "zoll", "insolvenz",
                 "vermögen", "schenkung", "aktie", "börse", "pfändung"],
    "social":   ["sgb", "rente", "kranken", "pflege", "sozial", "bürgergeld",
                 "behinderung", "rehabilitation", "unfallversicherung",
                 "arbeitslosengeld", "kindergeld", "elternzeit"],
    "public":   ["grundgesetz", "asyl", "ausländer", "polizei", "verwaltung",
                 "datenschutz", "dsgvo", "wahl", "parlament", "gemeinde",
                 "einbürgerung", "visum", "aufenthalt", "meinungsfreiheit"],
    "tech":     ["umwelt", "bau", "energie", "digital", "internet", "patent",
                 "urheber", "marke", "telekommunikation", "klima", "abfall",
                 "emission", "software", "it-sicherheit"],
    "berlin":   ["bln", "berlin", "bauo", "vbln", "senat", "bezirk"],
}


def _categorize(title: str, key: str) -> str:
    text = (title + " " + key).lower()
    for cat_id, keywords in _CAT_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return cat_id
    return "other"


def _infer_authority(title: str, key: str) -> str:
    t, k = title.upper(), key.upper()
    if "GESETZ" in t or k.endswith("G"):
        return "Federal Law"
    if "ORDNUNG" in t or "VERORDNUNG" in t:
        return "Regulation"
    if any(x in k for x in ["BGH", "BVERFG", "BSG", "BFH"]):
        return "Court Decision"
    return "Regulation"


def _infer_status(title: str) -> str:
    t = title.lower()
    if "außer kraft" in t or "weggefallen" in t or "(a.f.)" in t:
        return "Invalid/Amended"
    return "Active"


def _infer_jurisdiction(key: str, title: str) -> str:
    if "berlin" in key.lower() or "berlin" in title.lower():
        return "Berlin (State)"
    return "Germany (Federal)"


# ---------------------------------------------------------------------------
# Filesystem utilities
# ---------------------------------------------------------------------------

def collect_xml_files(root_dir: str, file_filter: tuple) -> List[str]:
    """Walk root_dir recursively and return absolute paths of all matching XMLs."""
    results: List[str] = []
    if not os.path.exists(root_dir):
        return results
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            if not fname.endswith(".xml"):
                continue
            if fname.startswith(".") or fname == ".gitkeep":
                continue
            if file_filter and not any(fname.startswith(f) for f in file_filter):
                continue
            results.append(os.path.abspath(os.path.join(dirpath, fname)))
    return results


# ---------------------------------------------------------------------------
# XML helpers (unchanged from original)
# ---------------------------------------------------------------------------

def convert_xml_to_dict(
    element, expected_type: Optional[type] = None
) -> Union[str, Dict]:
    if element.string and not element.find():
        return element.string.strip()
    children_dict: Dict = {}
    for child in element.contents:
        if not child.name:
            continue
        value = convert_xml_to_dict(child)
        if child.name in children_dict:
            existing = children_dict[child.name]
            if isinstance(existing, list):
                existing.append(value)
            else:
                children_dict[child.name] = [existing, value]
        else:
            children_dict[child.name] = value
    if expected_type is not None and not isinstance(children_dict, expected_type):
        return {}
    return children_dict


def _remove_year_suffix(key: str) -> str:
    return re.sub(r"\d{4}$", "", key).strip()


def _extract_content_tag(law_tag):
    textdaten = law_tag.find("textdaten")
    if textdaten:
        text = textdaten.find("text")
        if text:
            return text.find("Content")
    return None


def _get_p_first_token(p_tag) -> str:
    text = p_tag.get_text(strip=True)
    if not text:
        return ""
    return text.split()[0]


# ---------------------------------------------------------------------------
# Paragraph-level helpers (unchanged from original)
# ---------------------------------------------------------------------------

def _deduplicate_id(candidate: Union[int, str], existing_paragraphs: List[Dict]) -> str:
    existing_ids = {p["id"] for p in existing_paragraphs}
    res = str(candidate)
    while res in existing_ids:
        res += "_"
    return res


def _resolve_paragraph_number(
    p_tag, p_i: int, p_is_numbered: bool, existing_paragraphs: List[Dict]
) -> tuple[str, bool, bool]:
    first_token = _get_p_first_token(p_tag)
    number_missing = False
    is_numbered_pattern = bool(re.match(r"^\(?\d+[\.\)]?$", first_token)) or first_token.startswith("§")
    if is_numbered_pattern:
        number = first_token.strip("().")
        p_is_numbered = True
    else:
        if p_is_numbered:
            number = existing_paragraphs[-1]["id"] if existing_paragraphs else str(p_i)
            number_missing = True
        else:
            number = str(p_i)
    number = _deduplicate_id(number, existing_paragraphs)
    return number, p_is_numbered, number_missing


def _append_or_extend_paragraph(
    this_norm: Dict, p_tag, number: str, number_missing: bool,
    norm_id_for_log: str, filename: str, unprocessed_absatze: List[str],
) -> None:
    text = p_tag.get_text(" ", strip=True)
    if not text:
        return
    if number_missing and this_norm["paragraphs"]:
        this_norm["paragraphs"][-1]["text"] += "\n" + text
    else:
        this_norm["paragraphs"].append({"id": number, "text": text})


# ---------------------------------------------------------------------------
# Norm-level helper (unchanged logic, but returns structured data)
# ---------------------------------------------------------------------------

def _parse_norm(law_tag, output: Dict, filename: str, unprocessed_absatze: List[str]) -> None:
    metadaten_tag = law_tag.find("metadaten")
    if not metadaten_tag:
        return
    enbez_tag = metadaten_tag.find("enbez")
    jurabk_tag = metadaten_tag.find("jurabk")
    doknr_attr = str(law_tag.get("doknr", "")).strip()
    norm_id = (
        enbez_tag.get_text(strip=True) if enbez_tag and enbez_tag.get_text(strip=True)
        else (doknr_attr if doknr_attr
              else (jurabk_tag.get_text(strip=True) if jurabk_tag and jurabk_tag.get_text(strip=True)
                    else "unknown"))
    )
    title = ""
    titel_tag = metadaten_tag.find("titel")
    if titel_tag:
        title = titel_tag.get_text(strip=True)
    this_norm: Dict = {"norm_id": norm_id, "title": title, "paragraphs": []}
    content_tag = _extract_content_tag(law_tag)
    if content_tag:
        p_tags = content_tag.find_all("P", recursive=False)
        p_is_numbered = False
        for i, p_tag in enumerate(p_tags):
            num, p_is_numbered, missing = _resolve_paragraph_number(
                p_tag, i, p_is_numbered, this_norm["paragraphs"]
            )
            _append_or_extend_paragraph(
                this_norm, p_tag, num, missing, norm_id, filename, unprocessed_absatze
            )
    if title or this_norm["paragraphs"]:
        output["norms"].append(this_norm)


def _dedupe_exact_norms(norms: List[Dict]) -> List[Dict]:
    seen = set()
    deduped: List[Dict] = []
    for norm in norms:
        norm_id = str(norm.get("norm_id", "")).strip()
        title   = str(norm.get("title", "")).strip()
        paragraphs = norm.get("paragraphs", []) or []
        para_sig = tuple(
            (str(p.get("id", "")).strip(), str(p.get("text", "")).strip())
            for p in paragraphs
        )
        sig = (norm_id, title, para_sig)
        if sig in seen:
            continue
        seen.add(sig)
        deduped.append(norm)
    return deduped


def _score_norm(norm: Dict) -> tuple[int, int, int]:
    paragraphs = norm.get("paragraphs", []) or []
    return (len(paragraphs),
            sum(len(str(p.get("text", ""))) for p in paragraphs),
            len(str(norm.get("title", ""))))


def _dedupe_norm_ids(norms: List[Dict]) -> List[Dict]:
    deduped: List[Dict] = []
    slot_by_id: Dict[str, int] = {}
    for norm in norms:
        norm_id = str(norm.get("norm_id", "")).strip()
        if not norm_id:
            deduped.append(norm)
            continue
        slot = slot_by_id.get(norm_id)
        if slot is None:
            slot_by_id[norm_id] = len(deduped)
            deduped.append(norm)
            continue
        if _score_norm(norm) > _score_norm(deduped[slot]):
            deduped[slot] = norm
    return deduped


# ---------------------------------------------------------------------------
# Top-level file parser — runs in worker processes
# Returns a plain dict (no SQLite connection in worker process)
# ---------------------------------------------------------------------------

def process_file(xml_path: str) -> Optional[Dict]:
    """Parse one XML file and return a structured dict, or None on failure."""
    filename = os.path.basename(xml_path)
    unprocessed_absatze: List[str] = []
    try:
        with open(xml_path, encoding="utf-8", errors="replace") as fh:
            soup = BeautifulSoup(fh, "lxml-xml")
    except Exception as exc:
        logging.error("Parse error in %s: %s", xml_path, exc)
        return None

    metadaten_tag = soup.find("metadaten")
    if not metadaten_tag:
        return None
    try:
        metadaten = convert_xml_to_dict(metadaten_tag, dict)
    except Exception:
        return None

    raw_key = metadaten.get("jurabk", metadaten.get("amtabk", "unknown"))
    if isinstance(raw_key, list):
        raw_key = raw_key[0]
    if not raw_key:
        return None
    raw_key = str(raw_key).strip()
    if not raw_key:
        return None

    langue_tag = soup.find("langue")
    title = langue_tag.text if langue_tag else str(raw_key)
    last_changed = metadaten.get("ausfertigung-datum", "")
    if isinstance(last_changed, dict):
        last_changed = last_changed.get("#text", "") or ""

    output: Dict = {
        "raw_key": str(raw_key),
        "source":  filename,
        "title":   title,
        "last_changed": str(last_changed),
        "norms": [],
    }

    for law_tag in soup.find_all("norm"):
        _parse_norm(law_tag, output, filename, unprocessed_absatze)

    output["norms"] = _dedupe_exact_norms(output["norms"])
    output["norms"] = _dedupe_norm_ids(output["norms"])
    return output


# ---------------------------------------------------------------------------
# Key resolution (same logic as before, but operates on dicts not file paths)
# ---------------------------------------------------------------------------

def resolve_keys(results: List[Dict]) -> Dict[str, Dict]:
    """Map final law key → parsed dict."""
    final_mapping: Dict[str, Dict] = {}
    key_to_raw: Dict[str, str] = {}
    for result in results:
        raw_key = result["raw_key"]
        stripped = _remove_year_suffix(raw_key)
        if stripped not in final_mapping:
            final_mapping[stripped] = result
            key_to_raw[stripped] = raw_key
        else:
            prev_raw = key_to_raw[stripped]
            if prev_raw != stripped:
                final_mapping[prev_raw] = final_mapping.pop(stripped)
            final_mapping[raw_key] = result
            key_to_raw[raw_key] = raw_key
    return final_mapping


# ---------------------------------------------------------------------------
# Database writing — runs in the main process (serialised)
# ---------------------------------------------------------------------------

def write_law_to_db(conn: "sqlite3.Connection", key: str, data: Dict) -> None:
    """Insert or replace one law and all its norms into the database."""
    title    = data.get("title", "") or ""
    source   = data.get("source", "") or ""
    last_ch  = data.get("last_changed", "") or ""
    prediction = classify_category(title, key, title)
    category = prediction.category
    category_confidence = round(prediction.confidence, 4)
    authority    = _infer_authority(title, key)
    status       = _infer_status(title)
    jurisdiction = _infer_jurisdiction(key, title)

    # Upsert the law row
    conn.execute(
        """
        INSERT INTO laws (key, title, alt_title, category, category_confidence, authority, status,
                          jurisdiction, last_changed, source)
        VALUES (:key, :title, '', :category, :category_confidence, :authority, :status,
                :jurisdiction, :last_changed, :source)
        ON CONFLICT(key) DO UPDATE SET
            title                = excluded.title,
            category             = excluded.category,
            category_confidence  = excluded.category_confidence,
            authority            = excluded.authority,
            status               = excluded.status,
            jurisdiction         = excluded.jurisdiction,
            last_changed         = excluded.last_changed,
            source               = excluded.source
        """,
        {
            "key": key, "title": title, "category": category,
            "category_confidence": category_confidence,
            "authority": authority, "status": status,
            "jurisdiction": jurisdiction, "last_changed": last_ch, "source": source,
        },
    )

    law_id = conn.execute("SELECT id FROM laws WHERE key = ?", (key,)).fetchone()[0]

    # Preserve existing embeddings before re-inserting norms
    old_embeddings = {
        row["norm_id"]: row["embedding"]
        for row in conn.execute(
            "SELECT norm_id, embedding FROM norms WHERE law_id = ? AND embedding IS NOT NULL",
            (law_id,),
        ).fetchall()
    }

    # Remove old norms before re-inserting (handles re-processing)
    conn.execute("DELETE FROM norms WHERE law_id = ?", (law_id,))

    # Insert all norms
    for norm in data.get("norms", []):
        norm_id_str = str(norm.get("norm_id", "")).strip()
        norm_title  = str(norm.get("title", "")).strip()
        paragraphs  = norm.get("paragraphs", []) or []
        content     = "\n".join(
            str(p.get("text", "")) for p in paragraphs if p.get("text")
        )
        token_count = len(content.split())
        conn.execute(
            """
            INSERT INTO norms (law_id, norm_id, title, content, token_count)
            VALUES (?, ?, ?, ?, ?)
            """,
            (law_id, norm_id_str, norm_title, content, token_count),
        )
        # Restore embedding if we had one for this norm_id
        if norm_id_str in old_embeddings:
            conn.execute(
                "UPDATE norms SET embedding = ? WHERE law_id = ? AND norm_id = ?",
                (old_embeddings[norm_id_str], law_id, norm_id_str),
            )

    # Upsert law_versions record
    now = datetime.utcnow().isoformat()
    conn.execute(
        """
        INSERT INTO law_versions (law_key, last_changed, checksum, checked_at)
        VALUES (:key, :last_changed, '', :now)
        ON CONFLICT(law_key) DO UPDATE SET
            last_changed = excluded.last_changed,
            checked_at   = excluded.checked_at
        """,
        {"key": key, "last_changed": last_ch, "now": now},
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("[1/3] Initialising database …")
    init_db()

    xml_files = collect_xml_files(XML_DIR_PATH, FILE_FILTER)
    if not xml_files:
        print("[FATAL] No XML files found in ./de_federal_raw  — run download_de_laws.py first.")
        return

    cpu_count = min(8, multiprocessing.cpu_count())
    print(f"[2/3] Parsing {len(xml_files)} XML files using {cpu_count} worker processes …")

    raw_results: List[Dict] = []
    pool = multiprocessing.Pool(processes=cpu_count)
    try:
        with tqdm(total=len(xml_files), desc="Parsing XML", dynamic_ncols=True) as pbar:
            for res in pool.imap_unordered(process_file, xml_files):
                pbar.update()
                if res:
                    raw_results.append(res)
    finally:
        pool.close()
        pool.join()

    print(f"      Parsed {len(raw_results)} files successfully.")

    key_to_data = resolve_keys(raw_results)
    print(f"[3/3] Writing {len(key_to_data)} laws to {DB_PATH} …")

    conn = get_connection()
    try:
        with tqdm(total=len(key_to_data), desc="Writing DB", dynamic_ncols=True) as pbar:
            for key, data in key_to_data.items():
                write_law_to_db(conn, key, data)
                pbar.update()
        conn.commit()
    except Exception as exc:
        conn.rollback()
        logging.error("Database write failed: %s", exc)
        raise
    finally:
        conn.close()

    # Quick verification
    verify_conn = get_connection()
    law_count  = verify_conn.execute("SELECT COUNT(*) FROM laws").fetchone()[0]
    norm_count = verify_conn.execute("SELECT COUNT(*) FROM norms").fetchone()[0]
    verify_conn.close()

    print(f"\n[OK] Done — {law_count} laws, {norm_count} norms written to {DB_PATH}")

    # Step 2.3 — Generate vector embeddings
    print("\n[Phase 2/2] Generating vector embeddings …")
    try:
        from vector_search import embed_all_norms
        embed_all_norms()
        print("[OK] Vector embeddings generated successfully.")
    except Exception as exc:
        print(f"[WARNING] Could not generate embeddings: {exc}")
        print("Embeddings will be generated during the Setup Wizard or when Ollama is available.")

    # Step 3.2 — Generate cross-reference graph
    print("\n[Phase 3] Generating cross-reference graph …")
    try:
        from cross_reference_parser import parse_all_cross_references
        parse_all_cross_references()
        print("[OK] Cross-reference graph generated successfully.")
    except Exception as exc:
        print(f"[WARNING] Could not generate cross-references: {exc}")


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
