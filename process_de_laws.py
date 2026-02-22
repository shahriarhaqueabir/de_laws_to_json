"""
Processes all XML laws in ./de_federal_raw (and its subdirectories) and writes
structured JSON to ./de_federal_json as individual files.

This script uses multiprocessing to handle the XML parsing. To avoid
IPC (Inter-Process Communication) errors on Windows with extremely large laws,
it writes the JSON files directly to disk within the worker processes and
only returns the file paths to the main process for key resolution and cleanup.
"""

import json
import logging
import multiprocessing
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Union

from bs4 import BeautifulSoup
from tqdm import tqdm

# --- Configuration ---
XML_DIR_PATH = "./de_federal_raw"
JSON_DIR_PATH = "./de_federal_json"

# Optional allowlist filter: set to a non-empty tuple of filename stems such as
# ('BJNR002190897', 'BJNR119530979') to process only those specific files.
# Leave as an EMPTY tuple () to process everything.
FILE_FILTER: tuple = ()

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(message)s",
)


# ---------------------------------------------------------------------------
# Filesystem utilities
# ---------------------------------------------------------------------------


def collect_xml_files(root_dir: str, file_filter: tuple) -> List[str]:
    """
    Walk *root_dir* recursively and return absolute paths of all matching XMLs.
    """
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
# XML helpers
# ---------------------------------------------------------------------------


def convert_xml_to_dict(
    element, expected_type: Optional[type] = None
) -> Union[str, Dict]:
    """
    Recursively convert a BeautifulSoup element into a plain Python dict.
    Repeated sibling tags are promoted to lists automatically.
    """
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
        return {}  # Fallback
    return children_dict


def _remove_year_suffix(key: str) -> str:
    """Strip a trailing 4-digit year from an abbreviation ('UStG1980' → 'UStG')."""
    return re.sub(r"\d{4}$", "", key)


def _extract_content_tag(law_tag):
    """Return the <Content> tag inside <textdaten><text>, or None."""
    textdaten = law_tag.find("textdaten")
    if textdaten:
        text = textdaten.find("text")
        if text:
            return text.find("Content")
    return None


def _get_p_first_token(p_tag) -> str:
    """Return the first token of a <P> tag for numbering detection."""
    text = p_tag.get_text(strip=True)
    if not text:
        return ""
    return text.split()[0]


# ---------------------------------------------------------------------------
# Paragraph-level helpers
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

    # Detection logic for German law paragraph numbering (e.g. "(1)", "1.", "§ 1")
    is_numbered_pattern = bool(
        re.match(r"^\(?\d+[\.\)]?$", first_token)
    ) or first_token.startswith("§")

    if is_numbered_pattern:
        number = first_token.strip("().")
        p_is_numbered = True
    else:
        if p_is_numbered:
            # If we were in a numbered list and this P is not numbered, it's a continuation
            number = existing_paragraphs[-1]["id"] if existing_paragraphs else str(p_i)
            number_missing = True
        else:
            number = str(p_i)

    number = _deduplicate_id(number, existing_paragraphs)
    return number, p_is_numbered, number_missing


def _append_or_extend_paragraph(
    this_norm: Dict,
    p_tag,
    number: str,
    number_missing: bool,
    norm_id_for_log: str,
    filename: str,
    unprocessed_absatze: List[str],
) -> None:
    text = p_tag.get_text(" ", strip=True)
    if not text:
        return

    if number_missing and this_norm["paragraphs"]:
        this_norm["paragraphs"][-1]["text"] += "\n" + text
    else:
        this_norm["paragraphs"].append({"id": number, "text": text})


# ---------------------------------------------------------------------------
# Norm-level helper
# ---------------------------------------------------------------------------


def _parse_norm(
    law_tag, output: Dict, filename: str, unprocessed_absatze: List[str]
) -> None:
    metadaten_tag = law_tag.find("metadaten")
    if not metadaten_tag:
        return

    enigma = metadaten_tag.find("enigma")
    norm_id = (
        metadaten_tag.find("jurabk").text if metadaten_tag.find("jurabk") else "unknown"
    )

    title = ""
    titel_tag = metadaten_tag.find("titel")
    if titel_tag:
        title = titel_tag.get_text(strip=True)

    this_norm: Dict = {
        "norm_id": norm_id,
        "title": title,
        "paragraphs": [],
    }

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


