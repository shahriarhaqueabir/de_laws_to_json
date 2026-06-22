import os
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

JSON_DIR = "./de_federal_json"


def dedupe_laws():
    if not os.path.isdir(JSON_DIR):
        logging.info(f"Directory {JSON_DIR} not found. Skipping deduplication.")
        return

    files = [f for f in os.listdir(JSON_DIR) if f.endswith(".json")]
    seen_titles = set()
    duplicates = 0

    for filename in sorted(
        files, key=lambda x: len(x)
    ):  # keep shortest filename (safest)
        filepath = os.path.join(JSON_DIR, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)

            title = data.get("meta", {}).get("title", filename)

            if title in seen_titles:
                logging.info(f"Removing duplicate law: {filename} ({title})")
                os.remove(filepath)
                duplicates += 1
            else:
                seen_titles.add(title)

        except Exception as e:
            logging.error(f"Error reading {filename}: {e}")

    logging.info(f"Deduplication complete. Removed {duplicates} duplicate laws.")


if __name__ == "__main__":
    dedupe_laws()
