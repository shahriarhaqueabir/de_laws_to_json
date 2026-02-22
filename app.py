"""
German Law Search Dashboard — Flask Backend

Keyword-based natural language search over German federal laws.
Translates English queries to German legal terms, expands synonyms,
and ranks results using a TF-IDF-style inverted index.

Usage:
    python app.py
    Open: http://localhost:5000
"""

import json
import logging
import os
import re
import threading
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
JSON_DIR = "./de_federal_json"
SEARCH_INDEX_FILE = "./search_index.json"
HOST = "127.0.0.1"
PORT = 5000

# ---------------------------------------------------------------------------
# Stop words (German + English)
# ---------------------------------------------------------------------------
STOPWORDS = {
    # German
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einer",
    "einen",
    "eines",
    "einem",
    "und",
    "oder",
    "aber",
    "ist",
    "sind",
    "war",
    "waren",
    "hat",
    "haben",
    "wird",
    "werden",
    "auf",
    "an",
    "in",
    "im",
    "zu",
    "zur",
    "zum",
    "von",
    "vom",
    "mit",
    "nach",
    "bei",
    "aus",
    "durch",
    "fur",
    "über",
    "uber",
    "unter",
    "zwischen",
    "gegen",
    "ohne",
    "um",
    "bis",
    "seit",
    "nicht",
    "kein",
    "keine",
    "keinen",
    "keinem",
    "es",
    "er",
    "sie",
    "wir",
    "ihr",
    "ich",
    "du",
    "dass",
    "wenn",
    "als",
    "wie",
    "auch",
    "noch",
    "dann",
    "so",
    "nur",
    "mehr",
    "sehr",
    "kann",
    "muss",
    "soll",
    "darf",
    "jeder",
    "alle",
    "dieser",
    "diese",
    "dieses",
    "beim",
    "mein",
    "meine",
    "sein",
    "seine",
    "ihrer",
    "ihre",
    "wurde",
    "wurden",
    "worden",
    "hatte",
    "worden",
    # English
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "must",
    "can",
    "my",
    "your",
    "his",
    "her",
    "its",
    "our",
    "their",
    "this",
    "that",
    "these",
    "those",
    "i",
    "you",
    "he",
    "she",
    "we",
    "they",
    "it",
    "and",
    "or",
    "but",
    "so",
    "if",
    "because",
    "when",
    "where",
    "who",
    "which",
    "what",
    "how",
    "of",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
    "from",
    "up",
    "about",
    "into",
    "through",
    "during",
    "until",
    "not",
    "no",
    "nor",
    "as",
    "then",
    "am",
    "me",
    "us",
    "them",
}

