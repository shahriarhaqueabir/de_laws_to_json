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
import sys
import re
import threading
import bisect
import secrets
import tempfile
import time
import socket
import math
import atexit
import urllib.request
import urllib.error
from collections import defaultdict, OrderedDict, deque
from functools import wraps
from typing import Dict, List, Optional, Tuple

from flask import Flask, jsonify, render_template, request, Response

# Import centralized logging configuration
from logging_config import (
    get_server_logger,
    get_error_logger,
    get_indexing_logger,
    get_dictionary_logger,
    get_ai_logger,
    get_ratelimit_logger,
)

# Initialize all loggers
logger = get_server_logger()
error_logger = get_error_logger()
indexing_logger = get_indexing_logger()
dictionary_logger = get_dictionary_logger()
ai_logger = get_ai_logger()
ratelimit_logger = get_ratelimit_logger()

# Legal Dictionary integration - IN-MEMORY VERSION (no SQLite!)
# Uses pre-generated de_en_reversed.json for instant lookups
try:
    from dictionary.memory_dict import get_memory_legal_dictionary

    legal_dict = get_memory_legal_dictionary()
    if legal_dict:
        dictionary_logger.info("In-memory legal dictionary loaded successfully")
        stats = legal_dict.get_stats()
        dictionary_logger.info(f"Stats: {stats}")
    else:
        dictionary_logger.warning("In-memory dictionary returned None")
        legal_dict = None
except Exception as e:
    dictionary_logger.error(f"Error loading in-memory dictionary: {e}")
    legal_dict = None

# Unified AI Translation System
# Uses in-memory dictionary by default for dictionary hints
try:
    from unified_translator import get_unified_translator, translate_text
    # Pass None - unified_translator will load its own in-memory dictionary
    unified_translator = get_unified_translator(None)
    dictionary_logger.info("Unified AI translator initialized")
except Exception as e:
    dictionary_logger.error(f"Failed to initialize unified translator: {e}")
    unified_translator = None

# Import AI Guardrails
try:
    from ai_guardrails import (
        check_query_for_pii,
        validate_ai_response,
        get_pii_warning_response,
        get_ambiguous_query_response,
    )
    GUARDRAILS_AVAILABLE = True
    ai_logger.info("AI guardrails imported successfully")
except ImportError as e:
    GUARDRAILS_AVAILABLE = False
    ai_logger.warning(f"Could not import AI guardrails: {e}")

# Import version tracking
try:
    from version_tracking import get_version_tracker
    VERSION_TRACKING_AVAILABLE = True
except ImportError as e:
    ai_logger.debug(f"Version tracking not available: {e}")
    VERSION_TRACKING_AVAILABLE = False

# Thread-safe locks
_index_lock = threading.Lock()
_indexing_done = threading.Event()
_rebuild_in_progress = threading.Lock()

# Dev/Admin State
_dev_state = {"ai_enabled": True, "start_time": time.time()}
_dev_lock = threading.Lock()

# Translation support removed - display German-only
HAS_TRANSLATOR = False

app = Flask(__name__)

@app.after_request
def _log_response(response):
    """Log every HTTP request with status and brief reason for easy debugging."""
    # Add CORS headers for API endpoints
    if request.path.startswith('/api/'):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Admin-Token'
        
        # Handle OPTIONS preflight request
        if request.method == 'OPTIONS':
            response.status_code = 200
            return response

    status = response.status_code
    method = request.method
    path = request.path
    qs = f"?{request.query_string.decode()}" if request.query_string else ""

    # Classify the reason
    if status == 200:
        reason = "OK"
    elif status == 201:
        reason = "Created"
    elif status == 202:
        reason = "Accepted"
    elif status == 204:
        reason = "No Content"
    elif status == 301 or status == 302:
        reason = f"Redirect → {response.headers.get('Location', '?')}"
    elif status == 304:
        reason = "Not Modified (cached by browser)"
    elif status == 400:
        # Try to extract JSON error body
        try:
            body = response.get_data(as_text=True)
            reason = f"Bad Request — {body[:120]}"
        except Exception:
            reason = "Bad Request"
    elif status == 403:
        reason = "Forbidden (admin check failed)"
    elif status == 404:
        reason = f"Not Found — no route for '{method} {path}'"
    elif status == 405:
        reason = f"Method Not Allowed — '{method}' not permitted on {path}"
    elif status == 429:
        retry = response.headers.get("Retry-After", "?")
        reason = f"Rate Limited — retry after {retry}s"
    elif status == 500:
        try:
            body = response.get_data(as_text=True)
            reason = f"Internal Server Error — {body[:120]}"
        except Exception:
            reason = "Internal Server Error"
    elif status == 503:
        reason = "Service Unavailable (index still building)"
    else:
        reason = response.status

    level = logging.WARNING if status >= 400 else logging.INFO
    logger.log(level, "HTTP %d | %s %s%s | %s", status, method, path, qs, reason)
    return response

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
JSON_DIR = "./de_federal_json"
EN_JSON_DIR = "./de_federal_translations"
SEARCH_INDEX_FILE = "./search_index.json"
HOST = "127.0.0.1"
PORT = 5000

# Constants for common legal terms
TERM_RENT_INCREASE = "Mieterhöhung"
TERM_TERMINATION = "Kündigung"
TERM_FINE = "Bußgeld"

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

