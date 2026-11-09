// Shared plumbing for every game page: themes, player name, modals, toasts,
// dates, seeded randomness, and small API helpers. Exposed as window.Shared.
window.Shared = (() => {
  "use strict";

  const THEMES = [
    { id: "dark", name: "Dark", swatch: "#538d4e" },
    { id: "oled", name: "OLED Black", swatch: "#000000" },
    { id: "light", name: "Light", swatch: "#6aaa64" },
    { id: "neon-standard", name: "Standard Neon", swatch: "#39ff14" },
    { id: "neon-city", name: "Neon City", swatch: "#00e5ff" },
    { id: "synthwave", name: "Synthwave", swatch: "#ff2ec4" },
    { id: "bubblegum-3d", name: "Bubblegum 3D", swatch: "#6fdcc7" },
    { id: "ocean", name: "Ocean", swatch: "#2ea8b8" },
    { id: "sunset", name: "Sunset", swatch: "#f0643a" },
    { id: "forest", name: "Forest", swatch: "#f236c1" },
    { id: "halloween", name: "Halloween", swatch: "#f5891f" },
    { id: "christmas", name: "Christmas", swatch: "#c41e3a" },
    { id: "neon80s", name: "Neon 80s", swatch: "#ff6b00" },
    { id: "spooky", name: "Spooky", swatch: "#7cb342" },
    { id: "terminal", name: "Retro Terminal", swatch: "#33ff33" },
    { id: "bubblegum", name: "Bubblegum", swatch: "#ff8fc7" },
    { id: "art-deco", name: "Art Deco", swatch: "#d4af37" },
    { id: "tropical", name: "Tropical", swatch: "#1fc7b6" },
    { id: "desert", name: "Desert", swatch: "#e07a3a" },
    { id: "dessert", name: "Dessert", swatch: "#ff8fb4" },
  ];

  const THEME_KEY = "wordly:theme";
  const PLAYER_KEY = "wordly:playerName";
  const PIN_KEY = "wordly:playerPin";
  const SYNC_KEY_RE = /^(wordly|bee|boxed|connections|strands|mini|crossword|tiles|sudoku):(daily:|theme|hardMode|length|difficulty)/;

  let syncDebounce = null;
  let deferredInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById("pwa-install-btn");
    if (btn) btn.classList.remove("hidden");
  });

  // Prevent accidental double-tap or pinch zoom on phones during fast play.
  document.addEventListener(
    "dblclick",
    (e) => {
      if (!e.target.closest("input, textarea")) e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  // ---------- storage ----------

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (SYNC_KEY_RE.test(key)) scheduleCloudSync();
    } catch {
      // Storage full or blocked - progress just won't survive a reload.
    }
  }

  function collectSyncState() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && SYNC_KEY_RE.test(k)) {
          out[k] = localStorage.getItem(k);
        }
      }
    } catch {
      // ignore
    }
    return out;
  }

  function mergeLocalEntry(oldRaw, newRaw) {
    if (!oldRaw) return newRaw;
    if (!newRaw) return oldRaw;
    try {
      const a = JSON.parse(oldRaw);
      const b = JSON.parse(newRaw);
      if (a && typeof a === "object" && b && typeof b === "object") {
        const aDone = !!(a.over || a.solved);
        const bDone = !!(b.over || b.solved);
        if (aDone && !bDone) return oldRaw;
        if (bDone && !aDone) return newRaw;
        const aProg = (a.guesses?.length || 0) + (a.found?.length || 0) + (a.words?.length || 0) + (a.cleared || 0) + (a.filled || 0) + (a.activeMs || 0);
        const bProg = (b.guesses?.length || 0) + (b.found?.length || 0) + (b.words?.length || 0) + (b.cleared || 0) + (b.filled || 0) + (b.activeMs || 0);
        return bProg >= aProg ? newRaw : oldRaw;
      }
    } catch {
      // scalar
    }
    return newRaw;
  }

  function applySyncedState(remoteState) {
    if (!remoteState || typeof remoteState !== "object") return 0;
    let changed = 0;
    try {
      for (const [k, v] of Object.entries(remoteState)) {
        if (!SYNC_KEY_RE.test(k) || typeof v !== "string") continue;
        const cur = localStorage.getItem(k);
        const merged = mergeLocalEntry(cur, v);
        if (merged !== cur) {
          localStorage.setItem(k, merged);
          changed++;
        }
      }
    } catch {
      // ignore
    }
    return changed;
  }

  function getPlayerPin() {
    try {
      return localStorage.getItem(PIN_KEY) || "";
    } catch {
      return "";
    }
  }

  function setPlayerPin(pin) {
    try {
      localStorage.setItem(PIN_KEY, (pin || "").trim().slice(0, 16));
    } catch {
      // ignore
    }
  }

  async function syncProfile({ silent = false } = {}) {
    const name = getPlayerName();
    if (!name) return false;
    try {
      const res = await postJSON("/api/profile/sync", {
        name,
        pin: getPlayerPin(),
        state: collectSyncState(),
      });
      const updated = applySyncedState(res.state);
      if (!silent) {
        showToast(updated ? `Synced (${updated} updated)` : "Profile synced ☁️");
      }
      return updated > 0;
    } catch (err) {
      if (!silent) showToast(err.message || "Sync unavailable");
      return false;
    }
  }

  function scheduleCloudSync() {
    if (!getPlayerName()) return;
    clearTimeout(syncDebounce);
    syncDebounce = setTimeout(() => {
      syncProfile({ silent: true });
    }, 1800);
  }

  // ---------- dates & timers ----------

  function todayDateString(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function shiftDate(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return todayDateString(new Date(y, m - 1, d + days));
  }

  function msUntilNextMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  function formatCountdown(ms, noun = "puzzle") {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    return `Next ${noun} in ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  }

  function formatDateLabel(dateStr) {
    if (dateStr === todayDateString()) return "Today";
    if (dateStr === shiftDate(todayDateString(), -1)) return "Yesterday";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // Archive modal so players can catch up on missed daily puzzles.
  // getStatus(dateStr) -> { state: "won" | "lost" | "progress" | "none", detail?: string }
  function initArchive({ activeDate, getStatus, onSelectDate, days = 30, epoch = "2026-11-02" } = {}) {
    const controlsRow = document.querySelector(".controls-row");
    let archiveBtn = document.getElementById("archive-btn");
    if (controlsRow && !archiveBtn) {
      archiveBtn = document.createElement("button");
      archiveBtn.id = "archive-btn";
      archiveBtn.className = "icon-btn archive-btn";
      archiveBtn.type = "button";
      archiveBtn.setAttribute("aria-label", "Past daily puzzles");
      archiveBtn.title = "Past daily puzzles";
      archiveBtn.innerHTML = "&#128197;";
      const lbBtn = document.getElementById("leaderboard-btn");
      if (lbBtn) controlsRow.insertBefore(archiveBtn, lbBtn);
      else controlsRow.appendChild(archiveBtn);
    }

    if (!document.getElementById("archive-modal")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="archive-modal" class="modal-overlay hidden">
          <div class="modal modal-wide">
            <button class="modal-close" data-close="archive-modal" aria-label="Close">&times;</button>
            <h2>Daily Archive</h2>
            <p class="archive-sub">Catch up on any daily puzzle you missed.</p>
            <div id="archive-list" class="archive-grid"></div>
          </div>
        </div>`
      );
      document
        .querySelector('[data-close="archive-modal"]')
        .addEventListener("click", () => closeModal("archive-modal"));
      const overlay = document.getElementById("archive-modal");
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal("archive-modal");
      });
    }

    let currentActive = activeDate || todayDateString();

    function updateBadge(dateStr) {
      currentActive = dateStr || todayDateString();
      if (!archiveBtn) return;
      const isPast = currentActive !== todayDateString();
      archiveBtn.classList.toggle("is-past", isPast);
      archiveBtn.title = isPast ? `Playing ${currentActive} (tap to switch day)` : "Past daily puzzles";
      const dailyBtn = document.querySelector('.mode-btn[data-mode="daily"]');
      if (dailyBtn) {
        dailyBtn.textContent = isPast ? formatDateLabel(currentActive) : "Daily";
      }
    }

    function renderArchive() {
      const list = document.getElementById("archive-list");
      if (!list) return;
      const today = todayDateString();
      const items = [];
      for (let i = 0; i < days; i++) {
        const d = shiftDate(today, -i);
        if (epoch && d < epoch && i > 14) break;
        const st = (getStatus && getStatus(d)) || { state: "none" };
        const badge =
          st.state === "won"
            ? "✓"
            : st.state === "lost"
            ? "✗"
            : st.state === "progress"
            ? "•••"
            : "Play";
        items.push(`
          <button type="button" class="archive-day st-${st.state}${d === currentActive ? " active" : ""}" data-date="${d}">
            <span class="archive-day-top">
              <span class="archive-day-label">${escapeHtml(formatDateLabel(d))}</span>
              <span class="archive-day-badge">${escapeHtml(badge)}</span>
            </span>
            <span class="archive-day-meta">${escapeHtml(st.detail || d)}</span>
          </button>`);
      }
      list.innerHTML = items.join("");
      list.querySelectorAll(".archive-day").forEach((btn) => {
        btn.addEventListener("click", () => {
          const picked = btn.dataset.date;
          updateBadge(picked);
          closeModal("archive-modal");
          if (onSelectDate) onSelectDate(picked);
        });
      });
    }

    if (archiveBtn) {
      archiveBtn.addEventListener("click", () => {
        renderArchive();
        openModal("archive-modal");
      });
    }

    updateBadge(currentActive);
    return { setDate: updateBadge, refresh: renderArchive };
  }

  function formatTimer(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = String(totalSeconds % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
  }

  // ---------- seeded randomness ----------

  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash * 33) ^ str.charCodeAt(i)) >>> 0;
    }
    return hash >>> 0;
  }

  // mulberry32: tiny deterministic PRNG so every device builds the same
  // daily puzzle from the same date string.
  function seededRandom(seedStr) {
    let a = hashString(seedStr);
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function letterMask(word) {
    let mask = 0;
    for (let i = 0; i < word.length; i++) mask |= 1 << (word.charCodeAt(i) - 97);
    return mask;
  }

  function bitCount(n) {
    let c = 0;
    while (n) {
      n &= n - 1;
      c++;
    }
    return c;
  }

  // Active-play stopwatch: only counts while the page is visible, so leaving
  // a puzzle open in a background tab doesn't inflate your time.
  function createStopwatch(initialMs, onTick) {
    let accumulated = initialMs || 0;
    let runningSince = null;
    let interval = null;

    function current() {
      return accumulated + (runningSince ? Date.now() - runningSince : 0);
    }
    function pause() {
      if (runningSince) accumulated += Date.now() - runningSince;
      runningSince = null;
    }
    function resume() {
      if (!runningSince && !document.hidden) runningSince = Date.now();
    }
    function start() {
      resume();
      if (!interval) {
        interval = setInterval(() => onTick && onTick(current()), 250);
        document.addEventListener("visibilitychange", onVisibility);
      }
      onTick && onTick(current());
    }
    function stop() {
      pause();
      if (interval) clearInterval(interval);
      interval = null;
      document.removeEventListener("visibilitychange", onVisibility);
      return accumulated;
    }
    function onVisibility() {
      if (document.hidden) pause();
      else resume();
    }
    return { start, stop, current, get running() { return !!interval; } };
  }

  // ---------- player ----------

  function getPlayerName() {
    try {
      return localStorage.getItem(PLAYER_KEY) || "";
    } catch {
      return "";
    }
  }

  function setPlayerName(name) {
    try {
      localStorage.setItem(PLAYER_KEY, name);
    } catch {
      // ignore
    }
  }

  // ---------- UI helpers ----------

  function showToast(message, ms = 1300) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    // One message at a time - rapid-fire input would otherwise stack a
    // column of toasts down the screen.
    container.innerHTML = "";
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toast.style.animationDelay = `0s, ${Math.max(0, ms - 200) / 1000}s`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), ms);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  const closeHooks = {};
  function openModal(id) {
    document.getElementById(id).classList.remove("hidden");
  }
  function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
    (closeHooks[id] || []).forEach((fn) => fn());
  }
  function onModalClose(id, fn) {
    (closeHooks[id] = closeHooks[id] || []).push(fn);
  }
  function anyModalOpen() {
    return !!document.querySelector(".modal-overlay:not(.hidden)");
  }

  // ---------- theme ----------

  function applyTheme(themeId) {
    document.documentElement.setAttribute("data-theme", themeId);
    try {
      localStorage.setItem(THEME_KEY, themeId);
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && bg) meta.setAttribute("content", bg);
    } catch {
      // ignore
    }
    renderThemeList(themeId);
  }

  async function shareText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch {
      window.prompt("Copy your results:", text);
    }
  }

  function renderThemeList(activeId) {
    const list = document.getElementById("theme-list");
    if (!list) return;
    list.innerHTML = "";
    THEMES.forEach((theme) => {
      const btn = document.createElement("button");
      btn.className = "theme-option" + (theme.id === activeId ? " active" : "");
      btn.innerHTML = `<span class="theme-swatch" style="background:${theme.swatch}"></span><span>${theme.name}</span>`;
      btn.addEventListener("click", () => applyTheme(theme.id));
      list.appendChild(btn);
    });
  }

  // ---------- shell ----------

  // Injects the theme + player modals every page shares, and wires the
  // header buttons, close buttons, and click-outside-to-close behavior.
  function initShell({ onNameSaved } = {}) {
    if (!document.getElementById("theme-modal")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="theme-modal" class="modal-overlay hidden">
          <div class="modal">
            <button class="modal-close" data-close="theme-modal" aria-label="Close">&times;</button>
            <h2>Theme</h2>
            <div id="theme-list" class="theme-list"></div>
          </div>
        </div>
        <div id="name-modal" class="modal-overlay hidden">
          <div class="modal">
            <button class="modal-close" data-close="name-modal" aria-label="Close">&times;</button>
            <h2>Player Profile &amp; Sync</h2>
            <p>Your name is used for leaderboards and cross-device progress sync.</p>
            <input id="name-input" class="text-input" type="text" maxlength="40" placeholder="Your name" autocomplete="off" />
            <input id="pin-input" class="text-input" type="password" inputmode="numeric" maxlength="16" placeholder="Optional 4-digit sync PIN" autocomplete="off" />
            <button id="name-save-btn" class="primary-btn">Save &amp; Sync</button>
            <div class="profile-sync-box">
              <div class="profile-sync-row">
                <button id="sync-now-btn" class="pill-btn" type="button">Sync Now &#9729;</button>
                <button id="export-code-btn" class="pill-btn" type="button">Copy Backup Code</button>
                <button id="import-code-btn" class="pill-btn" type="button">Restore Code</button>
              </div>
              <button id="pwa-install-btn" class="pill-btn hidden" type="button" style="width:100%;margin-top:0.45rem">Install App to Home Screen &#128241;</button>
            </div>
          </div>
        </div>`
      );
    }

    let savedTheme = null;
    try {
      const params = new URLSearchParams(location.search);
      const qPlayer = params.get("player");
      if (qPlayer && qPlayer.trim()) setPlayerName(qPlayer.trim().slice(0, 40));
      const qTheme = params.get("theme");
      if (qTheme && THEMES.some((t) => t.id === qTheme)) {
        localStorage.setItem(THEME_KEY, qTheme);
      }
      savedTheme = localStorage.getItem(THEME_KEY);
    } catch {
      // ignore
    }
    if (savedTheme && THEMES.some((t) => t.id === savedTheme)) applyTheme(savedTheme);
    else renderThemeList(null);

    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) themeBtn.addEventListener("click", () => openModal("theme-modal"));

    const playerBtn = document.getElementById("player-btn");
    if (playerBtn) {
      playerBtn.addEventListener("click", () => {
        document.getElementById("name-input").value = getPlayerName();
        const pinEl = document.getElementById("pin-input");
        if (pinEl) pinEl.value = getPlayerPin();
        openModal("name-modal");
      });
    }

    const saveName = async () => {
      const input = document.getElementById("name-input");
      const pinEl = document.getElementById("pin-input");
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return;
      }
      setPlayerName(name);
      if (pinEl) setPlayerPin(pinEl.value);
      closeModal("name-modal");
      const pulled = await syncProfile({ silent: false });
      if (onNameSaved) onNameSaved(name);
      if (pulled) location.reload();
    };
    document.getElementById("name-save-btn").addEventListener("click", saveName);
    document.getElementById("name-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveName();
    });

    document.getElementById("sync-now-btn")?.addEventListener("click", async () => {
      const input = document.getElementById("name-input");
      const pinEl = document.getElementById("pin-input");
      if (input && input.value.trim()) setPlayerName(input.value.trim());
      if (pinEl) setPlayerPin(pinEl.value);
      const pulled = await syncProfile({ silent: false });
      if (pulled) location.reload();
    });

    document.getElementById("export-code-btn")?.addEventListener("click", () => {
      const payload = {
        name: getPlayerName(),
        state: collectSyncState(),
      };
      const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      shareText(code);
    });

    document.getElementById("import-code-btn")?.addEventListener("click", () => {
      const code = window.prompt("Paste your Wordly backup code:");
      if (!code || !code.trim()) return;
      try {
        const parsed = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
        if (parsed.name) setPlayerName(parsed.name);
        const count = applySyncedState(parsed.state || {});
        showToast(`Restored ${count} entries`);
        closeModal("name-modal");
        setTimeout(() => location.reload(), 350);
      } catch {
        showToast("Invalid backup code");
      }
    });

    document.getElementById("pwa-install-btn")?.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => {});
      deferredInstallPrompt = null;
      document.getElementById("pwa-install-btn")?.classList.add("hidden");
    });

    // Background sync on page open if player name is already set.
    if (getPlayerName()) {
      setTimeout(() => {
        syncProfile({ silent: true });
      }, 600);
    }

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const open = document.querySelector(".modal-overlay:not(.hidden)");
      if (open) closeModal(open.id);
    });
  }

  // Name gate shown before a Daily game when no player name is set yet.
  // Expects #name-gate, #gate-name-input, #gate-name-btn in the page.
  function wireNameGate(onSubmit) {
    const input = document.getElementById("gate-name-input");
    const btn = document.getElementById("gate-name-btn");
    btn.addEventListener("click", () => {
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return;
      }
      setPlayerName(name);
      onSubmit(name);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btn.click();
    });
  }

  // ---------- API ----------

  async function postJSON(url, body, { keepalive = false } = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // Renders an array of row objects as the shared leaderboard table style.
  // columns: [{ label, value: (row) => string (already escaped/safe) }]
  function renderTable(container, rows, columns, emptyText) {
    if (!rows.length) {
      container.innerHTML = `<p class="lb-status">${escapeHtml(emptyText)}</p>`;
      return;
    }
    const me = getPlayerName();
    container.innerHTML = `
      <table class="lb-table">
        <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr${r.name === me ? ' class="lb-me"' : ""}>${columns
                  .map((c) => `<td>${c.value(r)}</td>`)
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  return {
    THEMES,
    load,
    save,
    todayDateString,
    shiftDate,
    msUntilNextMidnight,
    formatCountdown,
    formatDateLabel,
    formatTimer,
    hashString,
    seededRandom,
    shuffle,
    letterMask,
    bitCount,
    createStopwatch,
    getPlayerName,
    setPlayerName,
    showToast,
    escapeHtml,
    openModal,
    closeModal,
    onModalClose,
    anyModalOpen,
    applyTheme,
    shareText,
    syncProfile,
    initShell,
    initArchive,
    wireNameGate,
    postJSON,
    getJSON,
    renderTable,
  };
})();
