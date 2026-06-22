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
import sqlite3
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

# Database layer
from database.db import get_db, db_is_ready, init_db, DB_PATH

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

# Security
ADMIN_API_KEY = secrets.token_hex(16)

# DB-level counters (populated once at startup)
_db_law_count: int = 0
_db_norm_count: int = 0


def is_first_run() -> bool:
    """Return True if the database does not exist or contains no laws."""
    ready, count = db_is_ready()
    return not ready


def _init_db_state() -> None:
    """Called once at startup to verify the DB and cache row counts."""
    global _db_law_count, _db_norm_count
    ready, count = db_is_ready()
    if ready:
        with get_db() as conn:
            _db_law_count  = conn.execute("SELECT COUNT(*) FROM laws").fetchone()[0]
            _db_norm_count = conn.execute("SELECT COUNT(*) FROM norms").fetchone()[0]
        indexing_logger.info(
            "Database ready: %d laws, %d norms.", _db_law_count, _db_norm_count
        )
        _indexing_done.set()
    else:
        indexing_logger.warning(
            "Database not ready — run process_de_laws.py or use the Setup Wizard."
        )

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
# Search (SQLite FTS5 + BM25-compatible scoring)
# ---------------------------------------------------------------------------

def _dummy_extract_summary(fpath: str) -> Optional[Dict]:
    """Placeholder — no longer used; data comes from SQLite."""
    return None

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
    """
    Search for laws matching the query using a Hybrid Search pipeline:
    1. Query expansion via legal dictionary & synonyms.
    2. SQLite FTS5 search to fetch top 100 candidate paragraphs (norms).
    3. nomic-embed-text vector embedding re-ranking of the candidate paragraphs.
    4. Aggregation of paragraph scores to the law level.
    5. Exact key & citation boosts applied to the aggregated scores.
    6. Normalization of scores to a percentage scale (0-100%).
    """
    if not query.strip() and not category:
        return {"results": [], "keywords": [], "german_terms": []}

    cited_law, cited_sec = _detect_citation(query)
    original_tokens, german_terms = expand_query(query)
    q_lower = query.lower().strip()

    # Build FTS5 query terms (OR logic)
    fts_terms = [t.replace('"', '') for t in german_terms if t.strip()]
    if not fts_terms:
        fts_terms = [t.replace('"', '') for t in original_tokens if t.strip()]

    results_map: Dict[str, Dict] = {}   # key -> result dict
    matched_terms_map: Dict[str, List[str]] = defaultdict(list)
    law_results: Dict[str, Dict] = {}

    try:
        with get_db() as conn:
            fts_rows = []
            # ── 1. FTS5 full-text search over norms (top 100 candidates) ──
            if fts_terms:
                fts_query = " OR ".join(f'"{t}"' for t in fts_terms)
                fts_rows = conn.execute(
                    """
                    SELECT n.id AS norm_id, n.law_id, l.key, l.title, l.alt_title, l.last_changed,
                           l.category, l.authority, l.status, l.jurisdiction,
                           (SELECT COUNT(*) FROM norms n2 WHERE n2.law_id = l.id) AS total_norms,
                           n.norm_id AS norm_num, n.title AS norm_title,
                           snippet(fts_norms, 2, '[', ']', '...', 20) AS snippet,
                           rank AS fts_rank
                    FROM fts_norms fts
                    JOIN norms n ON n.id = fts.rowid
                    JOIN laws  l ON n.law_id = l.id
                    WHERE fts_norms MATCH ?
                    AND (? = '' OR l.category = ?)
                    ORDER BY rank ASC
                    LIMIT 100
                    """,
                    (fts_query, category, category),
                ).fetchall()

            # ── 2. Vector re-ranking of the FTS5 candidate norms ──────────
            vector_scores: Dict[int, float] = {}
            if fts_rows:
                candidate_norm_ids = [row["norm_id"] for row in fts_rows]
                try:
                    from vector_search import vector_rerank
                    # Re-rank candidate paragraph IDs using the query embedding
                    reranked = vector_rerank(query, candidate_norm_ids, top_k=100)
                    vector_scores = {norm_id: score for norm_id, score in reranked}
                except Exception as e:
                    ai_logger.warning("Vector re-ranking skipped: %s", e)

            # ── 3. Aggregate paragraph scores back to law-level scores ───
            for i, row in enumerate(fts_rows):
                k = row["key"]
                norm_id = row["norm_id"]
                
                # Reciprocal rank score for FTS5 (ranges from 0.01 to 1.0)
                norm_fts_score = 1.0 / (i + 1.0)
                
                # Retrieve vector embedding score (cosine similarity, usually 0.3 to 0.8)
                v_score = vector_scores.get(norm_id, 0.0) if vector_scores else 0.0
                
                # Hybrid merge: 60% Vector, 40% FTS5 (if vector embeddings exist)
                if vector_scores and norm_id in vector_scores:
                    norm_score = 0.4 * norm_fts_score + 0.6 * v_score
                else:
                    # Fallback to pure FTS5 score
                    norm_score = norm_fts_score
                
                if k not in law_results:
                    law_results[k] = {
                        "key":           row["key"],
                        "title":         row["title"],
                        "alt_title":     row["alt_title"],
                        "last_changed":  row["last_changed"],
                        "category":      row["category"],
                        "authority":     row["authority"],
                        "status":        row["status"],
                        "jurisdiction":  row["jurisdiction"],
                        "total_norms":   row["total_norms"],
                        "norm_hits":     1,
                        "max_norm_score": norm_score,
                        "relevant_norms": [{
                            "norm_id": row["norm_num"],
                            "title":   row["norm_title"],
                            "snippet": row["snippet"]
                        }]
                    }
                else:
                    res = law_results[k]
                    res["norm_hits"] += 1
                    if norm_score > res["max_norm_score"]:
                        res["max_norm_score"] = norm_score
                    # Keep up to 3 highly-relevant norms per law for UI context
                    if len(res["relevant_norms"]) < 3:
                        res["relevant_norms"].append({
                            "norm_id": row["norm_num"],
                            "title":   row["norm_title"],
                            "snippet": row["snippet"]
                        })

            # Calculate base law-level score from norm aggregates
            for k, res in law_results.items():
                # Base is the best paragraph's score
                base = res["max_norm_score"]
                # Give a tiny boost for laws with multiple relevant matches
                hits_bonus = min(0.1, (res["norm_hits"] - 1) * 0.02)
                results_map[k] = res | {"score": base + hits_bonus}
                matched_terms_map[k].extend(fts_terms)

            # ── 4. Exact key boost (keeps the existing fast-path boosts) ──
            if q_lower:
                exact_rows = conn.execute(
                    """
                    SELECT l.key, l.title, l.alt_title, l.last_changed,
                           l.category, l.authority, l.status, l.jurisdiction,
                           (SELECT COUNT(*) FROM norms n WHERE n.law_id = l.id) AS total_norms
                     FROM laws l
                    WHERE LOWER(l.key) = ? OR LOWER(l.key) LIKE ?
                    LIMIT 5
                    """,
                    (q_lower, f"%{q_lower}%"),
                ).fetchall()
                for row in exact_rows:
                    k = row["key"]
                    boost = 1000.0 if row["key"].lower() == q_lower else 200.0
                    if k in results_map:
                        results_map[k]["score"] += boost
                    else:
                        results_map[k] = dict(row) | {
                            "score": boost,
                            "relevant_norms": []
                        }
                    matched_terms_map[k].append(f"Key match: {k}")

            # ── 5. Citation boost (boost specific targeted paragraph) ─────
            if cited_law and cited_sec:
                cite_rows = conn.execute(
                    """
                    SELECT l.key FROM laws l
                    JOIN norms n ON n.law_id = l.id
                    WHERE LOWER(l.key) LIKE ? AND n.norm_id = ?
                    LIMIT 3
                    """,
                    (f"%{cited_law}%", cited_sec),
                ).fetchall()
                for row in cite_rows:
                    k = row["key"]
                    if k in results_map:
                        results_map[k]["score"] += 400.0
                    else:
                        # Fetch complete record
                        l_row = conn.execute(
                            "SELECT * FROM laws WHERE key = ?", (k,)
                        ).fetchone()
                        if l_row:
                            results_map[k] = dict(l_row) | {
                                "score": 400.0,
                                "relevant_norms": []
                            }
                    matched_terms_map[k].append(f"Citation: {cited_law} §{cited_sec}")

            # ── 6. Category-only fallback (no query text) ─────────────────
            if not q_lower and category and not results_map:
                cat_rows = conn.execute(
                    """
                    SELECT l.key, l.title, l.alt_title, l.last_changed,
                           l.category, l.authority, l.status, l.jurisdiction,
                           (SELECT COUNT(*) FROM norms n WHERE n.law_id = l.id) AS total_norms
                    FROM laws l WHERE l.category = ?
                    ORDER BY l.key LIMIT ?
                    """,
                    (category, top_k),
                ).fetchall()
                for row in cat_rows:
                    results_map[row["key"]] = dict(row) | {
                        "score": 1.0,
                        "relevant_norms": []
                    }

    except Exception as exc:
        logging.error("search_laws hybrid search error: %s", exc, exc_info=True)
        return {"results": [], "keywords": original_tokens, "german_terms": german_terms}

    if not results_map:
        return {"results": [], "keywords": original_tokens, "german_terms": german_terms}

    # Sort results by hybrid score descending
    sorted_items = sorted(results_map.items(), key=lambda x: x[1].get("score", 0), reverse=True)[:top_k]
    max_score = max(v.get("score", 0) for _, v in sorted_items) or 1.0

    results = []
    for key, data in sorted_items:
        relevance = min(100, round(data.get("score", 0) / max_score * 100))
        results.append({
            "key":           data.get("key", key),
            "title":         data.get("title", ""),
            "alt_title":     data.get("alt_title", ""),
            "last_changed":  data.get("last_changed", ""),
            "relevance":     relevance,
            "total_norms":   data.get("total_norms", 0),
            "category":      data.get("category", "other"),
            "relevant_norms": data.get("relevant_norms", []),
            "matched_terms": list(dict.fromkeys(matched_terms_map.get(key, []))),
            "authority":     data.get("authority", ""),
            "status":        data.get("status", "Active"),
            "jurisdiction":  data.get("jurisdiction", ""),
        })

    return {"results": results, "keywords": original_tokens, "german_terms": german_terms}


