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

# Legal Dictionary integration
try:
    from dictionary.legal_dict import get_legal_dictionary

    legal_dict = get_legal_dictionary()
except ImportError:
    logging.warning("dictionary.legal_dict not found. Hybrid features will be limited.")
    legal_dict = None


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

# Force logging to console even when running in background
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@app.after_request
def _log_response(response):
    """Log every HTTP request with status and brief reason for easy debugging."""
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
        new_inverted, new_doc_lengths, new_avgdl = _populate_inverted_pure(summaries)
        new_sorted_terms = sorted(new_inverted.keys())

        # Persist to disk before swapping global references
        persisted = _persist_index(summaries, new_inverted, new_doc_lengths, new_avgdl)
        if not persisted:
            logging.warning("Index persistence failed; using in-memory only.")

        # Swapping global references
        with _index_lock:
            _law_summaries = summaries
            _inverted = new_inverted
            _sorted_terms = new_sorted_terms
            _doc_lengths = new_doc_lengths
            _avgdl = new_avgdl

        logging.info("Indexing complete: %d laws ready.", len(summaries))
    except Exception as e:
        logging.error(f"FATAL: Index build failed: {e}")
    finally:
        _indexing_done.set()


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

        payload = {
            "model": os.environ.get("OLLAMA_MODEL", "llama3"),
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }

        resp = _ollama_request(payload)
        ai_raw = json.loads(resp.read().decode("utf-8"))
        insights = json.loads(ai_raw.get("response", "{}"))

        return jsonify(insights)
    except Exception as e:
        logging.error(f"Law evaluation failed for {key}: {e}")
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
    logging.info("PREWARM: Starting translation pre-warming for popular laws.")

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

        # Build and send the Ollama request
        try:
            hint_str = _extract_translation_hints(title, is_title=True)
            if hint_str.startswith("MATCH:"):
                translation = hint_str.split(":", 1)[1].strip()
            else:
                prompt = _build_translation_prompt(
                    title, is_title=True, hint_str=hint_str
                )
                model = os.environ.get("OLLAMA_MODEL", "llama3.2")
                payload = {"model": model, "prompt": prompt, "stream": False}
                resp = _ollama_request(payload)
                res_data = json.loads(resp.read().decode("utf-8"))
                translation = res_data.get("response", "").strip()
                if translation.startswith('"') and translation.endswith('"'):
                    translation = translation[1:-1]

            if translation:
                with _translation_lock:
                    _translation_cache[title] = translation
                    global _translation_dirty
                    _translation_dirty = True
                warmed += 1
                logging.info(
                    "PREWARM [%d]: '%s' → '%s'", warmed, title[:40], translation[:40]
                )

        except Exception as e:
            logging.debug("PREWARM skip '%s': %s", title[:30], e)

        time.sleep(2)  # low priority — don't flood Ollama

    save_ai_translations()
    logging.info("PREWARM: Done. %d law titles pre-translated.", warmed)


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


def _match_case(original: str, replacement: str) -> str:
    """Mirror the capitalisation of 'original' onto 'replacement'."""
    if original.isupper():
        return replacement.upper()
    if original.istitle() or (original and original[0].isupper()):
        return replacement.capitalize()
    return replacement.lower()


@app.route("/api/fast_translate", methods=["POST"])
def api_fast_translate():
    """Instant dictionary-only translation. No AI involved. Used by DE/EN toggles."""
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "").strip()
    is_title = data.get("is_title", False)

    if not text:
        return jsonify({"translation": ""})

    # 1. Check AI cache (built up from chatbox interactions)
    with _translation_lock:
        if text in _translation_cache:
            return jsonify({"translation": _translation_cache[text], "is_final": True})

    # 2. FRAGMENT_MAP — abbreviations and legal shorthand (e.g. "BGB", "Abs. 1")
    text_lower = text.lower().strip()
    fragment_pattern = re.match(r"^([A-Za-z\.]+)\s*(\d*[a-z]?)$", text_lower)

    matched = None
    if text_lower in FRAGMENT_MAP:
        matched = FRAGMENT_MAP[text_lower]
    elif fragment_pattern:
        base = fragment_pattern.group(1).rstrip(".")
        num = fragment_pattern.group(2)
        key = base + "." if not base.endswith(".") else base
        if key in FRAGMENT_MAP:
            matched = f"{FRAGMENT_MAP[key]} {num}".strip()
        elif base in FRAGMENT_MAP:
            matched = f"{FRAGMENT_MAP[base]} {num}".strip()

    if matched:
        return jsonify({"translation": matched, "is_final": True})

    # 3. Full-phrase dictionary lookup (best for titles and short clauses)
    if legal_dict:
        results = legal_dict.get_translations(text, limit=1)
        if results and (results[0]["source"] == "legal_priority" or is_title):
            return jsonify({"translation": results[0]["english"], "is_final": True})

    # 4. Word-by-word substitution — covers full paragraphs of any length
    # Splits on whitespace preserving separators, looks up each word in the dictionary.
    tokens = re.split(r"(\s+)", text)
    out_tokens = []
    any_hit = False

    for token in tokens:
        if re.fullmatch(r"\s+", token):
            out_tokens.append(token)
            continue

        # Separate leading/trailing punctuation from the word core
        m = re.fullmatch(r"([^\w]*)([\w\-äöüÄÖÜß]+)([^\w]*)", token, re.UNICODE)
        if not m:
            out_tokens.append(token)
            continue

        lead, core, trail = m.group(1), m.group(2), m.group(3)

        # Try FRAGMENT_MAP on the core word
        core_low = core.lower()
        if core_low in FRAGMENT_MAP:
            frag = _match_case(core, FRAGMENT_MAP[core_low])
            # Avoid double punctuation (e.g. "Para." + "." = "Para..")
            if trail and frag.endswith(trail):
                trail = ""
            out_tokens.append(lead + frag + trail)
            any_hit = True
            continue

        # Try dictionary on the core word
        if legal_dict:
            try:
                hits = legal_dict.get_translations(core, limit=1)
                if hits:
                    out_tokens.append(
                        lead + _match_case(core, hits[0]["english"]) + trail
                    )
                    any_hit = True
                    continue
            except Exception:
                pass

        out_tokens.append(token)  # keep original if no match

    if any_hit:
        return jsonify({"translation": "".join(out_tokens), "is_final": True})

    # 5. Nothing matched — signal frontend to stay on DE
    return jsonify({"translation": text, "is_final": False})


