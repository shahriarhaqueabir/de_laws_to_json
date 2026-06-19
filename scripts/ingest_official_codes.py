import os
import re
import httpx
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# Configuration
CONFIG = {
    "BGB": "https://www.gesetze-im-internet.de/englisch_bgb/englisch_bgb.html",
    "StGB": "https://www.gesetze-im-internet.de/englisch_stgb/englisch_stgb.html"
}

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.")
    exit(1)

def normalize_section_id(text):
    """Convert 'Section 1' -> '§ 1', 'Section 651l' -> '§ 651l'."""
    # Matches 'Section 123' or 'Section 123a'
    match = re.search(r"Section\s+(\d+[a-z]?)", text, re.IGNORECASE)
    if match:
        return f"§ {match.group(1)}"
    return text

def scrape_code(law_key, url):
    print(f"Fetching English {law_key} from {url}...")
    resp = requests.get(url)
    resp.raise_for_status()
    resp.encoding = 'utf-8'

    soup = BeautifulSoup(resp.text, 'html.parser')
    all_p = soup.find_all('p')
    print(f"Found {len(all_p)} paragraphs in {law_key}. Analyzing...")

    norms = []
    current_norm = None

    for p in all_p:
        text = p.get_text(strip=True)

        # Detect Section Header (e.g., "Section 1", "Section 651a")
        # Structure: <p>Section 1<br/>Title</p>
        if text.startswith("Section") and any(c.isdigit() for c in text[:12]):
            if current_norm:
                norms.append(current_norm)

            raw_id = text.split('\n')[0].strip()
            # If multiple sections are combined (e.g. Sections 3-6)
            if "Sections" in raw_id and "–" in raw_id or "-" in raw_id:
                 # Handle range entries if needed, but usually we map 1:1
                 pass

            norm_id = normalize_section_id(raw_id)

            # Title is often the second line or bracketed text
            lines = text.split('\n')
            title_en = lines[1].strip() if len(lines) > 1 else ""

            current_norm = {
                "norm_id": f"{law_key}-{norm_id}",
                "law_key": law_key,
                "lang": "en",
                "translation": "",
                "summary": f"Official translation of {raw_id}: {title_en}",
                "implications": f"Verified text from the German Federal Ministry of Justice ({law_key}).",
                "next_steps": "Refer to this translation for official proceedings.",
                "is_official": True
            }
            continue

        if "table of contents" in text.lower() or "Back to top" in text.lower():
            continue

        if current_norm:
            if not text or len(text) < 3: continue
            if current_norm["translation"]:
                current_norm["translation"] += "\n\n"
            current_norm["translation"] += p.get_text(separator="\n", strip=True)

    if current_norm:
        norms.append(current_norm)

    return norms

def upsert_to_supabase(data):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    url = f"{SUPABASE_URL}/rest/v1/norm_explanations"

    batch_size = 50
    for i in tqdm(range(0, len(data), batch_size)):
        batch = data[i:i+batch_size]
        try:
            r = httpx.post(url, json=batch, headers=headers)
            r.raise_for_status()
        except Exception as e:
            print(f"Batch {i} failed: {e}")

if __name__ == "__main__":
    for key, url in CONFIG.items():
        data = scrape_code(key, url)
        if data:
            print(f"Successfully parsed {len(data)} sections for {key}.")
            upsert_to_supabase(data)
        else:
            print(f"No data found for {key}.")
    print("Hybrid Ingestion for BGB and StGB Complete.")
