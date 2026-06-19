import os
import re
import httpx
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# Configuration
GG_URL = "https://www.gesetze-im-internet.de/englisch_gg/englisch_gg.html"
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.")
    exit(1)

def normalize_id(text):
    """Convert 'Article 1' -> 'Art 1' to match existing German DB schema."""
    match = re.search(r"Article\s+(\d+[a-z]?)", text, re.IGNORECASE)
    if match:
        return f"Art {match.group(1)}"
    return text

def scrape_gg():
    print(f"Fetching English Basic Law (GG) from {GG_URL}...")
    resp = requests.get(GG_URL)
    resp.raise_for_status()
    resp.encoding = 'utf-8' # Important for special chars

    soup = BeautifulSoup(resp.text, 'html.parser')

    # This page uses a flat structure of <p> tags.
    # Article headers are usually center-aligned and bold.
    all_p = soup.find_all('p')
    print(f"Found {len(all_p)} paragraphs. Analyzing structure...")

    articles = []
    current_article = None

    for p in all_p:
        text = p.get_text(strip=True)

        # Detect Article Header (e.g., "Article 1", "Article 12a")
        # Structure: <p ...>Article 1<br/>[Title]</p>
        if text.startswith("Article") and any(c.isdigit() for c in text[:15]):
            # If we had a previous article, save it
            if current_article:
                articles.append(current_article)

            # Start new article
            raw_id = text.split('\n')[0].strip() # "Article 1"
            if not raw_id: # fallback if text() joined without newline
                 raw_id = re.match(r"(Article\s+\d+[a-z]?)", text, re.I).group(1)

            norm_id = normalize_id(raw_id)

            # Title is often inside the same <p> after a break
            # or in brackets.
            title_match = re.search(r"\[(.*?)\]", text)
            title_en = title_match.group(1) if title_match else ""

            current_article = {
                "norm_id": f"GG-{norm_id}",
                "law_key": "GG",
                "lang": "en",
                "translation": "",
                "summary": f"Official translation of {raw_id}: {title_en}",
                "implications": "Verified text from the German Federal Ministry of Justice.",
                "next_steps": "Refer to this translation for official proceedings.",
                "is_official": True
            }
            continue

        # Stop collecting if we hit table of contents or other landmarks
        if "table of contents" in text.lower() or "Back to top" in text.lower():
            continue

        # Collect content if inside an article
        if current_article:
            # Skip empty paragraphs or metadata
            if not text or len(text) < 5: continue

            # Append to translation
            if current_article["translation"]:
                current_article["translation"] += "\n\n"
            current_article["translation"] += p.get_text(separator="\n", strip=True)

    # Add the last one
    if current_article:
        articles.append(current_article)

    return articles

def upsert_to_supabase(data):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    url = f"{SUPABASE_URL}/rest/v1/norm_explanations"

    print(f"Upserting {len(data)} norms to Supabase...")
    batch_size = 50
    for i in tqdm(range(0, len(data), batch_size)):
        batch = data[i:i+batch_size]
        try:
            r = httpx.post(url, json=batch, headers=headers)
            r.raise_for_status()
        except Exception as e:
            print(f"Batch {i} failed: {e}")
            if hasattr(r, 'text'): print(r.text)

if __name__ == "__main__":
    gg_data = scrape_gg()
    if gg_data:
        print(f"Successfully parsed {len(gg_data)} articles.")
        # Print a sample for verification
        sample = gg_data[2] # Art 1
        print(f"Sample - ID: {sample['norm_id']}")
        print(f"Content Start: {sample['translation'][:100]}...")

        upsert_to_supabase(gg_data)
        print("Hybrid Ingestion Complete.")
    else:
        print("No articles found. Logic needs refinement.")
