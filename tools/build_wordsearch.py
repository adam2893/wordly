#!/usr/bin/env python3
"""
Builds public/words-wordsearch.js with rich themed categories for Searchy (/wordsearch).
Combines curated categories from tools/connections-categories.txt and tools/build_strands.py
so every daily & practice Word Search grid (Easy 8x8, Medium 10x10, Hard 12x12) has
clean, recognizable English theme words with zero network calls.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONN_FILE = ROOT / "tools" / "connections-categories.txt"
STRANDS_FILE = ROOT / "tools" / "build_strands.py"
OUT_FILE = ROOT / "public" / "words-wordsearch.js"

EXTRA_THEMES = [
    ("Space & Astronomy", ["PLANET", "COMET", "ASTEROID", "ORBIT", "GALAXY", "METEOR", "SATURN", "VENUS", "NEBULA", "COSMOS", "ROCKET", "CRATER", "ECLIPSE", "STAR", "MOON", "PULSAR", "QUASAR", "TELESCOPE", "GRAVITY", "SOLAR"]),
    ("Coffee Shop", ["ESPRESSO", "LATTE", "MOCHA", "BARISTA", "ROAST", "CREAMER", "STEAM", "FILTER", "CARAMEL", "AROMA", "CAFFEINE", "MUG", "BEAN", "CAPPUCCINO", "MACCHIATO", "DRIP", "FOAM", "PASTRY", "SYRUP", "BREW"]),
    ("At the Beach", ["UMBRELLA", "SUNSCREEN", "SURFBOARD", "SEASHELL", "SANDCASTLE", "LIFEGUARD", "TOWEL", "FLIPFLOP", "WAVES", "OCEAN", "COAST", "TIDE", "SWIM", "CORAL", "PELICAN", "DRIFTWOOD", "SUNSET", "BOARDWALK", "BREEZE", "DUNE"]),
    ("Camping Trip", ["LANTERN", "COMPASS", "HAMMOCK", "BACKPACK", "CAMPFIRE", "CANOE", "TRAIL", "FOREST", "CABIN", "HIKE", "TENT", "WOODS", "CANTEEN", "MARSHMALLOW", "SLEEPING", "BINOCULARS", "KAYAK", "FLASHLIGHT", "SUMMIT", "RANGER"]),
    ("Cinema & Movies", ["DIRECTOR", "POPCORN", "TRAILER", "PREMIERE", "MATINEE", "TICKET", "CINEMA", "CAMERA", "SCRIPT", "ACTOR", "CREDITS", "SCENE", "STUNT", "SEQUEL", "COMEDY", "THRILLER", "SOUNDTRACK", "OSCAR", "SCREEN", "STUDIO"]),
    ("Winter Wonderland", ["SNOWFLAKE", "MITTENS", "ICICLE", "SLEDDING", "SCARF", "BLIZZARD", "CHIMNEY", "SWEATER", "SKATING", "GLOVES", "BOOTS", "FROST", "PARKAS", "FIREPLACE", "SNOWMAN", "TOBOGGAN", "COCOA", "FLURRY", "GLACIER", "FREEZE"]),
    ("Autumn Harvest", ["PUMPKIN", "HARVEST", "CHESTNUT", "SWEATER", "HAYRIDE", "ORCHARD", "FLANNEL", "FOLIAGE", "ACORN", "CIDER", "MAPLE", "CRISP", "GOURD", "SCARECROW", "CORNUCOPIA", "CRANBERRY", "BONFIRE", "NOVEMBER", "OCTOBER", "RAKE"]),
    ("pirates & High Seas", ["TREASURE", "GALLEON", "COMPASS", "CUTLASS", "CAPTAIN", "BANDANA", "CANNON", "ANCHOR", "PARROT", "ISLAND", "PIRATE", "BOOTY", "SHIP", "MUTINY", "DOUBLOON", "LOOKOUT", "VOYAGE", "HARBOR", "SAILOR", "KRAKEN"]),
    ("Medieval Castle", ["FORTRESS", "CATAPULT", "DUNGEON", "CHIVALRY", "TAPESTRY", "JOUSTING", "KNIGHT", "CASTLE", "SHIELD", "THRONE", "CROWN", "MOAT", "TURRET", "BANQUET", "ARMOR", "HERALD", "KINGDOM", "LANCE", "SQUIRE", "DRAGON"]),
    ("Rock Concert", ["GUITAR", "DRUMMER", "BASSIST", "CONCERT", "AMPLIFIER", "SPEAKER", "ENCORE", "VOCALS", "STAGE", "CHORD", "TOUR", "SOLO", "SONG", "FESTIVAL", "ANTHEM", "BACKSTAGE", "MELODY", "RHYTHM", "TICKET", "CROWD"]),
    ("Art Studio", ["PALETTE", "CHARCOAL", "PORTRAIT", "EASEL", "SCULPTURE", "PIGMENT", "CANVAS", "SKETCH", "PASTEL", "BRUSH", "MURAL", "CLAY", "ACRYLIC", "GALLERY", "ABSTRACT", "CERAMIC", "STENCIL", "CRAYON", "MOSAIC", "FRAME"]),
    ("Detective Mystery", ["SUSPECT", "WITNESS", "EVIDENCE", "FOOTPRINT", "MYSTERY", "SLEUTH", "ALIBI", "MOTIVE", "VERDICT", "CLUE", "CRIME", "CASE", "TRIAL", "DETECTIVE", "CIPHER", "SHADOW", "INQUIRY", "SECRET", "RIDDLE", "BADGE"]),
    ("Science Lab", ["MOLECULE", "ELECTRON", "CATALYST", "SOLUTION", "COMPOUND", "ISOTOPE", "REACTION", "BEAKER", "PROTON", "ELEMENT", "ACID", "ATOM", "BOND", "NEUTRON", "FORMULA", "PIPETTE", "BURNER", "CRYSTAL", "MAGNET", "PLASMA"]),
    ("World Travel", ["PASSPORT", "SUITCASE", "AIRPLANE", "SOUVENIR", "ITINERARY", "TERMINAL", "RESORT", "CRUISE", "TICKET", "HOTEL", "GUIDE", "BEACH", "TOUR", "LUGGAGE", "CUSTOMS", "COMPASS", "POSTCARD", "RUNWAY", "VOYAGE", "SAFARI"]),
    ("Computers & Tech", ["KEYBOARD", "MONITOR", "BROWSER", "NETWORK", "DATABASE", "FIREWALL", "SOFTWARE", "HARDWARE", "WIRELESS", "TERMINAL", "COMPILER", "CHIPSET", "BATTERY", "ROUTER", "SERVER", "LAPTOP", "PIXEL", "MODEM", "CLOUD", "CACHE"]),
]


def clean_word(w):
    w = re.sub(r"[^A-Z]", "", w.upper())
    return w if 4 <= len(w) <= 11 else ""


def main():
    themes = []
    seen_titles = set()

    # 1. Parse yellow & green categories from connections-categories.txt
    if CONN_FILE.exists():
        for line in CONN_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 4:
                continue
            diff, title, rule, shown = parts[0], parts[1], parts[2], parts[3]
            if diff not in ("0", "1") or rule != "-":
                continue
            if any(x in title.lower() for x in ["___", "homophone", "anagram", "palindrome", "starting", "ending", "words that"]):
                continue
            raw_words = [clean_word(w) for w in shown.split(",")]
            if len(parts) >= 5:
                raw_words += [clean_word(w) for w in parts[4].split(",")[:25]]
            words = []
            used = set()
            for w in raw_words:
                if w and w not in used:
                    used.add(w)
                    words.append(w)
            if len(words) >= 12 and title.lower() not in seen_titles:
                seen_titles.add(title.lower())
                themes.append({"title": title, "words": words[:28]})

    # 2. Add EXTRA_THEMES
    for title, wlist in EXTRA_THEMES:
        clean_title = title[0].upper() + title[1:]
        if clean_title.lower() in seen_titles:
            continue
        words = []
        used = set()
        for w in wlist:
            cw = clean_word(w)
            if cw and cw not in used:
                used.add(cw)
                words.append(cw)
        if len(words) >= 12:
            seen_titles.add(clean_title.lower())
            themes.append({"title": clean_title, "words": words[:28]})

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        f.write("// Auto-generated by tools/build_wordsearch.py — do not edit by hand.\n")
        f.write('window.WORDSEARCH_EPOCH = "2026-11-02";\n')
        f.write("window.WORDSEARCH_THEMES = ")
        json.dump(themes, f, separators=(",", ":"))
        f.write(";\n")
    print(f"Wrote {len(themes)} word-search themes to {OUT_FILE} ({OUT_FILE.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
