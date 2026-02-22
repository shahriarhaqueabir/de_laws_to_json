# ⚖️ German Law Search Dashboard — Quick User Guide

Welcome to the **German Law Search Dashboard**. This application provides a premium, high-speed interface for searching through the complete database of German federal laws.

## 🚀 Getting Started

1. **Launch the App**: Double-click `start_dashboard.bat` in the project folder. This will automatically set up the environment and start the local server.
2. **Access the Dashboard**: Once the terminal shows "Index Ready", open [http://localhost:5000](http://localhost:5000) in your web browser.
3. **Wait for Indexing**: On the first run, the app will index over 6,000 laws. A progress bar at the top will show you the status.

## 🔍 How to Search

* **Natural Language**: You can type your legal situation in **English** (e.g., "eviction notice rules") or **German** (e.g., "Mietkündigung Frist").
* **Keyword Translation**: The app automatically translates English keywords into German legal terminology and expands them with relevant synonyms.
* **Targeted Search**: If you know the abbreviation of a law (e.g., "BGB", "StGB"), type it directly for instant results.

## ⭐ Key Features

* **Bookmarks (Saved Laws)**: Click the ☆ star on any law result to save it to your "Saved" tab. This persists even if you close the browser.
* **Search History**: Your last 10 queries are saved below the search bar for quick re-entry.
* **Category Browser**: Not sure what to search for? Use the "Browse" tab to explore legal domains like Civil Law, Criminal Law, or Labor Law.
* **Law Reader**: Click "View Law" on any result to open the full text in a clean, distraction-free modal.

## 🛠️ Data Updates

If you need to refresh the legal database:

1. **Run `download_de_laws.py`** to fetch the latest XML files from the federal portal.
2. **Run `process_de_laws.py`** to structure the XML into the optimized JSON format used by the dashboard.

---
*Created for the German Law Search Dashboard Project.*
