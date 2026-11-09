"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const PORT = process.env.PORT || 80;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
// Set TRUST_PROXY=1 when running behind a reverse proxy (Nginx Proxy
// Manager, SWAG, Traefik...) so rate limits key on the real client IP from
// X-Forwarded-For instead of lumping everyone under the proxy's address.
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || "");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".txt", ".svg", ".md"]);

// ---------- storage ----------

// One JSON array file per game. Writes are serialized per file so
// concurrent submissions can't clobber each other.
function createStore(fileName) {
  const file = path.join(DATA_DIR, fileName);
  let writeQueue = Promise.resolve();

  function ensure() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
  }

  function read() {
    ensure();
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function write(records) {
    writeQueue = writeQueue.then(
      () =>
        new Promise((resolve, reject) => {
          ensure();
          fs.writeFile(file, JSON.stringify(records), (err) => (err ? reject(err) : resolve()));
        })
    );
    return writeQueue;
  }

  return { read, write };
}

const wordlyStore = createStore("scores.json");
const beeStore = createStore("bee.json");
const boxedStore = createStore("boxed.json");
const connectionsStore = createStore("connections.json");
const miniStore = createStore("mini.json");
const crosswordStore = createStore("crossword.json");
const tilesStore = createStore("tiles.json");
const sudokuStore = createStore("sudoku.json");
const strandsStore = createStore("strands.json");
const profilesStore = createStore("profiles.json");

// ---------- shared helpers ----------

function isNextDay(dateStr, nextDateStr) {
  const d1 = new Date(dateStr + "T00:00:00Z").getTime();
  const d2 = new Date(nextDateStr + "T00:00:00Z").getTime();
  return d2 - d1 === 86400000;
}

// Streaks over a player's games sorted by date, where `counts(g)` says
// whether that day extends the streak.
function streaks(games, counts) {
  let maxStreak = 0;
  let running = 0;
  let prevDate = null;
  for (const g of games) {
    if (counts(g) && prevDate && isNextDay(prevDate, g.date)) running += 1;
    else if (counts(g)) running = 1;
    else running = 0;
    maxStreak = Math.max(maxStreak, running);
    prevDate = g.date;
  }

  let currentStreak = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if (!counts(games[i])) break;
    if (i === games.length - 1) currentStreak = 1;
    else if (isNextDay(games[i].date, games[i + 1].date)) currentStreak++;
    else break;
  }
  return { currentStreak, maxStreak };
}

function groupByPlayer(records) {
  const byPlayer = new Map();
  for (const r of records) {
    if (!byPlayer.has(r.name)) byPlayer.set(r.name, []);
    byPlayer.get(r.name).push(r);
  }
  for (const games of byPlayer.values()) games.sort((a, b) => a.date.localeCompare(b.date));
  return byPlayer;
}

function average(values, decimals = 0) {
  if (!values.length) return null;
  const f = 10 ** decimals;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * f) / f;
}

function minOrNull(values) {
  return values.length ? Math.min(...values) : null;
}

function validName(name) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 40) {
    throw new Error("invalid name");
  }
  return name.trim().slice(0, 40);
}

function validDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("invalid date");
  }
  return date;
}

function optionalMs(value, field) {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 24 * 60 * 60 * 1000) {
    throw new Error(`invalid ${field}`);
  }
  return Math.round(value);
}

function intInRange(value, min, max, field) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`invalid ${field}`);
  return value;
}

// ---------- Wordly ----------

function computeWordlyLeaderboard(length) {
  const byPlayer = groupByPlayer(wordlyStore.read().filter((s) => s.length === length));
  const result = [];
  for (const [name, games] of byPlayer) {
    const won = games.filter((g) => g.won);
    const hardWins = won.filter((g) => g.hardMode).length;
    const played = games.length;
    result.push({
      name,
      played,
      wins: won.length,
      hardWins,
      winPct: played ? Math.round((won.length / played) * 100) : 0,
      ...streaks(games, (g) => g.won),
      avgGuesses: average(won.map((g) => g.guesses), 1),
      bestTimeMs: minOrNull(won.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)),
      avgLuck: average(won.filter((g) => Number.isFinite(g.luck)).map((g) => g.luck)),
    });
  }
  result.sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || a.name.localeCompare(b.name));
  return result;
}

