#!/usr/bin/env python3
"""Fetch and build Mini and Standard crossword banks from Crosshare.org.

Outputs:
  public/words-mini.js
    MINI_EPOCH    date of puzzle #1 (puzzle n is shown on epoch + n-1 days)
    MINI_PUZZLES  list of mini crosswords (5x5)
  public/words-crossword.js
    CROSSWORD_EPOCH    date of puzzle #1
    CROSSWORD_PUZZLES  list of full-sized crosswords (10x10 to 15x15)

Each puzzle entry is a compact object:
  {
    id:     Crosshare puzzle id,
    title:  puzzle title,
    author: constructor name,
    rows:   grid height,
    cols:   grid width,
    grid:   flat string of length rows*cols ('A'-'Z' for letters, '.' for black squares),
    across: [[number, clue], ...],
    down:   [[number, clue], ...]
  }

Existing puzzles are kept in order (so re-running the build only appends new
puzzles and never changes a daily puzzle someone has already played); pass
--rebuild to start fresh.

Usage:  python3 tools/build_crosswords.py [--rebuild]
"""

import concurrent.futures
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "tools", ".cache", "crosshare")
MINI_OUT = os.path.join(ROOT, "public", "words-mini.js")
CROSSWORD_OUT = os.path.join(ROOT, "public", "words-crossword.js")

EPOCH = "2026-11-02"
MINI_TARGET = int(os.environ.get("MINI_TARGET", 365))
CROSSWORD_TARGET = int(os.environ.get("CROSSWORD_TARGET", 200))

UA = "Mozilla/5.0 (compatible; WordlyPuzzleBuilder/1.0)"


def fetch_text(url, cache_name=None):
    if cache_name:
        os.makedirs(CACHE_DIR, exist_ok=True)
        path = os.path.join(CACHE_DIR, cache_name)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as fh:
                return fh.read()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        text = resp.read().decode("utf-8")
    if cache_name:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
    return text


def fetch_next_data(path_slug, cache_key):
    url = f"https://crosshare.org/{path_slug.lstrip('/')}"
    html = fetch_text(url, f"page_{cache_key}.html")
    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
    )
    if not m:
        return {}
    return json.loads(m.group(1)).get("props", {}).get("pageProps", {})


def fetch_ipuz(puzzle_id):
    cache_name = f"ipuz_{puzzle_id}.json"
    try:
        raw = fetch_text(f"https://crosshare.org/api/ipuz/{puzzle_id}", cache_name)
        return json.loads(raw)
    except Exception:
        return None


def compute_numbering(rows, cols, grid):
    """Standard crossword numbering (1..N top-to-bottom, left-to-right) and
    the starting cell numbers for Across and Down entries."""
    across_nums = []
    down_nums = []
    num = 1
    for r in range(rows):
        for c in range(cols):
            if grid[r * cols + c] == ".":
                continue
            starts_across = (c == 0 or grid[r * cols + (c - 1)] == ".") and (
                c + 1 < cols and grid[r * cols + (c + 1)] != "."
            )
            starts_down = (r == 0 or grid[(r - 1) * cols + c] == ".") and (
                r + 1 < rows and grid[(r + 1) * cols + c] != "."
            )
            if starts_across or starts_down:
                if starts_across:
                    across_nums.append(num)
                if starts_down:
                    down_nums.append(num)
                num += 1
    return across_nums, down_nums


