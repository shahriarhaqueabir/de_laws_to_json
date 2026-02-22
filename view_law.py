"""
Interactive viewer for de_federal.json.

Usage:
    python view_law.py                  # interactive mode — prompts for search
    python view_law.py BGB              # look up a law by its abbreviation
    python view_law.py BGB --norm "§ 7" # look up a specific norm/paragraph
    python view_law.py --list           # list all available law keys
    python view_law.py --search word    # full-text search across all laws

Prerequisites:
    The pipeline must have been run first (run.bat or see README).
    No extra dependencies — uses only the Python standard library.
"""

import argparse
import json
import os
import sys
import textwrap
from typing import Dict, Optional

DATA_FILE = os.path.join(os.path.dirname(__file__), "de_federal.json")
LINE_WIDTH = 80


# ---------------------------------------------------------------------------
# ANSI colours (no-op on non-TTY / Windows without ANSI support)
# ---------------------------------------------------------------------------


def _ansi(code: str) -> str:
    return f"\033[{code}m" if sys.stdout.isatty() else ""


BOLD = _ansi("1")
DIM = _ansi("2")
CYAN = _ansi("96")
GREEN = _ansi("92")
YELLOW = _ansi("93")
RED = _ansi("91")
RESET = _ansi("0")


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_data() -> Dict:
    if not os.path.exists(DATA_FILE):
        print(f"{RED}[ERROR] '{DATA_FILE}' not found.{RESET}")
        print("  Run the pipeline first:  run.bat  (or see README)")
        sys.exit(1)

    size_mb = os.path.getsize(DATA_FILE) / 1_048_576
    print(f"{DIM}Loading {DATA_FILE} ({size_mb:.0f} MB) ...{RESET}", end="\r")
    with open(DATA_FILE, encoding="utf-8") as fh:
        data = json.load(fh)
    print(f"{GREEN}✓ Loaded {len(data):,} laws.{RESET}          ")
    return data


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------


def _hr(char: str = "─", width: int = LINE_WIDTH) -> None:
    print(DIM + char * width + RESET)


def _wrap(text: str, indent: int = 4) -> str:
    prefix = " " * indent
    return textwrap.fill(
        text, width=LINE_WIDTH, initial_indent=prefix, subsequent_indent=prefix
    )


def display_law(key: str, law: Dict, norm_filter: Optional[str] = None) -> None:
    meta = law.get("meta", {})
    norms = law.get("norms", [])

    _hr("═")
    title = meta.get("title") or "(no title)"
    alt = meta.get("alt_title") or ""
    print(f"{BOLD}{CYAN}  {key}{RESET}  {BOLD}{title}{RESET}", end="")
    if alt:
        print(f"  {DIM}(also: {alt}){RESET}", end="")
    print()
    print(
        f"  {DIM}Source: {meta.get('source')}  |  "
        f"In force since: {meta.get('last_changed')}  |  "
        f"Downloaded: {meta.get('download_date')}{RESET}"
    )
    _hr("═")

    # Filter to a specific norm if requested
    visible_norms = norms
    if norm_filter:
        visible_norms = [
            n for n in norms if norm_filter.lower() in n["meta"]["norm_id"].lower()
        ]
        if not visible_norms:
            print(f"{YELLOW}  No norm matching '{norm_filter}' found in {key}.{RESET}")
            return

    for norm in visible_norms:
        norm_id = norm["meta"].get("norm_id", "")
        norm_title = norm["meta"].get("title", "")
        paragraphs = norm.get("paragraphs", [])

        print()
        print(f"  {BOLD}{GREEN}{norm_id}{RESET}", end="")
        if norm_title:
            print(f"  {BOLD}{norm_title}{RESET}", end="")
        print()

        if not paragraphs:
            print(f"    {DIM}(no content){RESET}")
            continue

        for para in paragraphs:
            pid = para["meta"].get("paragraph_id", "")
            tokens = para["meta"].get("token", 0)
            content = para.get("content", "").strip()
            if not content:
                continue
            print(f"  {DIM}Abs. {pid}  [{tokens} tokens]{RESET}")
            print(_wrap(content))

    _hr()


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def cmd_list(data: Dict) -> None:
    """Print a sorted two-column table of all law keys and titles."""
    keys = sorted(data.keys())
    print(f"\n{BOLD}{'Key':<20}  Title{RESET}")
    _hr()
    for key in keys:
        title = data[key].get("meta", {}).get("title", "")
        print(f"  {CYAN}{key:<18}{RESET}  {title}")
    _hr()
    print(f"\n  {len(keys):,} laws total.\n")