# ---------------------------------------------------------------------------
# Top-level file parser (Worker)
# ---------------------------------------------------------------------------


def process_file(xml_path: str) -> Optional[Dict]:
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

    # Primary key
    raw_key = metadaten.get("jurabk", metadaten.get("amtabk", "unknown"))
    if isinstance(raw_key, list):
        raw_key = raw_key[0]

    if not raw_key or not str(raw_key).strip():
        return None

    output: Dict = {
        "meta": {
            "source": filename,
            "download_date": datetime.now().strftime("%Y-%m-%d"),
            "title": soup.find("langue").text if soup.find("langue") else str(raw_key),
            "last_changed": metadaten.get("ausfertigung-datum", ""),
            "alt_title": "",
        },
        "norms": [],
    }

    for law_tag in soup.find_all("norm"):
        _parse_norm(law_tag, output, filename, unprocessed_absatze)

    # --- Save JSON to temporary file ---
    # We use the source XML filename as a temporary unique identifier
    temp_filename = filename.replace(".xml", ".json")
    temp_path = os.path.join(JSON_DIR_PATH, f"tmp_{temp_filename}")

    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        logging.error("Failed to write JSON for %s: %s", temp_path, exc)
        return None

    return {
        "raw_key": str(raw_key),
        "temp_path": temp_path,
        "unprocessed_count": len(unprocessed_absatze),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def resolve_keys(results: List[Dict]) -> Dict[str, str]:
    """Final Key -> Temporary JSON Path"""
    final_mapping: Dict[str, str] = {}
    key_to_raw: Dict[str, str] = {}

    for result in results:
        raw_key = result["raw_key"]
        path = result["temp_path"]
        stripped = _remove_year_suffix(raw_key)

        if stripped not in final_mapping:
            final_mapping[stripped] = path
            key_to_raw[stripped] = raw_key
        else:
            # Collision: move previous to full name, and keep current as full name
            prev_raw = key_to_raw[stripped]
            if prev_raw != stripped:
                final_mapping[prev_raw] = final_mapping.pop(stripped)

            final_mapping[raw_key] = path
            key_to_raw[raw_key] = raw_key

    return final_mapping


def main() -> None:
    os.makedirs(JSON_DIR_PATH, exist_ok=True)
    xml_files = collect_xml_files(XML_DIR_PATH, FILE_FILTER)

    if not xml_files:
        print("[FATAL] No XML files found. Run the downloader first.")
        return

    # Use a smaller pool for stability on Windows
    cpu_count = min(4, multiprocessing.cpu_count())
    print(f"Processing {len(xml_files)} files using {cpu_count} processes...")

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

    print(f"Parsed {len(raw_results)} files. Resolving keys and finalizing...")

    key_to_path = resolve_keys(raw_results)

    # Track used paths to clean up unused temp files
    used_paths = set(key_to_path.values())

    for key, temp_path in tqdm(
        key_to_path.items(), desc="Finalizing", dynamic_ncols=True
    ):
        # Sanitize key for filesystem
        safe_key = re.sub(r"[^A-Za-z0-9_-]", "_", key)
        final_path = os.path.join(JSON_DIR_PATH, f"{safe_key}.json")

        try:
            if os.path.exists(final_path):
                os.remove(final_path)
            os.rename(temp_path, final_path)
        except Exception as e:
            logging.error("Rename failed: %s -> %s (%s)", temp_path, final_path, e)

    # Cleanup any temp files that weren't used (e.g. duplicates)
    for res in raw_results:
        tp = res["temp_path"]
        if os.path.exists(tp):
            try:
                os.remove(tp)
            except:
                pass

    print(f"\n✓ Success! {len(key_to_path)} laws indexed in {JSON_DIR_PATH}")


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