def _cleanup_rate_store():
    """Remove expired entries from the rate limit store to prevent memory growth."""
    now = time.time()
    # We use list(keys) to avoid "dictionary changed size during iteration"
    with _rate_lock:
        to_delete = []
        for key, dq in _rate_store.items():
            # A client is "inactive" if their newest request is older than 24 hours
            if not dq or dq[-1] < now - 86400:
                to_delete.append(key)
        for key in to_delete:
            del _rate_store[key]

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
                    resp = jsonify(
                        {"error": "rate_limited", "retry_after": retry_after}
                    )
                    # Set status and headers directly on the Response object to avoid
                    # Flask ambiguity when returning tuples containing Response objects.
                    resp.status_code = 429
                    resp.headers["Retry-After"] = str(retry_after)
                    return resp
                dq.append(now)

            # Periodically prune the entire store to prevent memory leaks from stale IPs
            # This is a lightweight "per-request" pruning chance
            if secrets.randbelow(100) == 0:
                threading.Thread(target=_cleanup_rate_store, daemon=True).start()

            return fn(*args, **kwargs)

        return wrapper

    return decorator

# Legal Jargon & Abbreviation Mapping (Deterministic Fast-Path)
FRAGMENT_MAP = {
    # Core Laws
    "gg": "Basic Law (Constitution)",
    "bgb": "Civil Code",
    "stgb": "Criminal Code",
    "stpo": "Code of Criminal Procedure",
    "zpo": "Code of Civil Procedure",
    "vwgo": "Administrative Court Rules",
    "owig": "Administrative Offenses Act",
    # Structure
    "abs.": "Para.",
    "abs": "Para.",
    "s.": "Sent.",
    "nr.": "No.",
    "art.": "Art.",
    "i.v.m.": "in conjunction with",
    "gem.": "acc. to",
    "vgl.": "cf.",
    "f.": "f.",
    "ff.": "ff.",
    "alt.": "Alt.",
    # Validity & Phrases
    "in kraft": "in force",
    "außer kraft": "no longer in force",
    "anwendbar": "applicable",
    "rückwirkend": "retroactive",
    # Modal verbs
    "muss": "must",
    "darf": "may",
    "soll": "should",
    "kann": "can/may",
    # Procedural
    "urt.": "Judgment",
    "beschl.": "Court order",
    "rechtskräftig": "final and binding",
    "nach h.m.": "prevailing opinion",
    "a.f.": "old version",
    "n.f.": "new version",
}

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
    "rent": ["Miete", TERM_RENT_INCREASE, "Mietvertrag", "Mietzins"],
    "rental": ["Miete", "Mietvertrag", "Wohnraum"],
    "lease": ["Mietvertrag", "Pacht", "Pachtverhältnis"],
    "apartment": ["Wohnung", "Mietwohnung", "Wohnraum"],
    "flat": ["Wohnung", "Wohnraum"],
    "house": ["Haus", "Immobilie", "Grundstück"],
    "eviction": [TERM_TERMINATION, "Räumung", "Räumungsklage"],
    "deposit": ["Kaution", "Sicherheitsleistung", "Mietkaution"],
    "termination": [TERM_TERMINATION, "Beendigung", "Auflösung"],
    "notice": [TERM_TERMINATION, "Ankündigung", "Frist"],
    "increase": ["Erhöhung", TERM_RENT_INCREASE, "Anhebung"],
    "increasing": ["Erhöhung", "erhöhen", TERM_RENT_INCREASE],
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
    "fired": [TERM_TERMINATION, "entlassen", "Entlassung", "Kündigungsschutz"],
    "dismissed": [TERM_TERMINATION, "Entlassung", "Abmahnung"],
    "dismissal": [TERM_TERMINATION, "Entlassung", "Abmahnung"],
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
    "fine": [TERM_FINE, "Strafe", "Geldstrafe"],
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
    "penalty": ["Strafe", "Sanktion", TERM_FINE],
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
    "best interests": ["Kindeswohl"],
    "internet": ["Telekommunikation", "TKG", "Vertrag", "Digital"],
    "shopping": ["Kauf", "Gewährleistung", "Widerruf", "Fernabsatz"],
    "scam": ["Betrug", "Täuschung", "Arglist"],
    "fined": [TERM_FINE, "Strafe", "Bußgeldbescheid", "Verwarnung"],
}

