// Tiley (/tiles) - NYT Tiles-style layered pattern-matching game,
// ported from baldoalessandro/tiles_game with deterministic daily seeds
// and multiple visual motif sets.
(() => {
  "use strict";

  const S = Shared;

  const KEYS = {
    mode: "tiles:mode",
    daily: (date) => `tiles:daily:${date}`,
    practice: "tiles:practice",
  };

  const NUM_TILES = 30; // 5 cols x 6 rows
  const NUM_LAYERS = 3;
  const NUM_VARIATIONS = 6;
  const BITS_PER_LAYER = 3;
  const BITMASKS = [0b111, 0b111 << 3, 0b111 << 6];
  const MAX_COMBO = (NUM_TILES * NUM_LAYERS) / 2; // 45

  // Distinct per-variation geometry for each layer (0 = outer plaque,
  // 1 = middle motif, 2 = center emblem) so every variation pairs a unique
  // shape with a unique color (WCAG 1.4.1).
  function renderLayerShape(layer, variation, color) {
    const idx = (variation - 1) % NUM_VARIATIONS;
    if (layer === 0) {
      switch (idx) {
        case 0:
          return `<rect x="8" y="8" width="84" height="84" rx="22" fill="${color}" opacity="0.92"/><rect x="14" y="14" width="72" height="72" rx="17" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2.4"/>`;
        case 1:
          return `<polygon points="30,8 70,8 92,30 92,70 70,92 30,92 8,70 8,30" fill="${color}" opacity="0.92"/><polygon points="33,14 67,14 86,33 86,67 67,86 33,86 14,67 14,33" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2.2"/>`;
        case 2:
          return `<circle cx="50" cy="50" r="42" fill="${color}" opacity="0.92"/><circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2.4" stroke-dasharray="7 5"/>`;
        case 3:
          return `<path d="M26,8 H74 V26 H92 V74 H74 V92 H26 V74 H8 V26 H26 Z" fill="${color}" opacity="0.92"/>`;
        case 4:
          return `<polygon points="50,5 95,50 50,95 5,50" fill="${color}" opacity="0.92"/><polygon points="50,13 87,50 50,87 13,50" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2.2"/>`;
        default:
          return `<rect x="10" y="10" width="80" height="80" rx="8" fill="${color}" opacity="0.92"/><circle cx="20" cy="20" r="3.5" fill="rgba(255,255,255,0.45)"/><circle cx="80" cy="20" r="3.5" fill="rgba(255,255,255,0.45)"/><circle cx="20" cy="80" r="3.5" fill="rgba(255,255,255,0.45)"/><circle cx="80" cy="80" r="3.5" fill="rgba(255,255,255,0.45)"/>`;
      }
    }
    if (layer === 1) {
      switch (idx) {
        case 0:
          return `<polygon points="50,20 80,50 50,80 20,50" fill="${color}" stroke="rgba(0,0,0,0.34)" stroke-width="2.2"/>`;
        case 1:
          return `<polygon points="50,17 60,40 83,50 60,60 50,83 40,60 17,50 40,40" fill="${color}" stroke="rgba(0,0,0,0.34)" stroke-width="2.2"/>`;
        case 2:
          return `<rect x="25" y="25" width="50" height="50" rx="12" fill="${color}" stroke="rgba(0,0,0,0.34)" stroke-width="2.2"/>`;
        case 3:
          return `<path d="M30,22 L50,38 L70,22 L78,30 L62,50 L78,70 L70,78 L50,62 L30,78 L22,70 L38,50 L22,30 Z" fill="${color}" stroke="rgba(0,0,0,0.34)" stroke-width="2.2"/>`;
        case 4:
          return `<polygon points="50,21 76,35.5 76,64.5 50,79 24,64.5 24,35.5" fill="${color}" stroke="rgba(0,0,0,0.34)" stroke-width="2.2"/>`;
        default:
          return `<circle cx="50" cy="50" r="24" fill="none" stroke="rgba(0,0,0,0.38)" stroke-width="12"/><circle cx="50" cy="50" r="24" fill="none" stroke="${color}" stroke-width="9"/>`;
      }
    }
    switch (idx) {
      case 0:
        return `<circle cx="50" cy="50" r="12" fill="${color}" stroke="rgba(0,0,0,0.45)" stroke-width="2.2"/>`;
      case 1:
        return `<polygon points="50,35 65,50 50,65 35,50" fill="${color}" stroke="rgba(0,0,0,0.45)" stroke-width="2.2"/>`;
      case 2:
        return `<path d="M45,36 H55 V45 H64 V55 H55 V64 H45 V55 H36 V45 H45 Z" fill="${color}" stroke="rgba(0,0,0,0.45)" stroke-width="2"/>`;
      case 3:
        return `<polygon points="50,35 65,61 35,61" fill="${color}" stroke="rgba(0,0,0,0.45)" stroke-width="2.2"/>`;
      case 4:
        return `<rect x="38" y="38" width="24" height="24" rx="5" fill="${color}" stroke="rgba(0,0,0,0.45)" stroke-width="2.2"/>`;
      default:
        return `<circle cx="50" cy="50" r="11" fill="#ffffff" stroke="rgba(0,0,0,0.45)" stroke-width="2"/><circle cx="50" cy="50" r="6.5" fill="${color}"/>`;
    }
  }

  // Visual motif palettes rotated deterministically by date/seed.
  const MOTIFS = [
    {
      name: "Mosaic Jewel",
      colors: ["#e63976", "#24b576", "#7b52e3", "#f2b705", "#1fb8d4", "#ff6b35"],
    },
    {
      name: "Azulejo Lisbon",
      colors: ["#2ec4b6", "#e71d36", "#ff9f1c", "#8338ec", "#3a86ff", "#8ac926"],
    },
    {
      name: "Bauhaus Studio",
      colors: ["#f72585", "#4cc9f0", "#f8961e", "#43aa8b", "#7209b7", "#f9c74f"],
    },
    {
      name: "Kyoto Origami",
      colors: ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#9b5de5", "#ff924c"],
    },
  ];

  const els = {
    game: document.getElementById("tiles-game"),
    gate: document.getElementById("name-gate"),
    combo: document.getElementById("tiles-combo"),
    best: document.getElementById("tiles-best"),
    max: document.getElementById("tiles-max"),
    timer: document.getElementById("tiles-timer"),
    board: document.getElementById("tiles-board"),
    reset: document.getElementById("tiles-reset"),
    newGame: document.getElementById("new-game-btn"),
  };

  let state = null;
  let stopwatch = null;
  let countdownTimer = null;
  let lastPersistSecond = -1;
  let archiveCtrl = null;

  // ---------- generator & bitwise logic (from baldoalessandro/tiles_game) ----------

  function createLayer(variations, len, rand) {
    const base = Array.from({ length: len }, (_, idx) => (((idx / 2) >> 0) % variations) + 1);
    return S.shuffle(base, rand);
  }

  function generateBoard(seed) {
    const rand = S.seededRandom(seed);
    const motifIndex = Math.floor(rand() * MOTIFS.length);
    const layers = Array.from({ length: NUM_LAYERS }, (_, l) =>
      createLayer(NUM_VARIATIONS, NUM_TILES, rand).map((v) => v << (l * BITS_PER_LAYER))
    );
    const tiles = layers.reduce((acc, layer) => acc.map((v, idx) => v | layer[idx]));
    // Prevent any two identical initial tiles where possible
    return { tiles, motifIndex };
  }

  function simplifyTiles(t1, t2) {
    const commonLayerMask = ~BITMASKS.reduce((acc, mask) => {
      const tl1 = t1 & mask;
      const tl2 = t2 & mask;
      return acc ^ ((tl1 ^ tl2) === 0 ? mask : 0);
    }, 0);
    return [t1 & commonLayerMask, t2 & commonLayerMask];
  }

  function getLayers(tile) {
    return BITMASKS.map((m, idx) => (m & tile) >> (idx * BITS_PER_LAYER));
  }

  function isTileEmpty(tile) {
    return tile === 0;
  }

  // ---------- lifecycle ----------

  function setMode(mode) {
    try {
      localStorage.setItem(KEYS.mode, mode);
    } catch {
      // ignore
    }
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    els.newGame.style.visibility = mode === "practice" ? "visible" : "hidden";
  }

  function teardown() {
    if (stopwatch && state && state.tiles) {
      state.activeMs = stopwatch.stop();
      persist();
    }
    stopwatch = null;
  }

  function startDaily(dateStr) {
    teardown();
    setMode("daily");
    const date = dateStr || (state && state.date) || S.todayDateString();
    if (archiveCtrl) archiveCtrl.setDate(date);
    if (!S.getPlayerName()) {
      state = { mode: "daily", date };
      showGate();
      return;
    }
    hideGate();
    const seed = `tiles:${date}`;
    const saved = S.load(KEYS.daily(date)) || {};
    beginRound({ mode: "daily", date, seed, saved });
  }

  function startPractice(fresh) {
    teardown();
    setMode("practice");
    hideGate();
    const saved = (!fresh && S.load(KEYS.practice)) || {};
    const seed = (!fresh && saved.seed) || `tiles-practice:${Date.now()}:${Math.random()}`;
    beginRound({ mode: "practice", date: null, seed, saved: fresh ? {} : saved });
  }

  function beginRound({ mode, date, seed, saved }) {
    const generated = generateBoard(seed);
    const hasSavedTiles = Array.isArray(saved.tiles) && saved.tiles.length === NUM_TILES;
    state = {
      mode,
      date,
      seed,
      motifIndex: generated.motifIndex,
      initialTiles: generated.tiles.slice(),
      tiles: hasSavedTiles ? saved.tiles.slice() : generated.tiles.slice(),
      selected: Number.isInteger(saved.selected) ? saved.selected : null,
      lastError: null,
      combo: Number.isInteger(saved.combo) ? saved.combo : 0,
      bestCombo: Number.isInteger(saved.bestCombo) ? saved.bestCombo : 0,
      errors: Number.isInteger(saved.errors) ? saved.errors : 0,
      started: !!saved.started,
      activeMs: saved.activeMs || 0,
      over: !!saved.over,
      submitted: !!saved.submitted,
    };

    stopwatch = S.createStopwatch(state.activeMs, onTick);
    els.timer.textContent = S.formatTimer(state.activeMs);
    els.timer.classList.toggle("hidden", !state.started);
    els.max.textContent = String(MAX_COMBO);

    buildBoardDOM();
    render();
    persist();

    if (state.started && !state.over) stopwatch.start();
    if (state.over) {
      if (mode === "daily" && !state.submitted) submitResult();
      showResult();
    }
  }

  function onTick(ms) {
    state.activeMs = ms;
    els.timer.textContent = S.formatTimer(ms);
    const sec = Math.floor(ms / 1000);
    if (sec !== lastPersistSecond) {
      lastPersistSecond = sec;
      persist();
    }
  }

  function ensureStarted() {
    if (!state.started) {
      state.started = true;
      els.timer.classList.remove("hidden");
    }
    if (stopwatch && !stopwatch.running && !state.over) stopwatch.start();
  }

  function persist() {
    if (!state || !state.tiles) return;
    const cleared = state.tiles.filter(isTileEmpty).length;
    const data = {
      seed: state.seed,
      tiles: state.tiles,
      selected: state.selected,
      combo: state.combo,
      bestCombo: state.bestCombo,
      errors: state.errors,
      cleared,
      started: state.started,
      activeMs: state.activeMs,
      over: state.over,
      won: state.over,
      submitted: state.submitted,
    };
    if (state.mode === "daily") S.save(KEYS.daily(state.date), data);
    else S.save(KEYS.practice, data);
  }

  function showGate() {
    els.game.classList.add("hidden");
    els.gate.classList.remove("hidden");
    document.getElementById("gate-name-input").value = "";
  }

  function hideGate() {
    els.game.classList.remove("hidden");
    els.gate.classList.add("hidden");
  }

  // ---------- interaction ----------

  function selectTile(idx) {
    if (!state || state.over) return;
    const targetVal = state.tiles[idx];

    // Clicking the currently selected tile deselects it (unless empty).
    if (state.selected === idx) {
      if (!isTileEmpty(targetVal)) {
        state.selected = null;
        render();
        persist();
      }
      return;
    }

    // Cannot select an empty tile directly.
    if (isTileEmpty(targetVal)) return;

    ensureStarted();

    if (state.selected !== null) {
      const prevIdx = state.selected;
      const prevVal = state.tiles[prevIdx];

      if (isTileEmpty(prevVal)) {
        // Free hop from an emptied tile!
        state.selected = idx;
        state.lastError = null;
        render();
        persist();
        return;
      }

      const [next1, next2] = simplifyTiles(prevVal, targetVal);
      const matched = prevVal !== next1;

      if (matched) {
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.tiles[prevIdx] = next1;
        state.tiles[idx] = next2;
        state.selected = idx;
        state.lastError = null;

        if (state.tiles.every(isTileEmpty)) {
          state.over = true;
          state.selected = null;
          if (stopwatch) state.activeMs = stopwatch.stop();
          render();
          persist();
          if (state.mode === "daily" && !state.submitted) submitResult();
          setTimeout(showResult, 350);
          return;
        }
      } else {
        state.combo = 0;
        state.errors += 1;
        state.selected = idx;
        state.lastError = idx;
        S.showToast("No matching layer — combo reset");
      }
    } else {
      state.selected = idx;
      state.lastError = null;
    }

    render();
    persist();
  }

  function restartBoard() {
    if (!state || state.over) return;
    state.tiles = state.initialTiles.slice();
    state.selected = null;
    state.lastError = null;
    state.combo = 0;
    render();
    persist();
  }

  // ---------- rendering ----------

  function buildBoardDOM() {
    els.board.innerHTML = "";
    for (let i = 0; i < NUM_TILES; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tiles-cell";
      btn.dataset.idx = String(i);
      btn.setAttribute("aria-label", `Tile ${i + 1}`);
      btn.addEventListener("click", () => selectTile(i));
      els.board.appendChild(btn);
    }
  }

  function render() {
    if (!state || !state.tiles) return;
    els.combo.textContent = String(state.combo);
    els.best.textContent = String(state.bestCombo);

    const motif = MOTIFS[state.motifIndex % MOTIFS.length];
    const cells = els.board.querySelectorAll(".tiles-cell");
    cells.forEach((btn, i) => {
      const val = state.tiles[i];
      const empty = isTileEmpty(val);
      const isSel = state.selected === i;
      const isErr = state.lastError === i;

      btn.classList.toggle("selected", isSel && !empty);
      btn.classList.toggle("selected-empty", isSel && empty);
      btn.classList.toggle("empty", empty);
      btn.classList.toggle("shake", isErr);

      const layers = getLayers(val);
      let svgInner = "";
      layers.forEach((v, l) => {
        if (v > 0) {
          const color = motif.colors[(v - 1) % motif.colors.length];
          svgInner += `<g class="tiles-layer l${l}">${renderLayerShape(l, v, color)}</g>`;
        }
      });

      const badge = isSel && empty ? `<span class="tiles-hop">Hop anywhere</span>` : "";
      btn.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${svgInner}</svg>${badge}`;
    });
  }

  // ---------- results & leaderboard ----------

  async function submitResult() {
    const name = S.getPlayerName();
    if (!name || state.mode !== "daily" || !state.over) return;
    try {
      await S.postJSON("/api/tiles/score", {
        name,
        date: state.date,
        bestCombo: state.bestCombo,
        maxCombo: MAX_COMBO,
        errors: state.errors,
        timeMs: Math.round(state.activeMs),
      });
      state.submitted = true;
      persist();
    } catch {
      // retry on next load
    }
  }

  function shareText() {
    const perfect = state.errors === 0 && state.bestCombo >= MAX_COMBO;
    const head =
      state.mode === "daily"
        ? `Tiley ${state.date} · ${ state.bestCombo }/${MAX_COMBO} combo${perfect ? " ★" : ""}`
        : `Tiley (practice) · ${state.bestCombo}/${MAX_COMBO} combo`;
    return `${head}\nTime: ${S.formatTimer(state.activeMs)} · Misses: ${state.errors}`;
  }

  function showResult() {
    const perfect = state.errors === 0 && state.bestCombo >= MAX_COMBO;
    document.getElementById("result-title").textContent = perfect ? "Perfect! ★" : "Board Cleared!";
    document.getElementById("result-text").textContent = perfect
      ? `Unbroken ${MAX_COMBO}-chain combo with zero misses!`
      : `Cleared all 30 tiles with a best combo of ${state.bestCombo}/${MAX_COMBO}.`;
    document.getElementById("result-stats").innerHTML = `
      <div class="result-stat">
        <span class="result-stat-label">Best Combo</span>
        <span class="result-stat-value">${state.bestCombo}/${MAX_COMBO}${perfect ? " ★" : ""}</span>
      </div>
      <div class="result-stat">
        <span class="result-stat-label">Misses</span>
        <span class="result-stat-value">${state.errors}</span>
      </div>
      <div class="result-stat">
        <span class="result-stat-label">Time</span>
        <span class="result-stat-value">${S.formatTimer(state.activeMs)}</span>
      </div>`;

    const cd = document.getElementById("result-countdown");
    const again = document.getElementById("play-again-btn");
    if (countdownTimer) clearInterval(countdownTimer);
    if (state.mode === "daily") {
      const tick = () => (cd.textContent = S.formatCountdown(S.msUntilNextMidnight(), "board"));
      tick();
      cd.classList.remove("hidden");
      again.classList.add("hidden");
      countdownTimer = setInterval(tick, 30000);
    } else {
      cd.classList.add("hidden");
      again.classList.remove("hidden");
      again.onclick = () => {
        S.closeModal("result-modal");
        startPractice(true);
      };
    }
    S.openModal("result-modal");
  }

  document.getElementById("share-btn").addEventListener("click", async () => {
    const text = shareText();
    try {
      await navigator.clipboard.writeText(text);
      S.showToast("Copied to clipboard");
    } catch {
      window.prompt("Copy your results:", text);
    }
  });

  let lbView = "today";
  let lbData = null;

  function renderLeaderboard() {
    const content = document.getElementById("leaderboard-content");
    if (!lbData) return;
    const t = (ms) => (Number.isFinite(ms) ? S.formatTimer(ms) : "—");
    const e = S.escapeHtml;
    if (lbView === "today") {
      S.renderTable(
        content,
        lbData.today,
        [
          { label: "Player", value: (r) => e(r.name) },
          { label: "Best Combo", value: (r) => `${r.bestCombo}/${r.maxCombo}${r.errors === 0 && r.bestCombo >= r.maxCombo ? " ★" : ""}` },
          { label: "Misses", value: (r) => r.errors },
          { label: "Time", value: (r) => t(r.timeMs) },
        ],
        "Nobody has finished today's Tiley board yet — be the first!"
      );
    } else {
      S.renderTable(
        content,
        lbData.overall,
        [
          { label: "Player", value: (r) => e(r.name) },
          { label: "Cleared", value: (r) => r.solved },
          { label: "Perfect ★", value: (r) => r.perfect },
          { label: "Avg Combo", value: (r) => r.avgCombo ?? "—" },
          { label: "Best Time", value: (r) => t(r.bestTimeMs) },
          { label: "Streak", value: (r) => r.currentStreak },
          { label: "Best", value: (r) => r.maxStreak },
        ],
        "No games yet — be the first!"
      );
    }
  }

  async function loadLeaderboard() {
    const content = document.getElementById("leaderboard-content");
    content.innerHTML = '<p class="lb-status">Loading…</p>';
    try {
      const d = (state && state.date) || S.todayDateString();
      lbData = await S.getJSON(`/api/tiles/leaderboard?date=${d}`);
      renderLeaderboard();
    } catch {
      content.innerHTML = '<p class="lb-status">Leaderboard unavailable right now.</p>';
    }
  }

  document.getElementById("leaderboard-btn").addEventListener("click", () => {
    S.openModal("leaderboard-modal");
    loadLeaderboard();
  });

  document.querySelectorAll(".lb-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      lbView = btn.dataset.lbView;
      document.querySelectorAll(".lb-tab").forEach((b) => b.classList.toggle("active", b === btn));
      renderLeaderboard();
    });
  });

  document.getElementById("help-btn").addEventListener("click", () => S.openModal("help-modal"));
  els.reset.addEventListener("click", restartBoard);

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state && btn.dataset.mode === state.mode) return;
      if (btn.dataset.mode === "daily") startDaily();
      else startPractice(false);
    });
  });

  els.newGame.addEventListener("click", () => {
    if (state && state.mode === "practice") startPractice(true);
  });

  S.initShell({
    onNameSaved() {
      if (state && state.mode === "daily" && !els.gate.classList.contains("hidden")) startDaily(state.date);
    },
  });
  if (S.initArchive) {
    archiveCtrl = S.initArchive({
      getStatus(d) {
        const s = S.load(KEYS.daily(d));
        if (!s || (!s.started && !s.over)) return { state: "none", detail: d };
        if (!s.over) return { state: "progress", detail: `${s.cleared || 0}/30 cleared` };
        return {
          state: "won",
          detail: `${s.bestCombo || 0}/${MAX_COMBO} combo${s.errors === 0 && s.bestCombo >= MAX_COMBO ? " ★" : ""}`,
        };
      },
      onSelectDate(d) {
        startDaily(d);
      },
    });
  }
  S.wireNameGate(() => startDaily(state && state.date));

  let startMode = "daily";
  try {
    startMode = localStorage.getItem(KEYS.mode) === "practice" ? "practice" : "daily";
  } catch {
    // ignore
  }
  if (startMode === "practice") startPractice(false);
  else startDaily();
})();