# BM25 helpers kept as no-ops for backward compat with any external callers
def _get_matching_docs(inverted, sorted_terms, term):
    return []

def _calculate_term_idf(matching_docs, num_docs):
    return 0.0

def _apply_bm25_scoring(*args, **kwargs):
    pass

def _format_search_results(scores, summaries, top_k, keywords, german_terms, matched_map=None):
    return {"results": [], "keywords": keywords, "german_terms": german_terms}

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
        indexed_laws = _db_law_count

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
    try:
        ready = _indexing_done.is_set()
        if ready:
            with get_db() as conn:
                law_count  = conn.execute("SELECT COUNT(*) FROM laws").fetchone()[0]
                norm_count = conn.execute("SELECT COUNT(*) FROM norms").fetchone()[0]
                cat_rows   = conn.execute(
                    "SELECT category, COUNT(*) AS cnt FROM laws GROUP BY category"
                ).fetchall()
                cat_counts = {r["category"]: r["cnt"] for r in cat_rows}
                largest = conn.execute(
                    """
                    SELECT l.key, l.title, COUNT(n.id) AS norm_count
                    FROM laws l LEFT JOIN norms n ON n.law_id = l.id
                    GROUP BY l.id ORDER BY norm_count DESC LIMIT 1
                    """
                ).fetchone()
        else:
            law_count = norm_count = 0
            cat_counts = {}
            largest = None

        return jsonify({
            "ready":       ready,
            "total":       law_count,
            "indexed":     law_count,
            "laws":        law_count,
            "total_norms": norm_count,
            "categories":  cat_counts,
            "largest_law": {
                "key":   largest["key"],
                "title": largest["title"],
                "norms": largest["norm_count"],
            } if largest else None,
        })
    except Exception as e:
        logging.error("API STATUS ERROR: %s", e, exc_info=True)
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
    """Returns a paginated, filterable list of all laws (without norm content)."""
    if not _indexing_done.is_set():
        return jsonify({"ready": False}), 503

    page     = max(1, int(request.args.get("page", 1)))
    per_page = max(1, min(200, int(request.args.get("per_page", 48))))
    category = request.args.get("category", "")
    q        = request.args.get("q", "").strip().lower()

    try:
        with get_db() as conn:
            # Build WHERE clause dynamically
            where_parts  = []
            params: list = []

            if category:
                where_parts.append("l.category = ?")
                params.append(category)

            if q:
                parts = [p.strip() for p in re.split(r"[\s§]+", q) if p.strip()]
                if parts:
                    law_prefix  = parts[0]
                    section_num = parts[1] if len(parts) >= 2 else ""
                    if section_num:
                        # "BGB 303" → law key contains prefix AND norm exists
                        where_parts.append(
                            "(LOWER(l.key) LIKE ? AND EXISTS "
                            "(SELECT 1 FROM norms n WHERE n.law_id = l.id AND n.norm_id = ?))"
                        )
                        params += [f"%{law_prefix}%", section_num]
                    else:
                        where_parts.append("(LOWER(l.key) LIKE ? OR LOWER(l.title) LIKE ?)")
                        params += [f"%{law_prefix}%", f"%{law_prefix}%"]

            where_sql = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

            # Total count
            total = conn.execute(
                f"SELECT COUNT(*) FROM laws l {where_sql}", params
            ).fetchone()[0]

            # Paged results
            offset = (page - 1) * per_page
            rows = conn.execute(
                f"""
                SELECT l.key, l.title, l.alt_title, l.last_changed, l.category,
                       (SELECT COUNT(*) FROM norms n WHERE n.law_id = l.id) AS total_norms
                FROM laws l
                {where_sql}
                ORDER BY l.key
                LIMIT ? OFFSET ?
                """,
                params + [per_page, offset],
            ).fetchall()

        return jsonify({
            "laws":     [dict(r) for r in rows],
            "total":    total,
            "page":     page,
            "per_page": per_page,
            "has_more": (offset + per_page) < total,
        })
    except Exception as exc:
        logging.error("API LAWS ERROR: %s", exc, exc_info=True)
        return jsonify({"error": str(exc)}), 500

