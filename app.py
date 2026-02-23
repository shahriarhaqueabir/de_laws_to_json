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
import bisect
import secrets
import tempfile
import time
import socket
import urllib.error
import atexit
from collections import defaultdict, OrderedDict, deque
from functools import wraps
from typing import Dict, List, Optional, Tuple

from flask import Flask, jsonify, render_template, request, Response

# Thread-safe locks
_index_lock = threading.Lock()
_indexing_done = threading.Event()

# Translation support removed - display German-only
HAS_TRANSLATOR = False


app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
JSON_DIR = "./de_federal_json"
EN_JSON_DIR = "./de_federal_translations"
SEARCH_INDEX_FILE = "./search_index.json"
HOST = "127.0.0.1"
PORT = 5000

# Cache for query expansions (English to German) to avoid redundant processing
# Use an OrderedDict to implement a simple LRU eviction policy.
MAX_EXPANSION_CACHE_SIZE = int(os.environ.get("EXPANSION_CACHE_SIZE", "1000"))
_expansion_cache: "OrderedDict[str, Tuple[List[str], List[str]]]" = OrderedDict()
_expansion_lock = threading.Lock()

# Basic in-memory rate limiter store: (client, route) -> deque[timestamps]
_rate_store: Dict[Tuple[str, str], deque] = {}
_rate_lock = threading.Lock()


def _get_client_id() -> str:
    # Prefer X-Forwarded-For when behind a proxy, else remote_addr
    xf = request.headers.get("X-Forwarded-For")
    if xf:
        return xf.split(",")[0].strip()
    return request.remote_addr or "unknown"