function submitWordlyScore(body) {
  const { length, won, guesses, timeMs, luck, hardMode } = body;
  const name = validName(body.name);
  const date = validDate(body.date);
  if (length !== 5 && length !== 6) throw new Error("invalid length");
  if (typeof won !== "boolean") throw new Error("invalid won");
  if (won) intInRange(guesses, 1, length + 1, "guesses");
  const time = optionalMs(timeMs, "timeMs");
  if (luck !== undefined && luck !== null) intInRange(luck, 0, 100, "luck");

  const record = {
    name,
    length,
    date,
    won,
    hardMode: !!hardMode,
    guesses: won ? guesses : null,
    timeMs: won ? time : null,
    luck: won && luck !== undefined && luck !== null ? luck : null,
    submittedAt: new Date().toISOString(),
  };

  const scores = wordlyStore.read();
  const key = (s) => `${s.name}|${s.date}|${s.length}`;
  const idx = scores.findIndex((s) => key(s) === key(record));
  if (idx >= 0) scores[idx] = record;
  else scores.push(record);
  return wordlyStore.write(scores).then(() => record);
}

// ---------- Spelling Bee ----------

const BEE_RANKS = [
  ["Beginner", 0],
  ["Good Start", 0.02],
  ["Moving Up", 0.05],
  ["Good", 0.08],
  ["Solid", 0.15],
  ["Nice", 0.25],
  ["Great", 0.4],
  ["Amazing", 0.5],
  ["Genius", 0.7],
  ["Queen Bee", 1],
];

function beeRank(score, max) {
  let name = BEE_RANKS[0][0];
  for (const [rank, pct] of BEE_RANKS) {
    const needed = pct === 1 ? max : Math.round(pct * max);
    if (score >= needed) name = rank;
  }
  return name;
}

function beeIsGenius(r) {
  return r.score >= Math.round(0.7 * r.maxScore);
}

function computeBeeLeaderboard(date) {
  const records = beeStore.read();

  const today = records
    .filter((r) => r.date === date)
    .map((r) => ({
      name: r.name,
      score: r.score,
      maxScore: r.maxScore,
      rank: beeRank(r.score, r.maxScore),
      words: r.words,
      pangrams: r.pangrams,
      geniusMs: r.geniusMs,
    }))
    .sort((a, b) => b.score - a.score || (a.geniusMs ?? Infinity) - (b.geniusMs ?? Infinity) || a.name.localeCompare(b.name));

  const overall = [];
  for (const [name, games] of groupByPlayer(records)) {
    overall.push({
      name,
      played: games.length,
      avgPct: average(games.map((g) => (g.maxScore ? (g.score / g.maxScore) * 100 : 0))),
      geniusDays: games.filter(beeIsGenius).length,
      queenBeeDays: games.filter((g) => g.score >= g.maxScore).length,
      pangrams: games.reduce((sum, g) => sum + (g.pangrams || 0), 0),
      ...streaks(games, () => true),
      bestGeniusMs: minOrNull(games.filter((g) => Number.isFinite(g.geniusMs)).map((g) => g.geniusMs)),
    });
  }
  overall.sort(
    (a, b) => b.geniusDays - a.geniusDays || b.avgPct - a.avgPct || b.played - a.played || a.name.localeCompare(b.name)
  );
  return { today, overall };
}

