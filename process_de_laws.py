"""
Processes all XML laws in ./de_federal_raw (and its subdirectories) and writes
structured JSON to ./de_federal_json as individual files, then merges everything
into a single de_federal.json.

Uses multiprocessing for the per-file parse+write phase. Duplicate-key resolution
and the final merge are done in the main process (the only place it is safe to
maintain shared state), so collision detection is now correct.

Prerequisites:
1) Create a virtual environment:
   python -m venv ./.venv
   source ./.venv/bin/activate   (Linux/macOS)
   .venv\\Scripts\\activate       (Windows)

2) Install dependencies:
   pip install -r requirements.txt

3) Run this script:
   python process_de_laws.py
"""

import copy
import json
import logging
import os
import re
import multiprocessing
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Union  # Tuple kept for 3.8 compat shim

import tiktoken
from bs4 import BeautifulSoup
from tqdm import tqdm

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OUTPUT_FILENAME = "de_federal"  # .json
XML_DIR_PATH = "./de_federal_raw"
JSON_DIR_PATH = "./de_federal_json"
# Optional allowlist filter: set to a non-empty tuple of filename stems such as
# ('BJNR002190897', 'BJNR119530979') to process only those specific files.
# Leave as an EMPTY tuple () to process everything.
# NOTE: ('',) would be WRONG — str.endswith('') is always True.
FILE_FILTER: tuple = ()
ENCODING_NAME = "cl100k_base"  # tiktoken encoding; compatible with GPT-4 / o-series

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ---------------------------------------------------------------------------
# Module-level compiled patterns  (avoid recompiling inside hot loops)
# ---------------------------------------------------------------------------
_NORM_PATTERN = re.compile(r"(§+|Art|Artikel)\.?\s*")
_WHITESPACE_PATTERN = re.compile(r"\n\s+\n")
_NUMBER_PATTERN = re.compile(r"\b\d+[a-zA-Z]?\b")
_NON_WORD_PATTERN = re.compile(r"\W+")
_DIGIT_PATTERN = re.compile(r"^\d+$")


# ---------------------------------------------------------------------------
# Encoder singleton  (one per worker process, initialised lazily)
# ---------------------------------------------------------------------------
_ENCODER: Optional[tiktoken.Encoding] = None


def _get_encoder() -> tiktoken.Encoding:
    """Return (and lazily initialise) the module-level tiktoken encoder."""
    global _ENCODER
    if _ENCODER is None:
        _ENCODER = tiktoken.get_encoding(ENCODING_NAME)
    return _ENCODER


def num_tokens_from_string(text: str) -> int:
    """Return the tiktoken token count for *text*."""
    return len(_get_encoder().encode(text))


# ---------------------------------------------------------------------------
# Filesystem utilities
# ---------------------------------------------------------------------------


def collect_xml_files(root_dir: str, file_filter: tuple) -> List[str]:
    """
    Walk *root_dir* recursively and return absolute paths of all matching XMLs.

    Supports the subdirectory layout created by the updated download script
    (each law in its own folder) as well as the flat original layout.

    When *file_filter* is non-empty, only files whose stem (name without
    extension) starts with one of the filter strings are included.
    """
    results = []
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            if not fname.endswith(".xml"):
                continue
            if fname.startswith(".") or fname == ".gitkeep":
                continue
            if file_filter and not any(fname.startswith(f) for f in file_filter):
                continue
            results.append(os.path.join(dirpath, fname))
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
    if element.string:
        return element.string
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
        raise ValueError(f"Expected {expected_type} but got {type(children_dict)}")
    return children_dict


def _remove_year_suffix(key: str) -> str:
    """Strip a trailing 4-digit year from an abbreviation ('UStG1980' → 'UStG')."""
    if isinstance(key, str) and len(key) >= 4 and key[-4:].isdigit():
        return key[:-4].strip()
    return key


def _extract_content_tag(law_tag):
    """Return the <Content> tag inside <textdaten><text>, or None."""
    textdaten = law_tag.find("textdaten")
    if not textdaten:
        return None
    text_tag = textdaten.find("text")
    if not text_tag:
        return None
    return text_tag.find("Content")


def _get_p_first_token(p_tag) -> str:
    """
    Return the first whitespace-separated token of a <P> tag, after stripping
    noisy child elements (DL, Revision, table col1 entries).
    """
    p_copy = copy.deepcopy(p_tag)
    for noisy in p_copy.find_all(
        ["DL", "Revision", lambda t: t.name == "entry" and t.get("colname") == "col1"]
    ):
        noisy.decompose()
    tokens = p_copy.get_text().split()
    return tokens[0] if tokens else ""