def rate_limit(max_calls: int, per_seconds: int):
    """Decorator to rate-limit Flask endpoints per client IP.

    Example: @rate_limit(10, 60)  -> 10 requests per 60 seconds
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                client = _get_client_id()
            except Exception:
                client = "unknown"
            key = (client, fn.__name__)
            now = time.time()
            with _rate_lock:
                dq = _rate_store.get(key)
                if dq is None:
                    dq = deque()
                    _rate_store[key] = dq
                # prune old timestamps
                while dq and dq[0] <= now - per_seconds:
                    dq.popleft()
                if len(dq) >= max_calls:
                    retry_after = int(dq[0] + per_seconds - now) + 1
                    resp = jsonify({"error": "rate_limited", "retry_after": retry_after})
                    # Set status and headers directly on the Response object to avoid
                    # Flask ambiguity when returning tuples containing Response objects.
                    resp.status_code = 429
                    resp.headers["Retry-After"] = str(retry_after)
                    return resp
                dq.append(now)
            return fn(*args, **kwargs)

        return wrapper

    return decorator

# ---------------------------------------------------------------------------
# Law Categorization
CATEGORIES = {
    "housing": {
        "title": "Wohnen & Miete",
        "icon": "🏠",
        "keywords": [
            "miet",
            "wohnung",
            "pacht",
            "eigenbedarf",
            "nachbar",
            "räumung",
            "kaution",
            "betriebskosten",
            "heizkosten",
            "modernisierung",
            "wohngeld",
            "immobilie",
            "grundstück",
            "grundbuch",
            "wohneigentum",
            "makler",
            "staffelmiete",
            "indexmiete",
            "untermiete",
            "mängel",
        ],
    },
    "labor": {
        "title": "Arbeit & Beruf",
        "icon": "💼",
        "keywords": [
            "arbeit",
            "kündigung",
            "lohn",
            "gehalt",
            "tarif",
            "streik",
            "urlaub",
            "arbeitszeit",
            "überstunden",
            "abmahnung",
            "zeugnis",
            "betriebsrat",
            "mitbestimmung",
            "elternzeit",
            "mutterschutz",
            "mindestlohn",
            "befristung",
            "teilzeit",
            "homeoffice",
            "diskriminierung",
        ],
    },
    "consumer": {
        "title": "Einkaufen & Verträge",
        "icon": "🛍️",
        "keywords": [
            "kauf",
            "gewährleistung",
            "garantie",
            "mangel",
            "widerruf",
            "vertrag",
            "fernabsatz",
            "agb",
            "haustürgeschäft",
            "reklamation",
            "produkthaftung",
            "darlehen",
            "kredit",
            "leasing",
            "inkasso",
            "mahnung",
            "verzug",
            "schaden",
            "haftung",
            "reise",
        ],
    },
    "traffic": {
        "title": "Verkehr & Transport",
        "icon": "🚗",
        "keywords": [
            "verkehr",
            "stvo",
            "parken",
            "unfall",
            "bußgeld",
            "führerschein",
            "geschwindigkeit",
            "alkohol",
            "drogen",
            "entzug",
            "auto",
            "kfz",
            "versicherung",
            "haftpflicht",
            "bahn",
            "fluggast",
            "fahrrad",
            "e-scooter",
            "tüv",
            "zulassung",
        ],
    },
    "family": {
        "title": "Familie & Leben",
        "icon": "👨‍👩‍👧‍👦",
        "keywords": [
            "ehe",
            "kind",
            "scheidung",
            "unterhalt",
            "erbe",
            "sorgerecht",
            "umgang",
            "jugendamt",
            "testament",
            "adoption",
            "namensrecht",
            "vormundschaft",
            "pflegschaft",
            "verwandtschaft",
            "lebenspartnerschaft",
            "gewaltschutz",
            "versorgungsausgleich",
            "zugewinn",
            "nachlass",
        ],
    },
    "criminal": {
        "title": "Strafrecht",
        "icon": "⚖️",
        "keywords": [
            "stgb",
            "straf",
            "diebstahl",
            "betrug",
            "körperverletzung",
            "nötigung",
            "bedrohung",
            "beleidigung",
            "raub",
            "erpressung",
            "mord",
            "totschlag",
            "drogen",
            "btmg",
            "urkunde",
            "brandstiftung",
            "hehlerei",
            "unterschlagung",
            "strafprozess",
            "haft",
        ],
    },
    "finance": {
        "title": "Steuern & Finanzen",
        "icon": "💶",
        "keywords": [
            "steuer",
            "finanz",
            "abgabe",
            "einkommen",
            "bank",
            "zins",
            "umsatzsteuer",
            "gewerbe",
            "körperschaft",
            "zoll",
            "insolvenz",
            "vermögen",
            "schenkung",
            "aktie",
            "börse",
            "depot",
            "kredit",
            "schulden",
            "pfändung",
            "finanzamt",
        ],
    },
    "social": {
        "title": "Gesundheit & Soziales",
        "icon": "🏥",
        "keywords": [
            "sgb",
            "rente",
            "kranken",
            "pflege",
            "sozial",
            "hartz",
            "bürgergeld",
            "behinderung",
            "rehabilitation",
            "unfallversicherung",
            "arbeitslosengeld",
            "wohngeld",
            "kindergeld",
            "elternzeit",
            "patientengeheimnis",
            "arztbericht",
            "behandlung",
            "vorsorge",
        ],
    },
    "public": {
        "title": "Staat & Rechte",
        "icon": "🏛️",
        "keywords": [
            "grundgesetz",
            "asyl",
            "ausländer",
            "polizei",
            "verwaltung",
            "datenschutz",
            "dsgvo",
            "wahl",
            "parlament",
            "gemeinde",
            "einbürgerung",
            "visum",
            "aufenthalt",
            "pass",
            "meldung",
            "vereinigungsfreiheit",
            "meinungsfreiheit",
            "religionsfreiheit",
        ],
    },
    "tech": {
        "title": "Innovation & Umwelt",
        "icon": "🌱",
        "keywords": [
            "umwelt",
            "bau",
            "energie",
            "digital",
            "internet",
            "patent",
            "urheber",
            "marke",
            "medien",
            "telekommunikation",
            "klima",
            "abfall",
            "emission",
            "strom",
            "gas",
            "wasser",
            "software",
            "künstliche intelligenz",
            "it-sicherheit",
            "radio",
        ],
    },
    "berlin": {
        "title": "Berlin",
        "icon": "🐻",
        "keywords": [
            "bln",
            "berlin",
            "landes",
            "bauo",
            "vbln",
            "strrein",
            "senat",
            "bezirk",
            "kita",
            "schule",
            "universität",
            "kitaförderung",
            "berliner",
            "berliner recht",
        ],
    },
}


def _categorize(title: str, key: str) -> str:
    text = (title + " " + key).lower()
    for cat_id, meta in CATEGORIES.items():
        if any(kw in text for kw in meta["keywords"]):
            return cat_id
    return "other"


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
    "neighbor": [
        "Nachbar",
        "Nachbarn",
        "Nachbarschaft",
        "Immission",
        "Lärm",
        "Hausordnung",
    ],
    "noise": ["Lärm", "Lärmbelästigung", "Ruhestörung", "Immissionsschutz"],
    "berlin": ["Berlin", "Landesrecht", "Bln"],
    # Employment
    "employer": ["Arbeitgeber", "Arbeitgeberin", "Vorgesetzter", "Chef"],
    "employee": ["Arbeitnehmer", "Arbeitnehmerin", "Beschäftigter"],
    "salary": ["Gehalt", "Lohn", "Vergütung", "Arbeitsentgelt"],
    "wages": ["Lohn", "Gehalt", "Arbeitslohn"],
    "fired": ["Kündigung", "entlassen", "Entlassung", "Kündigungsschutz"],
    "dismissed": ["Kündigung", "Entlassung", "Abmahnung"],
    "dismissal": ["Kündigung", "Entlassung", "Abmahnung"],
    "overtime": ["Überstunden", "Mehrarbeit"],
    "vacation": ["Urlaub", "Urlaubsanspruch"],
    "sick": [
        "Krankheit",
        "Krankmeldung",
        "Krankengeld",
        "Arbeitsunfähigkeit",
        "Entgeltfortzahlung",
        "Attest",
    ],
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
    "accident": ["Unfall", "Verkehrsunfall", "Schadensersatz", "Haftpflicht", "StVO"],
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
    "parking": ["Parken", "Parkplatz", "Parkverstoß", "Abschleppen"],
    "disability": ["Behinderung", "Schwerbehinderung"],
    "discrimination": ["Diskriminierung", "Benachteiligung"],
    "harassment": ["Belästigung", "Mobbing"],
    "healthcare": ["Krankenversicherung", "Gesundheit"],
    "doctor": ["Arzt", "Ärztin", "Patientenrechte", "Behandlung"],
    "death": ["Tod", "Todesfall"],
    "murder": ["Mord", "Totschlag"],
    "border": ["Grenze", "Grenzkontrolle"],
    "immigration": ["Einwanderung", "Aufenthaltsrecht", "Ausländerrecht"],
    "asylum": ["Asyl", "Asylrecht"],
    "citizenship": ["Staatsangehörigkeit", "Einbürgerung"],
    # Family extensions
    "custody": ["Sorgerecht", "Aufenthaltsbestimmungsrecht", "Kindeswohl"],
    "contact": ["Umgang", "Umgangsrecht"],
    "support": ["Unterhalt", "Kindesunterhalt", "Düsseldorfer Tabelle"],
    "threat": ["Bedrohung", "Nötigung", "Strafgesetzbuch"],
    "stalking": ["Nachstellung", "Belästigung"],
    "welfare": ["Jugendamt", "SGB VIII", "Kindeswohl"],
    "best interests": ["Kindeswohl"],
    "internet": ["Telekommunikation", "TKG", "Vertrag", "Digital"],
    "shopping": ["Kauf", "Gewährleistung", "Widerruf", "Fernabsatz"],
    "scam": ["Betrug", "Täuschung", "Arglist"],
    "fined": ["Bußgeld", "Strafe", "Bußgeldbescheid", "Verwarnung"],
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
# Global State & Locking
# ---------------------------------------------------------------------------

_index_lock = threading.Lock()
_indexing_done = threading.Event()

# Active corpus storage
_law_summaries: List[Dict] = []
_inverted: Dict[str, List[Tuple[int, float]]] = {}
_sorted_terms: List[str] = []  # For fast prefix lookups via bisect

_total_files = 0
_indexed_files = 0

# Security
ADMIN_API_KEY = secrets.token_hex(16)


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------


def tokenize(text: str) -> List[str]:
    """Lowercase, strip punctuation, remove stop words."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return [t for t in text.split() if t and t not in STOPWORDS and len(t) > 2]