@app.route("/api/law/<path:key>")
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_GENERIC", "60")),
    per_seconds=int(os.environ.get("RATE_PERIOD_GENERIC", "60")),
)
def api_law(key: str):
    """Return the full content of a law by key, including all norms from SQLite."""
    try:
        with get_db() as conn:
            law_row = conn.execute(
                "SELECT * FROM laws WHERE key = ?", (key,)
            ).fetchone()
            if not law_row:
                return jsonify({"error": "Law not found"}), 404

            norm_rows = conn.execute(
                """
                SELECT norm_id, title, content
                FROM norms WHERE law_id = ?
                ORDER BY id
                """,
                (law_row["id"],),
            ).fetchall()

        law = dict(law_row)
        norms = []
        for nr in norm_rows:
            # Reconstruct paragraphs from flat content string
            paragraphs = [
                {"id": str(i + 1), "text": line.strip()}
                for i, line in enumerate(nr["content"].split("\n"))
                if line.strip()
            ]
            norms.append({
                "norm_id":   nr["norm_id"],
                "title":     nr["title"],
                "paragraphs": paragraphs,
            })

        _increment_view(key)

        return jsonify({
            "key":   law["key"],
            "meta":  {
                "title":        law["title"],
                "alt_title":    law["alt_title"],
                "last_changed": law["last_changed"],
                "source":       law["source"],
                "category":     law["category"],
                "authority":    law["authority"],
                "status":       law["status"],
                "jurisdiction": law["jurisdiction"],
            },
            "norms": norms,
        })
    except Exception as exc:
        logging.error("API LAW ERROR for %s: %s", key, exc, exc_info=True)
        return jsonify({"error": str(exc)}), 500