function submitBeeScore(body) {
  const name = validName(body.name);
  const date = validDate(body.date);
  const maxScore = intInRange(body.maxScore, 1, 5000, "maxScore");
  const score = intInRange(body.score, 0, maxScore, "score");
  const words = intInRange(body.words, 0, 1000, "words");
  const pangrams = intInRange(body.pangrams, 0, 100, "pangrams");
  let geniusMs = optionalMs(body.geniusMs, "geniusMs");
  if (score < Math.round(0.7 * maxScore)) geniusMs = null;

  const records = beeStore.read();
  const idx = records.findIndex((r) => r.name === name && r.date === date);
  const prev = idx >= 0 ? records[idx] : null;
  // Scores only go up during a day; if a stale device reports a lower
  // score, keep the better one (and the faster Genius time).
  const record = {
    name,
    date,
    score: prev ? Math.max(prev.score, score) : score,
    maxScore,
    words: prev && prev.score > score ? prev.words : words,
    pangrams: prev && prev.score > score ? prev.pangrams : pangrams,
    geniusMs: minOrNull([prev && prev.geniusMs, geniusMs].filter(Number.isFinite)),
    submittedAt: new Date().toISOString(),
  };
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  return beeStore.write(records).then(() => ({ ...record, rank: beeRank(record.score, record.maxScore) }));
}

// ---------- Letter Boxed ----------

function computeBoxedLeaderboard(date) {
  const records = boxedStore.read();

  const today = records
    .filter((r) => r.date === date)
    .map((r) => ({ name: r.name, words: r.words, par: r.par, timeMs: r.timeMs }))
    .sort((a, b) => a.words - b.words || (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) || a.name.localeCompare(b.name));

  const overall = [];
  for (const [name, games] of groupByPlayer(records)) {
    overall.push({
      name,
      solved: games.length,
      avgWords: average(games.map((g) => g.words), 1),
      bestWords: minOrNull(games.map((g) => g.words)),
      twoWordSolves: games.filter((g) => g.words <= 2).length,
      parOrBetter: games.filter((g) => Number.isFinite(g.par) && g.words <= g.par).length,
      bestTimeMs: minOrNull(games.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)),
      ...streaks(games, () => true),
    });
  }
  overall.sort(
    (a, b) => b.solved - a.solved || (a.avgWords ?? Infinity) - (b.avgWords ?? Infinity) || a.name.localeCompare(b.name)
  );
  return { today, overall };
}

function submitBoxedScore(body) {
  const name = validName(body.name);
  const date = validDate(body.date);
  const words = intInRange(body.words, 1, 100, "words");
  const par = body.par === undefined || body.par === null ? null : intInRange(body.par, 1, 20, "par");
  const timeMs = optionalMs(body.timeMs, "timeMs");

  const records = boxedStore.read();
  const existing = records.find((r) => r.name === name && r.date === date);
  // First solve of the day is the one that counts - no replaying on a
  // second device for a better result.
  if (existing) return Promise.resolve(existing);
  const record = { name, date, words, par, timeMs, submittedAt: new Date().toISOString() };
  records.push(record);
  return boxedStore.write(records).then(() => record);
}

// ---------- Connections ----------

function computeConnectionsLeaderboard(date) {
  const records = connectionsStore.read();

  const today = records
    .filter((r) => r.date === date)
    .map((r) => ({ name: r.name, solved: r.solved, mistakes: r.mistakes, groups: r.groups, timeMs: r.timeMs }))
    .sort(
      (a, b) =>
        Number(b.solved) - Number(a.solved) ||
        a.mistakes - b.mistakes ||
        b.groups - a.groups ||
        (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) ||
        a.name.localeCompare(b.name)
    );

  const overall = [];
  for (const [name, games] of groupByPlayer(records)) {
    const won = games.filter((g) => g.solved);
    overall.push({
      name,
      played: games.length,
      solved: won.length,
      winPct: games.length ? Math.round((won.length / games.length) * 100) : 0,
      perfect: won.filter((g) => g.mistakes === 0).length,
      avgMistakes: average(won.map((g) => g.mistakes), 1),
      bestTimeMs: minOrNull(won.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)),
      ...streaks(games, (g) => g.solved),
    });
  }
  overall.sort(
    (a, b) =>
      b.solved - a.solved || b.winPct - a.winPct || (a.avgMistakes ?? Infinity) - (b.avgMistakes ?? Infinity) || a.name.localeCompare(b.name)
  );
  return { today, overall };
}

