#!/usr/bin/env python3
"""
Builds public/words-strands.js with 400 daily 6x8 Strandy puzzles.
Every puzzle partitions all 48 cells (6 cols x 8 rows) into non-overlapping
8-direction word paths, with one Spangram spanning opposite board edges.
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "public" / "words-strands.js"

# Each theme entry has (theme_clue, spangram, candidate_theme_words).
# The builder selects a subset of candidate_theme_words whose lengths + len(spangram) == 48.
THEMES = [
    ("Out of this world", "SOLARSYSTEM", ["PLANET", "COMET", "ASTEROID", "ORBIT", "GALAXY", "METEOR", "SATURN", "VENUS", "NEBULA", "COSMOS", "ROCKET", "CRATER", "ECLIPSE"]),
    ("Morning brew", "COFFEESHOP", ["ESPRESSO", "LATTE", "MOCHA", "BARISTA", "ROAST", "CREAMER", "STEAM", "FILTER", "CARAMEL", "AROMA", "CAFFEINE", "MUG", "BEAN"]),
    ("In the kitchen", "COOKWARE", ["SKILLET", "SPATULA", "BLENDER", "COLANDER", "GRATER", "WHISK", "KETTLE", "SAUCEPAN", "TONGS", "LADLE", "PEELER", "TIMER", "OVEN"]),
    ("Make some noise", "ORCHESTRA", ["VIOLIN", "TRUMPET", "CYMBAL", "CLARINET", "TIMPANI", "CELLO", "FLUTE", "BASSOON", "TROMBONE", "HARP", "OBOE", "VIOLA", "DRUM"]),
    ("Check the forecast", "WEATHERMAP", ["THUNDER", "BLIZZARD", "TORNADO", "DRIZZLE", "HUMIDITY", "BREEZE", "SHOWER", "SUNSHINE", "FROST", "SQUALL", "CLOUDS", "STORM", "HAIL"]),
    ("Under the waves", "CORALREEF", ["DOLPHIN", "OCTOPUS", "LOBSTER", "SEAHORSE", "JELLYFISH", "URCHIN", "ANEMONE", "STARFISH", "TURTLE", "SPONGE", "SHARK", "WHALE", "CLAM"]),
    ("Freshly picked", "FRUITBASKET", ["MANGO", "PEACH", "BANANA", "APRICOT", "CHERRY", "PAPAYA", "PLUM", "ORANGE", "MELON", "GRAPE", "LEMON", "GUAVA", "APPLE", "BERRY"]),
    ("Roll the dice", "BOARDGAMES", ["CHECKERS", "DOMINOES", "MONOPOLY", "SCRABBLE", "CHESS", "BACKGAMMON", "YAHTZEE", "TRIVIA", "PAWN", "TOKEN", "CARDS", "PLAYER"]),
    ("Into the woods", "CAMPINGTRIP", ["LANTERN", "COMPASS", "HAMMOCK", "BACKPACK", "CAMPFIRE", "CANOE", "SLEEPING", "TRAIL", "FOREST", "CABIN", "HIKE", "TENT", "WOODS"]),
    ("Sugar rush", "SWEETTREATS", ["BROWNIE", "CUPCAKE", "MACARON", "CARAMEL", "TRUFFLE", "CUSTARD", "SUNDAE", "WAFFLE", "DONUT", "COOKIE", "FUDGE", "CANDY", "TART"]),
    ("Now showing", "SILVERCREEN", ["DIRECTOR", "POPCORN", "TRAILER", "PREMIERE", "MATINEE", "TICKET", "CINEMA", "CAMERA", "SCRIPT", "ACTOR", "CREDITS", "SCENE", "STUNT"]),
    ("Bundle up", "WINTERTIME", ["SNOWFLAKE", "MITTENS", "ICICLE", "SLEDDING", "SCARF", "BLIZZARD", "CHIMNEY", "SWEATER", "SKATING", "GLOVES", "BOOTS", "FROST", "COLD"]),
    ("In full bloom", "SPRINGGARDEN", ["DAFFODIL", "LAVENDER", "MARIGOLD", "HIBISCUS", "PETUNIA", "ORCHID", "JASMINE", "BLOSSOM", "TULIP", "DAISY", "PANSY", "LILY", "ROSE"]),
    ("Hit the shore", "BEACHDAY", ["UMBRELLA", "SUNSCREEN", "SURFBOARD", "SEASHELL", "SANDCASTLE", "LIFEGUARD", "TOWEL", "FLIPFLOP", "WAVES", "OCEAN", "COAST", "TIDE", "SWIM"]),
    ("Fall vibes", "AUTUMNLEAVES", ["PUMPKIN", "HARVEST", "CHESTNUT", "SWEATER", "HAYRIDE", "ORCHARD", "FLANNEL", "FOLIAGE", "ACORN", "CIDER", "MAPLE", "CRISP", "GOURD"]),
    ("Take the field", "BALLGAMES", ["BASEBALL", "FOOTBALL", "LACROSSE", "HANDBALL", "SOFTBALL", "CRICKET", "BOWLING", "TENNIS", "SOCCER", "HOCKEY", "GOLF", "RUGBY", "POLO"]),
    ("Crown jewels", "GEMSTONES", ["SAPPHIRE", "EMERALD", "AMETHYST", "DIAMOND", "GARNET", "TOPAZ", "PERIDOT", "TURQUOISE", "OPAL", "RUBY", "JADE", "PEARL", "ONYX", "AMBER"]),
    ("Take flight", "SONGBIRDS", ["CARDINAL", "SPARROW", "BLUEJAY", "SWALLOW", "STARLING", "THRUSH", "FINCH", "ROBIN", "CANARY", "ORIOLE", "WREN", "LARK", "CROW"]),
    ("Order at the counter", "FASTFOOD", ["BURGER", "PRETZEL", "NUGGETS", "MILKSHAKE", "BURRITO", "SANDWICH", "HOTDOG", "WAFFLES", "FRIES", "TACOS", "PIZZA", "SODA", "WRAP"]),
    ("Rise and shine", "BREAKFAST", ["PANCAKE", "OMELETTE", "SAUSAGE", "CROISSANT", "OATMEAL", "MUFFIN", "WAFFLE", "BISCUIT", "BACON", "TOAST", "BAGEL", "SYRUP", "EGGS"]),
    ("On the prowl", "WILDCATS", ["LEOPARD", "CHEETAH", "PANTHER", "JAGUAR", "COUGAR", "OCELOT", "BOBCAT", "CARACAL", "TIGER", "LION", "LYNX", "PUMA"]),
    ("Stand tall", "FORESTTREES", ["REDWOOD", "SYCAMORE", "CYPRESS", "CHESTNUT", "MAHOGANY", "SEQUOIA", "WILLOW", "HICKORY", "MAPLE", "BIRCH", "CEDAR", "ASPEN", "PINE"]),
    ("Season to taste", "SPICERACK", ["CINNAMON", "TURMERIC", "CARDAMOM", "ROSEMARY", "OREGANO", "PAPRIKA", "CORIANDER", "NUTMEG", "THYME", "CUMIN", "BASIL", "CLOVE", "SAGE"]),
    ("Handyman's kit", "TOOLBELT", ["HAMMER", "WRENCH", "CHISEL", "PLIERS", "HACKSAW", "SANDPAPER", "MALLET", "LEVEL", "DRILL", "CLAMP", "SCREW", "LATHE", "VISE"]),
    ("Make yourself comfortable", "LIVINGROOM", ["ARMCHAIR", "BOOKCASE", "OTTOMAN", "CURTAINS", "CUSHION", "FIREPLACE", "CARPET", "CABINET", "COUCH", "TABLE", "SHELF", "RUG", "LAMP"]),
    ("Down on the farm", "BARNYARD", ["TRACTOR", "CHICKEN", "ROOSTER", "PASTURE", "HAYSTACK", "SILO", "PITCHFORK", "MEADOW", "SHEEP", "HORSE", "DAIRY", "FENCE", "BARN"]),
    ("Cut a rug", "DANCEFLOOR", ["FOXTROT", "FLAMENCO", "MACARENA", "BACHATA", "TANGO", "CHA-CHA", "MAMBO", "SAMBA", "WALTZ", "SALSA", "SWING", "DISCO", "POLKA", "JIVE"]),
    ("Mangia!", "PASTANIGHT", ["SPAGHETTI", "LINGUINE", "RAVIOLI", "MACARONI", "TORTELLINI", "LASAGNA", "FETTUCCINE", "GNOCCHI", "PENNE", "PESTO", "SAUCE", "ZITI"]),
    ("Say cheese", "DAIRYCASE", ["CHEDDAR", "GRUYERE", "PARMESAN", "PROVOLONE", "MOZZARELLA", "HAVARTI", "RICOTTA", "GOUDA", "SWISS", "BRIE", "FETA", "BLUE", "CURD"]),
    ("Whodunit?", "DETECTIVE", ["SUSPECT", "WITNESS", "EVIDENCE", "FOOTPRINT", "MYSTERY", "SLEUTH", "ALIBI", "MOTIVE", "VERDICT", "CLUE", "CRIME", "CASE", "TRIAL"]),
    ("Ahoy matey", "HIGHSEAS", ["TREASURE", "GALLEON", "COMPASS", "CUTLASS", "CAPTAIN", "BANDANA", "CANNON", "ANCHOR", "PARROT", "ISLAND", "PIRATE", "BOOTY", "SHIP"]),
    ("Royal court", "MEDIEVAL", ["FORTRESS", "CATAPULT", "DRAWBRIDGE", "DUNGEON", "CHIVALRY", "TAPESTRY", "JOUSTING", "KNIGHT", "CASTLE", "SHIELD", "THRONE", "CROWN", "MOAT"]),
    ("Turn it up", "ROCKBAND", ["GUITAR", "DRUMMER", "BASSIST", "CONCERT", "AMPLIFIER", "SPEAKER", "ENCORE", "VOCALS", "STAGE", "CHORD", "TOUR", "SOLO", "SONG"]),
    ("Creative space", "ARTSTUDIO", ["PALETTE", "CHARCOAL", "PORTRAIT", "EASEL", "WATERCOLOR", "SCULPTURE", "PIGMENT", "CANVAS", "SKETCH", "PASTEL", "BRUSH", "MURAL", "CLAY"]),
    ("Fresh out of the oven", "BAKESHOP", ["BAGUETTE", "FOCACCIA", "SOURDOUGH", "BRIOCHE", "PRETZEL", "CIABATTA", "PASTRY", "BISCUIT", "MUFFIN", "DANISH", "CRUST", "DOUGH", "LOAF"]),
    ("Pack your bags", "VACATION", ["PASSPORT", "SUITCASE", "AIRPLANE", "SOUVENIR", "ITINERARY", "TERMINAL", "RESORT", "CRUISE", "TICKET", "HOTEL", "GUIDE", "BEACH", "TOUR"]),
    ("Lab coat required", "CHEMISTRY", ["MOLECULE", "ELECTRON", "CATALYST", "SOLUTION", "COMPOUND", "ISOTOPE", "REACTION", "BEAKER", "PROTON", "ELEMENT", "ACID", "ATOM", "BOND"]),
    ("Step right up", "CARNIVAL", ["ACROBAT", "JUGGLER", "CAROUSEL", "TRAPEZE", "RINGMASTER", "POPCORN", "BALLOON", "TICKET", "MIDWAY", "CLOWN", "PARADE", "TENT", "RIDE"]),
    ("Creepy crawlies", "BUGWORLD", ["BEETLE", "CRICKET", "LADYBUG", "DRAGONFLY", "GRASSHOPPER", "FIREFLY", "MANTIS", "HORNET", "CICADA", "SPIDER", "WASP", "MOTH", "ANT"]),
    ("Man's best friend", "DOGBREEDS", ["BEAGLE", "POODLE", "BULLDOG", "TERRIER", "RETRIEVER", "COLLIE", "SPANIEL", "POINTER", "HUSKY", "BOXER", "CORGI", "HOUND", "PUG"]),
    ("Checkmate", "CHESSBOARD", ["BISHOP", "KNIGHT", "CASTLE", "GAMBIT", "ENDGAME", "CHECKMATE", "OPENING", "DEFENSE", "QUEEN", "ROOK", "PAWN", "KING", "RANK"]),
    ("Mount Olympus", "MYTHOLOGY", ["POSEIDON", "HERCULES", "APHRODITE", "ARTEMIS", "APOLLO", "ATHENA", "PEGASUS", "CENTAUR", "HERMES", "TITAN", "ZEUS", "HERA", "ARES"]),
    ("Once upon a time", "FAIRYTALE", ["PRINCESS", "SORCERER", "CARRIAGE", "CAULDRON", "BEANSTALK", "KINGDOM", "SLIPPER", "DRAGON", "GOBLIN", "WIZARD", "CASTLE", "MAGIC", "WAND"]),
    ("All aboard", "RAILROAD", ["CABOOSE", "STATION", "CONDUCTOR", "PLATFORM", "LOCOMOTIVE", "FREIGHT", "WHISTLE", "SLEEPER", "TUNNEL", "TICKET", "TRACKS", "ENGINE", "TRAIN"]),
    ("On the slopes", "WINTERSPORT", ["SNOWBOARD", "TOBOGGAN", "BOBSLEIGH", "CHAIRLIFT", "AVALANCHE", "SLALOM", "GOGGLES", "HELMET", "GLACIER", "POWDER", "JACKET", "SKIS", "POLE"]),
    ("Smooth sailing", "NAUTICAL", ["STARBOARD", "SCHOONER", "CATAMARAN", "BULKHEAD", "RIGGING", "MARINER", "HARBOR", "ANCHOR", "RUDDER", "VOYAGE", "GALE", "MAST", "DECK"]),
    ("Hit the books", "CLASSROOM", ["TEXTBOOK", "NOTEBOOK", "HOMEWORK", "BACKPACK", "SYLLABUS", "CALENDAR", "SHARPENER", "SEMESTER", "TEACHER", "DIPLOMA", "PENCIL", "ERASER", "CHALK"]),
    ("Money matters", "FINANCES", ["DIVIDEND", "MORTGAGE", "TREASURY", "INTEREST", "CURRENCY", "CHECKING", "SAVINGS", "DEPOSIT", "ACCOUNT", "BALANCE", "BUDGET", "CREDIT", "LOAN"]),
]


def find_subset_sum(words, target, rng):
    """Find a list of distinct words whose lengths sum to target."""
    pool = [w.replace("-", "") for w in words if w.isalpha() and 3 <= len(w) <= 11]
    for _ in range(80):
        rng.shuffle(pool)
        memo = {0: []}
        for w in pool:
            lw = len(w)
            next_memo = dict(memo)
            for s, chosen in memo.items():
                ns = s + lw
                if ns <= target and ns not in next_memo and len(chosen) < 8:
                    next_memo[ns] = chosen + [w]
            memo = next_memo
            if target in memo and 5 <= len(memo[target]) <= 7:
                return memo[target]
        if target in memo:
            return memo[target]
    return None


def make_base_snake(rows=8, cols=6):
    """Create a 48-cell 8-connected Hamiltonian path that can be locally mutated."""
    path = []
    for r in range(rows):
        row_cells = [(r, c) for c in range(cols)]
        if r % 2 == 1:
            row_cells.reverse()
        path.extend(row_cells)
    return path


def mutate_snake(path, rng):
    """Apply random local 2x2 segment swaps and symmetries to make the path wind naturally."""
    p = list(path)
    if rng.random() < 0.5:
        p = [(r, 5 - c) for (r, c) in p]
    if rng.random() < 0.5:
        p = [(7 - r, c) for (r, c) in p]
    if rng.random() < 0.5:
        p.reverse()

    # Local 2-cell transpositions along the path that preserve 8-connectivity
    for _ in range(120):
        i = rng.randint(1, len(p) - 3)
        # Try swapping p[i] and p[i+1] if p[i-1] adjacent to p[i+1] and p[i] adjacent to p[i+2]
        a, b, c, d = p[i - 1], p[i], p[i + 1], p[i + 2]
        if max(abs(a[0] - c[0]), abs(a[1] - c[1])) <= 1 and max(abs(b[0] - d[0]), abs(b[1] - d[1])) <= 1:
            p[i], p[i + 1] = p[i + 1], p[i]
    return p


def touches_opposite_edges(cells):
    cols = {c for _, c in cells}
    rows = {r for r, _ in cells}
    return (0 in cols and 5 in cols) or (0 in rows and 7 in rows)


def build_puzzle(theme, spangram, theme_words, rng):
    """Lay out spangram + theme_words along a mutated 48-cell Hamiltonian path so spangram spans opposite edges."""
    for _ in range(200):
        p = mutate_snake(make_base_snake(), rng)
        # Try placing spangram at different word positions along the partition
        order = list(theme_words)
        rng.shuffle(order)
        for sp_idx in range(len(order) + 1):
            all_words = order[:sp_idx] + [spangram] + order[sp_idx:]
            idx = 0
            placed = []
            sp_cells = None
            for w in all_words:
                seg = p[idx : idx + len(w)]
                idx += len(w)
                if w == spangram and sp_cells is None:
                    sp_cells = seg
                    placed.append({"word": w, "spangram": True, "path": [r * 6 + c for r, c in seg]})
                else:
                    placed.append({"word": w, "spangram": False, "path": [r * 6 + c for r, c in seg]})
            if sp_cells and touches_opposite_edges(sp_cells):
                if rng.random() < 0.5:
                    # Optionally reverse individual word directions
                    for item in placed:
                        if rng.random() < 0.45:
                            item["path"] = list(reversed(item["path"]))
                grid = ["?"] * 48
                for item in placed:
                    for ch, cell_idx in zip(item["word"], item["path"]):
                        grid[cell_idx] = ch
                assert "?" not in grid
                return {
                    "theme": theme,
                    "spangram": spangram,
                    "grid": "".join(grid),
                    "words": placed,
                }
    raise RuntimeError(f"Could not place {theme}")


def main():
    rng = random.Random(20261109)
    puzzles = []
    for i in range(400):
        theme, spangram, pool = THEMES[i % len(THEMES)]
        sp = spangram.replace("-", "").upper()
        target = 48 - len(sp)
        chosen = find_subset_sum(pool, target, rng)
        if not chosen:
            raise RuntimeError(f"No subset for {theme} (target={target})")
        puz = build_puzzle(theme, sp, chosen, rng)
        puzzles.append(puz)

    js = (
        "// Auto-generated by tools/build_strands.py — 400 daily 6x8 Strandy puzzles.\n"
        'const STRANDS_EPOCH = "2026-11-02";\n'
        f"const STRANDS_PUZZLES = {json.dumps(puzzles, separators=(',', ':'))};\n"
        "window.STRANDS_EPOCH = STRANDS_EPOCH;\n"
        "window.STRANDS_BANK = STRANDS_PUZZLES;\n"
    )
    OUT_FILE.write_text(js, encoding="utf-8")
    print(f"Wrote {len(puzzles)} Strandy puzzles to {OUT_FILE} ({OUT_FILE.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