def parse_and_validate(puzzle_id, ipuz, min_size, max_size, square_only=True):
    """Convert raw Crosshare ipuz dict to compact Wordly format, or return
    None if the puzzle uses unsupported features (rebus, non-A-Z, circles,
    missing clues, or cross-referential/meta gimmicks)."""
    if not ipuz or not isinstance(ipuz, dict):
        return None
    dims = ipuz.get("dimensions") or {}
    cols = dims.get("width")
    rows = dims.get("height")
    if not isinstance(rows, int) or not isinstance(cols, int):
        return None
    if rows < min_size or rows > max_size or cols < min_size or cols > max_size:
        return None
    if square_only and rows != cols:
        return None

    puzzle_rows = ipuz.get("puzzle")
    sol_rows = ipuz.get("solution")
    if (
        not isinstance(puzzle_rows, list)
        or not isinstance(sol_rows, list)
        or len(puzzle_rows) != rows
        or len(sol_rows) != rows
    ):
        return None

    chars = []
    letter_count = 0
    for r in range(rows):
        prow = puzzle_rows[r]
        srow = sol_rows[r]
        if not isinstance(prow, list) or not isinstance(srow, list) or len(prow) != cols or len(srow) != cols:
            return None
        for c in range(cols):
            pcell = prow[c]
            scell = srow[c]
            # Reject styled/circled cells (dict in puzzle matrix) so puzzles
            # requiring shaded/circle gimmicks are excluded.
            if isinstance(pcell, dict):
                return None
            if isinstance(scell, dict):
                scell = scell.get("value")
            if pcell == "#" or scell == "#" or scell is None:
                chars.append(".")
            elif isinstance(scell, str) and len(scell) == 1 and "A" <= scell.upper() <= "Z":
                chars.append(scell.upper())
                letter_count += 1
            else:
                # Rebus or non-standard character
                return None

    if letter_count < (rows * cols) // 2:
        return None

    grid = "".join(chars)
    across_expected, down_expected = compute_numbering(rows, cols, grid)
    if not across_expected or not down_expected:
        return None

    clues = ipuz.get("clues") or {}
    raw_across = clues.get("Across") or []
    raw_down = clues.get("Down") or []

    def norm_clues(raw_list, expected_nums):
        out = []
        by_num = {}
        for item in raw_list:
            if not isinstance(item, dict):
                return None
            n = item.get("number")
            c = (item.get("clue") or "").strip()
            if not isinstance(n, int) or not c or c == "-":
                return None
            by_num[n] = c
        if list(by_num.keys()) != expected_nums:
            return None
        for n in expected_nums:
            out.append([n, by_num[n]])
        return out

    across = norm_clues(raw_across, across_expected)
    down = norm_clues(raw_down, down_expected)
    if not across or not down:
        return None

    title = (ipuz.get("title") or "Crossword").strip()
    author = (ipuz.get("author") or "Crosshare").strip()

    return {
        "id": puzzle_id,
        "title": title,
        "author": author,
        "rows": rows,
        "cols": cols,
        "grid": grid,
        "across": across,
        "down": down,
    }


def read_existing(path, const_name):
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as fh:
        m = re.search(rf"const {const_name} = (\[.*\]);", fh.read(), re.S)
    return json.loads(m.group(1)) if m else []


def write_bank(path, epoch_name, const_name, puzzles):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("// Generated by tools/build_crosswords.py - do not edit by hand.\n")
        fh.write(f'const {epoch_name} = "{EPOCH}";\n')
        fh.write(f"const {const_name} = ")
        fh.write(json.dumps(puzzles, ensure_ascii=False, separators=(",", ":")))
        fh.write(";\n")


def collect_mini_ids():
    """Gather candidate mini IDs from Crosshare's /dailyminis archive."""
    ids = []
    seen = set()
    months = [
        (2025, 12), (2025, 11), (2025, 10), (2025, 9), (2025, 8), (2025, 7),
        (2025, 6), (2025, 5), (2025, 4), (2025, 3), (2025, 2), (2025, 1),
        (2024, 12), (2024, 11), (2024, 10), (2024, 9), (2024, 8), (2024, 7),
        (2024, 6), (2024, 5), (2024, 4), (2024, 3), (2024, 2), (2024, 1),
    ]
    for y, m in months:
        props = fetch_next_data(f"dailyminis/{y}/{m}", f"dailyminis_{y}_{m:02d}")
        for entry in props.get("puzzles") or []:
            if isinstance(entry, list) and len(entry) >= 2 and isinstance(entry[1], dict):
                p = entry[1]
                pid = p.get("id")
                size = p.get("size") or {}
                if pid and pid not in seen and size.get("rows") == 5 and size.get("cols") == 5:
                    seen.add(pid)
                    ids.append(pid)
        if len(ids) >= MINI_TARGET * 2:
            break
    return ids


