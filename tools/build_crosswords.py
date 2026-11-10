#!/usr/bin/env python3
"""Fetch and build Mini (5x5), Midi (7x7 to 11x11), and Full (15x15) crossword banks.

Outputs:
  public/words-mini.js
    MINI_EPOCH        date of puzzle #1
    MINI_PUZZLES      list of 5x5 mini crosswords (Crosshare Daily Minis)
  public/words-midi.js
    MIDI_EPOCH        date of puzzle #1
    MIDI_PUZZLES      list of 7x7 to 11x11 midi crosswords (curated Crosshare Midis)
  public/words-crossword.js
    CROSSWORD_EPOCH   date of puzzle #1
    CROSSWORD_PUZZLES list of 15x15 full crosswords (curated Monday/Tuesday NYT crosswords)

Usage:  python3 tools/build_crosswords.py [--rebuild] [--rebuild-full] [--rebuild-midi]
"""

import concurrent.futures
import datetime
import html as html_lib
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "tools", ".cache", "crosshare")
NYT_CACHE_DIR = os.path.join(ROOT, "tools", ".cache", "nyt")
MINI_OUT = os.path.join(ROOT, "public", "words-mini.js")
MIDI_OUT = os.path.join(ROOT, "public", "words-midi.js")
CROSSWORD_OUT = os.path.join(ROOT, "public", "words-crossword.js")

EPOCH = "2026-11-02"
MINI_TARGET = int(os.environ.get("MINI_TARGET", 365))
MIDI_TARGET = int(os.environ.get("MIDI_TARGET", 160))
CROSSWORD_TARGET = int(os.environ.get("CROSSWORD_TARGET", 200))

UA = "Mozilla/5.0 (compatible; WordlyPuzzleBuilder/2.0)"

CRYPTIC_OR_META_RE = re.compile(
    r"\(\d+(?:[,\s-]+\d+)*\)\s*$|"
    r"\b(?:1[0-9]|[1-9])-(?:Across|Down)\b|"
    r"\b(?:1[0-9]|[1-9])[AD]\b|"
    r"\bstarred\s+clue\b|"
    r"\bshaded\s+square|"
    r"\bcircled\s+letter|"
    r"\[[^\]]+\]",
    re.I,
)


def fetch_text(url, cache_dir=None, cache_name=None):
    if cache_dir and cache_name:
        os.makedirs(cache_dir, exist_ok=True)
        path = os.path.join(cache_dir, cache_name)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as fh:
                return fh.read()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        text = resp.read().decode("utf-8")
    if cache_dir and cache_name:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
    return text


def fetch_next_data(path_slug, cache_key):
    url = f"https://crosshare.org/{path_slug.lstrip('/')}"
    html = fetch_text(url, CACHE_DIR, f"page_{cache_key}.html")
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
        raw = fetch_text(f"https://crosshare.org/api/ipuz/{puzzle_id}", CACHE_DIR, cache_name)
        return json.loads(raw)
    except Exception:
        return None


def compute_numbering(rows, cols, grid):
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


def parse_and_validate(puzzle_id, ipuz, min_size, max_size, square_only=True, strict_clues=False):
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

    title = (ipuz.get("title") or "Crossword").strip()
    author = (ipuz.get("author") or "Crosshare").strip()
    if strict_clues and re.search(r"cryptic|meta|pun|rebus|variety|collab|spoiler|six out of seven", title, re.I):
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
            c = html_lib.unescape((item.get("clue") or "").strip())
            if not isinstance(n, int) or not c or c == "-":
                return None
            if strict_clues and (len(c) > 95 or CRYPTIC_OR_META_RE.search(c)):
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
    if strict_clues and across[0][0] != 1 and down[0][0] != 1:
        return None

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


