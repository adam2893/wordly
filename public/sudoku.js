// Sudoky (/sudoku) - Daily & Practice Sudoku with Easy/Medium/Hard tiers,
// pencil-mark notes, conflict highlighting, undo, hints, and leaderboards.
// Puzzle bank ported from TN1ck/super-sudoku.
(() => {
  "use strict";

  const S = Shared;
  const BANK = window.SUDOKU_BANK || { easy: [], medium: [], hard: [] };

  const KEYS = {
    mode: "sudoku:mode",
    diff: "sudoku:diff",
    daily: (diff, date) => `sudoku:daily:${diff}:${date}`,
    practice: (diff) => `sudoku:practice:${diff}`,
  };

  const DIFF_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };

  const els = {
    game: document.getElementById("sudoku-game"),
    gate: document.getElementById("name-gate"),
    meta: document.getElementById("sudoku-meta"),
    timer: document.getElementById("sudoku-timer"),
    board: document.getElementById("sudoku-board"),
    numpad: document.getElementById("sudoku-numpad"),
    undo: document.getElementById("sudoku-undo"),
    erase: document.getElementById("sudoku-erase"),
    notesBtn: document.getElementById("sudoku-notes-btn"),
    notesBadge: document.getElementById("sudoku-notes-badge"),
    hint: document.getElementById("sudoku-hint"),
    newGame: document.getElementById("new-game-btn"),
  };

  let state = null;
  let stopwatch = null;
  let countdownTimer = null;
  let lastPersistSecond = -1;
  let archiveCtrl = null;
  let notesMode = false;

  // ---------- geometry helpers ----------

  function rowOf(i) {
    return (i / 9) >> 0;
  }
  function colOf(i) {
    return i % 9;
  }
  function boxOf(i) {
    return ((rowOf(i) / 3) >> 0) * 3 + ((colOf(i) / 3) >> 0);
  }
  function arePeers(a, b) {
    if (a === b) return false;
    return rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b);
  }

  function pickPuzzle(diff, seedStr) {
    const list = BANK[diff] || BANK.easy;
    const rand = S.seededRandom(`sudoku:${diff}:${seedStr}`);
    const idx = Math.floor(rand() * list.length);
    const [givensStr, solStr] = list[idx];
    const givens = Array.from(givensStr, Number);
    const solution = Array.from(solStr, Number);
    return { idx, givens, solution };
  }

  // ---------- lifecycle ----------

  function getSavedDiff() {
    try {
      const d = localStorage.getItem(KEYS.diff);
      if (d === "easy" || d === "medium" || d === "hard") return d;
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
    if (stopwatch && state && state.values) {
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
    const seed = (!fresh && saved.seed) || `practice:${Date.now()}:${Math.random()}`;
    beginRound({ mode: "practice", diff, date: null, seed, saved: fresh ? {} : saved });
  }

  function beginRound({ mode, diff, date, seed, saved }) {
    const puz = pickPuzzle(diff, seed);
    const validSaved = Array.isArray(saved.values) && saved.values.length === 81 && saved.puzzleIdx === puz.idx;

    const firstEmpty = puz.givens.findIndex((v) => v === 0);
    state = {
      mode,
      diff,
      date,
      seed,
      puzzleIdx: puz.idx,
      givens: puz.givens,
      solution: puz.solution,
      values: validSaved ? saved.values.slice() : puz.givens.slice(),
      notes: validSaved && Array.isArray(saved.notes) && saved.notes.length === 81 ? saved.notes.slice() : new Array(81).fill(0),
      hinted: validSaved && Array.isArray(saved.hinted) && saved.hinted.length === 81 ? saved.hinted.slice() : new Array(81).fill(false),
      selected: Number.isInteger(saved.selected) && saved.selected >= 0 && saved.selected < 81 ? saved.selected : (firstEmpty >= 0 ? firstEmpty : 0),
      undoStack: [],
      mistakes: Number.isInteger(saved.mistakes) ? saved.mistakes : 0,
      hints: Number.isInteger(saved.hints) ? saved.hints : 0,
      started: !!saved.started,
      activeMs: saved.activeMs || 0,
      over: !!saved.over,
      submitted: !!saved.submitted,
    };

    stopwatch = S.createStopwatch(state.activeMs, onTick);
    els.timer.textContent = S.formatTimer(state.activeMs);
    els.timer.classList.toggle("hidden", !state.started);

    buildBoardDOM();
    buildNumpadDOM();
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
    if (!state || !state.values) return;
    const filled = state.values.filter((v) => v > 0).length;
    const data = {
      seed: state.seed,
      puzzleIdx: state.puzzleIdx,
      values: state.values,
      notes: state.notes,
      hinted: state.hinted,
      selected: state.selected,
      mistakes: state.mistakes,
      hints: state.hints,
      filled,
      started: state.started,
      activeMs: state.activeMs,
      over: state.over,
      won: state.over,
      submitted: state.submitted,
    };
    if (state.mode === "daily") S.save(KEYS.daily(state.diff, state.date), data);
    else S.save(KEYS.practice(state.diff), data);
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

  // ---------- game actions ----------

  function pushUndo() {
    state.undoStack.push({
      values: state.values.slice(),
      notes: state.notes.slice(),
    });
    if (state.undoStack.length > 60) state.undoStack.shift();
  }

  function isCellLocked(i) {
    return state.givens[i] !== 0 || state.hinted[i];
  }

  function hasConflictAt(i) {
    const v = state.values[i];
    if (!v) return false;
    for (let j = 0; j < 81; j++) {
      if (j !== i && state.values[j] === v && arePeers(i, j)) return true;
    }
    return false;
  }

  function checkSolved() {
    for (let i = 0; i < 81; i++) {
      if (state.values[i] !== state.solution[i]) return false;
    }
    return true;
  }

  function finishPuzzle() {
    state.over = true;
    if (stopwatch) state.activeMs = stopwatch.stop();
    render();
    persist();
    if (state.mode === "daily" && !state.submitted) submitResult();
    setTimeout(showResult, 320);
  }

  function inputDigit(d) {
    if (!state || state.over || state.selected === null) return;
    const idx = state.selected;
    if (isCellLocked(idx)) return;

    ensureStarted();

    if (notesMode) {
      if (state.values[idx] !== 0) return;
      pushUndo();
      state.notes[idx] ^= 1 << d;
      render();
      persist();
      return;
    }

    pushUndo();
    if (state.values[idx] === d) {
      // Tapping the same number again erases it
      state.values[idx] = 0;
    } else {
      state.values[idx] = d;
      state.notes[idx] = 0;
      if (d !== state.solution[idx]) {
        state.mistakes += 1;
      } else {
        // Clear matching pencil marks in peer cells
        const bit = ~(1 << d);
        for (let j = 0; j < 81; j++) {
          if (arePeers(idx, j)) state.notes[j] &= bit;
        }
      }
    }

    if (checkSolved()) {
      finishPuzzle();
      return;
    }

    render();
    persist();
  }

  function eraseCell() {
    if (!state || state.over || state.selected === null) return;
    const idx = state.selected;
    if (isCellLocked(idx)) return;
    if (state.values[idx] === 0 && state.notes[idx] === 0) return;
    ensureStarted();
    pushUndo();
    state.values[idx] = 0;
    state.notes[idx] = 0;
    render();
    persist();
  }

  function undoMove() {
    if (!state || state.over || !state.undoStack.length) return;
    const prev = state.undoStack.pop();
    state.values = prev.values;
    state.notes = prev.notes;
    render();
    persist();
  }

  function revealHint() {
    if (!state || state.over || state.selected === null) return;
    let idx = state.selected;
    if (state.values[idx] === state.solution[idx]) {
      // Find first unsolved cell if current is already right
      const next = state.values.findIndex((v, i) => v !== state.solution[i]);
      if (next < 0) return;
      idx = next;
      state.selected = idx;
    }
    ensureStarted();
    pushUndo();
    const ans = state.solution[idx];
    state.values[idx] = ans;
    state.notes[idx] = 0;
    state.hinted[idx] = true;
    state.hints += 1;

    const bit = ~(1 << ans);
    for (let j = 0; j < 81; j++) {
      if (arePeers(idx, j)) state.notes[j] &= bit;
    }

    if (checkSolved()) {
      finishPuzzle();
      return;
    }
    render();
    persist();
  }

  function toggleNotes() {
    notesMode = !notesMode;
    els.notesBtn.classList.toggle("active-tool", notesMode);
    els.notesBtn.setAttribute("aria-pressed", String(notesMode));
    els.notesBadge.textContent = notesMode ? "On" : "Off";
  }

  function moveSelection(dr, dc) {
    if (!state || state.selected === null) return;
    const r = (rowOf(state.selected) + dr + 9) % 9;
    const c = (colOf(state.selected) + dc + 9) % 9;
    state.selected = r * 9 + c;
    render();
  }

  // ---------- DOM & rendering ----------

  function buildBoardDOM() {
    els.board.innerHTML = "";
    for (let i = 0; i < 81; i++) {
      const r = rowOf(i);
      const c = colOf(i);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sudoku-cell";
      if (c === 2 || c === 5) btn.classList.add("box-right");
      if (r === 2 || r === 5) btn.classList.add("box-bottom");
      btn.dataset.idx = String(i);
      btn.setAttribute("aria-label", `Row ${r + 1} Column ${c + 1}`);
      btn.addEventListener("click", () => {
        state.selected = i;
        render();
      });
      els.board.appendChild(btn);
    }
  }

  function buildNumpadDOM() {
    els.numpad.innerHTML = "";
    for (let d = 1; d <= 9; d++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sudoku-num-btn";
      btn.dataset.digit = String(d);
      btn.innerHTML = `<span class="num-main">${d}</span><span class="num-rem">9</span>`;
      btn.addEventListener("click", () => inputDigit(d));
      els.numpad.appendChild(btn);
    }
  }

  function render() {
    if (!state || !state.values) return;

    const diffLabel = DIFF_LABELS[state.diff] || "Easy";
    els.meta.textContent = `${diffLabel} · ${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"}${
      state.hints ? ` · ${state.hints} hint${state.hints === 1 ? "" : "s"}` : ""
    }`;
    els.undo.disabled = state.undoStack.length === 0 || state.over;

    const sel = state.selected;
    const selVal = sel !== null ? state.values[sel] : 0;

    const counts = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      const v = state.values[i];
      if (v >= 1 && v <= 9) counts[v]++;
    }

    const cells = els.board.querySelectorAll(".sudoku-cell");
    cells.forEach((cell, i) => {
      const v = state.values[i];
      const given = state.givens[i] !== 0;
      const hinted = !!state.hinted[i];
      const isSelected = i === sel;
      const isPeer = sel !== null && arePeers(i, sel);
      const isSameDigit = selVal !== 0 && v === selVal;
      const conflict = v !== 0 && (hasConflictAt(i) || (!given && v !== state.solution[i]));

      cell.classList.toggle("given", given);
      cell.classList.toggle("hinted", hinted);
      cell.classList.toggle("selected", isSelected);
      cell.classList.toggle("peer", !isSelected && isPeer);
      cell.classList.toggle("same-digit", !isSelected && isSameDigit);
      cell.classList.toggle("conflict", conflict);
      cell.classList.toggle("solved", state.over);

      if (v !== 0) {
        cell.innerHTML = `<span class="sudoku-val">${v}</span>`;
      } else {
        const mask = state.notes[i] || 0;
        if (mask === 0) {
          cell.innerHTML = "";
        } else {
          let notesHtml = '<div class="sudoku-notes">';
          for (let d = 1; d <= 9; d++) {
            const on = (mask & (1 << d)) !== 0;
            const hi = selVal === d && on;
            notesHtml += `<span class="${hi ? "hi" : ""}">${on ? d : ""}</span>`;
          }
          notesHtml += "</div>";
          cell.innerHTML = notesHtml;
        }
      }
    });

    els.numpad.querySelectorAll(".sudoku-num-btn").forEach((btn) => {
      const d = Number(btn.dataset.digit);
      const rem = Math.max(0, 9 - counts[d]);
      btn.querySelector(".num-rem").textContent = rem > 0 ? String(rem) : "✓";
      btn.classList.toggle("completed", rem === 0);
      btn.classList.toggle("active-digit", selVal === d);
    });
  }

  // ---------- results & leaderboard ----------

  async function submitResult() {
    const name = S.getPlayerName();
    if (!name || state.mode !== "daily" || !state.over) return;
    try {
      await S.postJSON("/api/sudoku/score", {
        name,
        date: state.date,
        difficulty: state.diff,
        mistakes: state.mistakes,
        hints: state.hints,
        timeMs: Math.round(state.activeMs),
      });
      state.submitted = true;
      persist();
    } catch {
      // retry on next load
    }
  }

  function shareText() {
    const clean = state.hints === 0 && state.mistakes === 0;
    const diffLabel = DIFF_LABELS[state.diff] || "Easy";
    const head =
      state.mode === "daily"
        ? `Sudoky (${diffLabel}) ${state.date} · ${S.formatTimer(state.activeMs)}${clean ? " ★" : ""}`
        : `Sudoky (${diffLabel} practice) · ${S.formatTimer(state.activeMs)}`;
    return `${head}\nMistakes: ${state.mistakes} · Hints: ${state.hints}`;
  }

  function showResult() {
    const clean = state.hints === 0 && state.mistakes === 0;
    const diffLabel = DIFF_LABELS[state.diff] || "Easy";
    document.getElementById("result-title").textContent = clean ? "Flawless Solve! ★" : "Sudoku Solved!";
    document.getElementById("result-text").textContent = `${diffLabel} puzzle completed in ${S.formatTimer(state.activeMs)}.`;
    document.getElementById("result-stats").innerHTML = `
      <div class="result-stat">
        <span class="result-stat-label">Time</span>
        <span class="result-stat-value">${S.formatTimer(state.activeMs)}</span>
      </div>
      <div class="result-stat">
        <span class="result-stat-label">Mistakes</span>
        <span class="result-stat-value">${state.mistakes}</span>
      </div>
      <div class="result-stat">
        <span class="result-stat-label">Hints</span>
        <span class="result-stat-value">${state.hints === 0 ? "0 ★" : state.hints}</span>
      </div>`;

    const cd = document.getElementById("result-countdown");
    const again = document.getElementById("play-again-btn");
    if (countdownTimer) clearInterval(countdownTimer);
    if (state.mode === "daily") {
      const tick = () => (cd.textContent = S.formatCountdown(S.msUntilNextMidnight(), "puzzle"));
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
  let lbDiff = "easy";
  let lbData = null;

  function renderLeaderboard() {
    const content = document.getElementById("leaderboard-content");
    if (!lbData) return;
    const t = (ms) => (Number.isFinite(ms) ? S.formatTimer(ms) : "—");
    const e = S.escapeHtml;
    const diffLabel = DIFF_LABELS[lbDiff] || "Easy";
    if (lbView === "today") {
      S.renderTable(
        content,
        lbData.today,
        [
          { label: "Player", value: (r) => e(r.name) },
          { label: "Time", value: (r) => t(r.timeMs) },
          { label: "Mistakes", value: (r) => r.mistakes },
          { label: "Hints", value: (r) => (r.hints === 0 ? "0 ★" : r.hints) },
        ],
        `Nobody has finished today's ${diffLabel} Sudoku yet — be the first!`
      );
    } else {
      S.renderTable(
        content,
        lbData.overall,
        [
          { label: "Player", value: (r) => e(r.name) },
          { label: "Solved", value: (r) => r.solved },
          { label: "Flawless ★", value: (r) => r.flawless },
          { label: "Best Time", value: (r) => t(r.bestTimeMs) },
          { label: "Avg Time", value: (r) => t(r.avgTimeMs) },
          { label: "Streak", value: (r) => r.currentStreak },
          { label: "Best", value: (r) => r.maxStreak },
        ],
        `No ${diffLabel} games recorded yet — be the first!`
      );
    }
  }

  async function loadLeaderboard() {
    const content = document.getElementById("leaderboard-content");
    content.innerHTML = '<p class="lb-status">Loading…</p>';
    try {
      const d = (state && state.date) || S.todayDateString();
      lbData = await S.getJSON(`/api/sudoku/leaderboard?date=${d}&difficulty=${lbDiff}`);
      renderLeaderboard();
    } catch {
      content.innerHTML = '<p class="lb-status">Leaderboard unavailable right now.</p>';
    }
  }

  document.getElementById("leaderboard-btn").addEventListener("click", () => {
    lbDiff = (state && state.diff) || getSavedDiff();
    document.querySelectorAll(".lb-diff-tab").forEach((b) => b.classList.toggle("active", b.dataset.lbDiff === lbDiff));
    S.openModal("leaderboard-modal");
    loadLeaderboard();
  });

  document.querySelectorAll(".lb-view-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      lbView = btn.dataset.lbView;
      document.querySelectorAll(".lb-view-tab").forEach((b) => b.classList.toggle("active", b === btn));
      renderLeaderboard();
    });
  });

  document.querySelectorAll(".lb-diff-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      lbDiff = btn.dataset.lbDiff;
      document.querySelectorAll(".lb-diff-tab").forEach((b) => b.classList.toggle("active", b === btn));
      loadLeaderboard();
    });
  });

  // ---------- controls & keyboard ----------

  document.getElementById("help-btn").addEventListener("click", () => S.openModal("help-modal"));
  els.undo.addEventListener("click", undoMove);
  els.erase.addEventListener("click", eraseCell);
  els.notesBtn.addEventListener("click", toggleNotes);
  els.hint.addEventListener("click", revealHint);

  document.querySelectorAll(".len-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextDiff = btn.dataset.diff;
      if (state && nextDiff === state.diff) return;
      if (state && state.mode === "practice") startPractice(false, nextDiff);
      else startDaily(state && state.date, nextDiff);
    });
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state && btn.dataset.mode === state.mode) return;
      if (btn.dataset.mode === "daily") startDaily(state && state.date);
      else startPractice(false);
    });
  });

  els.newGame.addEventListener("click", () => {
    if (state && state.mode === "practice") startPractice(true);
  });

  document.addEventListener("keydown", (e) => {
    if (S.anyModalOpen() || !state || state.over || !els.gate.classList.contains("hidden")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      inputDigit(Number(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      e.preventDefault();
      eraseCell();
    } else if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      toggleNotes();
    } else if (e.key === "u" || e.key === "U" || e.key === "z" || e.key === "Z") {
      e.preventDefault();
      undoMove();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1, 0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1, 0);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveSelection(0, -1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveSelection(0, 1);
    }
  });

  S.initShell({
    onNameSaved() {
      if (state && state.mode === "daily" && !els.gate.classList.contains("hidden")) {
        startDaily(state.date, state.diff);
      }
    },
  });
  archiveCtrl = S.initArchive({
    getStatus(d) {
      const diff = (state && state.diff) || getSavedDiff();
      const s = S.load(KEYS.daily(diff, d));
      if (!s || (!s.started && !s.over)) return { state: "none", detail: `${DIFF_LABELS[diff]} · ${d}` };
      if (!s.over) return { state: "progress", detail: `${DIFF_LABELS[diff]} · ${s.filled || 0}/81` };
      return {
        state: "won",
        detail: `${DIFF_LABELS[diff]} · ${S.formatTimer(s.activeMs || 0)}${!s.hints && !s.mistakes ? " ★" : ""}`,
      };
    },
    onSelectDate(d) {
      startDaily(d, state && state.diff);
    },
  });
  S.wireNameGate(() => startDaily(state && state.date, state && state.diff));

  let startMode = "daily";
  try {
    startMode = localStorage.getItem(KEYS.mode) === "practice" ? "practice" : "daily";
  } catch {
    // ignore
  }
  if (startMode === "practice") startPractice(false);
  else startDaily();
})();