def expand_query(raw: str) -> Tuple[List[str], List[str]]:
    """Translate English keywords to German and expand German synonyms with caching."""
    q = raw.lower().strip()
    with _expansion_lock:
        if q in _expansion_cache:
            # Move to end to mark as recently used
            _expansion_cache.move_to_end(q)
            return _expansion_cache[q]

    tokens = tokenize(q)
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

    res = (tokens, list(dict.fromkeys(german)))
    with _expansion_lock:
        # Insert and enforce max size with LRU eviction
        _expansion_cache[q] = res
        _expansion_cache.move_to_end(q)
        try:
            while len(_expansion_cache) > MAX_EXPANSION_CACHE_SIZE:
                _expansion_cache.popitem(last=False)
        except Exception:
            # If something unusual occurs, keep going without crashing
            pass
    return res


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

    category = _categorize(meta.get("title", ""), str(key))

    norms = []
    for norm in norms_raw:
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

    # Check if English translation exists
    en_translation_path = os.path.join(EN_JSON_DIR, f"{key}.json")
    en_title = ""
    en_norms = []
    if os.path.exists(en_translation_path):
        try:
            with open(en_translation_path, encoding="utf-8", errors="replace") as fh:
                en_raw = json.load(fh)
                en_meta = en_raw.get("meta", {})
                en_title = en_meta.get("title", "")

                for en_norm in en_raw.get("norms", []):
                    en_preview = ""
                    en_paragraphs = en_norm.get("paragraphs", [])
                    if en_paragraphs:
                        en_preview = en_paragraphs[0].get("text", "")[:280]
                    en_norms.append(
                        {
                            "norm_id": en_norm.get("norm_id", ""),
                            "title": en_norm.get("title", ""),
                            "preview": en_preview,
                        }
                    )
        except (json.JSONDecodeError, OSError) as e:
            logging.warning("Failed to load translation for %s: %s", key, e)

    return {
        "key": key,
        "title": meta.get("title", ""),
        "en_title": en_title,
        "alt_title": meta.get("alt_title", ""),
        "last_changed": meta.get("last_changed", ""),
        "source": meta.get("source", ""),
        "category": category,
        "norms": norms,
        "en_norms": en_norms,
        "file_path": fpath,
        "has_translation": bool(en_title or en_norms),
    }