# German synonym expansion
DE_EXPANSIONS: Dict[str, List[str]] = {
    "miete": [
        "mietvertrag",
        "mietrecht",
        TERM_RENT_INCREASE.lower(),
        "vermieter",
        "mieter",
    ],
    "mietvertrag": ["miete", "vermieter", "mieter", "mietrecht"],
    TERM_TERMINATION.lower(): ["kündigungsfrist", "abmahnung", "kündigen"],
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

# BM25 Metadata
_doc_lengths: Dict[int, int] = {}
_avgdl: float = 0.0

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
        translated_list = []

        # 1. Try static EN_DE mapping
        static_trans = EN_DE.get(tok)
        if static_trans:
            translated_list.extend(t.lower() for t in static_trans)

        # 2. Try LegalDictionary expansion (Natural Language Search)
        if legal_dict:
            try:
                # Use the new reverse lookup method
                dict_german = legal_dict.get_german_terms(tok)
                translated_list.extend(g.lower() for g in dict_german)
            except Exception as e:
                logging.debug("Dictionary expansion failed for %s: %s", tok, e)

        if translated_list:
            german.extend(translated_list)
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

def _populate_inverted_pure(
    summaries: List[Dict],
) -> Tuple[Dict, Dict[int, int], float]:
    """Build and return an in-memory inverted index, doc lengths, and avg document length."""
    inv: Dict[str, List[Tuple[int, float]]] = defaultdict(list)
    doc_lengths: Dict[int, int] = {}
    total_len = 0

    for idx, s in enumerate(summaries):
        term_scores: Dict[str, float] = defaultdict(float)
        # We calculate "raw" frequency-like scores for BM25.
        # Law abbreviation (highest signal)
        tokens_key = tokenize(s["key"])
        for t in tokens_key:
            term_scores[t] += 20.0
        # Titles (German and English)
        tokens_titles = tokenize(
            s["title"] + " " + s.get("alt_title", "") + " " + s.get("en_title", "")
        )
        for t in tokens_titles:
            term_scores[t] += 10.0
        # Norm ids and titles (German and English)
        all_norms = s.get("norms", []) + s.get("en_norms", [])
        norm_tokens_count = 0
        for norm in all_norms:
            toks_norm = tokenize(norm["norm_id"] + " " + norm["title"])
            for t in toks_norm:
                term_scores[t] += 3.0
            # Paragraph previews (low weight)
            toks_preview = tokenize(norm["preview"])
            for t in toks_preview:
                term_scores[t] += 0.4
            norm_tokens_count += len(toks_norm) + len(toks_preview)

        # Doc length is the sum of relevant tokens (approximated)
        d_len = len(tokens_key) + len(tokens_titles) + norm_tokens_count
        doc_lengths[idx] = d_len
        total_len += d_len

        for term, score in term_scores.items():
            inv[term].append((idx, score))

    avgdl = total_len / max(len(summaries), 1)
    return dict(inv), doc_lengths, avgdl

def _fast_load_index(path: str) -> bool:
    """Try to load a pre-built search index with BM25 metadata. Returns True on success."""
    global \
        _total_files, \
        _indexed_files, \
        _law_summaries, \
        _inverted, \
        _sorted_terms, \
        _doc_lengths, \
        _avgdl
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)

        # Backward compatibility check
        if isinstance(data, list):
            # Old format, just summaries
            summaries = data
            inverted, doc_lengths, avgdl = _populate_inverted_pure(summaries)
        else:
            summaries = data.get("summaries", [])
            inverted = data.get("inverted", {})
            # Load doc_lengths keys as ints (JSON keys are always strings)
            raw_dl = data.get("doc_lengths", {})
            doc_lengths = {int(k): v for k, v in raw_dl.items()}
            avgdl = data.get("avgdl", 0.0)

            if not inverted or not doc_lengths:
                inverted, doc_lengths, avgdl = _populate_inverted_pure(summaries)

        new_sorted_terms = sorted(inverted.keys())

        with _index_lock:
            _law_summaries = summaries
            _inverted = inverted
            _sorted_terms = new_sorted_terms
            _doc_lengths = doc_lengths
            _avgdl = avgdl
            _total_files = len(summaries)
            _indexed_files = len(summaries)

        _indexing_done.set()
        logging.info(
            "Fast Index Ready: %d laws, %d terms, avgdl=%.2f.",
            len(summaries),
            len(_inverted),
            _avgdl,
        )
        return True
    except (json.JSONDecodeError, OSError, ValueError) as e:
        logging.warning("Cached index unreadable — rebuilding from source: %s", e)
        with _index_lock:
            _law_summaries = []
            _inverted = {}
            _sorted_terms = []
            _doc_lengths = {}
            _avgdl = 0.0
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