# ---------------------------------------------------------------------------
# Paragraph-level helpers
# ---------------------------------------------------------------------------


def _deduplicate_id(
    candidate: Union[int, str],
    existing_paragraphs: List[Dict],
) -> Union[int, str]:
    """
    If *candidate* paragraph_id already exists in *existing_paragraphs*,
    increment (numeric) or keep appending '_' (alphanumeric) until unique.
    Uses a while-loop so cascading collisions (e.g. both '2' and '3' already
    exist when trying to assign '2') are resolved correctly.
    """
    existing_ids = {str(p["meta"]["paragraph_id"]) for p in existing_paragraphs}
    while str(candidate) in existing_ids:
        if _DIGIT_PATTERN.fullmatch(str(candidate)):
            candidate = int(candidate) + 1
        else:
            candidate = str(candidate) + "_"
    return candidate


def _resolve_paragraph_number(
    p_tag,
    p_i: int,
    p_is_numbered: bool,
    existing_paragraphs: List[Dict],
) -> Tuple[Union[int, str], bool, bool]:
    """
    Determine the paragraph_id, updated p_is_numbered flag, and whether this
    <P> tag is a continuation of the previous paragraph (number_missing).

    Returns (number, p_is_numbered, number_missing).
    """
    first_token = _get_p_first_token(p_tag)
    if not first_token:
        return p_i, p_is_numbered, False

    match = _NUMBER_PATTERN.search(first_token)
    if match:
        raw = _NON_WORD_PATTERN.sub("", match.group())
        number = _deduplicate_id(raw, existing_paragraphs)
        return number, True, False

    if p_is_numbered:
        # This <P> continues the previous numbered paragraph.
        return p_i - 1, p_is_numbered, True

    # Unnumbered law — use our own counter.
    return p_i, p_is_numbered, False


def _append_or_extend_paragraph(
    this_norm: Dict,
    p_tag,
    number: Union[int, str],
    number_missing: bool,
    norm_id_for_log: str,
    filename: str,
    unprocessed_absatze: List[str],
) -> None:
    """
    Either append a new paragraph object to *this_norm* or extend the content
    of the previous paragraph when *number_missing* is True.
    """
    # Strip sentence-number superscripts.
    for sup in p_tag.find_all("SUP"):
        sup.extract()

    p_obj: Dict = {
        "meta": {
            "paragraph_id": str(number),
            "token": num_tokens_from_string(p_tag.get_text()),
        },
        "content": _WHITESPACE_PATTERN.sub("\n\n", p_tag.get_text(" ", strip=True)),
    }

    if number_missing:
        for para in this_norm["paragraphs"]:
            if str(para["meta"]["paragraph_id"]) == str(number):
                para["meta"]["token"] += p_obj["meta"]["token"]
                para["content"] += " " + p_obj["content"]
                break
        return

    # Within-norm duplicate guard: check this_norm's own paragraphs.
    # (already_seen_norms contains completed norms, not the one being built)
    existing_ids = {str(p["meta"]["paragraph_id"]) for p in this_norm["paragraphs"]}
    if str(p_obj["meta"]["paragraph_id"]) in existing_ids:
        unprocessed_absatze.append(f"{filename} {norm_id_for_log} {number}")
        return

    this_norm["paragraphs"].append(p_obj)


# ---------------------------------------------------------------------------
# Norm-level helper
# ---------------------------------------------------------------------------


