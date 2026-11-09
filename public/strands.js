// Strandy (/strands): NYT Strands-style 6x8 daily word-trail game.
// Supports smooth mobile drag-tracing AND tap-to-trace, Spangram + theme words,
// progressive hints, missed-days archive, and shared leaderboards.
(() => {
  "use strict";

  const S = window.Shared;
  const BANK = window.STRANDS_BANK || [];
  const EPOCH = window.STRANDS_EPOCH || "2026-11-02";
  const COLS = 6;
  const ROWS = 8;

  const KEYS = {
    mode: "strands:mode",
    daily: (date) => `strands:daily:${date}`,
    practice: "strands:practice",
  };

  const els = {
    gate: document.getElementById("name-gate"),
    game: document.getElementById("strands-game"),
    themeClue: document.getElementById("strands-theme-clue"),
    progress: document.getElementById("strands-progress"),
    timer: document.getElementById("daily-timer"),
    current: document.getElementById("strands-current"),
    boardWrap: document.getElementById("strands-board-wrap"),
    svg: document.getElementById("strands-svg"),
    board: document.getElementById("strands-board"),
    hintBtn: document.getElementById("strands-hint"),
    clearBtn: document.getElementById("strands-clear"),
    submitBtn: document.getElementById("strands-submit"),
    newGame: document.getElementById("new-game-btn"),
  };

  let state = null;
  let stopwatch = null;
  let countdownTimer = null;
  let lastPersistSecond = 0;
  let archiveCtrl = null;
  let dragging = null;

  function dayNumber(dateStr) {
    const t0 = Date.UTC(2026, 10, 2);
    const [y, m, d] = dateStr.split("-").map(Number);
    return Math.max(0, Math.round((Date.UTC(y, m - 1, d) - t0) / 86400000));
  }

  function puzzleIndexFor(dateStr) {
    if (!BANK.length) return 0;
    return dayNumber(dateStr) % BANK.length;
  }

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
    if (stopwatch && state && state.puzzle) {
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
    const index = puzzleIndexFor(date);
    const saved = S.load(KEYS.daily(date)) || {};
    beginRound({ mode: "daily", date, index, saved });
  }

  function startPractice(fresh) {
    teardown();
    setMode("practice");
    hideGate();
    const saved = (!fresh && S.load(KEYS.practice)) || {};
    const index =
      Number.isInteger(saved.index) && !fresh
        ? saved.index % BANK.length
        : Math.floor(Math.random() * Math.max(1, BANK.length));
    beginRound({ mode: "practice", date: null, index, saved: fresh ? {} : saved });
  }

  function beginRound({ mode, date, index, saved }) {
    const puzzle = BANK[index];
    if (!puzzle) return;
    const validWords = new Set(puzzle.words.map((w) => w.word));
    const found = (saved.found || []).filter((w) => validWords.has(w));
    const history = Array.isArray(saved.history) ? saved.history : found.map((w) => (w === puzzle.spangram ? "S" : "W"));

    state = {
      mode,
      date,
      index,
      puzzle,
      found,
      history, // "W" | "S" | "H"
      trace: [],
      hintWord: saved.hintWord && !found.includes(saved.hintWord) ? saved.hintWord : null,
      hintLevel: saved.hintWord && !found.includes(saved.hintWord) ? saved.hintLevel || 1 : 0,
      hintsUsed: saved.hintsUsed || 0,
      started: !!saved.started,
      activeMs: saved.activeMs || 0,
      over: found.length === puzzle.words.length,
      submitted: !!saved.submitted,
    };

    stopwatch = S.createStopwatch(state.activeMs, onTick);
    buildCells();
    render();
    persist();
    els.timer.textContent = S.formatTimer(state.activeMs);
    els.timer.classList.toggle("hidden", !state.started);
    if (state.started && !state.over) stopwatch.start();
    if (state.over) {
      if (mode === "daily" && !state.submitted) submitResult();
      setTimeout(showResult, 250);
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
      persist();
    }
    if (stopwatch && !stopwatch.running && !state.over) stopwatch.start();
  }

  function persist() {
    if (!state || !state.puzzle) return;
    const data = {
      found: state.found,
      total: state.puzzle.words.length,
      history: state.history,
      hintWord: state.hintWord,
      hintLevel: state.hintLevel,
      hintsUsed: state.hintsUsed,
      started: state.started,
      activeMs: state.activeMs,
      over: state.over,
      submitted: state.submitted,
    };
    if (state.mode === "daily") S.save(KEYS.daily(state.date), data);
    else S.save(KEYS.practice, { index: state.index, ...data });
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

  // ---------- grid & SVG rendering ----------

  function cellCenter(idx) {
    const r = Math.floor(idx / COLS);
    const c = idx % COLS;
    return [c * 50 + 25, r * 50 + 25];
  }

  function isAdjacent(a, b) {
    const r1 = Math.floor(a / COLS), c1 = a % COLS;
    const r2 = Math.floor(b / COLS), c2 = b % COLS;
    return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && a !== b;
  }

  function buildCells() {
    els.board.innerHTML = "";
    const grid = state.puzzle.grid;
    for (let i = 0; i < 48; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "strands-cell";
      btn.dataset.idx = String(i);
      btn.textContent = grid[i];
      els.board.appendChild(btn);
    }
  }

  function svgPolyline(indices, cls) {
    if (!indices || indices.length < 2) return "";
    const pts = indices.map((i) => cellCenter(i).join(",")).join(" ");
    return `<polyline class="strands-line ${cls}" points="${pts}" />`;
  }

  function render() {
    if (!state || !state.puzzle) return;
    els.themeClue.textContent = state.puzzle.theme;
    els.progress.textContent = `${state.found.length} / ${state.puzzle.words.length} found`;

    const foundMap = new Map(); // cellIdx -> "spangram" | "theme"
    const lines = [];
    for (const item of state.puzzle.words) {
      if (state.found.includes(item.word)) {
        const kind = item.spangram ? "spangram" : "theme";
        item.path.forEach((idx) => foundMap.set(idx, kind));
        lines.push(svgPolyline(item.path, kind));
      }
    }

    const hintItem = state.hintWord ? state.puzzle.words.find((w) => w.word === state.hintWord) : null;
    const hintSet = new Set(hintItem ? hintItem.path : []);
    if (hintItem && state.hintLevel >= 2) {
      lines.push(svgPolyline(hintItem.path, "hint-line"));
    }

    if (state.trace.length >= 2) {
      lines.push(svgPolyline(state.trace, "trace-line"));
    }
    els.svg.innerHTML = lines.join("");

    const traceSet = new Set(state.trace);
    const cells = els.board.querySelectorAll(".strands-cell");
    cells.forEach((btn, idx) => {
      const foundKind = foundMap.get(idx);
      btn.classList.toggle("found-theme", foundKind === "theme");
      btn.classList.toggle("found-spangram", foundKind === "spangram");
      btn.classList.toggle("traced", traceSet.has(idx));
      btn.classList.toggle("trace-head", state.trace.length > 0 && state.trace[state.trace.length - 1] === idx);
      btn.classList.toggle("hinted", !foundKind && hintSet.has(idx));
      btn.classList.toggle("hint-start", !foundKind && state.hintLevel >= 2 && hintItem && hintItem.path[0] === idx);
    });

    const tracedWord = state.trace.map((i) => state.puzzle.grid[i]).join("");
    if (tracedWord) {
      els.current.textContent = tracedWord;
      els.current.classList.add("active");
    } else if (state.over) {
      els.current.textContent = `All ${state.puzzle.words.length} theme words uncovered!`;
      els.current.classList.remove("active");
    } else {
      els.current.textContent = "Drag or tap letters";
      els.current.classList.remove("active");
    }

    els.clearBtn.disabled = state.over || state.trace.length === 0;
    els.submitBtn.disabled = state.over || state.trace.length < 3;
    els.hintBtn.disabled = state.over;
    els.hintBtn.textContent =
      state.hintWord && state.hintLevel === 1 ? "Show path 💡" : "Hint 💡";
  }

  // ---------- interaction ----------

  function isCellLocked(idx) {
    for (const item of state.puzzle.words) {
      if (state.found.includes(item.word) && item.path.includes(idx)) return true;
    }
    return false;
  }

  function submitTrace() {
    if (!state || state.over || state.trace.length < 3) {
      state.trace = [];
      render();
      return;
    }
    ensureStarted();
    const tracedStr = state.trace.map((i) => state.puzzle.grid[i]).join("");
    // Match either by exact path or exact word string on unfound cells
    const match = state.puzzle.words.find(
      (item) =>
        !state.found.includes(item.word) &&
        item.word === tracedStr &&
        item.path.length === state.trace.length &&
        item.path.every((c) => state.trace.includes(c))
    );

    state.trace = [];
    if (match) {
      state.found.push(match.word);
      state.history.push(match.spangram ? "S" : "W");
      if (state.hintWord === match.word) {
        state.hintWord = null;
        state.hintLevel = 0;
      }
      S.showToast(match.spangram ? `SPANGRAM! 🌟 ${match.word}` : `${match.word}!`);
      if (state.found.length === state.puzzle.words.length) {
        state.over = true;
        if (stopwatch) state.activeMs = stopwatch.stop();
        els.timer.textContent = S.formatTimer(state.activeMs);
        if (state.mode === "daily") submitResult();
        render();
        persist();
        setTimeout(showResult, 550);
        return;
      }
      render();
      persist();
    } else {
      els.current.classList.remove("shake");
      void els.current.offsetWidth;
      els.current.classList.add("shake");
      S.showToast("Not a theme word", 950);
      render();
    }
  }

  function useHint() {
    if (!state || state.over) return;
    ensureStarted();
    if (state.hintWord && !state.found.includes(state.hintWord)) {
      if (state.hintLevel < 2) {
        state.hintLevel = 2;
        state.hintsUsed++;
        state.history.push("H");
        S.showToast("Path revealed! Trace from the pulsing letter.");
        render();
        persist();
      } else {
        S.showToast("Trace the highlighted path!");
      }
      return;
    }
    const unfound = state.puzzle.words.filter((w) => !state.found.includes(w.word) && !w.spangram);
    const target = unfound[0] || state.puzzle.words.find((w) => !state.found.includes(w.word));
    if (!target) return;
    state.hintWord = target.word;
    state.hintLevel = 1;
    state.hintsUsed++;
    state.history.push("H");
    S.showToast("Theme word letters highlighted!");
    render();
    persist();
  }

  function cellAtPoint(clientX, clientY, forgiving = false) {
    const rect = els.board.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return -1;
    const cellW = rect.width / COLS;
    const cellH = rect.height / ROWS;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const c = Math.floor(relX / cellW);
    const r = Math.floor(relY / cellH);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
    if (forgiving) {
      // During a drag, require being within 42% of cell center so diagonal moves don't clip corner neighbors
      const cx = (c + 0.5) * cellW;
      const cy = (r + 0.5) * cellH;
      const dist = Math.hypot(relX - cx, relY - cy);
      if (dist > Math.min(cellW, cellH) * 0.43) return -1;
    }
    return r * COLS + c;
  }

  els.board.addEventListener("pointerdown", (e) => {
    if (!state || state.over) return;
    const idx = cellAtPoint(e.clientX, e.clientY, false);
    if (idx < 0 || isCellLocked(idx)) return;
    e.preventDefault();
    ensureStarted();

    dragging = {
      pointerId: e.pointerId,
      startIdx: idx,
      moved: false,
      wasLastInTrace: state.trace.length > 0 && state.trace[state.trace.length - 1] === idx,
    };

    try {
      els.board.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (state.trace.length === 0) {
      state.trace = [idx];
    } else {
      const last = state.trace[state.trace.length - 1];
      if (idx === last) {
        // Keep trace for tap-to-submit on pointerup if not dragged
      } else if (state.trace.length >= 2 && idx === state.trace[state.trace.length - 2]) {
        state.trace.pop();
      } else if (!state.trace.includes(idx) && isAdjacent(last, idx)) {
        state.trace.push(idx);
      } else {
        state.trace = [idx];
      }
    }
    render();
  });

  els.board.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== dragging.pointerId || !state || state.over) return;
    const idx = cellAtPoint(e.clientX, e.clientY, true);
    if (idx < 0 || idx === dragging.startIdx || isCellLocked(idx)) return;
    const last = state.trace[state.trace.length - 1];
    if (idx === last) return;
    if (state.trace.length >= 2 && idx === state.trace[state.trace.length - 2]) {
      dragging.moved = true;
      state.trace.pop();
      render();
      return;
    }
    if (!state.trace.includes(idx) && isAdjacent(last, idx)) {
      dragging.moved = true;
      state.trace.push(idx);
      render();
    }
  });

  function finishPointer(e) {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    const wasDrag = dragging.moved;
    const submitOnTap = !wasDrag && dragging.wasLastInTrace && state.trace.length >= 3;
    dragging = null;
    if ( (wasDrag && state.trace.length >= 3) || submitOnTap ) {
      submitTrace();
    }
  }

  els.board.addEventListener("pointerup", finishPointer);
  els.board.addEventListener("pointercancel", () => {
    dragging = null;
  });

  els.clearBtn.addEventListener("click", () => {
    if (!state || state.over) return;
    state.trace = [];
    render();
  });
  els.submitBtn.addEventListener("click", submitTrace);
  els.hintBtn.addEventListener("click", useHint);

  // ---------- results & leaderboard ----------

  async function submitResult() {
    const name = S.getPlayerName();
    if (!name || state.submitted || state.mode !== "daily") return;
    try {
      await S.postJSON("/api/strands/score", {
        name,
        date: state.date,
        hints: state.hintsUsed,
        timeMs: state.activeMs,
      });
      state.submitted = true;
      persist();
    } catch {
      // Retried next load
    }
  }

  function emojiForToken(tok) {
    if (tok === "S") return "🟡";
    if (tok === "H") return "💡";
    return "🔵";
  }

  function shareText() {
    const head =
      state.mode === "daily"
        ? `Strandy #${dayNumber(state.date) + 1} · "${state.puzzle.theme}"`
        : `Strandy (practice) · "${state.puzzle.theme}"`;
    const tokens = state.history.map(emojiForToken);
    const rows = [];
    for (let i = 0; i < tokens.length; i += 4) {
      rows.push(tokens.slice(i, i + 4).join(""));
    }
    return `${head}\n⏱ ${S.formatTimer(state.activeMs)}\n${rows.join("\n")}`;
  }

  function stopCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  S.onModalClose("result-modal", stopCountdown);

  function showResult() {
    const h = state.hintsUsed;
    document.getElementById("result-title").textContent =
      h === 0 ? "Flawless Strandy! 🌟" : h <= 2 ? "Great Strandy!" : "Strandy Solved!";
    document.getElementById("result-subtitle").textContent = `"${state.puzzle.theme}" · Spangram: ${state.puzzle.spangram}`;
    document.getElementById("result-grid").innerHTML = state.history
      .map((t) => `<span class="strands-em">${emojiForToken(t)}</span>`)
      .join("");

    const stat = (label, value) =>
      `<div class="result-stat"><span class="result-stat-label">${label}</span><span class="result-stat-value">${value}</span></div>`;
    document.getElementById("result-stats").innerHTML =
      stat("Words", `${state.found.length}`) +
      stat("Hints", `${h}`) +
      stat("Time", S.formatTimer(state.activeMs));

    const countdownEl = document.getElementById("result-countdown");
    const btn = document.getElementById("play-again-btn");
    stopCountdown();
    if (state.mode === "daily") {
      countdownEl.classList.remove("hidden");
      btn.classList.add("hidden");
      const tick = () => (countdownEl.textContent = S.formatCountdown(S.msUntilNextMidnight(), "puzzle"));
      tick();
      countdownTimer = setInterval(tick, 30000);
    } else {
      countdownEl.classList.add("hidden");
      btn.classList.remove("hidden");
      btn.onclick = () => {
        S.closeModal("result-modal");
        startPractice(true);
      };
    }
    S.openModal("result-modal");
  }

  document.getElementById("share-btn").addEventListener("click", () => {
    if (S.shareText) S.shareText(shareText());
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
          { label: "Hints", value: (r) => (r.hints === 0 ? "0 ★" : r.hints) },
          { label: "Time", value: (r) => t(r.timeMs) },
        ],
        "Nobody has solved today's Strandy yet — be the first!"
      );
    } else {
      S.renderTable(
        content,
        lbData.overall,
        [
          { label: "Player", value: (r) => e(r.name) },
          { label: "Solved", value: (r) => r.solved },
          { label: "No-Hint ★", value: (r) => r.clean },
          { label: "Best Time", value: (r) => t(r.bestTimeMs) },
          { label: "Avg Time", value: (r) => t(r.avgTimeMs) },
          { label: "Streak", value: (r) => r.currentStreak },
          { label: "Best", value: (r) => r.maxStreak },
        ],
        "No Strandy solves yet — be the first!"
      );
    }
  }

  async function openLeaderboard() {
    S.openModal("leaderboard-modal");
    const content = document.getElementById("leaderboard-content");
    content.innerHTML = '<p class="lb-status">Loading…</p>';
    try {
      const d = (state && state.date) || S.todayDateString();
      lbData = await S.getJSON(`/api/strands/leaderboard?date=${d}`);
      renderLeaderboard();
    } catch {
      content.innerHTML = '<p class="lb-status">Leaderboard unavailable right now.</p>';
    }
  }

  document.getElementById("leaderboard-btn").addEventListener("click", openLeaderboard);
  document.querySelectorAll(".lb-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      lbView = btn.dataset.lbView;
      document.querySelectorAll(".lb-tab").forEach((b) => b.classList.toggle("active", b === btn));
      renderLeaderboard();
    });
  });

  document.getElementById("help-btn").addEventListener("click", () => S.openModal("help-modal"));
  els.newGame.addEventListener("click", () => state && state.mode === "practice" && startPractice(true));
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.mode;
      if (state && state.mode === m) return;
      if (m === "daily") startDaily();
      else startPractice(false);
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state && state.mode === "daily" && state.date !== S.todayDateString()) {
      startDaily();
    }
  });

  S.initShell({
    onNameSaved() {
      if (state && state.mode === "daily" && !els.gate.classList.contains("hidden")) startDaily(state.date);
    },
  });
  S.wireNameGate(() => startDaily(state && state.date));

  if (S.initArchive) {
    archiveCtrl = S.initArchive({
      epoch: EPOCH,
      getStatus(d) {
        const s = S.load(KEYS.daily(d));
        if (!s || (!s.started && !s.over)) return { state: "none", detail: `"${BANK[puzzleIndexFor(d)]?.theme || d}"` };
        if (s.over) return { state: "won", detail: `Solved in ${S.formatTimer(s.activeMs || 0)}${s.hintsUsed ? "" : " ★"}` };
        return { state: "progress", detail: `${(s.found || []).length}/${s.total || 6} found` };
      },
      onSelectDate(d) {
        startDaily(d);
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
