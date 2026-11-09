(() => {
  "use strict";

  const S = Shared;

  const KEYS = {
    mode: "connections:mode",
    daily: (date) => `connections:daily:${date}`,
    practice: "connections:practice",
  };
  const MAX_MISTAKES = 4;
  const EMOJI = ["🟨", "🟩", "🟦", "🟪"];

  const els = {
    game: document.getElementById("conn-game"),
    gate: document.getElementById("name-gate"),
    label: document.getElementById("conn-label"),
    timer: document.getElementById("conn-timer"),
    board: document.getElementById("conn-board"),
    dots: document.getElementById("conn-dots"),
    submit: document.getElementById("conn-submit"),
    shuffle: document.getElementById("conn-shuffle"),
    deselect: document.getElementById("conn-deselect"),
    extra: document.getElementById("conn-extra"),
    newGame: document.getElementById("new-game-btn"),
  };

  let state = null;
  let stopwatch = null;
  let countdownTimer = null;
  let lastPersistSecond = -1;

  // ---------- puzzles ----------

  function dayNumber(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [ey, em, ed] = CONNECTIONS_EPOCH.split("-").map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
  }

  function puzzleIndexFor(dateStr) {
    const n = CONNECTIONS.length;
    return ((dayNumber(dateStr) % n) + n) % n;
  }

  // groups: [{ tier, name, words }] in difficulty order.
  function puzzleAt(index) {
    return CONNECTIONS[index].map(([name, words], tier) => ({ tier, name, words }));
  }

  function tierOf(word) {
    return state.groups.findIndex((g) => g.words.includes(word));
  }

  function guessKey(words) {
    return [...words].sort().join("|");
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
    els.extra.textContent = mode === "daily" ? "Yesterday's answers" : "Show answers";
  }

  function teardown() {
    if (stopwatch && state && state.groups) {
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
    beginRound({ mode: "daily", date, index: puzzleIndexFor(date), saved: S.load(KEYS.daily(date)) || {} });
  }

  function startPractice(fresh) {
    teardown();
    setMode("practice");
    hideGate();
    let saved = (!fresh && S.load(KEYS.practice)) || {};
    let index = Number.isInteger(saved.index) && saved.index < CONNECTIONS.length ? saved.index : null;
    if (index === null) {
      // Skip today's daily so practice never spoils it.
      const today = puzzleIndexFor(S.todayDateString());
      do index = Math.floor(Math.random() * CONNECTIONS.length);
      while (index === today && CONNECTIONS.length > 1);
      saved = {};
    }
    beginRound({ mode: "practice", date: null, index, saved });
  }

  function beginRound({ mode, date, index, saved }) {
    const groups = puzzleAt(index);
    const all = groups.flatMap((g) => g.words);
    const solved = (saved.solved || []).filter((t) => t >= 0 && t < 4);
    const remaining = all.filter((w) => !solved.some((t) => groups[t].words.includes(w)));
    const order =
      Array.isArray(saved.order) && saved.order.length === remaining.length && saved.order.every((w) => remaining.includes(w))
        ? saved.order
        : S.shuffle(remaining);
    state = {
      mode,
      date,
      index,
      groups,
      order,
      solved,
      guesses: (saved.guesses || []).filter((g) => Array.isArray(g) && g.length === 4),
      mistakes: Math.min(MAX_MISTAKES, saved.mistakes || 0),
      selected: (saved.selected || []).filter((w) => order.includes(w)),
      started: !!saved.started,
      activeMs: saved.activeMs || 0,
      over: !!saved.over,
      won: !!saved.won,
      submitted: !!saved.submitted,
    };
    stopwatch = S.createStopwatch(state.activeMs, onTick);
    els.timer.textContent = S.formatTimer(state.activeMs);
    els.timer.classList.toggle("hidden", !state.started);
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
    if (!stopwatch.running && !state.over) stopwatch.start();
  }

  function persist() {
    if (!state || !state.groups) return;
    const data = {
      order: state.order,
      solved: state.solved,
      guesses: state.guesses,
      mistakes: state.mistakes,
      selected: state.selected,
      started: state.started,
      activeMs: state.activeMs,
      over: state.over,
      won: state.won,
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

  // ---------- rendering ----------

  function groupBar(group, extraClass = "") {
    const e = S.escapeHtml;
    return `<div class="conn-group t${group.tier} ${extraClass}">
      <span class="conn-group-name">${e(group.name)}</span>
      <span class="conn-group-words">${group.words.map(e).join(", ")}</span>
    </div>`;
  }

  function render(justSolved = -1) {
    const bars = state.solved.map((t) => groupBar(state.groups[t], t === justSolved ? "pop" : ""));
    // After a loss, reveal the groups that weren't found.
    if (state.over && !state.won) {
      state.groups
        .filter((g) => !state.solved.includes(g.tier))
        .forEach((g) => bars.push(groupBar(g, "revealed")));
    }
    const tiles = state.over
      ? []
      : state.order.map((w) => {
          const sel = state.selected.includes(w) ? " selected" : "";
          const len = Math.max(...w.split(/[ -]/).map((p) => p.length));
          return `<button class="conn-tile${sel}" data-word="${S.escapeHtml(w)}" style="--len:${Math.max(len, 5)}">${S.escapeHtml(w)}</button>`;
        });
    els.board.innerHTML = bars.join("") + tiles.join("");

    const left = MAX_MISTAKES - state.mistakes;
    els.dots.innerHTML = Array.from({ length: MAX_MISTAKES }, (_, i) => `<span class="conn-dot${i < left ? "" : " used"}"></span>`).join("");
    els.dots.setAttribute("aria-label", `${left} mistakes remaining`);

    els.submit.disabled = state.over || state.selected.length !== 4;
    els.deselect.disabled = state.over || !state.selected.length;
    els.shuffle.disabled = state.over;
    els.label.textContent = state.over
      ? state.won
        ? "Solved!"
        : "Next time!"
      : state.mode === "daily"
      ? `Puzzle #${dayNumber(state.date) + 1} · Create four groups of four!`
      : `Practice #${state.index + 1} · Create four groups of four!`;
  }

  // ---------- input ----------

  function toggleWord(word) {
    if (!state || state.over) return;
    const i = state.selected.indexOf(word);
    if (i >= 0) state.selected.splice(i, 1);
    else if (state.selected.length < 4) state.selected.push(word);
    else return;
    ensureStarted();
    render();
    persist();
  }

  function shakeSelected() {
    state.selected.forEach((w) => {
      const tile = els.board.querySelector(`.conn-tile[data-word="${CSS.escape(w)}"]`);
      if (!tile) return;
      tile.classList.remove("shake");
      void tile.offsetWidth;
      tile.classList.add("shake");
    });
  }

  function submitGuess() {
    if (!state || state.over || state.selected.length !== 4) return;
    const key = guessKey(state.selected);
    if (state.guesses.some((g) => guessKey(g) === key)) {
      S.showToast("Already guessed!");
      return;
    }
    ensureStarted();
    state.guesses.push([...state.selected]);
    const tiers = state.selected.map(tierOf);
    const counts = [0, 0, 0, 0];
    tiers.forEach((t) => counts[t]++);

    if (counts.includes(4)) {
      const tier = tiers[0];
      state.solved.push(tier);
      state.order = state.order.filter((w) => !state.selected.includes(w));
      state.selected = [];
      if (state.solved.length === 4) finish(true);
      render(tier);
      persist();
      if (state.over) setTimeout(showResult, 900);
      return;
    }

    state.mistakes++;
    if (counts.includes(3)) S.showToast("One away…");
    shakeSelected();
    if (state.mistakes >= MAX_MISTAKES) {
      finish(false);
      setTimeout(() => {
        render();
        persist();
        setTimeout(showResult, 1200);
      }, 450);
    } else {
      // Let the shake play before the dot disappears.
      setTimeout(() => {
        render();
        persist();
      }, 400);
    }
    persist();
  }

  function finish(won) {
    state.over = true;
    state.won = won;
    state.selected = [];
    state.activeMs = stopwatch.stop();
    els.timer.textContent = S.formatTimer(state.activeMs);
    if (state.mode === "daily") submitResult();
  }

  els.board.addEventListener("click", (e) => {
    const tile = e.target.closest(".conn-tile");
    if (tile) toggleWord(tile.dataset.word);
  });

  els.submit.addEventListener("click", submitGuess);
  els.shuffle.addEventListener("click", () => {
    if (!state || state.over) return;
    state.order = S.shuffle(state.order);
    render();
    persist();
  });
  els.deselect.addEventListener("click", () => {
    if (!state || state.over) return;
    state.selected = [];
    render();
    persist();
  });

  document.addEventListener("keydown", (e) => {
    if (!state || !state.groups || S.anyModalOpen()) return;
    if (!els.gate.classList.contains("hidden")) return;
    if (e.key === "Enter") {
      e.preventDefault();
      submitGuess();
    }
  });

  // ---------- results ----------

  async function submitResult() {
    const name = S.getPlayerName();
    if (!name || state.submitted || state.mode !== "daily") return;
    try {
      await S.postJSON("/api/connections/score", {
        name,
        date: state.date,
        solved: state.won,
        mistakes: state.mistakes,
        groups: state.solved.length,
        timeMs: state.activeMs,
      });
      state.submitted = true;
      persist();
    } catch {
      // Offline or server down - retried next time the page loads.
    }
  }

  function guessRows(st) {
    return st.guesses.map((g) => g.map((w) => st.groups.findIndex((grp) => grp.words.includes(w))));
  }

  function shareText() {
    const head = state.mode === "daily" ? `Connecty #${dayNumber(state.date) + 1}` : `Connecty practice #${state.index + 1}`;
    const rows = guessRows(state).map((r) => r.map((t) => EMOJI[t]).join(""));
    return `${head}\n${rows.join("\n")}`;
  }

  function stopCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  S.onModalClose("result-modal", stopCountdown);

  function showResult() {
    const m = state.mistakes;
    const title = !state.won ? "Next time!" : m === 0 ? "Perfect!" : m === 1 ? "Great!" : m === 2 ? "Solid!" : "Phew!";
    document.getElementById("result-title").textContent = title;
    document.getElementById("result-number").textContent =
      state.mode === "daily" ? `Puzzle #${dayNumber(state.date) + 1}` : `Practice puzzle #${state.index + 1}`;
    document.getElementById("result-grid").innerHTML = guessRows(state)
      .map((r) => `<div class="conn-share-row">${r.map((t) => `<span class="conn-sq t${t}"></span>`).join("")}</div>`)
      .join("");
    const stat = (label, value) =>
      `<div class="result-stat"><span class="result-stat-label">${label}</span><span class="result-stat-value">${value}</span></div>`;
    document.getElementById("result-stats").innerHTML =
      stat("Mistakes", `${m}<small>/${MAX_MISTAKES}</small>`) +
      stat("Groups", `${state.solved.length}<small>/4</small>`) +
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

  document.getElementById("share-btn").addEventListener("click", async () => {
    const text = shareText();
    try {
      await navigator.clipboard.writeText(text);
      S.showToast("Copied to clipboard");
    } catch {
      // Clipboard blocked (e.g. plain http) - fall back to a prompt.
      window.prompt("Copy your results:", text);
    }
  });

  function showAnswers(index, title, yours) {
    document.getElementById("answers-title").textContent = title;
    document.getElementById("answers-groups").innerHTML = puzzleAt(index).map((g) => groupBar(g)).join("");
    document.getElementById("answers-yours").textContent = yours;
    S.openModal("answers-modal");
  }

  els.extra.addEventListener("click", () => {
    if (!state || !state.groups) return;
    if (state.mode === "daily") {
      const yesterday = S.shiftDate(state.date, -1);
      const saved = S.load(KEYS.daily(yesterday)) || {};
      const yours = saved.over
        ? saved.won
          ? `You solved it with ${saved.mistakes} mistake${saved.mistakes === 1 ? "" : "s"}.`
          : `You found ${(saved.solved || []).length} of 4 groups.`
        : "";
      showAnswers(puzzleIndexFor(yesterday), "Yesterday's Answers", yours);
    } else {
      showAnswers(state.index, "Answers", "");
    }
  });

  // Roll over to the new daily puzzle if the page was left open past midnight.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state && state.mode === "daily" && state.date !== S.todayDateString()) {
      startDaily();
    }
  });

  // ---------- leaderboard ----------

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
          { label: "Solved", value: (r) => (r.solved ? "✓" : `✗ ${r.groups}/4`) },
          { label: "Mistakes", value: (r) => r.mistakes },
          { label: "Time", value: (r) => t(r.timeMs) },
        ],
        "Nobody has finished today's puzzle yet — be the first!"
      );
    } else {
      S.renderTable(
        content,
        lbData.overall,
        [
          { label: "Player", value: (r) => e(r.name) },
          { label: "Played", value: (r) => r.played },
          { label: "Win %", value: (r) => r.winPct },
          { label: "Perfect", value: (r) => r.perfect },
          { label: "Avg Mistakes", value: (r) => r.avgMistakes ?? "—" },
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
      lbData = await S.getJSON(`/api/connections/leaderboard?date=${S.todayDateString()}`);
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

  // ---------- wiring ----------

  document.getElementById("help-btn").addEventListener("click", () => S.openModal("help-modal"));

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

  let archiveCtrl = null;
  S.initShell({
    onNameSaved() {
      if (state && state.mode === "daily" && !els.gate.classList.contains("hidden")) startDaily(state.date);
    },
  });
  if (S.initArchive) {
    archiveCtrl = S.initArchive({
      epoch: CONNECTIONS_EPOCH,
      getStatus(d) {
        const s = S.load(KEYS.daily(d));
        if (!s || (!s.started && !s.over)) return { state: "none", detail: d };
        if (!s.over) return { state: "progress", detail: `${(s.solved || []).length}/4 groups` };
        return {
          state: s.won ? "won" : "lost",
          detail: s.won ? `Solved · ${s.mistakes} mistake${s.mistakes === 1 ? "" : "s"}` : `${(s.solved || []).length}/4 groups`,
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