def _populate_inverted_pure(summaries: List[Dict]) -> Dict:
    """Build and return an in-memory inverted index purely without state mutation."""
    inv: Dict[str, List[Tuple[int, float]]] = defaultdict(list)
    for idx, s in enumerate(summaries):
        term_scores: Dict[str, float] = defaultdict(float)
        # Law abbreviation (highest signal)
        for t in tokenize(s["key"]):
            term_scores[t] += 20.0
        # Titles (German and English)
        for t in tokenize(
            s["title"] + " " + s.get("alt_title", "") + " " + s.get("en_title", "")
        ):
            term_scores[t] += 10.0
        # Norm ids and titles (German and English)
        all_norms = s.get("norms", []) + s.get("en_norms", [])
        for norm in all_norms:
            for t in tokenize(norm["norm_id"] + " " + norm["title"]):
                term_scores[t] += 3.0
            # Paragraph previews (low weight)
            for t in tokenize(norm["preview"]):
                term_scores[t] += 0.4
        for term, score in term_scores.items():
            inv[term].append((idx, score))
    return dict(inv)


def _fast_load_index(path: str) -> bool:
    """Try to load a pre-built search index with inverted weights. Returns True on success."""
    global _total_files, _indexed_files, _law_summaries, _inverted, _sorted_terms
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)

        # Backward compatibility check
        if isinstance(data, list):
            # Old format, just summaries
            summaries = data
            inverted = None
        else:
            summaries = data.get("summaries", [])
            inverted = data.get("inverted", {})

        local_total_files = len(summaries)
        local_indexed_files = len(summaries)

        if inverted:
            new_inverted = inverted
        else:
            new_inverted = _populate_inverted_pure(summaries)

        new_sorted_terms = sorted(new_inverted.keys())

        with _index_lock:
            _law_summaries = summaries
            _inverted = new_inverted
            _sorted_terms = new_sorted_terms
            _total_files = local_total_files
            _indexed_files = local_indexed_files

        _indexing_done.set()
        logging.info(
            "Fast Index Ready: %d laws, %d terms.", len(summaries), len(_inverted)
        )
        return True
    except (json.JSONDecodeError, OSError, ValueError):
        logging.warning("Cached index unreadable — rebuilding from source.")
        with _index_lock:
            _law_summaries = []
            _inverted = {}
            _sorted_terms = []
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


def _persist_index(summaries: List[Dict], local_inverted: Dict) -> bool:
    """Save the lightweight index and the inverted mapping to disk atomically.

    Returns True on successful write, False otherwise. This allows callers to
    attempt disk persistence before mutating in-memory globals to avoid a
    window where memory and on-disk state differ.
    """
    try:
        data = {
            "summaries": summaries,
            "inverted": local_inverted,
        }

        # Write to a temporary file first, then atomically rename it.
        # This prevents search_index.json corruption if the process is killed midway.
        fd, temp_path = tempfile.mkstemp(
            dir=os.path.dirname(os.path.abspath(SEARCH_INDEX_FILE)), suffix=".tmp"
        )
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False)

        # Atomic replace
        os.replace(temp_path, SEARCH_INDEX_FILE)
        logging.info("Deep search index atomically saved → %s", SEARCH_INDEX_FILE)
        return True
    except OSError as exc:
        logging.warning("Could not save search index: %s", exc)
        try:
            # Clean up temp file if it exists
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
        return False


def build_index(force: bool = False) -> None:
    global _law_summaries, _inverted, _sorted_terms, _indexed_files, _total_files
    try:
        if not os.path.isdir(JSON_DIR):
            logging.warning(
                "'%s' not found — run the download/process pipeline first.", JSON_DIR
            )
            return

        _indexing_done.clear()
        _indexed_files = 0

        # Fast path: pre-built lightweight index exists (only if not forcing)
        if not force and os.path.exists(SEARCH_INDEX_FILE):
            logging.info("Loading pre-built search index from %s …", SEARCH_INDEX_FILE)
            if _fast_load_index(SEARCH_INDEX_FILE):
                return

        # Slow path: scan individual JSON files
        summaries = _build_from_source()
        new_inverted = _populate_inverted_pure(summaries)
        new_sorted_terms = sorted(new_inverted.keys())

        # Persist to disk before swapping global references to avoid a short
        # window where in-memory state differs from the on-disk cache. Only
        # swap the live indexes if the persist succeeds.
        persisted = _persist_index(summaries, new_inverted)
        if not persisted:
            logging.warning("Index persistence failed; retaining existing in-memory index.")
            return

        # Safely swap in the new global references now that the on-disk cache
        # contains the same data. Keep the lock hold minimal.
        with _index_lock:
            _law_summaries = summaries
            _inverted = new_inverted
            _sorted_terms = new_sorted_terms

        logging.info("Indexing complete: %d laws ready.", len(summaries))
    except Exception as e:
        logging.error(f"FATAL: Index build failed: {e}")
    finally:
        _indexing_done.set()


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