def _persist_index(
    summaries: List[Dict], local_inverted: Dict, doc_lengths: Dict, avgdl: float
) -> bool:
    """Save the lightweight index, inverted mapping, and BM25 metadata to disk atomically."""
    try:
        data = {
            "summaries": summaries,
            "inverted": local_inverted,
            "doc_lengths": doc_lengths,
            "avgdl": avgdl,
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
            if "temp_path" in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
        return False

def build_index(force: bool = False) -> None:
    global _law_summaries, _inverted, _sorted_terms, _indexed_files, _total_files
    start_time = time.time()
    try:
        indexing_logger.info("=" * 50)
        indexing_logger.info("Index build started")
        
        if not os.path.isdir(JSON_DIR):
            indexing_logger.error("'%s' not found — run the download/process pipeline first.", JSON_DIR)
            return

        _indexing_done.clear()
        _indexed_files = 0

        # Fast path: pre-built lightweight index exists (only if not forcing)
        if not force and os.path.exists(SEARCH_INDEX_FILE):
            indexing_logger.info("Loading pre-built search index from %s …", SEARCH_INDEX_FILE)
            if _fast_load_index(SEARCH_INDEX_FILE):
                indexing_logger.info("Index loaded successfully from cache")
                return

        # Slow path: scan individual JSON files
        indexing_logger.info("Building index from source JSON files...")
        summaries = _build_from_source()
        new_inverted, new_doc_lengths, new_avgdl = _populate_inverted_pure(summaries)
        new_sorted_terms = sorted(new_inverted.keys())

        # Persist to disk before swapping global references
        persisted = _persist_index(summaries, new_inverted, new_doc_lengths, new_avgdl)
        if not persisted:
            indexing_logger.warning("Index persistence failed; using in-memory only.")

        # Swapping global references
        with _index_lock:
            _law_summaries = summaries
            _inverted = new_inverted
            _sorted_terms = new_sorted_terms
            _doc_lengths = new_doc_lengths
            _avgdl = new_avgdl

        duration = time.time() - start_time
        indexing_logger.info("Indexing complete: %d laws ready in %.2fs", len(summaries), duration)
        indexing_logger.info(f"Index statistics: {len(new_inverted)} unique terms, {len(new_sorted_terms)} sorted terms")
    except Exception as e:
        indexing_logger.error(f"FATAL: Index build failed: {e}")
        error_logger.error(f"Index build failed: {e}")
    finally:
        _indexing_done.set()
        indexing_logger.info("Index build finished (success or failure)")

# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def _detect_citation(query: str) -> Tuple[str, str]:
    """Extract law key and section number from query if it looks like a citation."""
    CITATION_SCAN_MAX = 300
    try:
        scan_q = (query or "")[:CITATION_SCAN_MAX]
    except Exception:
        scan_q = ""

    match = re.search(r"([A-Za-z]{2,})\s*(?:§|Art\.?)\s*(\d+)", scan_q, re.I)
    if match:
        return match.group(1).lower(), match.group(2)
    return "", ""

def _extract_cyborg_metadata(law: dict) -> dict:
    """Infer legal authority, status, and jurisdiction from law metadata."""
    key = law.get("key", "").upper()
    title = law.get("title", "").lower()

    # Authority level inference
    authority = "Regulation"  # Default for many secondary laws
    if "GESETZ" in title or key.endswith("G") or "GESETZ" in key:
        authority = "Federal Law"
    elif "ORDNUNG" in title or "VERORDNUNG" in title:
        authority = "Regulation"
    elif any(x in key for x in ["BGH", "BVERFG", "BSG", "BFH", "BAGE"]):
        authority = "Court Decision"

    # Status - Assume active if not specifically marked
    status = "Active"
    if "außer kraft" in title or "weggefallen" in title or "(a.f.)" in key.lower():
        status = "Invalid/Amended"

    jurisdiction = "Germany (Federal)"
    if "berlin" in key.lower() or "berlin" in title:
        jurisdiction = "Berlin (State)"

    # Categorization logic
    category = "other"
    if any(x in title for x in ["miete", "wohnung", "immobilien", "pacht"]):
        category = "housing"
    elif any(x in title for x in ["arbeit", "kündigung", "tarif", "beruf"]):
        category = "labor"
    elif any(x in title for x in ["steuer", "finanz", "bank", "geld", "währung"]):
        category = "finance"
    elif any(x in title for x in ["verkehr", "straße", "bahn", "auto", "kfz"]):
        category = "traffic"
    elif any(x in title for x in ["familie", "ehe", "kind", "unterhalt"]):
        category = "family"
    elif any(x in title for x in ["straf", "delikt", "gefängnis"]):
        category = "criminal"
    elif any(x in title for x in ["verbraucher", "kauf", "geschäft"]):
        category = "consumer"
    elif any(x in title for x in ["sozial", "rente", "kranken", "pflege"]):
        category = "social"
    elif any(x in title for x in ["patent", "urheber", "digit", "telekom"]):
        category = "tech"
    elif any(x in title for x in ["staats", "bundes", "recht", "wahl"]):
        category = "public"
    elif "berlin" in key.lower() or "berlin" in title:
        category = "berlin"

    return {
        "authority": authority,
        "status": status,
        "jurisdiction": jurisdiction,
        "category": category,
    }

def search_laws(query: str, top_k: int = 20, category: str = "") -> Dict:
    """Search for laws matching the query (returns laws only, not norms)."""
    if not query.strip() and not category:
        return {"results": [], "keywords": [], "german_terms": []}

    cited_law, cited_sec = _detect_citation(query)
    original_tokens, german_terms = expand_query(query)
    scores: Dict[int, float] = defaultdict(float)
    matched_map: Dict[int, List[str]] = defaultdict(list)

    with _index_lock:
        local_summaries = _law_summaries
        local_inverted = _inverted
        local_sorted_terms = _sorted_terms
        local_doc_lengths = _doc_lengths
        local_avgdl = _avgdl

    num_docs = len(local_summaries)
    q_lower = query.lower().strip()

    # 1. Base Score & Citation/Key Boost
    for idx, law in enumerate(local_summaries):
        if category and law.get("category") != category:
            continue

        # Basic listing for category if no query
        if not q_lower and category:
            scores[idx] += 1.0

        law_key = law.get("key", "").lower()
        if q_lower:
            if q_lower == law_key:
                scores[idx] += 1000.0
                matched_map[idx].append(f"Key match: {law_key}")
            elif q_lower in law_key:
                scores[idx] += 200.0
                matched_map[idx].append(f"Key partial: {law_key}")

            if cited_law and cited_law in law_key:
                if any(
                    cited_sec == str(n.get("norm_id", "")) for n in law.get("norms", [])
                ):
                    scores[idx] += 400.0
                    matched_map[idx].append(f"Citation: {cited_law} {cited_sec}")

    # 2. BM25 scoring for terms
    _apply_bm25_scoring(
        scores,
        german_terms,
        local_inverted,
        local_sorted_terms,
        local_doc_lengths,
        local_avgdl,
        num_docs,
        category,
        local_summaries,
        matched_map=matched_map,
    )

    if not scores:
        return {
            "results": [],
            "keywords": original_tokens,
            "german_terms": german_terms,
        }

    return _format_search_results(
        scores,
        local_summaries,
        top_k,
        original_tokens,
        german_terms,
        matched_map=matched_map,
    )

def _get_matching_docs(inverted, sorted_terms, term):
    """Retrieve documents matching a term, including prefix expansion if needed."""
    matching_docs = inverted.get(term, [])
    if not matching_docs and len(term) >= 4:
        prefix = term[:5]
        s_idx = bisect.bisect_left(sorted_terms, prefix)
        while s_idx < len(sorted_terms) and sorted_terms[s_idx].startswith(prefix):
            if sorted_terms[s_idx] != term:
                matching_docs.extend(inverted[sorted_terms[s_idx]])
            s_idx += 1
    return matching_docs

def _calculate_term_idf(matching_docs, num_docs):
    """Calculate Inverse Document Frequency (IDF) for a term."""
    unique_docs = {idx for idx, _ in matching_docs}
    n_q = len(unique_docs)
    return math.log((num_docs - n_q + 0.5) / (n_q + 0.5) + 1.0)

def _apply_bm25_scoring(
    scores,
    terms,
    inverted,
    sorted_terms,
    doc_lengths,
    avgdl,
    num_docs,
    category,
    summaries,
    matched_map=None,
):
    k1, b = 1.5, 0.75
    for term in terms:
        matching_docs = _get_matching_docs(inverted, sorted_terms, term)
        if not matching_docs:
            continue

        idf = _calculate_term_idf(matching_docs, num_docs)

        for idx, freq in matching_docs:
            if category and summaries[idx].get("category") != category:
                continue
            dl = doc_lengths.get(idx, avgdl)
            score = (
                idf
                * (freq * (k1 + 1))
                / (freq + k1 * (1 - b + b * (dl / max(avgdl, 1))))
            )
            scores[idx] += score
            if matched_map is not None:
                if term not in matched_map[idx]:
                    matched_map[idx].append(term)

def _format_search_results(
    scores, summaries, top_k, keywords, german_terms, matched_map=None
):
    top_indices = sorted(scores, key=scores.__getitem__, reverse=True)[:top_k]
    max_score = max(scores.values()) if scores else 0
    results = []
    for idx in top_indices:
        law = summaries[idx]
        relevance = (
            min(100, round(scores[idx] / max_score * 100)) if max_score > 0 else 0
        )

        # Cyborg Metadata Extraction
        meta = _extract_cyborg_metadata(law)

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
                "matched_terms": matched_map[idx] if matched_map else [],
                "authority": meta["authority"],
                "status": meta["status"],
                "jurisdiction": meta["jurisdiction"],
            }
        )
    return {"results": results, "keywords": keywords, "german_terms": german_terms}

# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------

@app.route("/")
def index_page():
    return render_template("index.html", admin_key=ADMIN_API_KEY)

@app.route("/favicon.ico")
def favicon():
    return "", 204

@app.route("/api/dev/health")
def api_dev_health():
    """Health check endpoint for development/debugging."""
    try:
        url = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/tags")
        req = urllib.request.Request(url)
        urllib.request.urlopen(req, timeout=5)
        ollama_status = "connected"
        ai_logger.info(f"AI health check: Ollama is {ollama_status} at {url}")
    except Exception as e:
        ollama_status = "disconnected"
        ai_logger.warning(f"AI health check: Ollama is {ollama_status} - {e}")

    # Determine index status
    index_status = "ready" if _indexing_done.is_set() else "building"

    # Get indexed laws count
    with _index_lock:
        indexed_laws = len(_law_summaries)

    return jsonify({
        "status": "ok",
        "ai_enabled": _dev_state["ai_enabled"],
        "ollama": ollama_status,
        "uptime": int(time.time() - _dev_state["start_time"]),
        "dependencies": {
            "search_index": index_status,
            "ai_service": ollama_status
        },
        "metrics": {
            "indexed_laws": indexed_laws
        }
    })

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
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_SEARCH", "30")),
    per_seconds=int(os.environ.get("RATE_PERIOD_SEARCH", "60")),
)
def api_search():
    if not _indexing_done.is_set():
        return jsonify({"error": "Index still building.", "results": []}), 503
    
    data = request.get_json(force=True, silent=True) or {}
    query = (data.get("query") or "").strip()
    category = data.get("category", "")
    
    # NEW: Check for PII in query
    if GUARDRAILS_AVAILABLE and query:
        has_pii, pii_types, warning = check_query_for_pii(query)
        if has_pii:
            indexing_logger.warning(
                f"PII detected in search query: {pii_types}"
            )
            return jsonify({
                "warning": warning,
                "results": [],
                "query": query,
                "pii_detected": True
            })
    
    results = search_laws(query, category=category)
    
    # Track view counts for returned laws (top results drive pre-warming)
    for result in (results.get("results") or [])[:10]:
        key = result.get("key")
        if key:
            _increment_view(key)
    
    return jsonify(results)

@app.route("/api/laws")
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_GENERIC", "60")),
    per_seconds=int(os.environ.get("RATE_PERIOD_GENERIC", "60")),
)
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
        filtered = [law for law in filtered if law.get("category") == category]
    try:
        if q:
            # Tokenize for smart matching (split by space or §)
            parts = [p.strip() for p in re.split(r"[\s§]+", q) if p.strip()]

            # Simple fallback if splitting failed
            if not parts:
                filtered = [
                    law
                    for law in filtered
                    if q in law.get("key", "").lower()
                    or q in law.get("title", "").lower()
                ]
            else:
                law_prefix = parts[0]
                section_num = parts[1] if len(parts) >= 2 else ""

                def is_match(law):
                    key = law.get("key", "").lower()
                    title = law.get("title", "").lower()

                    # Case 1: "BGB 303" -> parts[0]="bgb", parts[1]="303"
                    if law_prefix and section_num:
                        # Law code must start with prefix OR match exactly
                        if law_prefix not in key:
                            return False
                        # Check if any norm matches the section number
                        return any(
                            section_num in str(n.get("norm_id", "")).lower()
                            for n in law.get("norms", [])
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
                                for n in law.get("norms", [])
                            )

                    return False

                filtered = [law for law in filtered if is_match(law)]

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
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_GENERIC", "60")),
    per_seconds=int(os.environ.get("RATE_PERIOD_GENERIC", "60")),
)
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