# ---------------------------------------------------------------------------
# English → German legal terms
# ---------------------------------------------------------------------------
EN_DE: Dict[str, List[str]] = {
    # Housing / rental
    "landlord": ["Vermieter", "Vermieterin"],
    "tenant": ["Mieter", "Mieterin"],
    "rent": ["Miete", "Mieterhöhung", "Mietvertrag", "Mietzins"],
    "rental": ["Miete", "Mietvertrag", "Wohnraum"],
    "lease": ["Mietvertrag", "Pacht", "Pachtverhältnis"],
    "apartment": ["Wohnung", "Mietwohnung", "Wohnraum"],
    "flat": ["Wohnung", "Wohnraum"],
    "house": ["Haus", "Immobilie", "Grundstück"],
    "eviction": ["Kündigung", "Räumung", "Räumungsklage"],
    "deposit": ["Kaution", "Sicherheitsleistung", "Mietkaution"],
    "termination": ["Kündigung", "Beendigung", "Auflösung"],
    "notice": ["Kündigung", "Ankündigung", "Frist"],
    "increase": ["Erhöhung", "Mieterhöhung", "Anhebung"],
    "increasing": ["Erhöhung", "erhöhen", "Mieterhöhung"],
    "property": ["Eigentum", "Immobilie", "Grundstück"],
    "neighbor": ["Nachbar", "Nachbarn", "Nachbarschaft"],
    "noise": ["Lärm", "Lärmbelästigung", "Ruhestörung"],
    # Employment
    "employer": ["Arbeitgeber", "Arbeitgeberin"],
    "employee": ["Arbeitnehmer", "Arbeitnehmerin", "Beschäftigter"],
    "salary": ["Gehalt", "Lohn", "Vergütung", "Arbeitsentgelt"],
    "wages": ["Lohn", "Gehalt", "Arbeitslohn"],
    "fired": ["Kündigung", "entlassen", "Entlassung"],
    "dismissed": ["Kündigung", "Entlassung", "Abmahnung"],
    "dismissal": ["Kündigung", "Entlassung", "Abmahnung"],
    "overtime": ["Überstunden", "Mehrarbeit"],
    "vacation": ["Urlaub", "Urlaubsanspruch"],
    "sick": ["Krankheit", "Krankmeldung", "Krankengeld"],
    "maternity": ["Mutterschutz", "Elternzeit"],
    "parental": ["Elternzeit", "Elterngeld"],
    "workplace": ["Arbeitsplatz", "Arbeitsstätte", "Betrieb"],
    "unemployed": ["Arbeitslosigkeit", "Arbeitslosengeld"],
    "unemployment": ["Arbeitslosigkeit", "Arbeitslosengeld"],
    "pension": ["Rente", "Rentenanspruch"],
    "retirement": ["Rente", "Rentenanspruch", "Altersrente"],
    # Consumer / contracts
    "warranty": ["Gewährleistung", "Garantie", "Mängelrecht"],
    "refund": ["Rückerstattung", "Rückzahlung", "Rückgabe"],
    "return": ["Rückgabe", "Widerruf", "Rücktritt"],
    "purchase": ["Kauf", "Kaufvertrag", "Erwerb"],
    "seller": ["Verkäufer"],
    "buyer": ["Käufer", "Erwerber"],
    "defect": ["Mangel", "Sachmangel"],
    "consumer": ["Verbraucher", "Konsument"],
    "contract": ["Vertrag", "Mietvertrag", "Kaufvertrag"],
    # Debt / finance
    "debt": ["Schuld", "Verbindlichkeit", "Forderung"],
    "loan": ["Darlehen", "Kredit"],
    "interest": ["Zinsen", "Zins", "Zinssatz"],
    "insurance": ["Versicherung", "Versicherungsvertrag"],
    "payment": ["Zahlung", "Bezahlung", "Zahlungspflicht"],
    "fine": ["Bußgeld", "Strafe", "Geldstrafe"],
    "tax": ["Steuer", "Abgabe", "Steuerpflicht"],
    "bank": ["Bank", "Kreditinstitut"],
    # Family
    "divorce": ["Scheidung", "Ehescheidung"],
    "marriage": ["Ehe", "Heirat", "Eheschließung"],
    "child": ["Kind", "Kinder", "Kindschaft"],
    "children": ["Kinder", "Kind", "Kindschaft"],
    "custody": ["Sorgerecht", "Aufenthaltsbestimmungsrecht"],
    "alimony": ["Unterhalt", "Kindesunterhalt", "Ehegattenunterhalt"],
    "support": ["Unterhalt", "Unterhaltsanspruch"],
    "inheritance": ["Erbschaft", "Erbe", "Nachlassrecht"],
    "will": ["Testament", "Erbvertrag"],
    # Criminal / tort
    "theft": ["Diebstahl", "Entwendung"],
    "fraud": ["Betrug", "Täuschung"],
    "accident": ["Unfall", "Verkehrsunfall"],
    "injury": ["Verletzung", "Körperverletzung"],
    "assault": ["Körperverletzung", "Angriff"],
    "negligence": ["Fahrlässigkeit", "Sorgfaltspflicht"],
    "liability": ["Haftung", "Schadensersatz", "Haftpflicht"],
    "damages": ["Schadensersatz", "Schaden"],
    "lawsuit": ["Klage", "Rechtsstreit"],
    "court": ["Gericht", "Amtsgericht", "Landgericht"],
    "rights": ["Rechte", "Recht", "Anspruch"],
    "law": ["Gesetz", "Recht", "Vorschrift"],
    "penalty": ["Strafe", "Sanktion", "Bußgeld"],
    "police": ["Polizei", "Behörde"],
    "privacy": ["Datenschutz", "Privatsphäre"],
    "data": ["Daten", "Datenschutz"],
    # Business
    "business": ["Unternehmen", "Betrieb", "Gewerbe"],
    "company": ["Gesellschaft", "GmbH", "Unternehmen"],
    "competition": ["Wettbewerb", "Konkurrenz"],
    "copyright": ["Urheberrecht", "Schutzrecht"],
    "trademark": ["Marke", "Markenrecht", "Warenzeichen"],
    "traffic": ["Verkehr", "Straßenverkehr"],
    "speeding": ["Geschwindigkeit", "Tempoüberschreitung"],
    "parking": ["Parken", "Parkplatz"],
    "disability": ["Behinderung", "Schwerbehinderung"],
    "discrimination": ["Diskriminierung", "Benachteiligung"],
    "harassment": ["Belästigung", "Mobbing"],
    "healthcare": ["Krankenversicherung", "Gesundheit"],
    "doctor": ["Arzt", "Ärztin"],
    "death": ["Tod", "Todesfall"],
    "murder": ["Mord", "Totschlag"],
    "border": ["Grenze", "Grenzkontrolle"],
    "immigration": ["Einwanderung", "Aufenthaltsrecht", "Ausländerrecht"],
    "asylum": ["Asyl", "Asylrecht"],
    "citizenship": ["Staatsangehörigkeit", "Einbürgerung"],
}