def search_laws(query: str, top_k: int = 20, category: str = "") -> Dict:
    """Search for laws matching the query (returns laws only, not norms)."""
    # If query is empty but category exists, we just list all laws in category (up to top_k)
    if not query.strip() and not category:
        return {"results": [], "keywords": [], "german_terms": []}

    # Citation Detection: "BGB 303" or "Art 1 GG" or "§ 303 BGB"
    # To avoid regex-based DoS on long or adversarial inputs, only scan
    # a limited prefix of the query for citation patterns.
    CITATION_SCAN_MAX = 300
    try:
        scan_q = (query or "")[:CITATION_SCAN_MAX]
    except Exception:
        scan_q = ""

    citation_match = re.search(r"([A-Za-z]{2,})\s*(?:§|Art\.?|\b)??\s*(\d+)", scan_q, re.I)
    if citation_match and len(query) > CITATION_SCAN_MAX:
        logging.debug("Citation detection truncated to first %d chars", CITATION_SCAN_MAX)

    cited_law = citation_match.group(1).lower() if citation_match else ""
    cited_sec = citation_match.group(2) if citation_match else ""

    original_tokens, german_terms = expand_query(query)
    scores: Dict[int, float] = defaultdict(float)

    with _index_lock:
        local_summaries = _law_summaries
        local_inverted = _inverted
        local_sorted_terms = _sorted_terms

    # Boost exact/prefix key matches
    q_lower = query.lower().strip()
    for idx, law in enumerate(_law_summaries):
        # Category filtering
        if category and law.get("category") != category:
            continue

        # If query is empty but we are filtering by category, give a base score to show results
        if not q_lower and category:
            scores[idx] += 1.0

        law_key = law.get("key", "").lower()
        if q_lower and q_lower == law_key:
            scores[idx] += 1000.0  # Top priority
        elif q_lower and q_lower in law_key:
            scores[idx] += 200.0  # High priority

        # Citation match boost
        if cited_law and cited_law in law_key:
            if any(
                cited_sec == str(n.get("norm_id", "")) for n in law.get("norms", [])
            ):
                scores[idx] += 400.0

    for term in german_terms:
        # 1. Exact index term match
        if term in local_inverted:
            for idx, weight in local_inverted[term]:
                if category and local_summaries[idx].get("category") != category:
                    continue
                scores[idx] += weight * 2.0

        # 2. Fast prefix match
        # Try to find words starting with the term
        prefix = term[:5]
        if len(prefix) >= 4:
            s_idx = bisect.bisect_left(local_sorted_terms, prefix)
            while s_idx < len(local_sorted_terms) and local_sorted_terms[
                s_idx
            ].startswith(prefix):
                indexed_term = local_sorted_terms[s_idx]
                if indexed_term != term:
                    for d_idx, weight in local_inverted[indexed_term]:
                        if (
                            category
                            and local_summaries[d_idx].get("category") != category
                        ):
                            continue
                        scores[d_idx] += weight * 0.4
                s_idx += 1

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
        law = local_summaries[idx]
        relevance = (
            min(100, round(scores[idx] / max_score * 100)) if max_score > 0 else 0
        )
        results.append(
            {
                "key": law.get("key", ""),
                "title": law.get("title", ""),
                "alt_title": law.get("alt_title", ""),
                "last_changed": law.get("last_changed", ""),
                "relevance": relevance,
                "total_norms": len(law.get("norms", [])),
                "category": law.get("category", "other"),
                "relevant_norms": [
                    n.get("title") or n.get("norm_id") for n in law.get("norms", [])[:5]
                ],
            }
        )

    return {
        "results": results,
        "keywords": original_tokens,
        "german_terms": german_terms,
    }


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------