function submitConnectionsScore(body) {
  const name = validName(body.name);
  const date = validDate(body.date);
  if (typeof body.solved !== "boolean") throw new Error("invalid solved");
  const mistakes = intInRange(body.mistakes, 0, 4, "mistakes");
  const groups = intInRange(body.groups, 0, 4, "groups");
  if (body.solved ? groups !== 4 || mistakes > 3 : mistakes !== 4) throw new Error("inconsistent result");
  const timeMs = optionalMs(body.timeMs, "timeMs");

  const records = connectionsStore.read();
  const existing = records.find((r) => r.name === name && r.date === date);
  // First finished game of the day counts, like Letter Boxed.
  if (existing) return Promise.resolve(existing);
  const record = { name, date, solved: body.solved, mistakes, groups, timeMs, submittedAt: new Date().toISOString() };
  records.push(record);
  return connectionsStore.write(records).then(() => record);
}

// ---------- Crosswords (Mini & Standard) ----------

function computeCrosswordLeaderboard(store, date) {
  const records = store.read();

  const today = records
    .filter((r) => r.date === date)
    .map((r) => ({ name: r.name, hints: r.hints || 0, timeMs: r.timeMs }))
    .sort((a, b) => a.hints - b.hints || (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) || a.name.localeCompare(b.name));

  const overall = [];
  for (const [name, games] of groupByPlayer(records)) {
    const clean = games.filter((g) => (g.hints || 0) === 0);
    overall.push({
      name,
      solved: games.length,
      clean: clean.length,
      avgTimeMs: average(games.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)),
      bestTimeMs: minOrNull(clean.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)) ??
        minOrNull(games.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)),
      ...streaks(games, () => true),
    });
  }
  overall.sort(
    (a, b) =>
      b.solved - a.solved ||
      b.clean - a.clean ||
      (a.bestTimeMs ?? Infinity) - (b.bestTimeMs ?? Infinity) ||
      a.name.localeCompare(b.name)
  );
  return { today, overall };
}

function submitCrosswordScore(store, body) {
  const name = validName(body.name);
  const date = validDate(body.date);
  const hints = intInRange(body.hints ?? 0, 0, 500, "hints");
  const timeMs = optionalMs(body.timeMs, "timeMs");

  const records = store.read();
  const existing = records.find((r) => r.name === name && r.date === date);
  // First solve of the day is the one that counts.
  if (existing) return Promise.resolve(existing);
  const record = { name, date, hints, timeMs, submittedAt: new Date().toISOString() };
  records.push(record);
  return store.write(records).then(() => record);
}

// ---------- Tiley ----------

function computeTilesLeaderboard(date) {
  const records = tilesStore.read();

  const today = records
    .filter((r) => r.date === date)
    .map((r) => ({
      name: r.name,
      bestCombo: r.bestCombo,
      maxCombo: r.maxCombo || 45,
      errors: r.errors || 0,
      timeMs: r.timeMs,
    }))
    .sort(
      (a, b) =>
        b.bestCombo - a.bestCombo ||
        a.errors - b.errors ||
        (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) ||
        a.name.localeCompare(b.name)
    );

  const overall = [];
  for (const [name, games] of groupByPlayer(records)) {
    const perfect = games.filter((g) => (g.errors || 0) === 0 && g.bestCombo >= (g.maxCombo || 45));
    overall.push({
      name,
      solved: games.length,
      perfect: perfect.length,
      avgCombo: average(games.map((g) => g.bestCombo), 1),
      bestTimeMs: minOrNull(games.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)),
      ...streaks(games, () => true),
    });
  }
  overall.sort(
    (a, b) =>
      b.solved - a.solved ||
      b.perfect - a.perfect ||
      (b.avgCombo ?? 0) - (a.avgCombo ?? 0) ||
      (a.bestTimeMs ?? Infinity) - (b.bestTimeMs ?? Infinity) ||
      a.name.localeCompare(b.name)
  );
  return { today, overall };
}

function submitTilesScore(body) {
  const name = validName(body.name);
  const date = validDate(body.date);
  const maxCombo = intInRange(body.maxCombo ?? 45, 1, 200, "maxCombo");
  const bestCombo = intInRange(body.bestCombo, 1, maxCombo, "bestCombo");
  const errors = intInRange(body.errors ?? 0, 0, 500, "errors");
  const timeMs = optionalMs(body.timeMs, "timeMs");

  const records = tilesStore.read();
  const existing = records.find((r) => r.name === name && r.date === date);
  if (existing) return Promise.resolve(existing);
  const record = { name, date, bestCombo, maxCombo, errors, timeMs, submittedAt: new Date().toISOString() };
  records.push(record);
  return tilesStore.write(records).then(() => record);
}