def cmd_search(data: Dict, query: str) -> None:
    """Full-text search across all law titles and paragraph content."""
    q = query.lower()
    hits = []
    for key, law in data.items():
        # Search in title
        title = (law.get("meta", {}).get("title") or "").lower()
        if q in title or q in key.lower():
            hits.append((key, "title", law.get("meta", {}).get("title", "")))
            continue
        # Search in paragraph content
        for norm in law.get("norms", []):
            for para in norm.get("paragraphs", []):
                if q in para.get("content", "").lower():
                    snippet = para["content"]
                    idx = snippet.lower().find(q)
                    start = max(0, idx - 60)
                    end = min(len(snippet), idx + len(query) + 60)
                    excerpt = (
                        ("…" if start else "")
                        + snippet[start:end]
                        + ("…" if end < len(snippet) else "")
                    )
                    hits.append((key, norm["meta"]["norm_id"], excerpt))
                    break  # one hit per norm is enough

    if not hits:
        print(f"\n{YELLOW}  No results for '{query}'.{RESET}\n")
        return

    print(f"\n{BOLD}  {len(hits)} results for '{CYAN}{query}{RESET}{BOLD}':{RESET}\n")
    for law_key, location, snippet in hits[:50]:  # cap at 50
        print(f"  {CYAN}{law_key:<16}{RESET}  {GREEN}{location}{RESET}")
        print(_wrap(snippet, indent=20))
        print()
    if len(hits) > 50:
        print(f"  {DIM}… and {len(hits) - 50} more. Narrow your search.{RESET}\n")


def cmd_lookup(data: Dict, key: str, norm: Optional[str]) -> None:
    """Display a single law by exact key (case-insensitive)."""
    # Exact match first, then case-insensitive
    match = data.get(key) or data.get(key.upper()) or data.get(key.lower())
    if not match:
        # Fuzzy: prefix match
        candidates = [k for k in data if k.upper().startswith(key.upper())]
        if len(candidates) == 1:
            match = data[candidates[0]]
            key = candidates[0]
        elif candidates:
            print(f"\n{YELLOW}  Ambiguous key '{key}'. Did you mean:{RESET}")
            for c in candidates[:10]:
                print(
                    f"    {CYAN}{c}{RESET}  {data[c].get('meta', {}).get('title', '')}"
                )
            return
        else:
            print(f"\n{RED}  Law '{key}' not found.{RESET}")
            print(f"  Use {CYAN}--list{RESET} to see all available keys,")
            print(f"  or   {CYAN}--search <word>{RESET} to search by content.")
            return
    display_law(key, match, norm_filter=norm)


def cmd_interactive(data: Dict) -> None:
    """Enter an interactive REPL for browsing laws."""
    print(
        f"\n{BOLD}Interactive mode{RESET}  "
        f"({DIM}type a law key, 'list', 'search <word>', or 'quit'{RESET})\n"
    )
    while True:
        try:
            raw = input(f"{CYAN}law>{RESET} ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            break

        if not raw:
            continue
        if raw.lower() in ("q", "quit", "exit"):
            break
        if raw.lower() == "list":
            cmd_list(data)
            continue

        parts = raw.split()
        if parts[0].lower() == "search" and len(parts) > 1:
            cmd_search(data, " ".join(parts[1:]))
            continue

        # Key lookup, optionally with a norm filter after a space
        law_key = parts[0]
        norm_filter = " ".join(parts[1:]) if len(parts) > 1 else None
        cmd_lookup(data, law_key, norm_filter)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Browse the German federal law dataset (de_federal.json).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
        Examples:
          python view_law.py                    # interactive mode
          python view_law.py --list             # list all law keys
          python view_law.py BGB                # show entire BGB
          python view_law.py BGB --norm "§ 242" # show BGB § 242 only
          python view_law.py --search Wohnsitz  # full-text search
        """),
    )
    parser.add_argument("key", nargs="?", help="Law abbreviation, e.g. BGB, StGB")
    parser.add_argument(
        "--norm", metavar="ID", help="Filter to a specific norm, e.g. '§ 7'"
    )
    parser.add_argument(
        "--list", action="store_true", help="List all available law keys"
    )
    parser.add_argument(
        "--search", metavar="WORD", help="Full-text search across all laws"
    )
    args = parser.parse_args()

    data = load_data()

    if args.list:
        cmd_list(data)
    elif args.search:
        cmd_search(data, args.search)
    elif args.key:
        cmd_lookup(data, args.key, args.norm)
    else:
        cmd_interactive(data)


if __name__ == "__main__":
    main()
