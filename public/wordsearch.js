// Searchy (/wordsearch): Daily & Practice Word Search with Easy (8x8),
// Medium (10x10), and Hard (12x12) grids, straight-line drag or tap-start/tap-end
// selection, colorful highlight pills, offline deterministic generator,
// missed-days archive, and shared leaderboards.
(() => {
  "use strict";

  const S = window.Shared;
  const THEMES = window.WORDSEARCH_THEMES || [];
  const EPOCH = window.WORDSEARCH_EPOCH || "2026-11-02";

  const DIFF_CONFIG = {
    easy: { label: "Easy", size: 8, wordCount: 6, maxWordLen: 7 },
    medium: { label: "Medium", size: 10, wordCount: 8, maxWordLen: 9 },
    hard: { label: "Hard", size: 12, wordCount: 10, maxWordLen: 11 },
  };

  const PILL_COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ec4899",
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
    "#14b8a6",
    "#eab308",
    "#6366f1",
  ];

  const KEYS = {
    mode: "wordsearch:mode",
    diff: "wordsearch:diff",
    daily: (diff, date) => `wordsearch:daily:${diff}:${date}`,
    practice: (diff) => `wordsearch:practice:${diff}`,
  };

  const DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, -1],
    [-1, 1],
  ];

  const els = {
    gate: document.getElementById("name-gate"),
    game: document.getElementById("ws-game"),
    themeTitle: document.getElementById("ws-theme-title"),
    progress: document.getElementById("ws-progress"),
    timer: document.getElementById("ws-timer"),
    preview: document.getElementById("ws-selection-preview"),
    boardWrap: document.getElementById("ws-board-wrap"),
    svg: document.getElementById("ws-svg"),
    board: document.getElementById("ws-board"),
    wordlist: document.getElementById("ws-wordlist"),
    hintBtn: document.getElementById("ws-hint"),
    newGame: document.getElementById("new-game-btn"),
  };

  let state = null;
  let stopwatch = null;
  let countdownTimer = null;
  let lastPersistSecond = -1;
  let archiveCtrl = null;
  let dragState = null;
  let tapStartIdx = null;

  // ---------- deterministic offline word search generator ----------

  function generateBoard(diff, seedStr) {
    const cfg = DIFF_CONFIG[diff] || DIFF_CONFIG.easy;
    const size = cfg.size;
    const rand = S.seededRandom(`wordsearch:${diff}:${seedStr}`);

    const themeIdx = Math.floor(rand() * Math.max(1, THEMES.length));
    const theme = THEMES[themeIdx] || {
      title: "Classic Words",
      words: ["PLANET", "GALAXY", "COMET", "ORBIT", "METEOR", "SATURN", "ROCKET", "COSMOS", "STAR", "LUNAR"],
    };

    const candidates = S.shuffle(
      theme.words.filter((w) => w.length >= 4 && w.length <= cfg.maxWordLen && w.length <= size),
      rand
    );
    // Sort longer words first for higher packing density, with slight randomness
    const chosenPool = candidates.slice(0, cfg.wordCount + 6).sort((a, b) => b.length - a.length);

    const grid = new Array(size * size).fill("");
    const placed = [];

    for (const word of chosenPool) {
      if (placed.length >= cfg.wordCount) break;
      // Avoid placing a word that is a substring of an already placed word
      if (placed.some((p) => p.word.includes(word) || word.includes(p.word))) continue;

      let bestPlacement = null;
      let bestOverlaps = -1;

      const dirs = S.shuffle(DIRS, rand);
      const starts = S.shuffle(
        Array.from({ length: size * size }, (_, i) => i),
        rand
      );

      for (const startIdx of starts) {
        const sr = (startIdx / size) >> 0;
        const sc = startIdx % size;
        for (const [dr, dc] of dirs) {
          const er = sr + dr * (word.length - 1);
          const ec = sc + dc * (word.length - 1);
          if (er < 0 || er >= size || ec < 0 || ec >= size) continue;

          let overlaps = 0;
          let ok = true;
          const cells = [];
          for (let k = 0; k < word.length; k++) {
            const r = sr + dr * k;
            const c = sc + dc * k;
            const idx = r * size + c;
            const existing = grid[idx];
            if (existing !== "" && existing !== word[k]) {
              ok = false;
              break;
            }
            if (existing === word[k]) overlaps++;
            cells.push(idx);
          }
          if (!ok) continue;
          if (overlaps > bestOverlaps) {
            bestOverlaps = overlaps;
            bestPlacement = { word, start: startIdx, end: er * size + ec, cells };
            if (overlaps >= 2) break;
          }
        }
        if (bestOverlaps >= 2) break;
      }

      if (bestPlacement) {
        for (let k = 0; k < word.length; k++) {
          grid[bestPlacement.cells[k]] = word[k];
        }
        placed.push(bestPlacement);
      }
    }

    // Fill remaining empty squares with weighted letters drawn from the theme
    const fillerAlphabet = "EARIOTNSLCUDPMHGBFYWKVXZJQ";
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === "") {
        grid[i] = fillerAlphabet[Math.floor(rand() * 20)];
      }
    }

    return {
      title: theme.title,
      size,
      grid,
      targets: placed,
    };
  }

  // ---------- lifecycle ----------

  function getSavedDiff() {
    try {
      const qDiff = new URLSearchParams(location.search).get("diff");
      if (qDiff && DIFF_CONFIG[qDiff]) return qDiff;
      const d = localStorage.getItem(KEYS.diff);
      if (d && DIFF_CONFIG[d]) return d;
    } catch {
      // ignore
    }
    return "easy";
  }

  function setDiffUI(diff) {
    try {
      localStorage.setItem(KEYS.diff, diff);
    } catch {
      // ignore
    }
    document.querySelectorAll(".len-btn").forEach((b) => b.classList.toggle("active", b.dataset.diff === diff));
  }

  function setModeUI(mode) {
    try {
      localStorage.setItem(KEYS.mode, mode);
    } catch {
      // ignore
    }
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    els.newGame.style.visibility = mode === "practice" ? "visible" : "hidden";
  }

  function teardown() {
    if (stopwatch && state && state.puzzle) {
      state.activeMs = stopwatch.stop();
      persist();
    }
    stopwatch = null;
  }

  function startDaily(dateStr, diffOverride) {
    teardown();
    const diff = diffOverride || (state && state.diff) || getSavedDiff();
    const date = dateStr || (state && state.date) || S.todayDateString();
    setDiffUI(diff);
    setModeUI("daily");
    if (archiveCtrl) archiveCtrl.setDate(date);

    if (!S.getPlayerName()) {
      state = { mode: "daily", diff, date };
      showGate();
      return;
    }
    hideGate();
    const saved = S.load(KEYS.daily(diff, date)) || {};
    beginRound({ mode: "daily", diff, date, seed: date, saved });
  }

  function startPractice(fresh, diffOverride) {
    teardown();
    const diff = diffOverride || (state && state.diff) || getSavedDiff();
    setDiffUI(diff);
    setModeUI("practice");
    hideGate();
    const saved = (!fresh && S.load(KEYS.practice(diff))) || {};
    const seed = (!fresh && saved.seed && !saved.over) ? saved.seed : `practice:${Date.now()}:${Math.random()}`;
    beginRound({ mode: "practice", diff, date: null, seed, saved: fresh ? {} : saved });
  }

  function beginRound({ mode, diff, date, seed, saved }) {
    const puzzle = generateBoard(diff, seed);
    const validFound = Array.isArray(saved.found)
      ? saved.found.filter((w) => puzzle.targets.some((t) => t.word === w))
      : [];

    tapStartIdx = null;
    dragState = null;

    state = {
      mode,
      diff,
      date,
      seed,
      puzzle,
      found: validFound,
      hints: Number.isInteger(saved.hints) && saved.hints >= 0 ? saved.hints : 0,
      hintedWord: saved.hintedWord || null,
      started: !!saved.started || validFound.length > 0,
      activeMs: saved.activeMs || 0,
      over: !!saved.over || validFound.length === puzzle.targets.length,
      submitted: !!saved.submitted,
    };

    stopwatch = S.createStopwatch(state.activeMs, onTick);
    els.timer.textContent = S.formatTimer(state.activeMs);
    els.timer.classList.toggle("hidden", !state.started);
    els.themeTitle.textContent = puzzle.title;

    buildBoardDOM();
    render();
    persist();

    if (state.started && !state.over) stopwatch.start();
    if (state.over) {
      if (mode === "daily" && !state.submitted) submitScore();
      showResultModal();
    }
  }

  function onTick(ms) {
    state.activeMs = ms;
    els.timer.textContent = S.formatTimer(ms);
    const s = Math.floor(ms / 1000);
    if (s !== lastPersistSecond) {
      lastPersistSecond = s;
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
    if (!state || !state.puzzle) return;
    const payload = {
      seed: state.seed,
      found: state.found,
      total: state.puzzle.targets.length,
      hints: state.hints,
      hintedWord: state.hintedWord,
      started: state.started,
      activeMs: state.activeMs,
      over: state.over,
      won: state.over,
      submitted: state.submitted,
    };
    if (state.mode === "daily") S.save(KEYS.daily(state.diff, state.date), payload);
    else S.save(KEYS.practice(state.diff), payload);
  }

  function showGate() {
    els.game.classList.add("hidden");
    els.gate.classList.remove("hidden");
    document.getElementById("gate-name-input").value = "";
  }

  function hideGate() {
    els.gate.classList.add("hidden");
    els.game.classList.remove("hidden");
  }

  // ---------- straight-line ray math ----------

  function computeLineCells(startIdx, endIdx) {
    const size = state.puzzle.size;
    const r0 = (startIdx / size) >> 0;
    const c0 = startIdx % size;
    const r1 = (endIdx / size) >> 0;
    const c1 = endIdx % size;
    const dr = r1 - r0;
    const dc = c1 - c0;
    if (dr === 0 && dc === 0) return [startIdx];

    const absR = Math.abs(dr);
    const absC = Math.abs(dc);
    if (dr !== 0 && dc !== 0 && absR !== absC) return null;

    const steps = Math.max(absR, absC);
    const stepR = Math.sign(dr);
    const stepC = Math.sign(dc);
    const cells = [];
    for (let k = 0; k <= steps; k++) {
      cells.push((r0 + stepR * k) * size + (c0 + stepC * k));
    }
    return cells;
  }

  function snapToNearestRayEnd(startIdx, clientX, clientY) {
    const size = state.puzzle.size;
    const rect = els.board.getBoundingClientRect();
    if (!rect.width || !rect.height) return startIdx;

    const r0 = (startIdx / size) >> 0;
    const c0 = startIdx % size;
    const cellW = rect.width / size;
    const cellH = rect.height / size;
    const x0 = rect.left + (c0 + 0.5) * cellW;
    const y0 = rect.top + (r0 + 0.5) * cellH;

    const dx = (clientX - x0) / cellW;
    const dy = (clientY - y0) / cellH;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.35) return startIdx;

    // Snap angle to nearest 45-degree increment (8 directions)
    const angle = Math.atan2(dy, dx);
    const octant = Math.round(angle / (Math.PI / 4));
    const stepC = Math.round(Math.cos((octant * Math.PI) / 4));
    const stepR = Math.round(Math.sin((octant * Math.PI) / 4));

    const projSteps = Math.max(
      0,
      Math.round(Math.max(Math.abs(dx), Math.abs(dy)))
    );

    let bestEnd = startIdx;
    for (let s = 1; s <= projSteps; s++) {
      const nr = r0 + stepR * s;
      const nc = c0 + stepC * s;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
      bestEnd = nr * size + nc;
    }
    return bestEnd;
  }

  // ---------- board rendering & SVG highlight lines ----------

  function cellCenterSvg(idx) {
    const size = state.puzzle.size;
    const r = (idx / size) >> 0;
    const c = idx % size;
    return {
      x: ((c + 0.5) / size) * 100,
      y: ((r + 0.5) / size) * 100,
    };
  }

  function buildBoardDOM() {
    const { size, grid } = state.puzzle;
    els.board.style.setProperty("--ws-size", size);
    els.board.innerHTML = "";
    for (let i = 0; i < size * size; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ws-cell";
      btn.dataset.idx = String(i);
      btn.textContent = grid[i];
      els.board.appendChild(btn);
    }
  }

  function render(activeLineCells = null) {
    if (!state || !state.puzzle) return;
    const { size, grid, targets } = state.puzzle;
    const foundSet = new Set(state.found);

    els.progress.innerHTML = `<strong>${state.found.length}</strong> / ${targets.length} found`;

    const activeSet = new Set(activeLineCells || (tapStartIdx !== null ? [tapStartIdx] : []));
    const foundCellSet = new Set();
    targets.forEach((t) => {
      if (foundSet.has(t.word)) {
        t.cells.forEach((c) => foundCellSet.add(c));
      }
    });

    const hintedTarget = state.hintedWord ? targets.find((t) => t.word === state.hintedWord) : null;
    const hintStartCell = hintedTarget && !foundSet.has(hintedTarget.word) ? hintedTarget.cells[0] : -1;

    const cells = els.board.querySelectorAll(".ws-cell");
    cells.forEach((cell) => {
      const idx = Number(cell.dataset.idx);
      cell.classList.toggle("found", foundCellSet.has(idx));
      cell.classList.toggle("active", activeSet.has(idx));
      cell.classList.toggle("hint-start", idx === hintStartCell);
    });

    // Render SVG pill lines for found words + current drag line
    const strokeW = (72 / size).toFixed(2);
    const linesHtml = [];
    targets.forEach((t, idx) => {
      if (!foundSet.has(t.word)) return;
      const p0 = cellCenterSvg(t.cells[0]);
      const p1 = cellCenterSvg(t.cells[t.cells.length - 1]);
      const color = PILL_COLORS[idx % PILL_COLORS.length];
      linesHtml.push(
        `<line class="ws-pill" x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" stroke="${color}" stroke-width="${strokeW}" />`
      );
    });

    if (activeLineCells && activeLineCells.length >= 1) {
      const p0 = cellCenterSvg(activeLineCells[0]);
      const p1 = cellCenterSvg(activeLineCells[activeLineCells.length - 1]);
      linesHtml.push(
        `<line class="ws-pill active" x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" stroke="var(--color-accent)" stroke-width="${strokeW}" />`
      );
      els.preview.textContent = activeLineCells.map((i) => grid[i]).join("");
    } else if (tapStartIdx !== null) {
      els.preview.textContent = `${grid[tapStartIdx]}… (tap end letter)`;
    } else {
      els.preview.textContent = state.over ? "All words found!" : "Drag or tap start & end letters";
    }

    els.svg.innerHTML = linesHtml.join("");

    // Render word checklist
    els.wordlist.innerHTML = targets
      .map((t, idx) => {
        const isFound = foundSet.has(t.word);
        const isHinted = state.hintedWord === t.word && !isFound;
        const color = PILL_COLORS[idx % PILL_COLORS.length];
        return `<span class="ws-word-chip${isFound ? " found" : ""}${isHinted ? " hinted" : ""}" style="${
          isFound ? `--ws-chip-color:${color}` : ""
        }">${S.escapeHtml(t.word)}</span>`;
      })
      .join("");

    els.hintBtn.disabled = state.over;
  }

  // ---------- word submission ----------

  function tryCommitSelection(cells) {
    if (!cells || cells.length < 2 || !state || state.over) return false;
    const { grid, targets } = state.puzzle;
    const forward = cells.map((i) => grid[i]).join("");
    const backward = forward.split("").reverse().join("");

    const match = targets.find(
      (t) =>
        !state.found.includes(t.word) &&
        (t.word === forward || t.word === backward) &&
        t.cells.length === cells.length &&
        (t.cells.every((c, idx) => c === cells[idx]) ||
          t.cells.every((c, idx) => c === cells[cells.length - 1 - idx]))
    );

    if (!match) return false;

    ensureStarted();
    state.found.push(match.word);
    if (state.hintedWord === match.word) state.hintedWord = null;

    if (state.found.length === targets.length) {
      state.over = true;
      if (stopwatch) state.activeMs = stopwatch.stop();
      render();
      persist();
      if (state.mode === "daily" && !state.submitted) submitScore();
      setTimeout(showResultModal, 350);
    } else {
      S.showToast(`${match.word}!`);
      render();
      persist();
    }
    return true;
  }

  function useHint() {
    if (!state || !state.puzzle || state.over) return;
    ensureStarted();
    const unfound = state.puzzle.targets.filter((t) => !state.found.includes(t.word));
    if (!unfound.length) return;
    state.hints += 1;
    const target = unfound[0];
    state.hintedWord = target.word;
    S.showToast(`Hint: look for ${target.word} (first letter highlighted)`);
    render();
    persist();
  }

  // ---------- pointer drag & tap-start/tap-end interaction ----------

  els.board.addEventListener("pointerdown", (e) => {
    if (!state || !state.puzzle || state.over) return;
    const btn = e.target.closest(".ws-cell");
    if (!btn) return;
    e.preventDefault();
    const idx = Number(btn.dataset.idx);
    ensureStarted();

    dragState = {
      pointerId: e.pointerId,
      startIdx: idx,
      currentEndIdx: idx,
      moved: false,
    };
    try {
      els.board.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    render([idx]);
  });

  els.board.addEventListener("pointermove", (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const snappedEnd = snapToNearestRayEnd(dragState.startIdx, e.clientX, e.clientY);
    if (snappedEnd !== dragState.currentEndIdx) {
      dragState.currentEndIdx = snappedEnd;
      if (snappedEnd !== dragState.startIdx) dragState.moved = true;
      const line = computeLineCells(dragState.startIdx, snappedEnd);
      render(line);
    }
  });

  function finishPointer(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const { startIdx, currentEndIdx, moved } = dragState;
    dragState = null;

    if (moved && currentEndIdx !== startIdx) {
      tapStartIdx = null;
      const line = computeLineCells(startIdx, currentEndIdx);
      if (!tryCommitSelection(line)) {
        render(null);
      }
      return;
    }

    // Tap-start / tap-end fallback for one-handed phone play
    if (tapStartIdx === null) {
      tapStartIdx = startIdx;
      render([startIdx]);
    } else if (tapStartIdx === startIdx) {
      tapStartIdx = null;
      render(null);
    } else {
      const line = computeLineCells(tapStartIdx, startIdx);
      tapStartIdx = null;
      if (!line || !tryCommitSelection(line)) {
        tapStartIdx = startIdx;
        render([startIdx]);
      }
    }
  }

  els.board.addEventListener("pointerup", finishPointer);
  els.board.addEventListener("pointercancel", () => {
    dragState = null;
    render(null);
  });

  els.hintBtn.addEventListener("click", useHint);

  // ---------- result modal & leaderboard ----------

  function buildShareText() {
    const label = DIFF_CONFIG[state.diff].label;
    const tag = state.mode === "daily" ? state.date : "Practice";
    const star = state.hints === 0 ? " ★" : ` (${state.hints} hint${state.hints === 1 ? "" : "s"})`;
    const boxes = state.puzzle.targets.map((_, i) => (i < state.found.length ? "🟩" : "⬜")).join("");
    return `Searchy (${label}) ${tag}\nTheme: "${state.puzzle.title}"\n${boxes}\nSolved in ${S.formatTimer(state.activeMs)}${star}`;
  }

  function showResultModal() {
    const label = DIFF_CONFIG[state.diff].label;
    document.getElementById("result-title").textContent = state.hints === 0 ? "Flawless Search! ★" : "All Words Found!";
    document.getElementById("result-sub").textContent = `${label} · "${state.puzzle.title}"`;
    document.getElementById("result-stats").innerHTML = `
      <div class="result-stat"><div class="result-stat-value">${S.formatTimer(state.activeMs)}</div><div class="result-stat-label">Time</div></div>
      <div class="result-stat"><div class="result-stat-value">${state.found.length}/${state.puzzle.targets.length}</div><div class="result-stat-label">Words</div></div>
      <div class="result-stat"><div class="result-stat-value">${state.hints === 0 ? "0 ★" : state.hints}</div><div class="result-stat-label">Hints</div></div>
    `;

    const cd = document.getElementById("result-countdown");
    const again = document.getElementById("play-again-btn");
    if (countdownTimer) clearInterval(countdownTimer);
    if (state.mode === "daily") {
      cd.classList.remove("hidden");
      again.classList.add("hidden");
      const update = () => {
        cd.textContent = S.formatCountdown(S.msUntilNextMidnight(), "Searchy");
      };
      update();
      countdownTimer = setInterval(update, 10000);
    } else {
      cd.classList.add("hidden");
      again.classList.remove("hidden");
    }
    S.openModal("result-modal");
  }

  document.getElementById("share-btn").addEventListener("click", () => {
    if (state) S.shareText(buildShareText());
  });
  document.getElementById("play-again-btn").addEventListener("click", () => {
    S.closeModal("result-modal");
    startPractice(true);
  });

  async function submitScore() {
    const name = S.getPlayerName();
    if (!name || state.mode !== "daily" || !state.over) return;
    try {
      await S.postJSON("/api/wordsearch/score", {
        name,
        date: state.date,
        difficulty: state.diff,
        hints: state.hints,
        timeMs: Math.round(state.activeMs || 0),
      });
      state.submitted = true;
      persist();
    } catch {
      // queued offline or retried later
    }
  }

  let lbDiff = "easy";
  let lbView = "today";
  let lbData = null;

  function renderLeaderboard() {
    const content = document.getElementById("leaderboard-content");
    if (!lbData) return;
    const e = S.escapeHtml;
    const fmt = (ms) => (ms == null ? "—" : S.formatTimer(ms));
    if (lbView === "today") {
      S.renderTable(
        content,
        lbData.today || [],
        [
          { label: "#", value: (_, i) => i + 1 },
          { label: "Player", value: (r) => e(r.name) },
          { label: "Time", value: (r) => fmt(r.timeMs) },
          { label: "Hints", value: (r) => (r.hints === 0 ? "0 ★" : r.hints) },
        ],
        `No ${DIFF_CONFIG[lbDiff].label} Searchy solves yet for this day.`
      );
    } else {
      S.renderTable(
        content,
        lbData.overall || [],
        [
          { label: "#", value: (_, i) => i + 1 },
          { label: "Player", value: (r) => e(r.name) },
          { label: "Solved", value: (r) => r.solved },
          { label: "Flawless ★", value: (r) => r.clean },
          { label: "Best", value: (r) => fmt(r.bestTimeMs) },
          { label: "Avg", value: (r) => fmt(r.avgTimeMs) },
          { label: "Streak", value: (r) => r.currentStreak },
        ],
        `No all-time ${DIFF_CONFIG[lbDiff].label} Searchy stats yet.`
      );
    }
  }

  async function fetchLeaderboard() {
    const content = document.getElementById("leaderboard-content");
    content.innerHTML = '<p class="lb-status">Loading…</p>';
    try {
      const d = (state && state.date) || S.todayDateString();
      lbData = await S.getJSON(`/api/wordsearch/leaderboard?date=${d}&difficulty=${lbDiff}`);
      renderLeaderboard();
    } catch {
      content.innerHTML = '<p class="lb-status">Leaderboard unavailable offline.</p>';
    }
  }

  document.getElementById("leaderboard-btn").addEventListener("click", () => {
    lbDiff = (state && state.diff) || "easy";
    document.querySelectorAll(".ws-diff-tab").forEach((b) => b.classList.toggle("active", b.dataset.lbDiff === lbDiff));
    S.openModal("leaderboard-modal");
    fetchLeaderboard();
  });

  document.querySelectorAll(".ws-diff-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      lbDiff = btn.dataset.lbDiff;
      document.querySelectorAll(".ws-diff-tab").forEach((b) => b.classList.toggle("active", b === btn));
      fetchLeaderboard();
    });
  });

  document.querySelectorAll(".ws-view-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      lbView = btn.dataset.lbView;
      document.querySelectorAll(".ws-view-tab").forEach((b) => b.classList.toggle("active", b === btn));
      renderLeaderboard();
    });
  });

  document.getElementById("help-btn").addEventListener("click", () => S.openModal("help-modal"));
  els.newGame.addEventListener("click", () => state && state.mode === "practice" && startPractice(true));

  document.querySelectorAll(".len-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = btn.dataset.diff;
      if (state && state.diff === d) return;
      if (state && state.mode === "practice") startPractice(false, d);
      else startDaily(state && state.date, d);
    });
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.mode;
      if (state && state.mode === m) return;
      if (m === "daily") startDaily();
      else startPractice(false);
    });
  });

  S.initShell({
    onNameSaved() {
      if (state && state.mode === "daily" && !els.gate.classList.contains("hidden")) startDaily(state.date, state.diff);
    },
  });
  S.wireNameGate(() => startDaily(state && state.date, state && state.diff));

  if (S.initArchive) {
    archiveCtrl = S.initArchive({
      epoch: EPOCH,
      getStatus(d) {
        const diff = (state && state.diff) || getSavedDiff();
        const s = S.load(KEYS.daily(diff, d));
        if (!s || (!s.started && !s.over)) return { state: "none", detail: `${DIFF_CONFIG[diff].label} · ${d}` };
        if (s.over) return { state: "won", detail: `${S.formatTimer(s.activeMs || 0)}${s.hints ? "" : " ★"}` };
        return { state: "progress", detail: `${(s.found || []).length}/${s.total || ""} found` };
      },
      onSelectDate(d) {
        startDaily(d, state && state.diff);
      },
    });
  }

  let startMode = "daily";
  try {
    const qMode = new URLSearchParams(location.search).get("mode");
    if (qMode === "practice" || localStorage.getItem(KEYS.mode) === "practice") startMode = "practice";
  } catch {
    // ignore
  }
  if (startMode === "practice") startPractice(false);
  else startDaily();
})();