@app.route("/api/law-insights/<path:key>")
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_AI", "10")),
    per_seconds=int(os.environ.get("RATE_PERIOD_AI", "60")),
)
def api_law_insights(key: str):
    """Generate AI insights (summary, risk, exclusions) for a specific law."""
    with _dev_lock:
        if not _dev_state["ai_enabled"]:
            return jsonify(
                {
                    "summary": "AI explanations are currently disabled by administrator.",
                    "risk": "Please contact support if you believe this is an error.",
                    "exclusions": "Pure search mode active.",
                    "scenarios": "Direct law text browsing only.",
                }
            ), 200

    with _index_lock:
        local_summaries = _law_summaries

    match = next(
        (law_sum for law_sum in local_summaries if law_sum["key"] == key), None
    )
    if not match:
        return jsonify({"error": "Law not found"}), 404

    try:
        # Load first few norms to provide context
        with open(match["file_path"], encoding="utf-8", errors="replace") as fh:
            law_data = json.load(fh)

        norms_context = ""
        for n in law_data.get("norms", [])[:3]:
            n_title = n.get("title", "")
            n_text = n.get("paragraphs", [{}])[0].get("text", "")[:300]
            norms_context += f"- {n_title}: {n_text}...\n"

        prompt = (
            f"Analyze the German law '{match['title']}' ({key}).\n"
            f"Context (Top Norms):\n{norms_context}\n"
            "Provide the following in professional English, formatted as valid JSON:\n"
            "1. 'summary': A 2-3 sentence plain-language summary.\n"
            "2. 'risk': A caution statement or potential legal pitfall (1 sentence).\n"
            "3. 'exclusions': What this law specifically does NOT cover (1 sentence).\n"
            "4. 'scenarios': A common example person-scenario where this applies.\n"
            "Return ONLY the JSON object."
        )

        if unified_translator:
            insights = unified_translator.call_ollama_json(prompt)
            if insights:
                return jsonify(insights)

    except Exception as e:
        logging.error(f"Law evaluation failed for {key}: {e}")

    # Fallback if AI fails or exception occurred
    logging.warning(f"Law evaluation using fallback for {key}")
    return jsonify(
        {
            "summary": f"Official provisions of {match['title']}. Use for primary reference.",
            "risk": "Interpretation often requires case law context not fully captured here.",
            "exclusions": "Procedural details may be superseded by specific state-level regulations.",
            "scenarios": "Referencing this statute during initial legal research or drafting.",
        }
    )

# ---------------------------------------------------------------------------
# AI Translation System
# ---------------------------------------------------------------------------
_translation_cache: Dict[str, str] = {}
_translation_lock = threading.Lock()
AI_TRANSLATION_FILE = "./ai_translations.json"
_translation_dirty = False
_translation_save_interval = int(os.environ.get("TRANSLATION_SAVE_INTERVAL", "30"))

# ---------------------------------------------------------------------------
# View-count tracker (persisted to law_view_counts.json)
# ---------------------------------------------------------------------------
VIEW_COUNTS_FILE = "./law_view_counts.json"
_view_counts: Dict[str, int] = {}
_view_counts_lock = threading.Lock()
_view_counts_dirty = False

def _load_view_counts():
    global _view_counts
    if os.path.exists(VIEW_COUNTS_FILE):
        try:
            with open(VIEW_COUNTS_FILE, "r", encoding="utf-8") as f:
                _view_counts = json.load(f)
            logging.info("Loaded %d law view counts.", len(_view_counts))
        except Exception as e:
            logging.warning("Could not load view counts: %s", e)

def _save_view_counts():
    global _view_counts_dirty
    with _view_counts_lock:
        if not _view_counts_dirty:
            return
        try:
            if _atomic_write_json(VIEW_COUNTS_FILE, _view_counts):
                _view_counts_dirty = False
        except Exception as e:
            logging.warning("Could not save view counts: %s", e)

def _increment_view(key: str):
    """Thread-safe view count increment."""
    global _view_counts_dirty
    with _view_counts_lock:
        _view_counts[key] = _view_counts.get(key, 0) + 1
        _view_counts_dirty = True

def _view_counts_background_saver():
    while True:
        time.sleep(60)
        _save_view_counts()

threading.Thread(target=_view_counts_background_saver, daemon=True).start()

def _atomic_write_json(path: str, data) -> bool:
    try:
        fd, temp_path = tempfile.mkstemp(
            dir=os.path.dirname(os.path.abspath(path)) or ".", suffix=".tmp"
        )
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        os.replace(temp_path, path)
        return True
    except Exception as e:
        logging.warning("Atomic write failed for %s: %s", path, e)
        try:
            if "temp_path" in locals() and os.path.exists(temp_path):
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
                logging.warning(
                    "Failed to persist AI translations to %s", AI_TRANSLATION_FILE
                )
        except Exception as e:
            logging.warning("Could not save AI translations: %s", e)

# Load cache on startup
load_ai_translations()
_load_view_counts()

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
atexit.register(_save_view_counts)