# German synonym expansion
DE_EXPANSIONS: Dict[str, List[str]] = {
    "miete": ["mietvertrag", "mietrecht", "mieterhöhung", "vermieter", "mieter"],
    "mietvertrag": ["miete", "vermieter", "mieter", "mietrecht"],
    "kündigung": ["kündigungsfrist", "abmahnung", "kündigen"],
    "arbeit": ["arbeitnehmer", "arbeitgeber", "arbeitsrecht"],
    "vertrag": ["vertragsrecht", "vereinbarung", "vertragsverhältnis"],
    "schaden": ["schadensersatz", "haftung", "ersatz"],
    "steuer": ["steuerpflicht", "finanzamt", "abgabe"],
    "ehe": ["eheleute", "scheidung", "familienrecht"],
    "kauf": ["kaufvertrag", "verkäufer", "käufer", "gewährleistung"],
    "erbe": ["erbschaft", "testament", "nachlassrecht"],
    "datenschutz": ["daten", "privatsphäre", "dsgvo"],
    "wohnung": ["mietwohnung", "wohnraum", "vermieter"],
    "eigentum": ["eigentumsrecht", "besitz", "grundstück"],
    "haftung": ["schadensersatz", "haftpflicht", "verantwortung"],
    "unfall": ["verkehrsunfall", "schadensersatz", "haftpflicht"],
    "rente": ["rentenanspruch", "altersrente", "pension"],
    "versicherung": ["versicherungsvertrag", "haftpflicht", "leistung"],
    "betrug": ["täuschung", "arglist", "strafrecht"],
    "diebstahl": ["strafrecht", "eigentum", "entwendung"],
}

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
_law_summaries: List[Dict] = []
_inverted: Dict[str, List[Tuple[int, float]]] = defaultdict(list)
_indexing_done = threading.Event()
_total_files = 0
_indexed_files = 0
_index_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------