def _parse_norm(
    law_tag, output: Dict, filename: str, unprocessed_absatze: List[str]
) -> None:
    """
    Parse a single <norm> element and, if valid, append it to output['norms'].
    """
    norm_meta_tag = law_tag.find("metadaten")
    if norm_meta_tag is None:
        return
    try:
        norm_meta = convert_xml_to_dict(norm_meta_tag, dict)
    except (ValueError, AttributeError):
        return

    if not (
        isinstance(norm_meta, dict)
        and norm_meta.get("enbez")
        and _NORM_PATTERN.match(norm_meta["enbez"])
    ):
        return

    this_norm: Dict = {
        "meta": {"norm_id": norm_meta["enbez"], "title": ""},
        "paragraphs": [],
    }

    try:
        this_norm["meta"]["title"] = law_tag.find("metadaten").titel.text  # type: ignore[union-attr]
    except AttributeError:
        pass

    gliederung = norm_meta.get("gliederungseinheit", {})
    if isinstance(gliederung, dict) and gliederung.get("gliederungsbez"):
        this_norm["meta"]["norm_id"] = (
            gliederung["gliederungsbez"] + " " + this_norm["meta"]["norm_id"]
        )

    content_tag = _extract_content_tag(law_tag)
    if content_tag is not None:
        p_is_numbered = False
        for p_i, p_tag in enumerate(
            content_tag.find_all("P", recursive=False), start=1
        ):
            number, p_is_numbered, number_missing = _resolve_paragraph_number(
                p_tag, p_i, p_is_numbered, this_norm["paragraphs"]
            )
            _append_or_extend_paragraph(
                this_norm,
                p_tag,
                number,
                number_missing,
                norm_id_for_log=this_norm["meta"]["norm_id"],
                filename=filename,
                unprocessed_absatze=unprocessed_absatze,
            )

    output["norms"].append(this_norm)


# ---------------------------------------------------------------------------
# Top-level file parser  (runs inside worker processes)
# ---------------------------------------------------------------------------


def process_file(xml_path: str) -> Optional[Dict]:
    """
    Parse a single XML law file and return a result dict to the main process.

    Returns None on read / parse errors (error is logged so the pool continues).
    """
    filename = os.path.basename(xml_path)
    unprocessed_absatze: List[str] = []

    # --- Read ---
    try:
        with open(xml_path, encoding="utf-8", errors="replace") as fh:
            file_content = fh.read()
    except OSError as exc:
        logging.error("Cannot read %s: %s", xml_path, exc)
        return None

    # --- Parse ---
    try:
        soup = BeautifulSoup(file_content, "lxml-xml")
    except Exception as exc:
        logging.error("Parse error in %s: %s", xml_path, exc)
        return None

    # --- Law metadata ---
    metadaten_tag = soup.find("metadaten")
    if metadaten_tag is None:
        logging.warning("No <metadaten> in %s — skipping.", filename)
        return None

    try:
        metadaten = convert_xml_to_dict(metadaten_tag, dict)
    except (ValueError, AttributeError) as exc:
        logging.error("convert_xml_to_dict failed for %s: %s", filename, exc)
        return None

    output: Dict = {
        "meta": {
            "source": filename,
            "download_date": datetime.fromtimestamp(
                os.path.getctime(xml_path)
            ).strftime("%Y-%m-%d"),
            "title": "",
            "last_changed": metadaten.get("ausfertigung-datum", ""),
            "alt_title": "",
        },
        "metadaten": metadaten,
        "norms": [],
    }

    try:
        output["meta"]["title"] = soup.metadaten.langue.text  # type: ignore[union-attr]
    except AttributeError:
        pass

    # --- Primary key ---
    raw_key = metadaten.get("jurabk", metadaten.get("amtabk"))
    while isinstance(raw_key, list):
        raw_key = raw_key[0]

    if not raw_key or not isinstance(raw_key, str) or not raw_key.strip():
        logging.warning("No usable key (jurabk/amtabk) in %s — skipping.", filename)
        return None

    # --- Alt title ---
    alt_jurabk = _remove_year_suffix(str(metadaten.get("jurabk", "")))
    alt_amtabk = _remove_year_suffix(str(metadaten.get("amtabk", "")))
    if alt_jurabk and alt_amtabk and alt_jurabk != alt_amtabk:
        output["meta"]["alt_title"] = (
            alt_amtabk if alt_jurabk == raw_key else alt_jurabk
        )

    # --- Norms ---
    for law_tag in soup.find_all("norm"):
        _parse_norm(law_tag, output, filename, unprocessed_absatze)

    return {
        "raw_key": raw_key,
        "output": output,
        "unprocessed_absatze": unprocessed_absatze,
        "source_path": xml_path,
    }


# ---------------------------------------------------------------------------
# Key collision resolution  (runs in the MAIN process only — safe shared state)
# ---------------------------------------------------------------------------