# ---------------------------------------------------------------------------
# Background Translation Pre-warmer
# Runs after index is ready, AI-translates the most-viewed law titles into the
# cache so users see instant refined translations on their first EN toggle.
# ---------------------------------------------------------------------------
def _prewarm_translations():
    """Low-priority background thread: pre-translate top-50 viewed law titles."""
    _indexing_done.wait()
    time.sleep(10)  # let server stabilise after startup
    ai_logger.info("PREWARM: Starting translation pre-warming for popular laws.")

    # Collect top candidates by view count
    with _view_counts_lock:
        sorted_keys = sorted(_view_counts, key=lambda k: _view_counts[k], reverse=True)[
            :50
        ]

    warmed = 0
    for key in sorted_keys:
        with _index_lock:
            summary = next((s for s in _law_summaries if s.get("key") == key), None)
        if not summary:
            continue

        title = summary.get("title", "").strip()
        if not title:
            continue

        # Skip if already in cache
        with _translation_lock:
            if title in _translation_cache:
                continue

        # Use unified translator
        if unified_translator:
            try:
                translation, from_cache = unified_translator.translate(title, is_title=True)
                if translation and translation != title:
                    warmed += 1
                    ai_logger.info(
                        "PREWARM [%d]: '%s' → '%s'", warmed, title[:40], translation[:40]
                    )
            except Exception as e:
                ai_logger.debug("PREWARM skip '%s': %s", title[:30], e)

            time.sleep(2)  # low priority — don't flood Ollama

    ai_logger.info("PREWARM: Done. %d law titles pre-translated.", warmed)

threading.Thread(target=_prewarm_translations, daemon=True).start()

@app.route("/api/dictionary_lookup", methods=["POST"])
def api_dictionary_lookup():
    """Fast-path dictionary lookup for the UI."""
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "").strip()
    if not text or not legal_dict:
        return jsonify({"results": []})

    try:
        results = legal_dict.get_translations(text, limit=3)
        return jsonify({"results": results})
    except Exception as e:
        logging.error(f"DICT LOOKUP ERROR: {e}")
        return jsonify({"error": str(e), "results": []}), 500

# ---------------------------------------------------------------------------
# Unified AI Translation Endpoint
# ---------------------------------------------------------------------------

@app.route("/api/translate", methods=["POST", "OPTIONS"])
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_TRANSLATE", "60")),
    per_seconds=int(os.environ.get("RATE_PERIOD_TRANSLATE", "60")),
)
def api_translate():
    """
    Unified AI-powered translation endpoint.
    
    All translation requests flow through here. The system:
    1. Checks translation cache (instant)
    2. Extracts dictionary hints for AI context
    3. Calls Ollama LLM for accurate translation
    4. Caches result for future requests
    
    Used by DE/EN toggle buttons throughout the UI.
    """
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response
    
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "").strip()
    is_title = data.get("is_title", False)
    
    ai_logger.info(f"TRANSLATE REQUEST: text='{text[:50]}...' is_title={is_title}")
    
    if not text:
        return jsonify({"translation": "", "from_cache": False})
    
    # Use unified translator
    if unified_translator:
        try:
            translation, from_cache = unified_translator.translate(text, is_title)
            ai_logger.info(f"TRANSLATION {'(cache)' if from_cache else '(AI)'}: '{text[:30]}' -> '{translation[:50] if translation else 'N/A'}...'")
            return jsonify({
                "translation": translation,
                "from_cache": from_cache,
            })
        except Exception as e:
            ai_logger.error(f"UNIFIED TRANSLATE ERROR: {e}", exc_info=True)
            return jsonify({"translation": text, "error": str(e)}), 500
    else:
        # Fallback: return original text
        ai_logger.warning("Unified translator not available, returning original text")
        return jsonify({"translation": text, "error": "Translator unavailable"})

@app.route("/api/translate/batch", methods=["POST", "OPTIONS"])
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_TRANSLATE_BATCH", "10")),
    per_seconds=int(os.environ.get("RATE_PERIOD_TRANSLATE_BATCH", "60")),
)
def api_translate_batch():
    """
    Batch translation endpoint for multiple texts.
    
    Efficient for translating multiple law titles/paragraphs at once.
    """
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response
    
    data = request.get_json(force=True, silent=True) or {}
    texts = data.get("texts", [])
    is_title = data.get("is_title", False)
    
    if not texts or not isinstance(texts, list):
        return jsonify({"error": "Invalid input: expected 'texts' array"}), 400
    
    results = []
    for text in texts[:50]:  # Limit batch size
        if unified_translator:
            translation, from_cache = unified_translator.translate(str(text), is_title)
            results.append({
                "original": text,
                "translation": translation,
                "from_cache": from_cache,
            })
        else:
            results.append({
                "original": text,
                "translation": text,
                "error": "Translator unavailable",
            })
    
    return jsonify({"translations": results})

@app.route("/api/translate/cache/stats", methods=["GET"])
def api_translate_cache_stats():
    """Get translation cache statistics."""
    if unified_translator:
        stats = unified_translator.get_cache_stats()
        return jsonify(stats)
    return jsonify({"error": "Translator unavailable"}), 500

@app.route("/api/translate/cache/clear", methods=["POST"])
def api_translate_cache_clear():
    """Clear the translation cache (admin only)."""
    if not _is_admin(request):
        return jsonify({"error": "unauthorized"}), 403
    
    if unified_translator:
        unified_translator.clear_cache()
        return jsonify({"status": "ok", "message": "Translation cache cleared"})
    return jsonify({"error": "Translator unavailable"}), 500

# ---------------------------------------------------------------------------
# AI Chat Endpoint
# ---------------------------------------------------------------------------

@app.route("/api/ai_chat", methods=["POST"])
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_AI_CHAT", "5")),
    per_seconds=int(os.environ.get("RATE_PERIOD_AI_CHAT", "60")),
)
def api_ai_chat():
    """Streams a response from local Ollama instance utilizing the provided German law context."""
    data = request.get_json(force=True, silent=True) or {}
    query = data.get("query", "").strip()
    context = data.get("context", "").strip()

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
        if unified_translator:
            for chunk in unified_translator.stream_ollama(prompt):
                yield chunk
        else:
            yield "[AI chat unavailable - translator not initialized]"

    return Response(generate_stream(), mimetype="text/plain")

