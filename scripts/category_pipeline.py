from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class CategoryPrediction:
    category: str
    confidence: float
    reasons: List[str]


_CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "housing": ["miet", "wohnung", "pacht", "eigenbedarf", "nachbar", "räumung", "kaution", "betriebskosten", "heizkosten", "modernisierung", "wohngeld", "immobilie", "grundstück", "grundbuch", "makler"],
    "labor": ["arbeit", "kündigung", "lohn", "gehalt", "tarif", "streik", "urlaub", "arbeitszeit", "überstunden", "abmahnung", "zeugnis", "betriebsrat", "elternzeit", "mutterschutz", "mindestlohn"],
    "consumer": ["kauf", "gewährleistung", "garantie", "mangel", "widerruf", "vertrag", "fernabsatz", "agb", "reklamation", "produkthaftung", "darlehen", "kredit", "inkasso", "mahnung", "verzug"],
    "traffic": ["verkehr", "stvo", "parken", "unfall", "bußgeld", "führerschein", "geschwindigkeit", "alkohol", "kfz", "versicherung", "bahn", "fahrrad", "e-scooter", "tüv", "zulassung"],
    "family": ["ehe", "kind", "scheidung", "unterhalt", "erbe", "sorgerecht", "umgang", "jugendamt", "testament", "adoption", "namensrecht", "lebenspartnerschaft", "gewaltschutz", "nachlass"],
    "criminal": ["stgb", "straf", "diebstahl", "betrug", "körperverletzung", "nötigung", "bedrohung", "beleidigung", "raub", "erpressung", "mord", "totschlag", "btmg", "brandstiftung", "hehlerei"],
    "finance": ["steuer", "finanz", "abgabe", "einkommen", "bank", "zins", "umsatzsteuer", "gewerbe", "körperschaft", "zoll", "insolvenz", "vermögen", "schenkung", "aktie", "börse", "pfändung"],
    "social": ["sgb", "rente", "kranken", "pflege", "sozial", "bürgergeld", "behinderung", "rehabilitation", "unfallversicherung", "arbeitslosengeld", "kindergeld", "elternzeit"],
    "public": ["grundgesetz", "asyl", "ausländer", "polizei", "verwaltung", "datenschutz", "dsgvo", "wahl", "parlament", "gemeinde", "einbürgerung", "visum", "aufenthalt", "meinungsfreiheit"],
    "tech": ["umwelt", "bau", "energie", "digital", "internet", "patent", "urheber", "marke", "telekommunikation", "klima", "abfall", "emission", "software", "it-sicherheit"],
    "berlin": ["bln", "berlin", "bauo", "vbln", "senat", "bezirk"],
}


_GENERIC_TERMS = {"gesetz", "recht", "verordnung", "verwaltung", "verfahren", "ordnung", "bund", "amt", "anordnung", "vorschrift"}


def _normalize(text: str) -> str:
    return re.sub(r"[^a-zäöüß]+", " ", text.lower()).strip()


def _score_text(text: str, category: str) -> tuple[int, List[str]]:
    normalized = _normalize(text)
    hits = []
    score = 0
    for keyword in _CATEGORY_KEYWORDS.get(category, []):
        if keyword in normalized:
            score += 2
            hits.append(keyword)
    for term in _GENERIC_TERMS:
        if term in normalized:
            score -= 1
    return score, hits


def classify_category(title: str, key: str, text: Optional[str] = None) -> CategoryPrediction:
    combined = " ".join(filter(None, [title, key, text or ""]))
    normalized = _normalize(combined)

    scores: Dict[str, int] = {}
    reasons: Dict[str, List[str]] = {}
    for category in _CATEGORY_KEYWORDS:
        score, hits = _score_text(combined, category)
        if score > 0:
            scores[category] = score
            reasons[category] = hits

    if not scores:
        return CategoryPrediction(category="other", confidence=0.0, reasons=[])

    best_category, best_score = max(scores.items(), key=lambda item: item[1])
    second_score = 0
    if len(scores) > 1:
        second_score = sorted(scores.values(), reverse=True)[1] if len(scores) > 1 else 0

    margin = best_score - second_score
    if best_score < 2 or margin < 1:
        return CategoryPrediction(category="other", confidence=min(0.49, max(0.1, best_score / 10.0)), reasons=reasons.get(best_category, []))

    confidence = min(0.98, 0.55 + (best_score / 12.0) + (margin / 10.0))
    return CategoryPrediction(category=best_category, confidence=confidence, reasons=reasons.get(best_category, []))


def select_review_candidates(items: List[Dict], limit: int = 50) -> List[Dict]:
    scored = []
    for item in items:
        prediction = classify_category(item.get("title", ""), item.get("key", ""), item.get("text", ""))
        scored.append({
            "title": item.get("title", ""),
            "key": item.get("key", ""),
            "confidence": prediction.confidence,
            "category": prediction.category,
            "reasons": prediction.reasons,
        })

    scored.sort(key=lambda x: (x["confidence"], x["title"]))
    return scored[:limit]