@app.route("/api/ai_translate", methods=["POST"])
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_TRANSLATE", "60")),
    per_seconds=int(os.environ.get("RATE_PERIOD_TRANSLATE", "60")),
)
def api_ai_translate():
    """Translates text using Ollama with a local cache."""
    global _translation_dirty
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "").strip()
    is_title = data.get("is_title", False)

    logging.info(f"TRANSLATION REQUEST: text='{text[:50]}...' is_title={is_title}")

    if not text:
        return jsonify({"translation": ""})

    with _translation_lock:
        if text in _translation_cache:
            logging.info("TRANSLATION CACHE HIT")
            return jsonify({"translation": _translation_cache[text]})

    t0 = time.time()
    hint_str = _extract_translation_hints(text, is_title)
    logging.info(f"TRANSLATION HINTS ({time.time() - t0:.3f}s): {hint_str}")

    if is_title and hint_str.startswith("MATCH:"):
        translation = hint_str.split(":", 1)[1]
        logging.info(f"TRANSLATION HINT MATCH: {translation}")
        with _translation_lock:
            _translation_cache[text] = translation
            _translation_dirty = True
        return jsonify({"translation": translation})

    prompt = _build_translation_prompt(text, is_title, hint_str)
    model = os.environ.get("OLLAMA_MODEL", "llama3.2")
    payload = {"model": model, "prompt": prompt, "stream": False}

    logging.info(f"OLLAMA START: model={model}")
    try:
        req_t0 = time.time()
        resp = _ollama_request(payload)
        resp_t = time.time() - req_t0

        res_data = json.loads(resp.read().decode("utf-8"))
        translation = res_data.get("response", "").strip()
        logger.info(f"OLLAMA DONE ({resp_t:.2f}s): {translation[:50]}...")

        if translation.startswith('"') and translation.endswith('"'):
            translation = translation[1:-1]

        if translation:
            with _translation_lock:
                _translation_cache[text] = translation
                _translation_dirty = True
        else:
            logger.warning(f"OLLAMA RETURNED EMPTY TRANSLATION for '{text[:20]}...'")
            translation = text  # Fail-safe: return original

        return jsonify({"translation": translation})
    except Exception as e:
        logger.error(f"AI TRANSLATE ERROR: {e}", exc_info=True)
        return jsonify({"translation": text, "error": str(e)}), 500


def _extract_translation_hints(text: str, is_title: bool) -> str:
    """Extract contextual hints from the legal dictionary."""
    hints = []
    if not legal_dict:
        return ""
    try:
        if len(text) < 150:
            dict_results = legal_dict.get_translations(text, limit=3)
            if dict_results:
                if is_title and dict_results[0]["source"] == "legal_priority":
                    return f"MATCH:{dict_results[0]['english']}"
                hints = [res["english"] for res in dict_results]

        if not hints and len(text) > 50:
            # Simple keyword extraction: find words >= 5 chars
            words = re.findall(r"\b\w{5,}\b", text, flags=re.UNICODE)
            for w in set(words[:10]):
                w_trans = legal_dict.get_translations(w, limit=1)
                if w_trans:
                    hints.append(f"'{w}' -> '{w_trans[0]['english']}'")
    except Exception as e:
        logging.debug("Dictionary hint extraction failed: %s", e)
    return f"\nHints (verified legal terms): {', '.join(hints[:5])}" if hints else ""


def _build_translation_prompt(text: str, is_title: bool, hint_str: str) -> str:
    """Construct the translation prompt for the AI."""
    if is_title:
        return (
            "Translate this German law title or abbreviation into professional English. "
            f"{hint_str}\nReturn ONLY the translation, no explanation.\n\n"
            f"German: {text}\nEnglish:"
        )
    return (
        "Translate this German legal norm/paragraph into professional, accurate English. "
        "Maintain formal legal terminology and formatting. "
        f"{hint_str}\nReturn ONLY the translated text.\n\n"
        f"German: {text}\n\nEnglish Legal Translation:"
    )


def _ollama_request(payload: dict):
    """Call the local Ollama HTTP API with retries and exponential backoff.

    Returns the urllib response object on success or raises the last exception.
    """
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
            logging.warning(
                "Ollama request failed (attempt %d/%d): %s", attempt, max_retries, e
            )
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
@rate_limit(
    max_calls=int(os.environ.get("RATE_LIMIT_AI_CHAT", "5")),
    per_seconds=int(os.environ.get("RATE_PERIOD_AI_CHAT", "60")),
)
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
                            txt = (
                                line.decode("utf-8")
                                if isinstance(line, (bytes, bytearray))
                                else str(line)
                            )
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
    threading.Thread(target=build_index, daemon=True).start()
    print("  ---  German Law Search Dashboard")
    print(f"  ->   http://{HOST}:{PORT}\n")
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False)