# ---------------------------------------------------------------------------
# AI Law Explanation Endpoint (with guardrails)
# ---------------------------------------------------------------------------

@app.route("/api/ai/explain", methods=["POST"])
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_AI_EXPLAIN", "10")),
    per_seconds=int(os.environ.get("RATE_PERIOD_AI_EXPLAIN", "60")),
)
def api_ai_explain():
    """
    Explain a law paragraph with AI and full guardrail enforcement.
    
    Expects JSON body:
    {
        "law_id": "bgb",
        "paragraph": "§548",
        "query": "What does this mean?"
    }
    
    Returns:
    {
        "explanation": "...",
        "warnings": [...],
        "version_info": {...}
    }
    """
    if not _is_admin(request):
        return jsonify({"error": "unauthorized"}), 403
    
    data = request.get_json(force=True, silent=True) or {}
    law_id = data.get("law_id", "")
    paragraph = data.get("paragraph", "")
    user_query = data.get("query", "")
    
    if not law_id or not paragraph:
        return jsonify({"error": "law_id and paragraph required"}), 400
    
    # Find the law in search index
    law_result = _find_law_by_id(law_id, paragraph)
    if not law_result:
        return jsonify({"error": "law_not_found", "law_id": law_id, "paragraph": paragraph}), 404
    
    # Get AI explanation with guardrails
    try:
        if unified_translator and hasattr(unified_translator, 'explain_law_with_context'):
            explanation = unified_translator.explain_law_with_context(
                law_result=law_result,
                user_query=user_query,
                language="en"  # Could be made configurable
            )
            
            # Get version info
            version_info = {}
            if VERSION_TRACKING_AVAILABLE:
                try:
                    tracker = get_version_tracker()
                    metadata = tracker.get_metadata(law_result)
                    version_info = {
                        "last_changed": metadata.last_changed,
                        "status": metadata.status,
                        "age_years": metadata.get_age_years(),
                        "warning": metadata.get_staleness_warning()
                    }
                except Exception as e:
                    ai_logger.debug(f"Could not get version info: {e}")
            
            return jsonify({
                "explanation": explanation,
                "law_id": law_id,
                "paragraph": paragraph,
                "version_info": version_info
            })
        else:
            return jsonify({
                "error": "ai_unavailable",
                "message": "AI explanation with guardrails is not available"
            }), 503
    
    except Exception as e:
        ai_logger.error(f"AI explanation failed: {e}", exc_info=True)
        return jsonify({
            "error": "ai_unavailable",
            "message": "AI explanation is currently unavailable"
        }), 503


def _find_law_by_id(law_id: str, paragraph: str) -> Optional[Dict]:
    """
    Find a law in the search index by ID and paragraph.
    
    Args:
        law_id: Law identifier (e.g., 'bgb')
        paragraph: Paragraph number (e.g., '§548')
    
    Returns:
        Law result dictionary or None
    """
    # Search in the index
    with _index_lock:
        if _search_index is None:
            return None
        
        # Look for exact match in laws
        laws = _search_index.get("laws", [])
        for result in laws:
            if (result.get("law_id", "").lower() == law_id.lower() and 
                result.get("paragraph", "") == paragraph):
                return result
        
        # Try partial match
        for result in laws:
            if (law_id.lower() in result.get("law_id", "").lower() and 
                paragraph in result.get("paragraph", "")):
                return result
        
        # Try searching in law_summaries
        for law in _law_summaries:
            if law.get("key", "").lower() == law_id.lower():
                # Found the law, now find the paragraph
                for norm in law.get("norms", []):
                    if str(norm.get("norm_id", "")) == paragraph.replace("§", "").strip():
                        return {
                            "law_id": law_id,
                            "paragraph": paragraph,
                            "content": norm.get("content", ""),
                            "meta": {
                                "last_changed": law.get("last_changed"),
                                "status": "in_force"
                            }
                        }
    
    return None


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
            logging.warning(
                "Could not remove cached index file %s: %s", SEARCH_INDEX_FILE, e
            )

    # Start rebuild in background, forcing a scan from source
    # Guard against multiple concurrent rebuilds
    if _rebuild_in_progress.locked():
        return jsonify({"error": "rebuild_already_in_progress"}), 409

    def _guarded_rebuild():
        with _rebuild_in_progress:
            build_index(force=True)

    threading.Thread(target=_guarded_rebuild, daemon=True).start()
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
    logger.info("=" * 60)
    logger.info("German Law Search Dashboard - Server Starting")
    logger.info("=" * 60)
    logger.info(f"Server will be available at: http://{HOST}:{PORT}")
    logger.info("Waiting for incoming connections...")
    
    # Log AI health status at startup
    ai_logger.info("AI subsystem initializing...")
    try:
        url = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/tags")
        req = urllib.request.Request(url)
        urllib.request.urlopen(req, timeout=3)
        ai_logger.info("AI health check: Ollama is running")
    except Exception as e:
        ai_logger.warning(f"AI health check: Ollama unavailable at startup - {e}")
    
    # Start index build
    indexing_logger.info("Starting index build in background...")
    threading.Thread(target=build_index, daemon=True).start()
    
    print("  ---  German Law Search Dashboard")
    print(f"  ->   http://{HOST}:{PORT}\n")

    @app.before_request
    def log_connection():
        """Log incoming connections for visibility."""
        logger.info(f"Connection from {request.remote_addr} - {request.method} {request.path}")

    logger.info("Flask app starting...")
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False, threaded=True)