@app.route("/")
def index_page():
    return render_template("index.html", admin_key=ADMIN_API_KEY)


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

                cat_counts = defaultdict(int)
                for law in _law_summaries:
                    cat_counts[law.get("category", "other")] += 1

        return jsonify(
            {
                "ready": _indexing_done.is_set(),
                "total": _total_files,
                "indexed": _indexed_files,
                "laws": len(_law_summaries),
                "total_norms": total_norms,
                "categories": cat_counts if _indexing_done.is_set() else {},
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
@rate_limit(max_calls=int(os.environ.get("RATE_LIMIT_SEARCH", "30")), per_seconds=int(os.environ.get("RATE_PERIOD_SEARCH", "60")))
def api_search():
    if not _indexing_done.is_set():
        return jsonify({"error": "Index still building.", "results": []}), 503
    data = request.get_json(force=True, silent=True) or {}
    query = (data.get("query") or "").strip()
    category = data.get("category", "")
    return jsonify(search_laws(query, category=category))


@app.route("/api/laws")
@rate_limit(max_calls=int(os.environ.get("RATE_LIMIT_GENERIC", "60")), per_seconds=int(os.environ.get("RATE_PERIOD_GENERIC", "60")))
def api_laws():
    """Returns a paginated and filterable list of all laws (German only, without norms)."""
    if not _indexing_done.is_set():
        return jsonify({"ready": False}), 503

    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 48))
    category = request.args.get("category", "")
    q = request.args.get("q", "").lower()

    # Snapshot local reference
    with _index_lock:
        local_summaries = _law_summaries

    filtered = local_summaries
    if category:
        filtered = [l for l in filtered if l.get("category") == category]
    try:
        if q:
            # Tokenize for smart matching (split by space, §, etc)
            parts = [p.strip() for p in re.split(r"[\s§]+", q) if p.strip()]

            # Simple fallback if splitting failed
            if not parts:
                filtered = [
                    l
                    for l in filtered
                    if q in l.get("key", "").lower() or q in l.get("title", "").lower()
                ]
            else:
                law_prefix = parts[0]
                section_num = parts[1] if len(parts) >= 2 else ""

                def is_match(l):
                    key = l.get("key", "").lower()
                    title = l.get("title", "").lower()

                    # Case 1: "BGB 303" -> parts[0]="bgb", parts[1]="303"
                    if law_prefix and section_num:
                        # Law code must start with prefix OR match exactly
                        if law_prefix not in key:
                            return False
                        # Check if any norm matches the section number
                        return any(
                            section_num in str(n.get("norm_id", "")).lower()
                            for n in l.get("norms", [])
                        )

                    # Case 2: Only one term (could be "BGB" or "§303" or "303")
                    if law_prefix:
                        # Basic title/key match
                        if law_prefix in key or law_prefix in title:
                            return True
                        # If it's a number, match against norm IDs
                        if any(c.isdigit() for c in law_prefix):
                            return any(
                                law_prefix in str(n.get("norm_id", "")).lower()
                                for n in l.get("norms", [])
                            )

                    return False

                filtered = [l for l in filtered if is_match(l)]

        total_matching = len(filtered)

        # Sort by key (abbreviation) for the database view
        filtered = sorted(filtered, key=lambda x: x.get("key", ""))

        start = (page - 1) * per_page
        end = start + per_page
        paged = filtered[start:end]

        results = []
        for law in paged:
            item = {
                "key": law.get("key", ""),
                "title": law.get("title", ""),
                "alt_title": law.get("alt_title", ""),
                "last_changed": law.get("last_changed", ""),
                "category": law.get("category", "other"),
                "total_norms": len(law.get("norms", [])),
            }
            results.append(item)

        return jsonify(
            {
                "laws": results,
                "total": total_matching,
                "page": page,
                "per_page": per_page,
                "has_more": end < total_matching,
            }
        )
    except Exception as e:
        logging.error(f"API LAWS ERROR: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/law/<path:key>")
@rate_limit(max_calls=int(os.environ.get("RATE_LIMIT_GENERIC", "60")), per_seconds=int(os.environ.get("RATE_PERIOD_GENERIC", "60")))
def api_law(key: str):
    """Return the full content of a law by key (German + English translation if available)."""
    with _index_lock:
        local_summaries = _law_summaries

    match = next(
        (law_sum for law_sum in local_summaries if law_sum["key"] == key), None
    )
    if not match:
        return jsonify({"error": "Law not found"}), 404
    try:
        with open(match["file_path"], encoding="utf-8", errors="replace") as fh:
            raw = json.load(fh)

        # If translation exists, lazily load it and attach
        if match.get("has_translation"):
            en_translation_path = os.path.join(EN_JSON_DIR, f"{key}.json")
            if os.path.exists(en_translation_path):
                with open(
                    en_translation_path, encoding="utf-8", errors="replace"
                ) as fh:
                    raw["en_translation"] = json.load(fh)

        return jsonify(raw)
    except OSError as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# AI Translation System
# ---------------------------------------------------------------------------
_translation_cache: Dict[str, str] = {}
_translation_lock = threading.Lock()
AI_TRANSLATION_FILE = "./ai_translations.json"
_translation_dirty = False
_translation_save_interval = int(os.environ.get("TRANSLATION_SAVE_INTERVAL", "30"))