def resolve_keys(results: List[Dict]) -> Dict[str, Dict]:
    """
    Assign a unique string key to each law, handling the year-suffix ambiguity.

    If stripping the year ('UStG1980' → 'UStG') would collide with an already
    registered key, both entries keep their full year-qualified names.
    """
    laws: Dict[str, Dict] = {}
    key_to_raw: Dict[str, str] = {}

    for result in results:
        raw_key: str = result["raw_key"]
        output: Dict = result["output"]
        stripped = _remove_year_suffix(raw_key)

        if stripped not in laws:
            laws[stripped] = output
            key_to_raw[stripped] = raw_key
        else:
            # Rename the previous entry to its full raw key (with year).
            prev_raw = key_to_raw[stripped]
            if prev_raw != stripped:
                laws[prev_raw] = laws.pop(stripped)
                key_to_raw[prev_raw] = prev_raw
                key_to_raw.pop(stripped)
            # Register current entry under its full raw key.
            laws[raw_key] = output
            key_to_raw[raw_key] = raw_key

    return laws


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    os.makedirs(JSON_DIR_PATH, exist_ok=True)

    xml_files = collect_xml_files(XML_DIR_PATH, FILE_FILTER)
    if not xml_files:
        raise SystemExit(
            f"[FATAL] No XML files found under '{XML_DIR_PATH}'. "
            "Run download_de_laws.py first."
        )

    cpu_count = multiprocessing.cpu_count()
    print(f"Processing {len(xml_files)} XML files using {cpu_count} processes …")

    raw_results: List[Dict] = []
    pool = multiprocessing.Pool(processes=cpu_count)
    try:
        with tqdm(total=len(xml_files), desc="Parsing XML", dynamic_ncols=True) as pbar:
            for result in pool.imap_unordered(process_file, xml_files):
                pbar.update()
                if result is not None:
                    raw_results.append(result)
    finally:
        pool.close()
        pool.join()

    skipped = len(xml_files) - len(raw_results)
    print(f"Parsed {len(raw_results)} files ({skipped} skipped due to errors).")

    # --- Write individual JSON files ---
    print("Writing individual JSON files …")
    all_unprocessed: List[str] = []
    for result in tqdm(raw_results, desc="Writing JSON", dynamic_ncols=True):
        raw_key = result["raw_key"]
        output = result["output"]
        source_stem = os.path.splitext(os.path.basename(result["source_path"]))[0]
        json_path = os.path.join(JSON_DIR_PATH, f"{source_stem}.json")
        payload = {
            "key": raw_key,
            "output": output,
            "unprocessed_absatze": result["unprocessed_absatze"],
        }
        with open(json_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False)
        if result["unprocessed_absatze"]:
            all_unprocessed.extend(result["unprocessed_absatze"])

    # --- Resolve duplicate keys (main process — correct shared state) ---
    print("Resolving duplicate law keys …")
    all_laws = resolve_keys(raw_results)

    # --- Stream-write merged JSON (avoids loading everything into RAM twice) ---
    merged_path = f"{OUTPUT_FILENAME}.json"
    print(f"Writing merged output to {merged_path} …")
    with open(merged_path, "w", encoding="utf-8") as fh:
        fh.write("{\n")
        items = list(all_laws.items())
        for idx, (key, law_output) in enumerate(
            tqdm(items, desc="Merging", dynamic_ncols=True)
        ):
            entry = (
                json.dumps(key, ensure_ascii=False)
                + ": "
                + json.dumps(law_output, ensure_ascii=False)
            )
            fh.write("  " + entry)
            if idx < len(items) - 1:
                fh.write(",")
            fh.write("\n")
        fh.write("}\n")

    # --- Debug artefacts ---
    unprocessed_path = f"{OUTPUT_FILENAME}_unprocessed_absatze.txt"
    with open(unprocessed_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(all_unprocessed) + "\n" if all_unprocessed else "")

    processed_sources = {r["output"]["meta"]["source"] for r in raw_results}
    all_basenames = {os.path.basename(p) for p in xml_files}
    missing_files = sorted(all_basenames - processed_sources)
    missing_path = f"{OUTPUT_FILENAME}_missing_files.txt"
    with open(missing_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(missing_files) + "\n" if missing_files else "")

    # --- Summary ---
    print("\n--- STATS ---")
    print(f"  XML files found      : {len(xml_files)}")
    print(f"  Successfully parsed  : {len(raw_results)}")
    print(f"  Unique law keys      : {len(all_laws)}")
    print(f"  Skipped (errors)     : {skipped}")
    print(f"  Unprocessed Absätze  : {len(all_unprocessed):>6}  → {unprocessed_path}")
    print(f"  Missing files        : {len(missing_files):>6}  → {missing_path}")
    print(f"  Merged output        : {merged_path}")
    print("--- DONE ---")


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