// ---------- Sudoky ----------

const SUDOKU_DIFFS = new Set(["easy", "medium", "hard"]);

function validSudokuDiff(diff) {
  const d = typeof diff === "string" ? diff.toLowerCase() : "easy";
  if (!SUDOKU_DIFFS.has(d)) throw new Error("invalid difficulty");
  return d;
}

function computeSudokuLeaderboard(date, difficulty) {
  const records = sudokuStore.read().filter((r) => (r.difficulty || "easy") === difficulty);

  const today = records
    .filter((r) => r.date === date)
    .map((r) => ({
      name: r.name,
      mistakes: r.mistakes || 0,
      hints: r.hints || 0,
      timeMs: r.timeMs,
    }))
    .sort(
      (a, b) =>
        a.hints - b.hints ||
        a.mistakes - b.mistakes ||
        (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) ||
        a.name.localeCompare(b.name)
    );

  const overall = [];
  for (const [name, games] of groupByPlayer(records)) {
    const flawless = games.filter((g) => (g.hints || 0) === 0 && (g.mistakes || 0) === 0);
    overall.push({
      name,
      solved: games.length,
      flawless: flawless.length,
      avgTimeMs: average(games.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)),
      bestTimeMs:
        minOrNull(flawless.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)) ??
        minOrNull(games.filter((g) => Number.isFinite(g.timeMs)).map((g) => g.timeMs)),
      ...streaks(games, () => true),
    });
  }
  overall.sort(
    (a, b) =>
      b.solved - a.solved ||
      b.flawless - a.flawless ||
      (a.bestTimeMs ?? Infinity) - (b.bestTimeMs ?? Infinity) ||
      a.name.localeCompare(b.name)
  );
  return { today, overall };
}

function submitSudokuScore(body) {
  const name = validName(body.name);
  const date = validDate(body.date);
  const difficulty = validSudokuDiff(body.difficulty);
  const mistakes = intInRange(body.mistakes ?? 0, 0, 500, "mistakes");
  const hints = intInRange(body.hints ?? 0, 0, 81, "hints");
  const timeMs = optionalMs(body.timeMs, "timeMs");

  const records = sudokuStore.read();
  const existing = records.find((r) => r.name === name && r.date === date && (r.difficulty || "easy") === difficulty);
  if (existing) return Promise.resolve(existing);
  const record = { name, date, difficulty, mistakes, hints, timeMs, submittedAt: new Date().toISOString() };
  records.push(record);
  return sudokuStore.write(records).then(() => record);
}

// ---------- rate limiting ----------

// Fixed-window counters per client IP. Writes are the thing worth
// protecting (each one rewrites a JSON file); reads get a looser cap.
const RATE_LIMITS = {
  write: { max: Number(process.env.RATE_LIMIT_WRITES) || 30, windowMs: 60_000 },
  read: { max: Number(process.env.RATE_LIMIT_READS) || 120, windowMs: 60_000 },
};
const rateBuckets = new Map();

function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

// Returns 0 if allowed, otherwise seconds until the window resets.
function rateLimited(req, kind) {
  const { max, windowMs } = RATE_LIMITS[kind];
  const key = `${kind}|${clientIp(req)}`;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count++;
  return bucket.count > max ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) if (now >= bucket.resetAt) rateBuckets.delete(key);
}, 60_000).unref();

// ---------- HTTP plumbing ----------

function sendJSON(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function readBody(req, maxBytes = 10_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function readJSONBody(req, maxBytes = 10_000) {
  const raw = await readBody(req, maxBytes);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("invalid JSON");
  }
}

// ---------- Cross-Device Profile Sync ----------

const SYNC_KEY_RE = /^(wordly|bee|boxed|connections|strands|mini|crossword|tiles|sudoku):(daily:|theme|hardMode|length|difficulty)/;

function mergeSyncValue(oldRaw, newRaw) {
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
    // Non-JSON scalar preference
  }
  return newRaw;
}