def _atomic_write_json(path: str, data) -> bool:
    try:
        fd, temp_path = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)) or '.', suffix=".tmp")
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        os.replace(temp_path, path)
        return True
    except Exception as e:
        logging.warning("Atomic write failed for %s: %s", path, e)
        try:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
        return False


def load_ai_translations():
    global _translation_cache
    if os.path.exists(AI_TRANSLATION_FILE):
        try:
            with open(AI_TRANSLATION_FILE, "r", encoding="utf-8") as f:
                _translation_cache = json.load(f)
            logging.info("Loaded %d AI translations.", len(_translation_cache))
        except Exception as e:
            logging.warning("Could not load AI translations: %s", e)


def save_ai_translations():
    with _translation_lock:
        try:
            if _atomic_write_json(AI_TRANSLATION_FILE, _translation_cache):
                global _translation_dirty
                _translation_dirty = False
                logging.info("Saved %d AI translations.", len(_translation_cache))
            else:
                logging.warning("Failed to persist AI translations to %s", AI_TRANSLATION_FILE)
        except Exception as e:
            logging.warning("Could not save AI translations: %s", e)


# Load cache on startup
load_ai_translations()


# Periodic background saver to reduce lost translations on crash
def _translation_background_saver():
    while True:
        time.sleep(_translation_save_interval)
        try:
            with _translation_lock:
                if _translation_dirty:
                    save_ai_translations()
        except Exception:
            pass

threading.Thread(target=_translation_background_saver, daemon=True).start()


# Ensure translations are saved on exit
atexit.register(save_ai_translations)


@app.route("/api/ai_translate", methods=["POST"])
@rate_limit(max_calls=int(os.environ.get("RATE_LIMIT_TRANSLATE", "60")), per_seconds=int(os.environ.get("RATE_PERIOD_TRANSLATE", "60")))
def api_ai_translate():
    """Translates text using Ollama with a local cache."""
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "").strip()
    is_title = data.get("is_title", False)

    if not text:
        return jsonify({"translation": ""})

    with _translation_lock:
        if text in _translation_cache:
            return jsonify({"translation": _translation_cache[text]})

    model = os.environ.get("OLLAMA_MODEL", "llama3.2")

    # Ensure we update the module-level dirty flag when new translations arrive
    global _translation_dirty

    # Prompt optimization for legal translation
    if is_title:
        prompt = (
            "Translate this German law title or abbreviation into professional English. "
            "Return ONLY the translation, no explanation.\n\n"
            f"German: {text}\nEnglish:"
        )
    else:
        prompt = (
            "Translate this German legal norm/paragraph into professional, accurate English. "
            "Maintain formal legal terminology and formatting. Return ONLY the translated text.\n\n"
            f"German: {text}\n\nEnglish Legal Translation:"
        )

    import urllib.request

    payload = {"model": model, "prompt": prompt, "stream": False}

    try:
        # Use robust wrapper with retries and configurable timeout
        resp = _ollama_request(payload)
        res_data = json.loads(resp.read().decode("utf-8"))
        translation = res_data.get("response", "").strip()

        # Basic cleanup of AI chatter if any
        if translation.startswith('"') and translation.endswith('"'):
            translation = translation[1:-1]

        if translation:
            with _translation_lock:
                _translation_cache[text] = translation
                _translation_dirty = True
            # Proactively save every 10 translations to avoid loss
            if len(_translation_cache) % 10 == 0:
                threading.Thread(target=save_ai_translations, daemon=True).start()

        return jsonify({"translation": translation})
    except Exception as e:
        # Persist what we have before returning the error to avoid losing recent translations
        try:
            save_ai_translations()
        except Exception:
            pass
        return jsonify(
            {"error": str(e), "translation": f"[Translation Error: {text}]"}
        ), 500


def _ollama_request(payload: dict, stream: bool = False):
    """Call the local Ollama HTTP API with retries and exponential backoff.

    Returns the urllib response object on success or raises the last exception.
    """
    import urllib.request

    url = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
    timeout = int(os.environ.get("OLLAMA_TIMEOUT", "120"))
    max_retries = int(os.environ.get("OLLAMA_MAX_RETRIES", "3"))
    backoff_base = float(os.environ.get("OLLAMA_RETRY_BACKOFF", "1.0"))

    last_exc = None
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            resp = urllib.request.urlopen(req, timeout=timeout)
            return resp
        except (urllib.error.URLError, socket.timeout, ConnectionError) as e:
            last_exc = e
            logging.warning("Ollama request failed (attempt %d/%d): %s", attempt, max_retries, e)
            if attempt == max_retries:
                break
            sleep = backoff_base * (2 ** (attempt - 1))
            time.sleep(sleep)
        except Exception as e:
            last_exc = e
            logging.exception("Unexpected error calling Ollama: %s", e)
            break

    # Raise the last exception to the caller
    raise last_exc


