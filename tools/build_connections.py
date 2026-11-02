#!/usr/bin/env python3
"""Generate Connections puzzles from tools/connections-categories.txt.

Output: public/words-connections.js
  CONNECTIONS_EPOCH   date of puzzle #1 (puzzle n is shown on epoch + n-1 days)
  CONNECTIONS         list of puzzles; each is four [category, [w, w, w, w]]
                      groups in difficulty order (yellow, green, blue, purple)

Each puzzle takes one category per difficulty and four words from each, and
is kept only if:
  - the 16 words split into the four categories in exactly one way (a word
    may fit two of the categories as a red herring, as long as the puzzle
    as a whole still has a single answer), and
  - no other category in the bank covers four or more of the words (other
    than exactly one of the puzzle's own groups), so there's no "also
    valid" grouping the game would mark wrong.
Among valid candidates it prefers ones with red herrings.

Existing puzzles are kept as they are (so editing the bank never changes a
puzzle someone has already played); the builder only appends new ones up
to TARGET.

Usage:  python3 tools/build_connections.py [--rebuild]
"""

import json
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_words  # noqa: E402  (shared downloads + offensive-word lists)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, "tools", "connections-categories.txt")
OUT = os.path.join(ROOT, "public", "words-connections.js")
EPOCH = "2026-11-02"
TARGET = int(os.environ.get("CONNECTIONS_TARGET", 1000))
SAMPLES_PER_COMBO = 40
MAX_LEN = 12  # longest word that fits a tile on a phone


class Category:
    def __init__(self, tier, name, rule, shown, also, dictionary):
        self.tier = tier
        self.name = name
        self.shown = list(dict.fromkeys(shown))
        self.members = set(shown) | set(also)
        self.rule = rule
        self.dictionary = dictionary
        kind, _, arg = rule.partition(":")
        self.kind = kind
        self.args = arg.split()

    def fits(self, word):
        if word in self.members:
            return True
        w = word
        if not re.fullmatch(r"[A-Z]+", w):
            return False
        k, a = self.kind, self.args
        if k == "start":
            return any(w.startswith(p) and len(w) > len(p) for p in a)
        if k == "end":
            return any(w.endswith(p) and len(w) > len(p) for p in a)
        if k == "contains":
            return any(p in w and len(w) > len(p) for p in a)
        if k == "before":
            return (w + a[0]).lower() in self.dictionary
        if k == "after":
            return (a[0] + w).lower() in self.dictionary
        if k == "palindrome":
            return len(w) >= 4 and w == w[::-1]
        if k == "anagram":
            return sorted(w) == sorted(a[0])
        return False