function getProfileSync(nameRaw, pinRaw) {
  const name = validName(nameRaw);
  const pin = typeof pinRaw === "string" ? pinRaw.trim().slice(0, 16) : "";
  const profiles = profilesStore.read();
  const entry = profiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!entry) return { name, state: {}, hasPin: false };
  if (entry.pin && entry.pin !== pin) throw new Error("invalid PIN for this player profile");
  return { name: entry.name, state: entry.state || {}, hasPin: !!entry.pin, updatedAt: entry.updatedAt };
}

function saveProfileSync(body) {
  const name = validName(body.name);
  const pin = typeof body.pin === "string" ? body.pin.trim().slice(0, 16) : "";
  const incoming = body.state && typeof body.state === "object" ? body.state : {};
  const profiles = profilesStore.read();
  const idx = profiles.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
  const existing = idx >= 0 ? profiles[idx] : null;
  if (existing && existing.pin && existing.pin !== pin) {
    throw new Error("invalid PIN for this player profile");
  }
  const merged = existing && existing.state ? { ...existing.state } : {};
  const keys = Object.keys(incoming).slice(0, 450);
  for (const k of keys) {
    if (!SYNC_KEY_RE.test(k)) continue;
    const v = incoming[k];
    if (typeof v === "string" && v.length <= 16_000) {
      merged[k] = mergeSyncValue(merged[k], v);
    }
  }
  const record = {
    name: existing ? existing.name : name,
    pin: pin || (existing ? existing.pin || "" : ""),
    state: merged,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) profiles[idx] = record;
  else profiles.push(record);
  return profilesStore.write(profiles).then(() => ({
    name: record.name,
    state: record.state,
    hasPin: !!record.pin,
    updatedAt: record.updatedAt,
  }));
}

// Gzipped copies of text assets, cached by path + mtime. The Letter Boxed
// dictionary is ~1.4 MB raw but under 400 KB gzipped.
const gzipCache = new Map();

function resolveStatic(pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  // Clean game URLs: /wordly -> wordly.html, /bee -> bee.html, ...
  if (!path.extname(rel)) rel += ".html";
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  return filePath.startsWith(PUBLIC_DIR + path.sep) ? filePath : null;
}

function serveStatic(req, pathname, res) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const filePath = resolveStatic(decoded);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
    const headers = {
      "Content-Type": MIME[ext] || "application/octet-stream",
      // Revalidate every load so a freshly pulled image shows up right away.
      "Cache-Control": "no-cache, must-revalidate",
      "Last-Modified": stat.mtime.toUTCString(),
      ETag: etag,
    };
    const inm = req.headers["if-none-match"];
    if (inm) {
      if (inm === etag) {
        res.writeHead(304, headers);
        res.end();
        return;
      }
    } else {
      const since = Date.parse(req.headers["if-modified-since"] || "");
      if (Number.isFinite(since) && Math.floor(stat.mtimeMs / 1000) * 1000 <= since) {
        res.writeHead(304, headers);
        res.end();
        return;
      }
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
      if (COMPRESSIBLE.has(ext) && data.length > 1024) {
        headers.Vary = "Accept-Encoding";
        if (acceptsGzip) {
          const cacheKey = `${filePath}|${stat.mtimeMs}`;
          let gz = gzipCache.get(cacheKey);
          if (!gz) {
            gz = zlib.gzipSync(data, { level: 9 });
            gzipCache.set(cacheKey, gz);
          }
          headers["Content-Encoding"] = "gzip";
          data = gz;
        }
      }
      headers["Content-Length"] = data.length;
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : data);
    });
  });
}