@app.route("/api/law/<path:key>/references")
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_GENERIC", "60")),
    per_seconds=int(os.environ.get("RATE_PERIOD_GENERIC", "60")),
)
def api_law_references(key: str):
    """
    Returns all outgoing references (laws this law references) and
    incoming references/backlinks (laws referencing this law).
    """
    try:
        with get_db() as conn:
            # 1. Outgoing references (what this law cites)
            outgoing_rows = conn.execute(
                """
                SELECT DISTINCT target_law, target_norm, COUNT(*) as mention_count
                FROM cross_references xref
                JOIN norms n ON xref.source_norm_id = n.id
                JOIN laws l ON n.law_id = l.id
                WHERE LOWER(l.key) = ?
                GROUP BY target_law, target_norm
                ORDER BY target_law, target_norm
                """,
                (key.lower(),),
            ).fetchall()

            # 2. Incoming references/backlinks (what cites this law)
            incoming_rows = conn.execute(
                """
                SELECT DISTINCT l.key AS source_law, l.title AS source_title, COUNT(*) as mention_count
                FROM cross_references xref
                JOIN norms n ON xref.source_norm_id = n.id
                JOIN laws l ON n.law_id = l.id
                WHERE LOWER(xref.target_law) = ?
                GROUP BY l.key
                ORDER BY mention_count DESC, l.key
                """,
                (key.lower(),),
            ).fetchall()

        return jsonify({
            "law": key,
            "outgoing": [dict(r) for r in outgoing_rows],
            "incoming": [dict(r) for r in incoming_rows],
        })
    except Exception as exc:
        logging.error("API LAW REFERENCES ERROR for %s: %s", key, exc, exc_info=True)
        return jsonify({"error": str(exc)}), 500

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

    try:
        with get_db() as conn:
            law_row = conn.execute(
                "SELECT * FROM laws WHERE key = ?", (key,)
            ).fetchone()
        if not law_row:
            return jsonify({"error": "Law not found"}), 404
        match = dict(law_row)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    try:
        # Load first few norms to provide context
        with get_db() as conn:
            norm_rows = conn.execute(
                "SELECT title, content FROM norms WHERE law_id = ? ORDER BY id LIMIT 3",
                (match["id"],),
            ).fetchall()

        norms_context = ""
        for nr in norm_rows:
            n_title = nr["title"]
            n_text  = (nr["content"] or "")[:300]
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
        with get_db() as conn:
            row = conn.execute("SELECT title FROM laws WHERE key = ?", (key,)).fetchone()
        if not row:
            continue

        title = (row["title"] or "").strip()
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
    if unified_translator:
        try:
            # Call parallel ThreadPoolExecutor translation helper
            batch_results = unified_translator.translate_batch_parallel(texts[:50], is_title)
            for text in texts[:50]:
                text_str = str(text)
                trans = batch_results.get(text_str, text_str)
                results.append({
                    "original": text_str,
                    "translation": trans,
                    "from_cache": True,
                })
        except Exception as e:
            ai_logger.error("Batch translation failed: %s", e)
            for text in texts[:50]:
                results.append({
                    "original": text,
                    "translation": text,
                    "error": str(e)
                })
    else:
        for text in texts[:50]:
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

    model = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")

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
        
        # Fallback: search directly in the DB
        with get_db() as conn:
            law_row = conn.execute("SELECT id, title, last_changed FROM laws WHERE key = ?", (law_id.lower(),)).fetchone()
        if law_row:
            norm_num = paragraph.replace("§", "").strip()
            with get_db() as conn:
                norm_row = conn.execute(
                    "SELECT norm_id, content FROM norms WHERE law_id = ? AND norm_id = ?",
                    (law_row["id"], norm_num),
                ).fetchone()
            if norm_row:
                return {
                    "law_id": law_id,
                    "paragraph": paragraph,
                    "content": norm_row["content"],
                    "meta": {
                        "last_changed": law_row["last_changed"],
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
            "total_files": _db_law_count,
            "indexed_files": _db_norm_count,
            "laws": _db_law_count,
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
    logger.info("Server will be available at: http://%s:%s", HOST, PORT)

    # AI health check
    ai_logger.info("AI subsystem initializing...")
    try:
        url = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/tags")
        req = urllib.request.Request(url)
        urllib.request.urlopen(req, timeout=3)
        ai_logger.info("Ollama is running")
    except Exception as e:
        ai_logger.warning("Ollama unavailable at startup: %s", e)

    # Verify database (replaces build_index thread)
    _init_db_state()

    print("  ---  German Law Search Dashboard")
    print(f"  ->   http://{HOST}:{PORT}\n")
    if is_first_run():
        print("  [!]  Database not found — open the app and use the Setup Wizard.")

    @app.before_request
    def log_connection():
        """Log incoming connections for visibility."""
        logger.debug("Connection from %s - %s %s", request.remote_addr, request.method, request.path)

    logger.info("Flask app starting...")
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False, threaded=True)