def load_bank(dictionary, blocked):
    cats = []
    with open(BANK) as fh:
        for n, line in enumerate(fh, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 4:
                raise SystemExit(f"{BANK}:{n}: expected 4 or 5 fields")
            tier, name, rule = int(parts[0]), parts[1], parts[2]
            split = lambda s: [w.strip().upper() for w in s.split(",") if w.strip()]
            shown = split(parts[3])
            also = split(parts[4]) if len(parts) > 4 else []
            ok = []
            for w in shown:
                plain = re.sub(r"[^A-Z]", "", w).lower()
                if plain in blocked:
                    print(f"  skipped blocked word {w} in {name}")
                elif len(w) > MAX_LEN:
                    print(f"  skipped long word {w} in {name}")
                else:
                    ok.append(w)
            cat = Category(tier, name, rule if rule != "-" else "", ok, also, dictionary)
            bad = [w for w in ok if not cat.fits(w)]
            if bad:
                raise SystemExit(f"{BANK}:{n}: {name}: shown words don't fit: {bad}")
            if len(cat.shown) < 4:
                raise SystemExit(f"{BANK}:{n}: {name}: needs at least 4 shown words")
            cats.append(cat)
    return cats


def count_partitions(words, chosen, limit=2):
    """How many ways (up to `limit`) can the words be split four per
    category among `chosen`?"""
    options = [[i for i, c in enumerate(chosen) if c.fits(w)] for w in words]
    if any(not o for o in options):
        return 0
    order = sorted(range(len(words)), key=lambda i: len(options[i]))
    counts = [0] * len(chosen)
    found = 0

    def walk(k):
        nonlocal found
        if found >= limit:
            return
        if k == len(order):
            found += 1
            return
        for c in options[order[k]]:
            if counts[c] < 4:
                counts[c] += 1
                walk(k + 1)
                counts[c] -= 1

    walk(0)
    return found


def evaluate(groups, chosen, bank):
    """None if the puzzle is invalid, else a herring score (higher = more
    interesting)."""
    words = [w for g in groups for w in g]
    if len(set(words)) != 16:
        return None
    if count_partitions(words, chosen) != 1:
        return None
    group_sets = [frozenset(g) for g in groups]
    score = 0.0
    # Words that also fit another chosen category are the classic herring.
    for gi, g in enumerate(groups):
        for w in g:
            if any(c.fits(w) for ci, c in enumerate(chosen) if ci != gi):
                score += 1
    chosen_ids = {id(c) for c in chosen}
    for c in bank:
        if id(c) in chosen_ids:
            continue
        hits = frozenset(w for w in words if c.fits(w))
        if len(hits) >= 4 and hits not in group_sets:
            return None
        # Three words from different groups that all fit some other
        # category make a tempting wrong guess.
        if len(hits) == 3 and not any(hits <= g for g in group_sets):
            score += 0.5
    return score


def make_puzzle(index, bank, by_tier, recent):
    rng = random.Random(f"connections:{index}")
    best = None
    for attempt in range(400):
        chosen = []
        for tier in range(4):
            pool = [c for c in by_tier[tier] if c.name not in recent[tier]] or by_tier[tier]
            chosen.append(rng.choice(pool))
        for _ in range(SAMPLES_PER_COMBO):
            groups = [rng.sample(c.shown, 4) for c in chosen]
            score = evaluate(groups, chosen, bank)
            if score is None:
                continue
            score += rng.random() * 0.1  # tie-break
            if not best or score > best[0]:
                best = (score, chosen, groups)
        if best and best[0] >= 2 and attempt >= 3:
            break
    if not best:
        raise SystemExit(f"could not build puzzle {index}")
    _, chosen, groups = best
    return [[c.name, sorted(g)] for c, g in zip(chosen, groups)]


def read_existing():
    if not os.path.exists(OUT):
        return []
    with open(OUT) as fh:
        m = re.search(r"const CONNECTIONS = (\[.*\]);", fh.read(), re.S)
    return json.loads(m.group(1)) if m else []


def main():
    dictionary = set(build_words.fetch(build_words.ENABLE_URL, "enable1.txt"))
    blocked = (
        set(build_words.fetch(build_words.BLOCK_URL, "blocklist.txt"))
        | build_words.EXTRA_BLOCK
        | build_words.LATE_BLOCK
    )
    bank = load_bank(dictionary, blocked)
    by_tier = [[c for c in bank if c.tier == t] for t in range(4)]
    print("categories per difficulty:", [len(t) for t in by_tier])

    puzzles = [] if "--rebuild" in sys.argv else read_existing()
    kept = len(puzzles)
    # Don't reuse a category until most of its tier has had a turn.
    window = [max(1, len(t) * 2 // 3) for t in by_tier]
    while len(puzzles) < TARGET:
        recent = [
            {p[t][0] for p in puzzles[-window[t]:]} for t in range(4)
        ]
        puzzles.append(make_puzzle(len(puzzles), bank, by_tier, recent))
        if len(puzzles) % 100 == 0:
            print(f"  {len(puzzles)} puzzles")

    with open(OUT, "w") as fh:
        fh.write("// Generated by tools/build_connections.py - do not edit by hand.\n")
        fh.write(f'const CONNECTIONS_EPOCH = "{EPOCH}";\n')
        fh.write("const CONNECTIONS = ")
        fh.write(json.dumps(puzzles, separators=(",", ":")))
        fh.write(";\n")
    print(f"kept {kept} existing puzzles, wrote {len(puzzles)} total")


if __name__ == "__main__":
    main()