// method + path -> { limit, handler(url, req) -> Promise<object> | object }
const ROUTES = {
  "GET /api/health": { handler: () => ({ ok: true }) },

  // Wordly (original paths kept so older cached pages keep working)
  "GET /api/leaderboard": {
    limit: "read",
    handler: (url) => {
      const length = Number(url.searchParams.get("length"));
      if (length !== 5 && length !== 6) throw new Error("length must be 5 or 6");
      return computeWordlyLeaderboard(length);
    },
  },
  "POST /api/score": {
    limit: "write",
    handler: async (url, req) => submitWordlyScore(await readJSONBody(req)),
  },

  "GET /api/bee/leaderboard": {
    limit: "read",
    handler: (url) => computeBeeLeaderboard(validDate(url.searchParams.get("date"))),
  },
  "POST /api/bee/score": {
    limit: "write",
    handler: async (url, req) => submitBeeScore(await readJSONBody(req)),
  },

  "GET /api/boxed/leaderboard": {
    limit: "read",
    handler: (url) => computeBoxedLeaderboard(validDate(url.searchParams.get("date"))),
  },
  "POST /api/boxed/score": {
    limit: "write",
    handler: async (url, req) => submitBoxedScore(await readJSONBody(req)),
  },

  "GET /api/connections/leaderboard": {
    limit: "read",
    handler: (url) => computeConnectionsLeaderboard(validDate(url.searchParams.get("date"))),
  },
  "POST /api/connections/score": {
    limit: "write",
    handler: async (url, req) => submitConnectionsScore(await readJSONBody(req)),
  },

  "GET /api/mini/leaderboard": {
    limit: "read",
    handler: (url) => computeCrosswordLeaderboard(miniStore, validDate(url.searchParams.get("date"))),
  },
  "POST /api/mini/score": {
    limit: "write",
    handler: async (url, req) => submitCrosswordScore(miniStore, await readJSONBody(req)),
  },

  "GET /api/crossword/leaderboard": {
    limit: "read",
    handler: (url) => computeCrosswordLeaderboard(crosswordStore, validDate(url.searchParams.get("date"))),
  },
  "POST /api/crossword/score": {
    limit: "write",
    handler: async (url, req) => submitCrosswordScore(crosswordStore, await readJSONBody(req)),
  },

  "GET /api/tiles/leaderboard": {
    limit: "read",
    handler: (url) => computeTilesLeaderboard(validDate(url.searchParams.get("date"))),
  },
  "POST /api/tiles/score": {
    limit: "write",
    handler: async (url, req) => submitTilesScore(await readJSONBody(req)),
  },

  "GET /api/sudoku/leaderboard": {
    limit: "read",
    handler: (url) =>
      computeSudokuLeaderboard(
        validDate(url.searchParams.get("date")),
        validSudokuDiff(url.searchParams.get("difficulty") || "easy")
      ),
  },
  "POST /api/sudoku/score": {
    limit: "write",
    handler: async (url, req) => submitSudokuScore(await readJSONBody(req)),
  },

  "GET /api/strands/leaderboard": {
    limit: "read",
    handler: (url) => computeCrosswordLeaderboard(strandsStore, validDate(url.searchParams.get("date"))),
  },
  "POST /api/strands/score": {
    limit: "write",
    handler: async (url, req) => submitCrosswordScore(strandsStore, await readJSONBody(req)),
  },

  "GET /api/profile/sync": {
    limit: "read",
    handler: (url) => getProfileSync(url.searchParams.get("name"), url.searchParams.get("pin")),
  },
  "POST /api/profile/sync": {
    limit: "write",
    handler: async (url, req) => saveProfileSync(await readJSONBody(req, 150_000)),
  },
};

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  const route = ROUTES[`${req.method} ${url.pathname}`];
  if (route) {
    if (route.limit) {
      const retryAfter = rateLimited(req, route.limit);
      if (retryAfter) {
        return sendJSON(res, 429, { error: "too many requests" }, { "Retry-After": String(retryAfter) });
      }
    }
    try {
      return sendJSON(res, 200, await route.handler(url, req));
    } catch (err) {
      return sendJSON(res, 400, { error: err.message || "bad request" });
    }
  }

  if (url.pathname.startsWith("/api/")) return sendJSON(res, 404, { error: "not found" });
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, url.pathname, res);
  sendJSON(res, 405, { error: "method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Wordly listening on port ${PORT}`);
});