def parse_nyt_json(path_key, raw_json):
    """Validate and convert a Monday/Tuesday NYT crossword JSON into compact Wordly format."""
    try:
        d = json.loads(raw_json)
    except Exception:
        return None
    if not isinstance(d, dict):
        return None
    if d.get("circles") or d.get("rbars") or d.get("bbars") or d.get("shadecircles") or d.get("jnotes"):
        return None
    sz = d.get("size") or {}
    rows = sz.get("rows")
    cols = sz.get("cols")
    if rows != 15 or cols != 15:
        return None

    raw_grid = d.get("grid")
    if not isinstance(raw_grid, list) or len(raw_grid) != 225:
        return None
    chars = []
    for cell in raw_grid:
        if cell == ".":
            chars.append(".")
        elif isinstance(cell, str) and len(cell) == 1 and "A" <= cell.upper() <= "Z":
            chars.append(cell.upper())
        else:
            return None

    grid = "".join(chars)
    across_expected, down_expected = compute_numbering(rows, cols, grid)
    if not across_expected or not down_expected:
        return None

    clues = d.get("clues") or {}
    raw_across = clues.get("across") or []
    raw_down = clues.get("down") or []

    def parse_clue_list(clist, expected_nums):
        by_num = {}
        for item in clist:
            if not isinstance(item, str):
                return None
            m = re.match(r"^(\d+)\.\s*(.+)$", item.strip())
            if not m:
                return None
            n = int(m.group(1))
            text = html_lib.unescape(m.group(2).strip())
            if not text or CRYPTIC_OR_META_RE.search(text):
                return None
            by_num[n] = text
        if list(by_num.keys()) != expected_nums:
            return None
        return [[n, by_num[n]] for n in expected_nums]

    across = parse_clue_list(raw_across, across_expected)
    down = parse_clue_list(raw_down, down_expected)
    if not across or not down:
        return None

    dow = d.get("dow") or "Monday"
    date_str = d.get("date") or path_key
    author = (d.get("author") or "New York Times").strip()
    return {
        "id": f"nyt-{path_key.replace('/', '-').replace('.json', '')}",
        "title": f"{dow} Classic ({date_str})",
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
        fh.write(f"window.{epoch_name} = {epoch_name};\n")
        fh.write(f"window.{const_name} = {const_name};\n")


def collect_mini_ids():
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


def collect_midi_ids():
    ids = []
    seen = set()
    tag_queries = [
        "midi,featured",
        "midi",
        "themeless,midi",
        "themed,midi",
        "easy,midi",
        "monday,midi",
        "indie,midi",
        "daily,midi",
    ]
    for q in tag_queries:
        safe_q = q.replace(",", "_")
        for page in range(12):
            slug = f"tags/{q}" if page == 0 else f"tags/{q}/page/{page}"
            props = fetch_next_data(slug, f"tags_{safe_q}_p{page}")
            puzzles = props.get("puzzles") or []
            if not puzzles:
                break
            for p in puzzles:
                pid = p.get("id")
                size = p.get("size") or {}
                r, c = size.get("rows", 0), size.get("cols", 0)
                if pid and pid not in seen and 7 <= r <= 11 and r == c:
                    seen.add(pid)
                    ids.append(pid)
            if props.get("nextPage") is None:
                break
        if len(ids) >= MIDI_TARGET * 3:
            break
    return ids


def build_crosshare_category(label, existing, candidate_ids, target, min_sz, max_sz, strict_clues=False):
    puzzles = list(existing)
    kept = len(puzzles)
    used_ids = {p["id"] for p in puzzles}
    todo = [pid for pid in candidate_ids if pid not in used_ids]

    print(f"{label}: {kept} existing, {len(todo)} candidate IDs fetched")
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
            parsed = parse_and_validate(pid, ipuz, min_sz, max_sz, square_only=True, strict_clues=strict_clues)
            if parsed:
                puzzles.append(parsed)
                used_ids.add(pid)
        print(f"  {label}: {len(puzzles)}/{target} valid puzzles")
    return kept, puzzles


def build_nyt_full_crosswords(target):
    """Fetch Monday & Tuesday NYT 15x15 crosswords (2017 down to 2005) from doshea/nyt_crosswords."""
    tree_raw = fetch_text(
        "https://api.github.com/repos/doshea/nyt_crosswords/git/trees/master?recursive=1",
        NYT_CACHE_DIR,
        "git_tree.json",
    )
    tree = json.loads(tree_raw).get("tree", [])
    monday_paths = []
    tuesday_paths = []

    for item in tree:
        p = item.get("path", "")
        m = re.match(r"^(20\d\d)/(\d\d)/(\d\d)\.json$", p)
        if not m:
            continue
        y, mo, da = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 2006:
            continue
        try:
            wd = datetime.date(y, mo, da).weekday()
        except ValueError:
            continue
        if wd == 0:
            monday_paths.append(p)
        elif wd == 1:
            tuesday_paths.append(p)

    # Sort newest first so vocabulary/references are modern and approachable
    monday_paths.sort(reverse=True)
    tuesday_paths.sort(reverse=True)
    candidates = monday_paths + tuesday_paths
    print(f"NYT Full: {len(monday_paths)} Monday + {len(tuesday_paths)} Tuesday candidate paths")

    def fetch_one(path_key):
        cache_name = path_key.replace("/", "_")
        url = f"https://raw.githubusercontent.com/doshea/nyt_crosswords/master/{path_key}"
        try:
            return fetch_text(url, NYT_CACHE_DIR, cache_name)
        except Exception:
            return None

    puzzles = []
    idx = 0
    batch_size = 32
    while len(puzzles) < target and idx < len(candidates):
        batch = candidates[idx : idx + batch_size]
        idx += batch_size
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            raws = list(pool.map(fetch_one, batch))
        for path_key, raw in zip(batch, raws):
            if len(puzzles) >= target:
                break
            if not raw:
                continue
            parsed = parse_nyt_json(path_key, raw)
            if parsed:
                puzzles.append(parsed)
        print(f"  NYT Full: {len(puzzles)}/{target} valid Monday/Tuesday puzzles")
    return puzzles


def main():
    rebuild_all = "--rebuild" in sys.argv
    rebuild_midi = rebuild_all or "--rebuild-midi" in sys.argv
    rebuild_full = rebuild_all or "--rebuild-full" in sys.argv

    # 1. Mini (5x5)
    mini_existing = [] if rebuild_all else read_existing(MINI_OUT, "MINI_PUZZLES")
    if len(mini_existing) < MINI_TARGET:
        mini_candidates = collect_mini_ids()
        _, minis = build_crosshare_category("Mini", mini_existing, mini_candidates, MINI_TARGET, 5, 5, strict_clues=False)
    else:
        minis = mini_existing
    write_bank(MINI_OUT, "MINI_EPOCH", "MINI_PUZZLES", minis)
    print(f"Mini: wrote {len(minis)} total to {MINI_OUT}")

    # 2. Midi (7x7 to 11x11)
    midi_existing = [] if rebuild_midi else read_existing(MIDI_OUT, "MIDI_PUZZLES")
    if len(midi_existing) < MIDI_TARGET:
        midi_candidates = collect_midi_ids()
        _, midis = build_crosshare_category("Midi", midi_existing, midi_candidates, MIDI_TARGET, 7, 11, strict_clues=True)
    else:
        midis = midi_existing
    write_bank(MIDI_OUT, "MIDI_EPOCH", "MIDI_PUZZLES", midis)
    print(f"Midi: wrote {len(midis)} total to {MIDI_OUT}")

    # 3. Full (15x15 Monday/Tuesday NYT Classics)
    cw_existing = [] if rebuild_full else read_existing(CROSSWORD_OUT, "CROSSWORD_PUZZLES")
    if len(cw_existing) < CROSSWORD_TARGET:
        crosswords = build_nyt_full_crosswords(CROSSWORD_TARGET)
    else:
        crosswords = cw_existing
    write_bank(CROSSWORD_OUT, "CROSSWORD_EPOCH", "CROSSWORD_PUZZLES", crosswords)
    print(f"Crossword: wrote {len(crosswords)} total to {CROSSWORD_OUT}")


if __name__ == "__main__":
    main()