@app.route("/api/ai_chat", methods=["POST"])
@rate_limit(max_calls=int(os.environ.get("RATE_LIMIT_AI_CHAT", "5")), per_seconds=int(os.environ.get("RATE_PERIOD_AI_CHAT", "60")))
def api_ai_chat():
    """Streams a response from local Ollama instance utilizing the provided German law context."""
    data = request.get_json(force=True, silent=True) or {}
    query = data.get("query", "").strip()
    context = data.get("context", "").strip()

    # Optional explicitly selected model, fallback to a fast standard
    model = os.environ.get("OLLAMA_MODEL", "llama3.2")

    prompt = (
        "### SYSTEM\n"
        "You are an expert German Legal Assistant. Your role is to explain German law to English speakers accurately and professionally. "
        "Base your analysis strictly on the provided context where possible. If the context is insufficient, state the limitations clearly "
        "before providing general legal principles. Keep explanations concise, structured, and avoid speculation.\n\n"
        "### CONTEXT\n"
        f"Relevant legal metadata and norm snippets:\n{context}\n\n"
        "### TASK\n"
        f'Analyze and answer: "{query}"\n\n'
        "### OUTPUT STRUCTURE\n"
        "1. **Summary**: Brief overview of the situation.\n"
        "2. **Detailed Analysis**: Breakdown of relevant paragraphs (e.g., § 303 BGB). Explain the legal logic.\n"
        "3. **Practical Guidance**: Conclusion or next steps.\n\n"
        "Expert Legal Analysis in English:"
    )

    def generate_stream():
        payload = {"model": model, "prompt": prompt, "stream": True}
        try:
            resp = _ollama_request(payload)
            for line in resp:
                if line:
                    try:
                        chunk = json.loads(line)
                        if "response" in chunk:
                            yield chunk["response"]
                    except Exception:
                        # Non-JSON chunk; yield raw safely
                        try:
                            txt = line.decode('utf-8') if isinstance(line, (bytes, bytearray)) else str(line)
                            yield txt
                        except Exception:
                            continue
        except Exception as e:
            yield f"\n\n[Ollama Connection Error: {str(e)}. Ensure Ollama is running and model '{model}' is installed via `ollama run {model}`]"

    return Response(generate_stream(), mimetype="text/plain")


# API endpoints section continues below


# -----------------------------
# Admin / Debug endpoints
# -----------------------------


def _is_admin(req) -> bool:
    # Require strictly identical ADMIN_API_KEY preventing network edge bypassing
    token = req.headers.get("X-Admin-Token")
    return token == ADMIN_API_KEY


@app.route("/api/admin/info")
def api_admin_info():
    if not _is_admin(request):
        return jsonify({"error": "unauthorized"}), 403
    lvl = logging.getLogger().getEffectiveLevel()
    return jsonify(
        {
            "indexing": _indexing_done.is_set(),
            "total_files": _total_files,
            "indexed_files": _indexed_files,
            "laws": len(_law_summaries),
            "log_level": logging.getLevelName(lvl),
        }
    )


@app.route("/api/admin/rebuild_index", methods=["POST"])
def api_admin_rebuild():
    if not _is_admin(request):
        return jsonify({"error": "unauthorized"}), 403

    # Optional: Delete the cached index file to force fresh scans for future restarts too
    if os.path.exists(SEARCH_INDEX_FILE):
        try:
            os.remove(SEARCH_INDEX_FILE)
        except Exception as e:
            logging.warning("Could not remove cached index file %s: %s", SEARCH_INDEX_FILE, e)

    # Start rebuild in background, forcing a scan from source
    threading.Thread(target=build_index, args=(True,), daemon=True).start()
    return jsonify({"status": "reindexing_started"}), 202


@app.route("/api/admin/clear_translations", methods=["POST"])
def api_admin_clear_translations():
    """Translation caching has been removed."""
    if not _is_admin(request):
        return jsonify({"error": "unauthorized"}), 403
    return jsonify(
        {
            "status": "translations_disabled",
            "message": "Translation caching is no longer used",
        }
    )


@app.route("/api/admin/toggle_debug", methods=["POST"])
def api_admin_toggle_debug():
    if not _is_admin(request):
        return jsonify({"error": "unauthorized"}), 403
    root = logging.getLogger()
    lvl = root.getEffectiveLevel()
    new_lvl = logging.DEBUG if lvl != logging.DEBUG else logging.INFO
    root.setLevel(new_lvl)
    return jsonify(
        {"debug": new_lvl == logging.DEBUG, "level": logging.getLevelName(new_lvl)}
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    threading.Thread(target=build_index, daemon=True).start()
    print("  ---  German Law Search Dashboard")
    print(f"  ->   http://{HOST}:{PORT}\n")
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False)