def collect_full_ids():
    """Gather candidate full-sized crossword IDs from Crosshare tag & featured pages."""
    ids = []
    seen = set()
    tag_queries = [
        "full,featured",
        "full",
        "themeless,full",
        "themed,full",
        "indie,full",
        "standard,full",
        "nyt,full",
        "monday,full",
        "tuesday,full",
        "wednesday,full",
        "easy,full",
        "medium,full",
        "cryptic,full",
        "friday,full",
        "sunday,full",
        "daily,full",
        "2025,full",
        "2024,full",
        "2023,full",
        "2022,full",
    ]
    for q in tag_queries:
        safe_q = q.replace(",", "_")
        for page in range(10):
            slug = f"tags/{q}" if page == 0 else f"tags/{q}/page/{page}"
            props = fetch_next_data(slug, f"tags_{safe_q}_p{page}")
            puzzles = props.get("puzzles") or []
            if not puzzles:
                break
            for p in puzzles:
                pid = p.get("id")
                size = p.get("size") or {}
                r, c = size.get("rows", 0), size.get("cols", 0)
                if pid and pid not in seen and 10 <= r <= 15 and r == c:
                    seen.add(pid)
                    ids.append(pid)
            if props.get("nextPage") is None:
                break
        if len(ids) >= CROSSWORD_TARGET * 3:
            break
    return ids


def build_category(label, existing, candidate_ids, target, min_sz, max_sz):
    puzzles = list(existing)
    kept = len(puzzles)
    used_ids = {p["id"] for p in puzzles}
    todo = [pid for pid in candidate_ids if pid not in used_ids]

    print(f"{label}: {kept} existing, {len(todo)} candidate IDs fetched")
    # Fetch ipuz files in parallel using a small worker pool
    batch_size = 40
    idx = 0
    while len(puzzles) < target and idx < len(todo):
        batch = todo[idx : idx + batch_size]
        idx += batch_size
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(fetch_ipuz, batch))
        for pid, ipuz in zip(batch, results):
            if len(puzzles) >= target:
                break
            parsed = parse_and_validate(pid, ipuz, min_sz, max_sz, square_only=True)
            if parsed:
                puzzles.append(parsed)
                used_ids.add(pid)
        print(f"  {label}: {len(puzzles)}/{target} valid puzzles")
    return kept, puzzles


def main():
    rebuild = "--rebuild" in sys.argv

    mini_existing = [] if rebuild else read_existing(MINI_OUT, "MINI_PUZZLES")
    mini_candidates = collect_mini_ids()
    mini_kept, minis = build_category(
        "Mini", mini_existing, mini_candidates, MINI_TARGET, 5, 5
    )
    write_bank(MINI_OUT, "MINI_EPOCH", "MINI_PUZZLES", minis)
    print(f"Mini: kept {mini_kept}, wrote {len(minis)} total to {MINI_OUT}")

    cw_existing = [] if rebuild else read_existing(CROSSWORD_OUT, "CROSSWORD_PUZZLES")
    cw_candidates = collect_full_ids()
    cw_kept, crosswords = build_category(
        "Crossword", cw_existing, cw_candidates, CROSSWORD_TARGET, 10, 15
    )
    write_bank(CROSSWORD_OUT, "CROSSWORD_EPOCH", "CROSSWORD_PUZZLES", crosswords)
    print(f"Crossword: kept {cw_kept}, wrote {len(crosswords)} total to {CROSSWORD_OUT}")


if __name__ == "__main__":
    main()
