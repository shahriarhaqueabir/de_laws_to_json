"""
Downloads all (>6000) federal laws from https://www.gesetze-im-internet.de/gii-toc.xml
as individual XML files into ./de_federal_raw.

Each law's XML is extracted into its own subdirectory (named after the ZIP file) to
prevent filename collisions when two different laws share the same internal filename.

Uses multiprocessing to speed up the process.
NOTE: To use this in a Jupyter notebook you likely need to remove multiprocessing.

Prerequisites:
1) Create a virtual environment:
   python -m venv ./.venv
   source ./.venv/bin/activate   (Linux/macOS)
   .venv\\Scripts\\activate       (Windows)

2) Install dependencies:
   pip install -r requirements.txt

3) Run this script:
   python download_de_laws.py
"""

import os
import zipfile
import xml.etree.ElementTree as ET
import re
import multiprocessing
import logging
from tqdm import tqdm
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- Configuration ---
RAW_DIR = "./de_federal_raw"
TOC_URL = "https://www.gesetze-im-internet.de/gii-toc.xml"
TOC_TIMEOUT = 15  # seconds for the index request
DOWNLOAD_TIMEOUT = 90  # seconds per individual law ZIP download
MAX_RETRIES = 3  # number of HTTP retries on transient errors
BACKOFF_FACTOR = 1.0  # exponential backoff multiplier for retries

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(message)s",
)


def _make_session() -> requests.Session:
    """Build a requests Session with automatic retry on transient HTTP errors."""
    session = requests.Session()
    retry_strategy = Retry(
        total=MAX_RETRIES,
        backoff_factor=BACKOFF_FACTOR,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def _safe_dir_name(url: str) -> str:
    """Derive a filesystem-safe subdirectory name from a URL."""
    return re.sub(r"[^A-Za-z0-9_-]", "_", url.rstrip("/").split("/")[-1])


def process_law(law: dict) -> tuple[bool, str]:
    """
    Download, unzip, and extract the XML for a single law.

    Returns (success: bool, message: str) so that the main process can
    collect errors without crashing the pool.

    FIX vs original:
    - Each law is extracted into its own subdirectory (de_federal_raw/<law_dir>/)
      instead of the shared root, preventing XML filename collisions when two
      different archives happen to contain a file with the same name.
    - HTTP failures and corrupt ZIPs are caught and returned rather than
      raising unhandled exceptions.
    - A per-process Session with retry logic avoids one-off connection errors.
    """
    link: str = law["link"]
    zip_name = _safe_dir_name(link) + ".zip"
    # Each law gets its own subdirectory so filenames cannot collide.
    law_dir = os.path.join(RAW_DIR, _safe_dir_name(link))
    os.makedirs(law_dir, exist_ok=True)
    zip_path = os.path.join(law_dir, zip_name)

    session = _make_session()
    try:
        response = session.get(link, stream=True, timeout=DOWNLOAD_TIMEOUT)
        response.raise_for_status()
        with open(zip_path, "wb") as fh:
            for chunk in response.iter_content(chunk_size=1024 * 64):
                fh.write(chunk)
    except requests.RequestException as exc:
        return False, f"HTTP error for {link}: {exc}"

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            xml_files = [n for n in zf.namelist() if n.endswith(".xml")]
            if not xml_files:
                return False, f"No XML found in ZIP for {link}"
            # Zip-slip guard: reject any member whose resolved path escapes law_dir.
            law_dir_real = os.path.realpath(law_dir)
            for xml_name in xml_files:
                target = os.path.realpath(os.path.join(law_dir, xml_name))
                if not target.startswith(law_dir_real + os.sep):
                    return False, f"Zip-slip attempt blocked in {link}: {xml_name}"
                zf.extract(xml_name, law_dir)
    except zipfile.BadZipFile as exc:
        return False, f"Corrupt ZIP for {link}: {exc}"
    finally:
        # Always clean up the downloaded ZIP regardless of extraction outcome.
        if os.path.exists(zip_path):
            os.remove(zip_path)

    return True, link


def main() -> None:
    os.makedirs(RAW_DIR, exist_ok=True)

    # --- Fetch and parse the master TOC ---
    print(f"Fetching law index from {TOC_URL} ...")
    session = _make_session()
    try:
        response = session.get(TOC_URL, timeout=TOC_TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise SystemExit(f"[FATAL] Could not fetch TOC: {exc}") from exc
    finally:
        session.close()

    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as exc:
        raise SystemExit(f"[FATAL] Could not parse TOC XML: {exc}") from exc
    item_array = [
        {"title": item.find("title").text, "link": item.find("link").text}
        for item in root.findall(".//item")
        if item.find("title") is not None and item.find("link") is not None
    ]
    total = len(item_array)
    print(f"Found {total} laws in the index.")

    cpu_count = multiprocessing.cpu_count()
    print(f"Using {cpu_count} parallel processes.")

    errors: list[str] = []
    pool = multiprocessing.Pool(processes=cpu_count)
    try:
        with tqdm(total=total, desc="Downloading laws", dynamic_ncols=True) as pbar:
            for success, message in pool.imap_unordered(process_law, item_array):
                pbar.update()
                if not success:
                    errors.append(message)
                    logging.warning(message)
    finally:
        pool.close()
        pool.join()

    # --- Summary ---
    succeeded = total - len(errors)
    print(f"\n✓ {succeeded}/{total} laws downloaded successfully.")
    if errors:
        error_log = os.path.join(RAW_DIR, "download_errors.txt")
        with open(error_log, "w", encoding="utf-8") as fh:
            fh.write("\n".join(errors))
        print(f"✗ {len(errors)} errors — see {error_log}")


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