def tokenize(text: str) -> List[str]:
    """Lowercase, strip punctuation, remove stop words."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return [t for t in text.split() if t and t not in STOPWORDS and len(t) > 2]


def expand_query(raw: str) -> Tuple[List[str], List[str]]:
    """
    Translate English keywords to German and expand German synonyms.
    Returns (original_tokens, deduplicated_german_terms).
    """
    tokens = tokenize(raw)
    german: List[str] = []
    for tok in tokens:
        translated = EN_DE.get(tok)
        if translated:
            german.extend(t.lower() for t in translated)
        else:
            german.append(tok)
            expanded = DE_EXPANSIONS.get(tok)
            if expanded:
                german.extend(expanded)
    return tokens, list(dict.fromkeys(german))


# ---------------------------------------------------------------------------
# Index building
# ---------------------------------------------------------------------------


def _extract_summary(fpath: str) -> Optional[Dict]:
    """Extract lightweight metadata from a single law JSON file."""
    try:
        with open(fpath, encoding="utf-8", errors="replace") as fh:
            raw = json.load(fh)
    except (json.JSONDecodeError, OSError):
        return None

    # Structural mapping for the updated process_de_laws.py output
    meta = raw.get("meta", {})
    norms_raw = raw.get("norms", [])

    # key defaults to filename stem if not explicit
    key = raw.get("key")
    if not key:
        key = os.path.splitext(os.path.basename(fpath))[0]

    norms = []
    for norm in norms_raw:
        # preview is first 280 chars of first paragraph
        preview = ""
        paragraphs = norm.get("paragraphs", [])
        if paragraphs:
            preview = paragraphs[0].get("text", "")[:280]

        norms.append(
            {
                "norm_id": norm.get("norm_id", ""),
                "title": norm.get("title", ""),
                "preview": preview,
            }
        )

    return {
        "key": key,
        "title": meta.get("title", ""),
        "alt_title": meta.get("alt_title", ""),
        "last_changed": meta.get("last_changed", ""),
        "source": meta.get("source", ""),
        "norms": norms,
        "file_path": fpath,
    }


def _populate_inverted(summaries: List[Dict]) -> None:
    """Build the in-memory inverted index from a list of law summaries."""
    inv: Dict[str, List[Tuple[int, float]]] = defaultdict(list)
    for idx, s in enumerate(summaries):
        term_scores: Dict[str, float] = defaultdict(float)
        # Law abbreviation (highest signal)
        for t in tokenize(s["key"]):
            term_scores[t] += 20.0
        # Titles
        for t in tokenize(s["title"] + " " + s.get("alt_title", "")):
            term_scores[t] += 10.0
        # Norm ids and titles
        for norm in s["norms"]:
            for t in tokenize(norm["norm_id"] + " " + norm["title"]):
                term_scores[t] += 3.0
            # Paragraph previews (low weight)
            for t in tokenize(norm["preview"]):
                term_scores[t] += 0.4
        for term, score in term_scores.items():
            inv[term].append((idx, score))
    with _index_lock:
        _inverted.update(inv)


def _fast_load_index(path: str) -> bool:
    """Try to load a pre-built search index. Returns True on success."""
    global _total_files, _indexed_files
    try:
        with open(path, encoding="utf-8") as fh:
            summaries = json.load(fh)
        _law_summaries.extend(summaries)
        _total_files = len(summaries)
        _indexed_files = len(summaries)
        _populate_inverted(summaries)
        _indexing_done.set()
        logging.info("Index ready: %d laws.", len(summaries))
        return True
    except (json.JSONDecodeError, OSError):
        logging.warning("Cached index unreadable — rebuilding from source.")
        _law_summaries.clear()
        return False


def _build_from_source() -> List[Dict]:
    """Scan JSON_DIR and build summaries from individual law files."""
    global _total_files, _indexed_files
    files = sorted(f for f in os.listdir(JSON_DIR) if f.endswith(".json"))
    _total_files = len(files)
    logging.info("Building search index from %d files …", _total_files)
    summaries: List[Dict] = []
    for i, fname in enumerate(files):
        summary = _extract_summary(os.path.join(JSON_DIR, fname))
        if summary:
            summaries.append(summary)
        _indexed_files = i + 1
    return summaries


def _persist_index(summaries: List[Dict]) -> None:
    """Save the lightweight index to disk for fast future startups."""
    try:
        with open(SEARCH_INDEX_FILE, "w", encoding="utf-8") as fh:
            json.dump(summaries, fh, ensure_ascii=False)
        logging.info("Search index saved → %s", SEARCH_INDEX_FILE)
    except OSError as exc:
        logging.warning("Could not save search index: %s", exc)


def build_index() -> None:
    if not os.path.isdir(JSON_DIR):
        logging.warning(
            "'%s' not found — run the download/process pipeline first.", JSON_DIR
        )
        _indexing_done.set()
        return

    # Fast path: pre-built lightweight index exists
    if os.path.exists(SEARCH_INDEX_FILE):
        logging.info("Loading pre-built search index from %s …", SEARCH_INDEX_FILE)
        if _fast_load_index(SEARCH_INDEX_FILE):
            return

    # Slow path: scan individual JSON files
    summaries = _build_from_source()
    _persist_index(summaries)
    _law_summaries.extend(summaries)
    _populate_inverted(summaries)
    _indexing_done.set()
    logging.info("Indexing complete: %d laws ready.", len(summaries))


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


def search_laws(query: str, top_k: int = 12) -> Dict:
    if not query.strip():
        return {"results": [], "keywords": [], "german_terms": []}

    original_tokens, german_terms = expand_query(query)

    scores: Dict[int, float] = defaultdict(float)

    for term in german_terms:
        # Exact index term match
        if term in _inverted:
            for idx, weight in _inverted[term]:
                scores[idx] += weight * 2.0
        # Prefix / substring match (capped prefix length to keep it fast)
        prefix = term[:5]
        if len(prefix) >= 4:
            for indexed_term, postings in _inverted.items():
                if indexed_term != term and indexed_term.startswith(prefix):
                    for idx, weight in postings:
                        scores[idx] += weight * 0.4

    if not scores:
        return {
            "results": [],
            "keywords": original_tokens,
            "german_terms": german_terms,
        }

    top_indices = sorted(scores, key=scores.__getitem__, reverse=True)[:top_k]
    max_score = max(scores.values())

    results = []
    for idx in top_indices:
        law = _law_summaries[idx]
        relevance = round(scores[idx] / max_score * 100)

        # Score norms by how well their text matches the query terms
        norm_hits = []
        for norm in law["norms"]:
            text = (
                norm["norm_id"] + " " + norm["title"] + " " + norm["preview"]
            ).lower()
            hit = sum(1 for t in german_terms if t in text)
            if hit > 0:
                norm_hits.append({**norm, "hit": hit})

        norm_hits.sort(key=lambda n: n["hit"], reverse=True)

        results.append(
            {
                "key": law["key"],
                "title": law["title"],
                "alt_title": law["alt_title"],
                "last_changed": law["last_changed"],
                "relevance": relevance,
                "top_norms": norm_hits[:4],
                "total_norms": len(law["norms"]),
            }
        )

    return {
        "results": results,
        "keywords": original_tokens,
        "german_terms": german_terms[:10],
    }


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------


@app.route("/")
def index_page():
    return render_template("index.html")


@app.route("/favicon.ico")
def favicon():
    return "", 204


@app.route("/api/status")
def api_status():
    global _law_summaries
    try:
        total_norms = 0
        largest_law = None

        if _indexing_done.is_set():
            with _index_lock:
                total_norms = sum(len(law.get("norms", [])) for law in _law_summaries)
                if _law_summaries:
                    largest_law = max(
                        _law_summaries, key=lambda x: len(x.get("norms", []))
                    )

        return jsonify(
            {
                "ready": _indexing_done.is_set(),
                "total": _total_files,
                "indexed": _indexed_files,
                "laws": len(_law_summaries),
                "total_norms": total_norms,
                "largest_law": {
                    "key": largest_law["key"],
                    "title": largest_law["title"],
                    "norms": len(largest_law.get("norms", [])),
                }
                if largest_law
                else None,
            }
        )
    except Exception as e:
        logging.error(f"API STATUS ERROR: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/search", methods=["POST"])
def api_search():
    if not _indexing_done.is_set():
        return jsonify(
            {"error": "Index still building — please wait.", "results": []}
        ), 503
    data = request.get_json(force=True, silent=True) or {}
    query = (data.get("query") or "").strip()
    return jsonify(search_laws(query))


@app.route("/api/law/<path:key>")
def api_law(key: str):
    """Return the full content of a law by key, for the law reader."""
    with _index_lock:
        match = next(
            (law_sum for law_sum in _law_summaries if law_sum["key"] == key), None
        )
    if not match:
        return jsonify({"error": "Law not found"}), 404
    try:
        with open(match["file_path"], encoding="utf-8", errors="replace") as fh:
            raw = json.load(fh)
        return jsonify(raw.get("output", {}))
    except (OSError, json.JSONDecodeError) as exc:
        return jsonify({"error": str(exc)}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    threading.Thread(target=build_index, daemon=True).start()
    print("  ⋘  German Law Search Dashboard")
    print(f"  ➜  http://{HOST}:{PORT}\n")
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False)
