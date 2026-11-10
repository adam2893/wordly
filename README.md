# Wordly

<img src="icon.png" alt="Wordly icon" width="96" align="right">

[![Build and publish Docker image](https://github.com/adam2893/wordly/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/adam2893/wordly/actions/workflows/docker-publish.yml)
[![GHCR Package](https://img.shields.io/badge/ghcr.io-adam2893%2Fwordly%3Alatest-blue?logo=docker)](https://github.com/adam2893/wordly/pkgs/container/wordly)

**Docker image:** [`ghcr.io/adam2893/wordly:latest`](https://github.com/adam2893/wordly/pkgs/container/wordly) (`docker pull ghcr.io/adam2893/wordly:latest`)

A small, self-hosted collection of 11 daily word and logic games: **Wordly** (guess the 5 or 6 letter word, with optional **Hard Mode\*** and high-contrast recessed eliminated keys), **Spelly Bee**, **Boxy Letters**, **Connecty**, **Strandy** (6×8 themed word trails + Spangram), **Searchy** (Easy 8×8, Medium 10×10 & Hard 12×12 themed word searches), **Mini Crossy** (5×5), **Midi Crossy** (9×9–11×11), **Crossy** (Monday/Tuesday NYT 15×15), **Tiley**, and **Sudoky**. Phone-first and installable as a **PWA** with 100% offline play (pre-caches all 11 games + automatic offline score queue), accidental-zoom protection, **20 themes** (including **OLED Black**), cross-device profile sync, shared leaderboards for everyone on your server, and a **Daily Archive** (📅) to catch up on any past day you missed. The home page (`/`) is a game menu showing today's progress in each game plus a 1-click **Daily Recap** share button.

## What's New in This Fork (`adam2893/wordly`)

This repository is an expanded fork of [**jakeshake/wordly**](https://github.com/jakeshake/wordly) (which created the original **Wordly**, **Spelly Bee**, **Boxy Letters**, **Connecty**, and zero-dependency server/theme architecture). On top of upstream, this fork adds:

- **7 New Daily & Practice Games:**
  - **Strandy (`/strands`)** — 6×8 themed word-trail grids with a board-spanning **Spangram** (`🟡`) and **Theme Words** (`🔵`).
  - **Searchy (`/wordsearch`)** — deterministic offline themed **Word Search** across **Easy (8×8)**, **Medium (10×10)**, and **Hard (12×12)** grids.
  - **Mini Crossy (`/mini`)** — bite-sized 5×5 daily crosswords.
  - **Midi Crossy (`/midi`)** — mid-sized 8×8–11×11 daily crosswords, with a header switcher (`Mini | Midi | Full`) shared across all three crossword modes.
  - **Crossy (`/crossword`)** — full 15×15 daily crosswords curated from approachable **Monday & Tuesday New York Times** puzzles, with `(N)` word-length badges on every clue.
  - **Tiley (`/tiles`)** — 30-tile layered pattern-matching combo game with 4 daily visual styles.
  - **Sudoky (`/sudoku`)** — **Easy**, **Medium**, and **Hard** 9×9 logic grids with pencil-mark notes, auto-clearing candidates, and undo.
- **100% Offline Phone PWA (`sw.js`):** pre-caches all 11 games, JS engines, and word banks on first visit so every puzzle loads in airplane mode or on the subway, plus an automatic **offline score queue** that syncs to the leaderboard as soon as your connection returns.
- **Phone-First Ergonomics & High-Contrast Keyboard:** recessed/dimmed eliminated keys in Wordly so used letters never blend in with unused keys, optional **Hard Mode (`*`)**, anti-zoom touch handling, and **OLED Black** (`#000000`) theme.
- **30-Day Daily Archive (`📅`), Emoji Shares & Cross-Device Sync (`👤`):** play any missed daily puzzle from the past 30 days, share spoiler-free emoji grids (`🟩🟨⬛`, `🔵🟡💡`) or a combined **Daily Recap**, and sync progress across phone, tablet, and desktop via PIN or backup code.
- **Automated Multi-Arch GHCR Releases:** GitHub Actions workflow publishing `ghcr.io/adam2893/wordly:latest` (`linux/amd64` + `linux/arm64`) on every push to `main`.

## Play against your family and friends

The big difference from the NYT games: **everyone on your server plays the same daily puzzles and lands on the same leaderboard.** Challenge your spouse, kids, or friends, compare today's results, and see who's ahead over weeks of streaks, win rates, average guesses, and best times. Each game has its own board, with a **Today** view and an **All-time** view.

<p align="center">
  <img src="docs/screenshots/leaderboard-ocean.png" alt="Wordly all-time leaderboard in the Ocean theme" width="260">
  <img src="docs/screenshots/bee-lb-synthwave.png" alt="Spelly Bee daily leaderboard in the Synthwave theme" width="260">
  <img src="docs/screenshots/connecty-lb-forest.png" alt="Connecty daily leaderboard in the Forest theme" width="260">
</p>

Pick a name on any device and you're in; there are no accounts or sign-ups.

## Screenshots

A few of the themes: Forest, Bubblegum 3D, Synthwave and Ocean. Pick yours with the theme button (◑) on the home menu; it applies to every game.

<p align="center">
  <img src="docs/screenshots/menu-forest.png" alt="Game menu in the Forest theme" width="190">
  <img src="docs/screenshots/menu-bubblegum3d.png" alt="Game menu in the Bubblegum 3D theme" width="190">
  <img src="docs/screenshots/wordly-synthwave.png" alt="Wordly game in the Synthwave theme" width="190">
  <img src="docs/screenshots/bee-bubblegum3d.png" alt="Spelly Bee in the Bubblegum 3D theme" width="190">
  <img src="docs/screenshots/connecty-ocean.png" alt="Connecty in the Ocean theme" width="190">
</p>

<sub>Leaderboard screenshots use sample players and scores.</sub>

## Games

### Wordly (`/wordly`)

- **5 or 6 letter mode** — toggle in the header, adjusts guess count (6 tries for 5-letter, 7 for 6-letter, word length + 1).
- **Daily Challenge** — everyone gets the same word each day (per length), computed deterministically from the date so it resets automatically at local midnight. No server round-trip needed to pick it.
- **Practice mode** — unlimited random-word games, doesn't touch the leaderboard.
- **Leaderboard** — games played, win %, current streak, best streak, average guesses, best time, and average luck, separately for 5- and 6-letter.
- **Speed timer** — starts on your first keystroke each Daily game, shown live above the board, recorded on completion, and tracked on the leaderboard as each player's best time.
- **Luck rating** — on a win, shows how many answer-pool words were still possible right before your winning guess. Solve it in few guesses despite a wide-open field and you'll score high on luck; narrow it down methodically and you'll score low ("All Skill"). Averaged per player on the leaderboard.
- A **huge valid-word dictionary** (8,645 five-letter / 15,232 six-letter words) so common guesses never get rejected, while the daily/practice *answer* always comes from a smaller curated common-word list (2,315 / 1,233 words) so the puzzle itself stays fair and guessable.

### Spelly Bee (`/bee`)

- Make words from a 7-letter hive; every word needs the center letter and at least 4 letters. Scoring: 1 point for 4-letter words, 1 per letter above that, +7 for a **pangram** (uses all 7 letters).
- Ranks from Beginner to **Genius** (70%) and **Queen Bee** (every word). Tap the rank bar for the thresholds.
- **Daily** hive shared by everyone (resets at midnight), re-rolled until it has 20–70 answers so no day is a dud; **Practice** for unlimited random hives, with a "Reveal answers" button.
- **Yesterday's answers**, with the words you found ticked off.
- **Time to Genius** — an active-play clock that pauses when the tab isn't visible.
- **Leaderboard**: *Today* (score, rank, words, pangrams, Genius time) and *All-time* (days played, average % of max, Genius days, Queen Bee days, pangrams, streak, best Genius time). Scores submit as you play (debounced).
- Keyboard: type letters, Enter, Backspace, Space to shuffle.

### Boxy Letters (`/boxed`)

- 12 letters, 3 per side of a square. Words chain end-to-start, consecutive letters must come from different sides, and the goal is to use all 12 letters in as few words as possible.
- Each daily box is generated around a real two-word solution from common words, so a 2-word solve is always possible. A **par** (4–6 words) is set based on how many 2-word solutions exist.
- Delete past the start of a word to reopen the previous one; Restart clears everything.
- **Daily** + **Practice** modes, **yesterday's solution**, and an active-play timer.
- **Leaderboard**: *Today* (words, par, time — fewer words wins, time breaks ties) and *All-time* (solves, average words, fewest words, 2-word solves, at/under-par solves, best time, streaks). First solve of the day counts.

### Connecty (`/connections`)

- 16 words, four hidden groups of four. Tap four words and Submit; four mistakes and you're out. "One away…" when three of the four belong together, and repeat guesses don't cost a mistake.
- Groups are color-coded by difficulty (yellow → green → blue → purple). Purple groups are wordplay: hidden words, fill-in-the-blank compounds (___BALL, FIRE___), anagrams, words that start or end with something.
- **Red herrings, but one answer**: words regularly fit a second group on the board, but every puzzle is checked at build time to have exactly one way to sort all 16 (see Dictionary below).
- **Daily** puzzle shared by everyone (numbered from #1 on 2026-11-02), **Practice** plays any puzzle from the archive, **Yesterday's answers**, active-play timer, and a copyable emoji result grid.
- **Leaderboard**: *Today* (solved, mistakes, time) and *All-time* (played, win %, perfect games, average mistakes, best time, streaks). First finished game of the day counts.

### Strandy (`/strands`)

- Trace winding 8-directional letter paths across a **6×8 grid** (48 letters) to uncover every hidden **Theme Word** (`🔵`) and the **Spangram** (`🟡`) that stretches between two opposite edges of the board. Every cell belongs to exactly one word.
- Supports smooth **touch drag** on phones as well as **tap-to-trace** (tap adjacent letters and tap the last letter again to submit).
- Stuck? Tap **Hint 💡** once to outline the cells of an unfound theme word, or a second time to highlight its starting letter. Solving with 0 hints earns a **Flawless ★** badge.
- **Daily** + **Practice** modes, **Daily Archive** (📅), active-play timer, and a copyable `🔵`/`🟡`/`💡` emoji result summary.
- **Leaderboard**: *Today* (hints, time) and *All-time* (solved, flawless ★ solves, average hints, best time, streaks).

### Searchy (`/wordsearch`)

- Classic themed **Word Search** generated deterministically on-device (`tools/build_wordsearch.py` -> 141 curated themed word lists in `public/words-wordsearch.js`) — works 100% offline with zero external API calls.
- Three grid sizes with their own daily puzzles and leaderboard tabs: **Easy** (8×8, 6 words, horizontal/vertical/down-right), **Medium** (10×10, 8 words, 8 directions), and **Hard** (12×12, 10 words, all 8 directions including reverse diagonals).
- Drag in a straight line (automatically snaps to the nearest of the 8 compass rays) or tap the start letter and tap the end letter. Found words lock in with colorful translucent pill highlights and cross off the word list.
- **Leaderboard**: separate **Easy**, **Medium**, and **Hard** tabs with *Today* (time, hints) and *All-time* (solved, flawless ★ solves, best time, average time, streaks).

### Mini Crossy (`/mini`), Midi Crossy (`/midi`) & Crossy (`/crossword`)

- Three daily crossword sizes linked by a header switcher (`Mini | Midi | Full`):
  - **Mini Crossy (`/mini`)**: bite-sized 5×5 daily crossword.
  - **Midi Crossy (`/midi`)**: mid-sized 9×9–11×11 daily crossword when you want more than a 5×5 without committing to a full 15×15.
  - **Crossy (`/crossword`)**: full 15×15 daily crossword curated from **Monday & Tuesday New York Times** crosswords (edited by Will Shortz — approachable early-week clues, zero rebus or cryptic gimmicks), with answer letter counts `(N)` shown on every clue.
- Tap a square to select it, tap again (or tap the clue bar / press `Space`) to switch between **Across** and **Down**, and use `‹` / `›` (or `Tab` / `Enter`) to jump between clues. Desktop viewports also show side-by-side Across and Down clue lists.
- Optional **Check word**, **Reveal letter**, and **Reveal word** buttons if you get stuck — solving with 0 hints earns a **Flawless ★** badge on the leaderboard.
- **Daily** + **Practice** modes, **Yesterday's answers**, active-play timer, and a copyable emoji share grid for minis.
- **Leaderboard**: *Today* (time, hints — fewest hints wins, time breaks ties) and *All-time* (solved, flawless ★ solves, best time, average time, streaks). First solve of the day counts.

### Tiley (`/tiles`)

- Clear the 5×6 board of 30 layered pattern tiles (ported from [baldoalessandro/tiles_game](https://github.com/baldoalessandro/tiles_game)). Each tile holds up to 3 overlapping layers (outer shape, middle motif, inner center).
- Tap a tile, then tap a second tile that shares at least one matching layer — shared layers vanish from both tiles and your **Combo** increases by 1. When your active tile empties completely, you get a free hop to any tile on the board without breaking your combo.
- Clear all 30 tiles with 0 misses to achieve a **Perfect 45/45 ★** combo!
- **Daily** board and motif palette (Squircle Pebbles, Azulejo Diamonds, Bauhaus Rings, Origami Petals) shared by everyone, plus **Practice** mode, **Daily Archive** (📅), and active-play timer.
- **Leaderboard**: *Today* (best combo, misses, time) and *All-time* (boards cleared, perfect ★ games, average combo, best time, streaks).

### Sudoky (`/sudoku`)

- Daily & Practice **Easy**, **Medium**, and **Hard** 9×9 Sudoku puzzles (puzzle bank from [TN1ck/super-sudoku](https://github.com/TN1ck/super-sudoku), pre-solved via `tools/build_sudoku.py`).
- **Notes (Pencil marks)** mode (`N` key) for 1–9 candidate numbers inside empty cells — placing a digit automatically clears matching notes in the same row, column, and 3×3 box.
- Row/column/box peer highlighting, same-digit highlighting, real-time conflict highlighting, **Undo** (`U`), **Erase**, **Hint**, and remaining-count badges on each number button.
- **Leaderboard**: separate **Easy**, **Medium**, and **Hard** tabs with *Today* (time, mistakes, hints) and *All-time* (solved, flawless ★ solves, best time, average time, streaks).

### Shared

- **Installable PWA & Phone-First UX** — install to your iOS/Android home screen for fullscreen standalone play (`manifest.json` + offline Service Worker `sw.js`), with anti-zoom touch handling so rapid double-tapping keys never accidentally zooms the viewport.
- **Cross-Device Profile Sync & Backup Code** — sync your daily progress, archive history, theme, and player profile across phone, tablet, and desktop via server-side profile sync (with optional PIN) or a portable Backup Code inside the Player Profile (`👤`) menu.
- **Emoji Share & Daily Recap** — every game has a **Share result** button with spoiler-free emoji grids (`🟩🟨⬛`, `🔵🟡💡`, etc.), and the main menu includes a **Copy today's recap** button that bundles all your completed games for the day into one message.
- **Daily Archive (📅)** — missed a day? Tap the calendar button in any game's header to browse and play the past 30 days of daily puzzles, complete with completion badges (`✓`, `✗`, `•••`) and leaderboard submission.
- **20 themes** — Dark, **OLED Black** (`#000000`), Light, Standard Neon, Neon City, Synthwave, Bubblegum 3D, Ocean, Sunset, Forest, Halloween, Christmas, Neon 80s, Spooky, Retro Terminal, Bubblegum, Art Deco, Tropical, Desert, Dessert — picked from the palette button on any page, saved across visits and games.
- **Player name** (no password) set once, used by every game's leaderboard.

## Architecture

Frontend is plain HTML/CSS/JS (`public/`), no build step, no framework. It's paired with a small zero-dependency Node backend (`server.js`, built-in `http`/`fs` only — no `npm install`, no `package.json`) that does two things:

1. Serves the static frontend (gzip-compressed for text assets, with clean URLs like `/bee` → `bee.html`, `/wordsearch` → `wordsearch.html`, `/midi` → `midi.html`, etc.).
2. Stores and aggregates leaderboard scores and synced player profiles as JSON files in the data directory (`scores.json` for Wordly, `bee.json`, `boxed.json`, `connections.json`, `strands.json`, `wordsearch.json`, `mini.json`, `midi.json`, `crossword.json`, `tiles.json`, `sudoku.json`, and `profiles.json`), so results submitted from any device/browser are visible to everyone.

Shared frontend code (themes, player name, cross-device profile sync, offline score queue, daily archive modal, dates, seeded RNG, stopwatch) lives in `public/common.js`; each game has its own `*.html` + `*.js` (with Mini, Midi, and Full Crossy sharing `public/crossword.js`), and game-specific styles live in `public/games.css`.

### Rate limiting

The API is rate limited per client IP with fixed one-minute windows: **30 score submissions/minute** and **120 leaderboard reads/minute** by default (override with `RATE_LIMIT_WRITES` / `RATE_LIMIT_READS` env vars). Over the limit returns `429` with a `Retry-After` header; the games quietly retry later.

If you put the container behind a reverse proxy (Nginx Proxy Manager, SWAG, Traefik…), set `TRUST_PROXY=1` so limits key on the real client IP from `X-Forwarded-For` rather than the proxy's address. Leave it unset when clients connect directly, so nobody can spoof the header.

The daily word itself is **not** served by the backend — it's derived client-side from a deterministic hash of the local date, so it needs no network call and stays in sync across devices without any server coordination. (This does mean the word technically sits in the page's JS if someone opens dev tools — there's no server-side anti-cheat. Fine for a friendly household leaderboard; don't peek at `words.js` before you've guessed.)

Score submissions are trusted from the client (no server-side guess verification) — again, appropriate for a private 2-person leaderboard, not a public competitive one.

## Running it locally

You need Node.js (any reasonably recent version) to run the full app with the leaderboard:

```bash
node server.js
```

Visit `http://localhost` (or set `PORT`/`DATA_DIR` env vars, e.g. `PORT=5173 node server.js`).

To preview just the frontend without Node (leaderboard calls will fail gracefully, everything else works), serve `public/` with any static file server, e.g. the bundled zero-dependency PowerShell server for Windows machines without Python/Node:

```powershell
powershell -File .devserver/serve.ps1 -Port 5173
```

## Docker / Unraid

A `Dockerfile` (Node 20 alpine) and a GitHub Actions workflow ([`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml)) are included. Every push to `main` builds, smoke-tests, and publishes a multi-arch (`linux/amd64`, `linux/arm64`) image to [GitHub Container Registry](https://github.com/adam2893/wordly/pkgs/container/wordly) at:

```
ghcr.io/adam2893/wordly:latest
```

Quick run with Docker:

```bash
docker run -d --name wordly -p 8080:80 -v wordly-data:/data ghcr.io/adam2893/wordly:latest
```

To run it on Unraid:

1. **Docker tab → Add Container.**
2. **Repository**: `ghcr.io/adam2893/wordly:latest`
3. **Port**: map container port `80` to whatever host port you want (e.g. `8080`).
4. **Path**: map container path `/data` to a host appdata folder (e.g. `/mnt/user/appdata/wordly`) — **this is what makes the leaderboard persist** across container restarts/updates. Without it, scores reset every time the container is recreated.
5. Apply — Unraid pulls the image and starts it. Visit `http://<unraid-ip>:8080`.

If the GHCR package is private, Unraid needs a registry login first (Docker tab → gear icon → add a registry with a GitHub personal access token that has `read:packages` scope). Making the repo/package public avoids this.

To build and run locally instead (no GHCR):

```bash
docker build -t wordly .
docker run -p 8080:80 -v wordly-data:/data wordly
```

## Dictionary

Spelly Bee and Boxy Letters word lists (`public/words-bee.js`, `public/words-boxed.js`) are generated by `tools/build_words.py` from the ENABLE list, filtered by word frequency ([wordfreq](https://pypi.org/project/wordfreq/)) and an offensive-word blocklist:

- **Spelly Bee answers** (~21.8k) are modeled on the NYT's own list. Fan archives of past NYT puzzles ([tedmiston/spelling-bee-answers](https://github.com/tedmiston/spelling-bee-answers), [philshem/scrape_bee](https://github.com/philshem/scrape_bee), [bwillenbring/nytimes-bee](https://github.com/bwillenbring/nytimes-bee) — ~1,200 puzzles, 2019–2025) show which words the NYT accepted and, since every word that fit a puzzle but isn't in its answers was turned down, which it rejected. Each word takes its most recent NYT verdict (~9k accepted, ~6.5k rejected). Words the NYT has never judged fall back to our own list: common words ([wordfreq](https://pypi.org/project/wordfreq/)), well-known dictionary words ([SCOWL](http://wordlist.aspell.net/) size ≤55) and their inflections ([lemminflect](https://pypi.org/project/lemminflect/)). Backtested against a held-out year of NYT puzzles, this matches the NYT's answers to within ~0.4 extra and ~0.7 missing words per puzzle (the previous frequency-based list was off by ~5 extra and ~6.6 missing). No S, ever (same as NYT).
- **Hives** are still picked from `BEE_WORDS`, a stable common-word list, so changing what counts as an answer never reshuffles a daily puzzle.
- **Petitions**: `tools/bee-petitions.txt` — one word per line to accept a word regardless of the NYT's verdict (this also overrides the generic blocklists below), or `-word` to reject one. Re-run the build after editing.
- **Offensive words**: the LDNOOBW list plus hand-kept `EXTRA_BLOCK` / `LATE_BLOCK` sets (slurs and crude words it misses) are excluded from every answer/solution list — *except* that a Spelly Bee word the NYT itself has accepted (ANAL, NUDE, NIPPLE, CRAP, POOP…) counts as an answer anyway. Slurs and hate terms (`NEVER_ACCEPT`) stay out no matter what. Words blocked after launch go in `LATE_BLOCK`, which lists them in `BEE_AVOID` / `BOXED_AVOID` instead of removing them from the puzzle-picking lists, so blocking a word never reshuffles daily puzzles.
- **Boxy Letters valid words** (~131k): the full ENABLE list minus words with doubled letters (impossible to play). Solutions for generated puzzles come from a ~12k common-word subset.

Re-run with `pip install wordfreq lemminflect && python3 tools/build_words.py` (needs network access to GitHub and SourceForge; downloads are cached in `tools/.cache`).

Connecty (`public/words-connections.js`) is generated by `tools/build_connections.py` from the category bank in `tools/connections-categories.txt` (~200 categories, each with the words that can be shown plus extra words that also fit it):

- Each puzzle takes one category per difficulty and four words from each. It's only kept if the 16 words can be sorted into its four categories in **exactly one way**, and no other category in the bank covers four of the words (other than one of the puzzle's own groups), so there's never a second "correct" grouping. Wordplay categories carry a rule (`before:BALL`, `start:CAR CAB`, `contains:RED TAN`, `anagram:STEAL`…) that the checker also applies to every other word on the board — fill-in rules are checked against the ENABLE dictionary — so a stray SNOWMAN or hidden RED gets caught.
- Among valid candidates it prefers ones with red herrings, and doesn't reuse a category until most of its difficulty tier has had a turn.
- 1,000 puzzles are generated (~2¾ years of dailies, then it loops). Re-running the build **keeps existing puzzles** and only appends, so editing the bank never changes a puzzle someone has played; `--rebuild` starts over. Run `python3 tools/build_connections.py` (uses the same cached downloads as `build_words.py`).

Wordly:

- **Valid guesses** (`GUESSES[5]`, `GUESSES[6]` in `public/words.js`): a large Scrabble-style word-game dictionary (ENABLE word list), ~8.6k five-letter and ~15.2k six-letter words. This is what guesses are checked against, so legitimate everyday words are essentially never rejected.
- **Possible answers** (`ANSWERS[5]`, `ANSWERS[6]`): the curated common-word lists from the original build — a curated 2,314-word list of common words for 5 letters, and a manually-screened ~1,233-word list for 6 letters. Daily and Practice answers are always picked from here, so the puzzle stays solvable/fair. `ANSWERS` is a subset of `GUESSES`, guaranteed at build time.

Additional puzzle banks generated by scripts in `tools/`:

- **Strandy** (`public/words-strands.js`, built by `tools/build_strands.py`): 140+ pre-packed 6×8 word-trail boards where every cell belongs to a theme word or the board-spanning Spangram.
- **Searchy** (`public/words-wordsearch.js`, built by `tools/build_wordsearch.py`): 141 curated themed word lists (10 words each, 4–8 letters) placed deterministically on-device into 8×8, 10×10, or 12×12 grids.
- **Mini Crossy, Midi Crossy & Crossy** (`public/words-mini.js`, `public/words-midi.js`, `public/words-crossword.js`, built by `tools/build_crosswords.py`): 365 5×5 Mini puzzles and 148 8×8–11×11 Midi puzzles from Crosshare, plus 200 classic Monday & Tuesday 15×15 NYT crosswords (filtered for standard numbering and zero rebus/cryptic gimmicks).
- **Sudoky** (`public/words-sudoku.js`, built by `tools/build_sudoku.py`): 450 pre-solved Easy, Medium, and Hard 9×9 Sudoku boards.

## Customizing

- **Add a theme**: add a `[data-theme="yourname"]` block in `public/style.css` with the same CSS custom properties as the existing themes, then add `{ id, name, swatch }` to the `THEMES` array at the top of `public/common.js`. Optionally set `--bee-center` / `--bee-center-text` if the theme's `--color-present` doesn't stand out as the Spelly Bee center hex.
- **Add a length**: add `GUESSES[n]` and `ANSWERS[n]` arrays in `public/words.js`, a `<button class="len-btn" data-len="n">n</button>` in `index.html`'s `.length-toggle`, and the board/keyboard/daily logic handles the rest automatically (max guesses = length + 1).
- **Change the daily reset time or make it shared across timezones**: `todayDateString()` in `public/common.js` uses the browser's local date. Switch it to a fixed UTC-based string if you'd rather everyone share one global reset time regardless of timezone.

## Theme background images

`public/images/themes/` holds per-theme background images, wired up as a `background-image` on the matching `[data-theme="..."]` block in `public/style.css` (see the "Theme background images" section near the top of that file). Currently wired: Ocean, Christmas, Spooky, Bubblegum 3D, Sunset, Standard Neon, Neon City, Neon 80s, Synthwave, Forest, Halloween (Sunset, Forest and Halloween use user-supplied photos/art), Retro Terminal, Bubblegum, Art Deco, Tropical, Desert, Dessert. Dark and Light intentionally stay flat.

The Retro Terminal, Bubblegum, Art Deco, Tropical, Desert, and Dessert backgrounds are hand-built SVGs generated by `tools/make_theme_art.py` (seeded, so re-running reproduces them exactly) — edit the script and re-run to tweak them.

Convention:

- File name matches the theme's `id` from the `THEMES` array in `public/common.js` (e.g. `ocean.jpg`, `neon-city.svg`). Extension can be `.jpg`, `.png`, `.webp`, or `.svg`.
- Portrait-friendly / mobile-first framing, since the board is narrow and tall on phones. `background-position: center top` keeps the top of the image anchored under the header.
- Each wired theme pairs its image with a `linear-gradient(...)` scrim tuned to that image's brightness, layered in the same `background-image` declaration, so tiles/keys (which always paint a solid theme color) and header text stay legible on top.

To add one for a theme that doesn't have it yet: drop the image in this folder, then add its `[data-theme="..."] body { background-image: linear-gradient(...), url("images/themes/yourfile"); }` rule alongside the others, and add the theme's selector to the shared `background-size/position/repeat` rule above them.

## Unraid

Wordly is listed in Unraid's Community Applications (search for **Wordly** in the Apps tab). The template lives in [`templates/wordly.xml`](templates/wordly.xml).

## Versions

Every push to `main` publishes [`ghcr.io/adam2893/wordly:latest`](https://github.com/adam2893/wordly/pkgs/container/wordly). Release tags (`v1.0.0`, ...) also publish `:1.0.0` and `:1.0`, so you can pin a version.

## Credits & Acknowledgments

- **Original Wordly project**: Forked from [**jakeshake/wordly**](https://github.com/jakeshake/wordly) by [@jakeshake](https://github.com/jakeshake) — creator of the original self-hosted Wordly, Spelly Bee, Boxy Letters, and Connecty suite, the zero-dependency Node server, and the theme artwork system ([Buy Jacob a coffee](https://buymeacoffee.com/jakeshake)).
- **Crosswords (`Mini Crossy`, `Midi Crossy` & `Crossy`)**:
  - Mini (5×5) and Midi (8×8–11×11) puzzles sourced from community constructors on [**Crosshare**](https://crosshare.org) (constructor credit is displayed in the byline of every puzzle).
  - Full 15×15 Monday & Tuesday crosswords sourced from the historical archive compiled in [**doshea/nyt_crosswords**](https://github.com/doshea/nyt_crosswords) (with individual constructor credits preserved in each puzzle's byline).
- **Tiley (`/tiles`)**: Inspired by and adapted from [**baldoalessandro/tiles_game**](https://github.com/baldoalessandro/tiles_game) by [@baldoalessandro](https://github.com/baldoalessandro).
- **Sudoky (`/sudoku`)**: 9×9 Easy, Medium, and Hard puzzle bank adapted from [**TN1ck/super-sudoku**](https://github.com/TN1ck/super-sudoku) by [@TN1ck](https://github.com/TN1ck).
- **Searchy (`/wordsearch`)**: Inspired by [**apiverve/wordsearch-api**](https://github.com/apiverve/wordsearch-api).
- **UI/UX & Polish**: Guided by design and interaction skills from [**jakubkrehel/skills**](https://github.com/jakubkrehel/skills) and [**pbakaus/impeccable**](https://github.com/pbakaus/impeccable).
- **Dictionaries & Word Data**: [ENABLE](https://github.com/dolph/dictionary) (public domain), [wordfreq](https://github.com/rspeer/wordfreq), [SCOWL](http://wordlist.aspell.net/), [lemminflect](https://github.com/bjascob/LemmInflect), the [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) blocklist, and community Spelling Bee archives ([tedmiston/spelling-bee-answers](https://github.com/tedmiston/spelling-bee-answers), [philshem/scrape_bee](https://github.com/philshem/scrape_bee), [bwillenbring/nytimes-bee](https://github.com/bwillenbring/nytimes-bee)).
- **Theme Backgrounds**: Several theme backgrounds are wallpapers collected from the web. If you own one of them and want it credited or removed, please [open an issue](https://github.com/adam2893/wordly/issues) and it will be taken care of promptly.
- Wordly is an independent self-hosted project and is not affiliated with or endorsed by The New York Times.

## License

[MIT](LICENSE)
