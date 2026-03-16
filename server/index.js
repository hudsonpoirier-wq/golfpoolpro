// ============================================================
// MyGolfPoolPro — Express Backend Server
// ============================================================
// Stack: Node.js + Express + Supabase + JWT + Resend (email)
//
// Install:
//   npm install express cors helmet express-rate-limit
//               @supabase/supabase-js jsonwebtoken
//               resend node-cron dotenv
// ============================================================

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");
const cron       = require("node-cron");
const crypto     = require("crypto");
const fetch      = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const authRoutes    = require("./routes/auth");
const poolRoutes    = require("./routes/pools");
const golferRoutes  = require("./routes/golfers");
const scoreRoutes   = require("./routes/scores");
const inviteRoutes  = require("./routes/invites");
const draftRoutes   = require("./routes/draft");
const tournamentRoutes = require("./routes/tournaments");
const courseRoutes = require("./routes/courses");
const publicRoutes = require("./routes/public");
const { syncLiveScores, seedGolfers, resolveTheSportsDbEventId } = require("./services/scoresSync");
const { seedUpcomingTournaments } = require("./services/tournamentSync");

const app = express();

const ANALYTICS_ERRORS_MAX = 80;
const analytics = {
  startedAt: new Date().toISOString(),
  scoreSync: { lastRunAt: null, lastOkAt: null, lastErrorAt: null, lastError: null },
  errors: [],
};

// ─── Supabase admin client (service role — never expose to client) ───
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);
app.locals.supabase = supabase;
app.locals.analytics = analytics;

// Safety switch: avoid seeding fake "ranking fallback" fields unless explicitly enabled.
const ALLOW_PROVISIONAL_FIELDS = String(process.env.ALLOW_PROVISIONAL_FIELDS || "").toLowerCase() === "true";

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/postman/server-to-server
    if (!allowedOrigins.length) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("CORS origin denied"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 60,
  skipSuccessfulRequests: true,
  message: { error: "Too many attempts. Please try again in 15 minutes." }
}));
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: "Rate limit exceeded. Slow down." }
}));

// ─── Routes ──────────────────────────────────────────────────
app.use("/api/auth",    authRoutes);
app.use("/api/pools",   poolRoutes);
app.use("/api/golfers", golferRoutes);
app.use("/api/scores",  scoreRoutes);
app.use("/api/invite",  inviteRoutes);
app.use("/api/draft",   draftRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/public", publicRoutes);

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// Admin seed endpoint for loading golfers from SportsDataIO.
app.post("/api/admin/seed-golfers", async (req, res, next) => {
  try {
    const required = process.env.ADMIN_TOKEN;
    if (required && req.headers["x-admin-token"] !== required) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await seedGolfers(supabase);
    if (result?.error) return res.status(400).json({ error: result.error });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
});

app.post("/api/admin/seed-tournaments", async (req, res, next) => {
  try {
    const required = process.env.ADMIN_TOKEN;
    if (required && req.headers["x-admin-token"] !== required) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const year = Number(req.body?.year) || new Date().getUTCFullYear();
    const result = await seedUpcomingTournaments(supabase, year);
    if (result?.error) return res.status(400).json({ error: result.error });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
});

app.get("/api/admin/tournaments/suggest-map", async (req, res, next) => {
  try {
    const required = process.env.ADMIN_TOKEN;
    if (required && req.headers["x-admin-token"] !== required) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: tournaments, error } = await supabase
      .from("tournaments")
      .select("id, name, start_date")
      .gte("start_date", today)
      .order("start_date", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const map = {};
    for (const tournament of tournaments || []) {
      const eventId = await resolveTheSportsDbEventId(tournament.id, supabase);
      if (eventId) map[tournament.id] = String(eventId);
    }

    return res.json({ count: Object.keys(map).length, map });
  } catch (e) {
    return next(e);
  }
});

function normalizePlayerName(name) {
  const s = String(name || "")
    .replace(/\s+/g, " ")
    .trim();
  // Common feed format: "Last, First" -> "First Last"
  if (s.includes(",")) {
    const [last, rest] = s.split(",", 2).map((x) => String(x || "").trim());
    if (last && rest) return `${rest} ${last}`.replace(/\s+/g, " ").trim();
  }
  return s;
}

function toStableGolferId(name) {
  const normalized = normalizePlayerName(name).toLowerCase();
  const hex = crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 7);
  return Number.parseInt(hex, 16);
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        cur += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parsePlayersFromBody(body) {
  if (Array.isArray(body?.players)) {
    return body.players
      .map((p) => ({
        name: normalizePlayerName(p.name || p.player || p.full_name),
        country: p.country || p.nationality || null,
        world_rank: Number(p.world_rank || p.rank) || null,
      }))
      .filter((p) => p.name);
  }

  if (typeof body?.csv === "string" && body.csv.trim()) {
    const lines = body.csv
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const nameIdx = Math.max(header.indexOf("name"), header.indexOf("player"), header.indexOf("player_name"));
    const countryIdx = Math.max(header.indexOf("country"), header.indexOf("nationality"));
    const rankIdx = Math.max(header.indexOf("world_rank"), header.indexOf("rank"));
    const startAt = nameIdx >= 0 ? 1 : 0;

    return lines.slice(startAt).map((line) => {
      const cols = parseCsvLine(line);
      const name = normalizePlayerName(nameIdx >= 0 ? cols[nameIdx] : cols[0]);
      return {
        name,
        country: countryIdx >= 0 ? (cols[countryIdx] || null) : null,
        world_rank: rankIdx >= 0 ? (Number(cols[rankIdx]) || null) : null,
      };
    }).filter((p) => p.name);
  }

  return [];
}

function coerceFieldPlayer(row) {
  if (!row || typeof row !== "object") return null;
  const hasPlayerSignal = Boolean(
    row.strPlayer ||
    row.player ||
    row.player_name ||
    row.full_name ||
    row.PlayerName ||
    row.golfer ||
    row.golfer_name ||
    row.first_name ||
    row.last_name ||
    row.abbr_name ||
    row.competitor?.name
  );
  if (!hasPlayerSignal) return null;

  const name = normalizePlayerName(
    row.name ||
    row.player ||
    row.player_name ||
    row.full_name ||
    row.strPlayer ||
    row.PlayerName ||
    row.golfer ||
    row.golfer_name ||
    row.competitor?.name ||
    [row.first_name, row.last_name].filter(Boolean).join(" ")
  );
  if (!name) return null;
  return {
    name,
    country: row.country || row.nationality || row.strCountry || null,
    rank: row.rank || row.world_rank || row.intRank || row.position || null,
  };
}

function extractPlayersFromPayload(payload) {
  if (!payload) return [];

  const directKeys = [
    "players",
    "player",
    "playerstats",
    "eventstats",
    "leaderboard",
    "results",
    "field",
    "entries",
    "competitors",
    "competitor",
    "participants",
    "participant",
    "statistics",
    "standings",
    "data",
    "response",
  ];

  const players = [];
  for (const key of directKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      players.push(...value.map(coerceFieldPlayer).filter(Boolean));
    }
  }

  if (Array.isArray(payload)) {
    players.push(...payload.map(coerceFieldPlayer).filter(Boolean));
  }

  // Some APIs nest arrays one level deeper under data/results.
  for (const key of ["data", "results", "response"]) {
    const value = payload[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const nestedVal of Object.values(value)) {
        if (Array.isArray(nestedVal)) {
          players.push(...nestedVal.map(coerceFieldPlayer).filter(Boolean));
        }
      }
    }
  }

  return players;
}

function renderTemplateUrl(template, vars) {
  let out = String(template || "");
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, encodeURIComponent(String(v ?? "")));
  }
  return out;
}

// ─── RapidAPI (SlashGolf) quota + cache guardrails ────────────
// RapidAPI free tiers have hard limits. We enforce a conservative in-process budget so
// we don't burn the monthly allotment with background retries.
const SLASHGOLF_CACHE_TTL_MS = Number(process.env.SLASHGOLF_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6h
const SLASHGOLF_MONTHLY_LIMIT = Number(process.env.SLASHGOLF_MONTHLY_LIMIT || 250);
const SLASHGOLF_RATE_LIMIT_PER_MIN = Number(process.env.SLASHGOLF_RATE_LIMIT_PER_MIN || 60);
const SLASHGOLF_MIN_INTERVAL_MS = Number(process.env.SLASHGOLF_MIN_INTERVAL_MS || 1100);
const SLASHGOLF_STATE = {
  monthKey: null,
  monthCount: 0,
  minuteKey: null,
  minuteCount: 0,
  nextAllowedAtMs: 0,
};
const SLASHGOLF_CACHE = new Map(); // url -> { ts, json }

function slashgolfKeyParts() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  return {
    monthKey: `${y}-${m}`,
    minuteKey: `${y}-${m}-${d}T${hh}:${mm}`,
  };
}

function slashgolfResetWindowsIfNeeded() {
  const { monthKey, minuteKey } = slashgolfKeyParts();
  if (SLASHGOLF_STATE.monthKey !== monthKey) {
    SLASHGOLF_STATE.monthKey = monthKey;
    SLASHGOLF_STATE.monthCount = 0;
  }
  if (SLASHGOLF_STATE.minuteKey !== minuteKey) {
    SLASHGOLF_STATE.minuteKey = minuteKey;
    SLASHGOLF_STATE.minuteCount = 0;
  }
}

function slashgolfCanCall() {
  slashgolfResetWindowsIfNeeded();
  if (SLASHGOLF_STATE.monthCount >= SLASHGOLF_MONTHLY_LIMIT) {
    return { ok: false, reason: "monthly_limit" };
  }
  if (SLASHGOLF_STATE.minuteCount >= SLASHGOLF_RATE_LIMIT_PER_MIN) {
    return { ok: false, reason: "rate_limit" };
  }
  const now = Date.now();
  if (now < SLASHGOLF_STATE.nextAllowedAtMs) {
    return { ok: false, reason: "spacing", retryAfterMs: SLASHGOLF_STATE.nextAllowedAtMs - now };
  }
  return { ok: true };
}

function slashgolfRegisterCall() {
  slashgolfResetWindowsIfNeeded();
  SLASHGOLF_STATE.monthCount += 1;
  SLASHGOLF_STATE.minuteCount += 1;
  SLASHGOLF_STATE.nextAllowedAtMs = Date.now() + SLASHGOLF_MIN_INTERVAL_MS;
}

function sleepMs(ms) {
  const wait = Number(ms || 0);
  if (!Number.isFinite(wait) || wait <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, wait));
}

function dateDistanceDays(a, b) {
  if (!a || !b) return 3650;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 3650;
  return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}

// ─── DataGolf (Scratch Plus) – upcoming tournament fields/tee times ─────────
const DATAGOLF_API_KEY = process.env.DATAGOLF_API_KEY || "";
const DATAGOLF_BASE_URL = (process.env.DATAGOLF_BASE_URL || "https://feeds.datagolf.com").replace(/\/+$/, "");
const DATAGOLF_TOUR = (process.env.DATAGOLF_TOUR || "pga").toLowerCase();
const DATAGOLF_CACHE_TTL_MS = Number(process.env.DATAGOLF_CACHE_TTL_MS || 10 * 60 * 1000); // 10m
const DATAGOLF_RATE_LIMIT_PER_MIN = Number(process.env.DATAGOLF_RATE_LIMIT_PER_MIN || 45);
const DATAGOLF_STATE = { minuteKey: null, minuteCount: 0, nextAllowedAtMs: 0 };
const DATAGOLF_CACHE = new Map(); // url -> { ts, json }

// Longer-lived, normalized DataGolf reference data (player list + rankings)
// Used to ensure projected fields include the right names/countries and have stable OWGR sorting.
const DATAGOLF_PLAYERLIST_TTL_MS = Number(process.env.DATAGOLF_PLAYERLIST_TTL_MS || 12 * 60 * 60 * 1000); // 12h
const DATAGOLF_RANKINGS_TTL_MS = Number(process.env.DATAGOLF_RANKINGS_TTL_MS || 30 * 60 * 1000); // 30m
const DATAGOLF_PLAYERLIST_STATE = { ts: 0, map: new Map() }; // dg_id -> { name, country }
const DATAGOLF_RANKINGS_STATE = { ts: 0, map: new Map() }; // dg_id -> { world_rank }

function datagolfMinuteKey() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function datagolfResetWindowIfNeeded() {
  const k = datagolfMinuteKey();
  if (DATAGOLF_STATE.minuteKey !== k) {
    DATAGOLF_STATE.minuteKey = k;
    DATAGOLF_STATE.minuteCount = 0;
  }
}

function datagolfCanCall() {
  datagolfResetWindowIfNeeded();
  if (DATAGOLF_STATE.minuteCount >= DATAGOLF_RATE_LIMIT_PER_MIN) return { ok: false, reason: "rate_limit" };
  const now = Date.now();
  if (now < DATAGOLF_STATE.nextAllowedAtMs) return { ok: false, reason: "spacing", retryAfterMs: DATAGOLF_STATE.nextAllowedAtMs - now };
  return { ok: true };
}

function datagolfRegisterCall() {
  datagolfResetWindowIfNeeded();
  DATAGOLF_STATE.minuteCount += 1;
  // ~40/min max to stay under 45/min.
  DATAGOLF_STATE.nextAllowedAtMs = Date.now() + 1500;
}

async function datagolfFetchJson(url) {
  const cached = DATAGOLF_CACHE.get(url);
  if (cached && Date.now() - cached.ts < DATAGOLF_CACHE_TTL_MS) return cached.json;

  const decision = datagolfCanCall();
  if (!decision.ok) {
    if (decision.reason === "spacing" && decision.retryAfterMs && decision.retryAfterMs < 2500) {
      await sleepMs(decision.retryAfterMs);
    } else {
      throw new Error("DataGolf rate limit/spacing in effect.");
    }
  }
  datagolfRegisterCall();
  const resp = await fetch(url, { timeout: 12000 });
  if (!resp.ok) throw new Error(`DataGolf returned ${resp.status}`);
  const json = await resp.json();
  DATAGOLF_CACHE.set(url, { ts: Date.now(), json });
  return json;
}

function pickFirstArray(json, keys) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];
  for (const k of keys || []) {
    if (Array.isArray(json[k])) return json[k];
  }
  // Some endpoints return { data: { players: [...] } }-style shapes.
  for (const v of Object.values(json)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

async function getDataGolfPlayerListMap() {
  if (!DATAGOLF_API_KEY) return new Map();
  if (DATAGOLF_PLAYERLIST_STATE.map.size && (Date.now() - DATAGOLF_PLAYERLIST_STATE.ts) < DATAGOLF_PLAYERLIST_TTL_MS) {
    return DATAGOLF_PLAYERLIST_STATE.map;
  }
  const url = `${DATAGOLF_BASE_URL}/get-player-list?file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
  const json = await datagolfFetchJson(url);
  const items = pickFirstArray(json, ["players", "data", "player_list", "list"]);
  const next = new Map();
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const id = Number(row.dg_id ?? row.dgid ?? row.datagolf_id ?? row.player_id ?? row.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const name = normalizePlayerName(row.player_name ?? row.full_name ?? row.name ?? row.player ?? row.display_name ?? "");
    if (!name) continue;
    const country = row.country || row.nationality || row.country_code || row.country_name || null;
    next.set(id, { name, country });
  }
  if (next.size) {
    DATAGOLF_PLAYERLIST_STATE.ts = Date.now();
    DATAGOLF_PLAYERLIST_STATE.map = next;
  }
  return DATAGOLF_PLAYERLIST_STATE.map;
}

async function getDataGolfRankingsMap() {
  if (!DATAGOLF_API_KEY) return new Map();
  if (DATAGOLF_RANKINGS_STATE.map.size && (Date.now() - DATAGOLF_RANKINGS_STATE.ts) < DATAGOLF_RANKINGS_TTL_MS) {
    return DATAGOLF_RANKINGS_STATE.map;
  }
  const url = `${DATAGOLF_BASE_URL}/preds/get-dg-rankings?file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
  const json = await datagolfFetchJson(url);
  const items = pickFirstArray(json, ["rankings", "data", "players", "results"]);
  const next = new Map();
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const id = Number(row.dg_id ?? row.dgid ?? row.datagolf_id ?? row.player_id ?? row.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const worldRank = Number(row.owgr_rank ?? row.owgr ?? row.world_rank ?? row.rank ?? row.owgrRank);
    if (Number.isFinite(worldRank) && worldRank > 0) next.set(id, { world_rank: worldRank });
  }
  if (next.size) {
    DATAGOLF_RANKINGS_STATE.ts = Date.now();
    DATAGOLF_RANKINGS_STATE.map = next;
  }
  return DATAGOLF_RANKINGS_STATE.map;
}

async function enrichPlayersFromDataGolfRefs(players) {
  const rows = Array.isArray(players) ? players : [];
  if (!rows.length) return [];
  const needsList = rows.some((p) => Number(p?.id) > 0 && (!p?.name || !p?.country));
  const needsRank = rows.some((p) => Number(p?.id) > 0 && !(Number(p?.world_rank) > 0));

  let listMap = null;
  let rankMap = null;
  try {
    if (needsList) listMap = await getDataGolfPlayerListMap();
    if (needsRank) rankMap = await getDataGolfRankingsMap();
  } catch {
    // If the reference endpoints fail, keep raw players; field import should still work.
  }

  return rows
    .map((p) => {
      const id = Number(p?.id) || null;
      const out = { ...p };
      if (id && listMap?.has(id)) {
        const meta = listMap.get(id);
        if (!out.name && meta?.name) out.name = meta.name;
        if (!out.country && meta?.country) out.country = meta.country;
      }
      if (id && rankMap?.has(id)) {
        const meta = rankMap.get(id);
        if (!(Number(out.world_rank) > 0) && Number(meta?.world_rank) > 0) out.world_rank = Number(meta.world_rank);
      }
      return out;
    })
    .filter((p) => p?.name);
}

function normKey(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function strongNameMatch(a, b) {
  const stop = new Set(["the", "of", "and", "in", "at", "on", "for", "a", "an", "to", "by", "with", "presented"]);
  const aa = normKey(a);
  const bb = normKey(b);
  if (!aa || !bb) return false;
  if (aa.includes(bb) || bb.includes(aa)) return true;

  const ta = aa.split(" ").filter((t) => t && !stop.has(t));
  const tb = bb.split(" ").filter((t) => t && !stop.has(t));
  const small = ta.length <= tb.length ? ta : tb;
  const big = ta.length <= tb.length ? tb : ta;
  if (!small.length || !big.length) return false;
  const bigSet = new Set(big);
  const covered = small.filter((t) => bigSet.has(t)).length;
  return covered >= Math.max(1, Math.ceil(small.length * 0.6));
}

function pickBestDataGolfEvent(scheduleItems, tournament) {
  const targetName = normKey(tournament?.name || "");
  const targetDate = tournament?.start_date || "";
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const ev of scheduleItems) {
    const evName = normKey(ev.event_name || ev.name);
    const namePenalty = (evName.includes(targetName) || targetName.includes(evName)) ? 0 : 25;
    const datePenalty = dateDistanceDays(targetDate, ev.start_date || ev.startDate || ev.date);
    const score = namePenalty + datePenalty;
    if (score < bestScore) { bestScore = score; best = ev; }
  }
  return best;
}

async function fetchDataGolfFieldPlayers(tournament) {
  if (!DATAGOLF_API_KEY) return { players: [], provider: null, urlsTried: [], error: "DATAGOLF_API_KEY not set." };

  const targetName = normKey(tournament?.name || "");
  const targetDate = tournament?.start_date || "";

  const toursToTry = Array.from(new Set([
    DATAGOLF_TOUR,
    "upcoming_pga",
    "pga",
    "opp",
    "euro",
    "kft",
    "alt",
    "all", // undocumented, but harmless to try if supported
  ].map((t) => String(t || "").toLowerCase()).filter(Boolean)));

  const urlsTried = [];
  let scheduleEventId = null;
  let scheduleEventName = null;

  // 0) If this is already a DataGolf-sourced schedule row (id starts with dg_), the event_id is in the id.
  const tid = String(tournament?.id || "");
  if (tid.startsWith("dg_")) {
    scheduleEventName = tournament?.name || null;
    const candidate = tid.slice(3);
    // DataGolf schedule rows sometimes use a hashed placeholder ID when event_id is "TBD".
    // Never treat that as a real event_id for field matching.
    if (!/^\d{4}_[0-9a-f]{12}$/i.test(candidate)) {
      scheduleEventId = candidate;
    }
  }

  // 1) For our stable internal ids (t1..t20), prefer matching against the dg_* tournament row
  // we already store in Supabase so we don't waste DataGolf API calls and we get a reliable event_id.
  if (!scheduleEventId && tournament?.start_date) {
    try {
      const base = new Date(`${String(tournament.start_date).slice(0, 10)}T00:00:00Z`);
      if (!Number.isNaN(base.getTime())) {
        const min = new Date(base); min.setUTCDate(min.getUTCDate() - 10);
        const max = new Date(base); max.setUTCDate(max.getUTCDate() + 10);
        const minIso = min.toISOString().slice(0, 10);
        const maxIso = max.toISOString().slice(0, 10);

        const { data: candidates } = await supabase
          .from("tournaments")
          .select("id, name, start_date")
          .like("id", "dg_%")
          .gte("start_date", minIso)
          .lte("start_date", maxIso)
          .order("start_date", { ascending: true });

        const list = Array.isArray(candidates) ? candidates : [];
        const best = pickBestDataGolfEvent(list, tournament);
        const bestName = best?.name || best?.event_name || "";
        // Only trust the nearby dg_* row if it strongly matches our intended tournament name.
        // Otherwise we can accidentally lock onto the wrong week (common for majors if schedule tour excludes them).
        if (best?.id && String(best.id).startsWith("dg_") && strongNameMatch(bestName, tournament?.name || "")) {
          const candidate = String(best.id).slice(3);
          if (!/^\d{4}_[0-9a-f]{12}$/i.test(candidate)) scheduleEventId = candidate;
          scheduleEventName = bestName || null;
        }
      }
    } catch {}
  }

  // Use DataGolf schedule to get a stable event_id, then match that in field-updates.
  // This is critical for majors where name-only matching can accidentally pick the wrong week.
  if (!scheduleEventId) {
    try {
      const year = String(tournament?.start_date || "").slice(0, 4) || String(new Date().getUTCFullYear());
      const scheduleUrl = `${DATAGOLF_BASE_URL}/get-schedule?tour=all&season=${encodeURIComponent(year)}&upcoming_only=no&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
      urlsTried.push(scheduleUrl);
      const scheduleJson = await datagolfFetchJson(scheduleUrl);
      const scheduleItems = []
        .concat(scheduleJson?.schedule || [])
        .concat(scheduleJson?.events || [])
        .concat(scheduleJson?.data || [])
        .concat(Array.isArray(scheduleJson) ? scheduleJson : [])
        .filter((x) => x && typeof x === "object");
      const bestEvent = pickBestDataGolfEvent(scheduleItems, tournament);
      const rawEventId = bestEvent?.event_id ?? bestEvent?.eventId ?? bestEvent?.id ?? null;
      const rawStr = String(rawEventId || "").trim();
      // DataGolf sometimes uses "TBD" placeholders. Never treat those as matchable event_ids.
      scheduleEventId = rawStr && !/^tbd$/i.test(rawStr) ? rawEventId : null;
      scheduleEventName = scheduleEventName || bestEvent?.event_name || bestEvent?.name || null;
    } catch {}
  }
  if (scheduleEventId && !scheduleEventName) scheduleEventName = tournament?.name || null;

  const coercePlayers = (arr) => (arr || [])
    .map((p) => ({
      id: Number(p.dg_id || p.dgid || p.datagolf_id || p.player_id) || null,
      name: normalizePlayerName(p.player_name || p.name || p.full_name || p.player || ""),
      country: p.country || p.nationality || null,
      world_rank: Number(p.owgr || p.owgr_rank || p.world_rank || p.rank) || null,
    }))
    // Allow missing names as long as we have a dg_id; we can enrich from DataGolf player list.
    .filter((p) => p.id || p.name);

  const findBestPlayerArray = (node) => {
    let best = [];
    const seen = new Set();
    const walk = (x, depth) => {
      if (!x || depth > 6) return;
      if (Array.isArray(x)) {
        // Candidate player list if objects look like players.
        if (x.length && typeof x[0] === "object") {
          const sample = x.slice(0, 10);
          const looksLikePlayers = sample.some((p) => p && typeof p === "object" && (p.player_name || p.full_name || p.name || p.player));
          if (looksLikePlayers && x.length > best.length) best = x;
        }
        for (const el of x.slice(0, 30)) walk(el, depth + 1);
        return;
      }
      if (typeof x !== "object") return;
      if (seen.has(x)) return;
      seen.add(x);
      for (const v of Object.values(x)) walk(v, depth + 1);
    };
    walk(node, 0);
    return best;
  };

  const getEventName = (ev) => normKey(ev?.event_name || ev?.eventName || ev?.name || ev?.tournament_name || ev?.tournament || "");
  const getEventDate = (ev) => ev?.start_date || ev?.startDate || ev?.event_start_date || ev?.date || ev?.start || "";

  // DataGolf's `field-updates` endpoint sometimes returns a flat list of rows (one per player)
  // with `event_id`/`event_name` repeated per row. In that case we need to group rows by event.
  const getRowEventId = (r) => r?.event_id ?? r?.eventId ?? r?.tournament_id ?? r?.tournamentId ?? r?.id ?? null;
  const getRowEventName = (r) => r?.event_name || r?.eventName || r?.event || r?.tournament_name || r?.tournament || r?.name || "";
  const getRowEventDate = (r) => r?.start_date || r?.startDate || r?.event_start_date || r?.date || r?.start || r?.starts_at || "";
  const looksLikeFlatPlayerRow = (r) => {
    if (!r || typeof r !== "object") return false;
    const hasPlayer = !!(r.player_name || r.full_name || r.player || r.name);
    const hasEvent = !!(r.event_name || r.eventName || r.event_id || r.eventId || r.tournament_id || r.tournamentId);
    return hasPlayer && hasEvent;
  };
  const pickBestPlayersFromFlatRows = (flatRows) => {
    const scheduleName = normKey(scheduleEventName || "");
    const strictName = scheduleEventName || tournament?.name || "";
    const groups = new Map(); // key -> { event_id, event_name, start_date, rows }
    for (const row of flatRows || []) {
      if (!looksLikeFlatPlayerRow(row)) continue;
      const eid = getRowEventId(row);
      const ename = getRowEventName(row);
      const key = (eid != null && String(eid).trim())
        ? `id:${String(eid).trim()}`
        : (ename ? `name:${normKey(ename)}` : null);
      if (!key) continue;
      const g = groups.get(key) || { event_id: eid != null ? String(eid).trim() : null, event_name: ename || "", start_date: null, rows: [] };
      g.rows.push(row);
      if (!g.event_name && ename) g.event_name = ename;
      if (!g.start_date) {
        const d = getRowEventDate(row);
        if (d) g.start_date = d;
      }
      groups.set(key, g);
    }

    // Best: match by event_id from the schedule, when possible.
    if (scheduleEventId) {
      const direct = groups.get(`id:${String(scheduleEventId).trim()}`) || null;
      if (direct) {
        const players = coercePlayers(direct.rows);
        if (players.length) return { players, event_id: direct.event_id };
      }
    }

    // Fallback: choose the closest event name/date match with a realistic field size.
    let bestPlayers = [];
    let bestScore = Number.POSITIVE_INFINITY;
    let bestEventId = null;
    for (const g of groups.values()) {
      if (strictName && !strongNameMatch(g.event_name || "", strictName)) continue;
      const evName = normKey(g.event_name || "");
      if (!evName) continue;
      const namePenalty =
        (scheduleName && (evName.includes(scheduleName) || scheduleName.includes(evName))) ? 0 :
        ((evName.includes(targetName) || targetName.includes(evName)) ? 10 : 40);
      const datePenalty = dateDistanceDays(targetDate, g.start_date);
      const players = coercePlayers(g.rows);
      if (!players.length) continue;
      const sizePenalty = players.length < 50 ? 25 : 0;
      const score = namePenalty + datePenalty + sizePenalty;
      if (score < bestScore) {
        bestScore = score;
        bestPlayers = players;
        bestEventId = g.event_id || null;
      }
    }
    return { players: bestPlayers, event_id: bestEventId };
  };

  const pickBestEventFromPayload = (json) => {
    const scheduleName = normKey(scheduleEventName || "");
    const strictName = scheduleEventId ? (scheduleEventName || tournament?.name || "") : "";
    const candidates = [];
    if (Array.isArray(json)) candidates.push(...json);
    if (json && typeof json === "object") {
      for (const key of ["events", "tournaments", "schedule", "data", "results"]) {
        if (Array.isArray(json[key])) candidates.push(...json[key]);
      }
      // Some feeds are a single event object.
      candidates.push(json);
    }

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestPlayers = [];
    let bestEventId = null;
    for (const ev of candidates.filter((x) => x && typeof x === "object")) {
      if (strictName && !strongNameMatch(ev?.event_name || ev?.eventName || ev?.name || "", strictName)) continue;
      const evName = getEventName(ev);
      if (!evName) continue;
      const namePenalty =
        (scheduleName && (evName.includes(scheduleName) || scheduleName.includes(evName))) ? 0 :
        ((evName.includes(targetName) || targetName.includes(evName)) ? 10 : 40);
      const datePenalty = dateDistanceDays(targetDate, getEventDate(ev));

      // Extract player list from common keys first, then fallback to a recursive search.
      const rawList =
        (Array.isArray(ev.field) && ev.field) ||
        (Array.isArray(ev.players) && ev.players) ||
        (Array.isArray(ev.entries) && ev.entries) ||
        (Array.isArray(ev.data) && ev.data) ||
        findBestPlayerArray(ev);
      const players = coercePlayers(rawList);
      if (!players.length) continue;

      // Prefer "real" field sizes.
      const sizePenalty = players.length < 50 ? 25 : 0;
      const score = namePenalty + datePenalty + sizePenalty;
      if (score < bestScore) {
        bestScore = score;
        best = ev;
        bestPlayers = players;
        bestEventId = ev?.event_id ?? ev?.eventId ?? ev?.id ?? null;
      }
    }
    return { best, players: bestPlayers, event_id: bestEventId };
  };

  for (const tour of toursToTry) {
    const url = `${DATAGOLF_BASE_URL}/field-updates?tour=${encodeURIComponent(tour)}&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
    urlsTried.push(url);
    try {
      const json = await datagolfFetchJson(url);

      // Flat rows form: group by event first.
      if (Array.isArray(json) && json.length && looksLikeFlatPlayerRow(json[0])) {
        const flat = pickBestPlayersFromFlatRows(json);
        if (flat.players?.length) {
          const players = await enrichPlayersFromDataGolfRefs(flat.players);
          return { players, provider: "DataGolf", url, urlsTried, event_id: flat.event_id || null };
        }
      }

      // Nested flat rows: some feeds wrap player rows under a key (e.g., field_updates).
      if (json && typeof json === "object" && !Array.isArray(json)) {
        const nested = findBestPlayerArray(json);
        if (Array.isArray(nested) && nested.length && looksLikeFlatPlayerRow(nested[0])) {
          const flat = pickBestPlayersFromFlatRows(nested);
          if (flat.players?.length) {
            const players = await enrichPlayersFromDataGolfRefs(flat.players);
            return { players, provider: "DataGolf", url, urlsTried, event_id: flat.event_id || null };
          }
        }
      }

      // First: exact match by schedule event_id (most reliable).
      if (scheduleEventId && json && typeof json === "object") {
        const events = Array.isArray(json.events) ? json.events
          : Array.isArray(json.tournaments) ? json.tournaments
            : Array.isArray(json.data) ? json.data
              : [];
        const match = (events || []).find((ev) =>
          String(ev?.event_id ?? ev?.eventId ?? ev?.id ?? "") === String(scheduleEventId)
        );
        if (match) {
          const rawList =
            (Array.isArray(match.field) && match.field) ||
            (Array.isArray(match.players) && match.players) ||
            (Array.isArray(match.entries) && match.entries) ||
            (Array.isArray(match.data) && match.data) ||
            findBestPlayerArray(match);
          const players = coercePlayers(rawList);
          if (players.length) {
            const enriched = await enrichPlayersFromDataGolfRefs(players);
            return { players: enriched, provider: "DataGolf", url, urlsTried, event_id: String(scheduleEventId) };
          }
        }
      }

      const out = pickBestEventFromPayload(json);
      if (out.players?.length) {
        const players = await enrichPlayersFromDataGolfRefs(out.players);
        return { players, provider: "DataGolf", url, urlsTried, event_id: out.event_id || null };
      }
    } catch {}
  }

  return { players: [], provider: "DataGolf", urlsTried, error: "No matching projected field found in DataGolf field-updates yet." };
}

async function fetchRapidApiFieldPlayers(tournament) {
  // Separate "RapidAPI GolfCourseAPI" (courses) from "RapidAPI SlashGolf" (tournaments/leaderboards/fields).
  // If you only set RAPIDAPI_KEY/HOST, those will still work as a fallback.
  const rapidKey =
    process.env.SLASHGOLF_RAPIDAPI_KEY ||
    process.env.RAPIDAPI_GOLF_KEY ||
    process.env.RAPIDAPI_KEY;
  const rapidHost =
    process.env.SLASHGOLF_RAPIDAPI_HOST ||
    process.env.RAPIDAPI_GOLF_HOST ||
    process.env.RAPIDAPI_HOST;
  const rapidBase = (
    process.env.SLASHGOLF_RAPIDAPI_BASE_URL ||
    process.env.RAPIDAPI_GOLF_BASE_URL ||
    process.env.RAPIDAPI_BASE_URL ||
    ""
  ).replace(/\/+$/, "");
  const customTemplate =
    process.env.SLASHGOLF_RAPIDAPI_FIELD_URL_TEMPLATE ||
    process.env.RAPIDAPI_GOLF_FIELD_URL_TEMPLATE ||
    "";

  if (!rapidKey || !rapidHost) {
    return {
      players: [],
      provider: null,
      urlsTried: [],
      error: "RapidAPI not configured (missing SLASHGOLF_RAPIDAPI_KEY and/or SLASHGOLF_RAPIDAPI_HOST).",
    };
  }
  // Common misconfig: "rapidapi.com" is not an endpoint base.
  if (rapidBase && /rapidapi\.com/i.test(rapidBase) && !/p\.rapidapi\.com/i.test(rapidBase)) {
    return { players: [], provider: "RapidAPI", urlsTried: [], error: "RAPIDAPI base URL must be the API endpoint host (like https://<api>.p.rapidapi.com), not rapidapi.com." };
  }
  if (!rapidBase) {
    return {
      players: [],
      provider: "RapidAPI",
      urlsTried: [],
      error: "RapidAPI configured but missing SLASHGOLF_RAPIDAPI_BASE_URL (expected https://live-golf-data.p.rapidapi.com).",
    };
  }

  const vars = {
    id: tournament?.id || "",
    tsdb_event_id: String(tournament?.id || "").startsWith("tsdb_") ? String(tournament.id).slice(5) : "",
    name: tournament?.name || "",
    start_date: tournament?.start_date || "",
    year: String(tournament?.start_date || "").slice(0, 4),
  };

  const urls = [];
  if (customTemplate) urls.push(renderTemplateUrl(customTemplate, vars));
  if (rapidBase && tournament?.name) {
    urls.push(
      `${rapidBase}/leaderboard?event=${encodeURIComponent(tournament.name)}`,
      `${rapidBase}/leaderboard?name=${encodeURIComponent(tournament.name)}`,
      `${rapidBase}/events?name=${encodeURIComponent(tournament.name)}`,
      `${rapidBase}/tournaments?name=${encodeURIComponent(tournament.name)}`
    );
  }
  if (rapidBase && vars.tsdb_event_id) {
    urls.push(
      `${rapidBase}/leaderboard?eventId=${encodeURIComponent(vars.tsdb_event_id)}`,
      `${rapidBase}/event?eventId=${encodeURIComponent(vars.tsdb_event_id)}`
    );
  }
  // SlashGolf "Live Golf Data" tends to expose plural endpoints like /tournaments and /leaderboards.
  // We attempt a minimal schedule/tournaments fetch by year to get an internal event id, then try leaderboards/scorecards.
  if (rapidBase && vars.year) {
    urls.push(
      `${rapidBase}/tournaments?orgId=1&year=${encodeURIComponent(vars.year)}`,
      `${rapidBase}/tournaments?tourId=1&year=${encodeURIComponent(vars.year)}`,
      `${rapidBase}/schedule?orgId=1&year=${encodeURIComponent(vars.year)}`
    );
  }

  const dedupedUrls = Array.from(new Set(urls.filter(Boolean)));
  const headers = {
    "x-rapidapi-key": rapidKey,
    "x-rapidapi-host": rapidHost,
  };

  for (const url of dedupedUrls) {
    // Cache hit (helps avoid burning monthly quota on repeated imports).
    const cached = SLASHGOLF_CACHE.get(url);
    if (cached && Date.now() - cached.ts < SLASHGOLF_CACHE_TTL_MS) {
      const players = extractPlayersFromPayload(cached.json);
      if (players.length) return { players, provider: "RapidAPI (cache)", url, urlsTried: dedupedUrls };
    }

    const decision = slashgolfCanCall();
    if (!decision.ok) {
      if (decision.reason === "spacing" && decision.retryAfterMs && decision.retryAfterMs < 2500) {
        await sleepMs(decision.retryAfterMs);
      } else {
        return {
          players: [],
          provider: "RapidAPI",
          urlsTried: dedupedUrls,
          error: decision.reason === "monthly_limit"
            ? `RapidAPI monthly limit reached (${SLASHGOLF_MONTHLY_LIMIT}/month).`
            : decision.reason === "rate_limit"
              ? "RapidAPI rate limit reached (per-minute)."
              : "RapidAPI call spacing in effect.",
          retryAfterMs: decision.retryAfterMs || null,
        };
      }
    }
    try {
      slashgolfRegisterCall();
      const resp = await fetch(url, { headers, timeout: 12000 });
      if (!resp.ok) continue;
      const json = await resp.json();
      SLASHGOLF_CACHE.set(url, { ts: Date.now(), json });
      const players = extractPlayersFromPayload(json);
      if (players.length) {
        return { players, provider: "RapidAPI", url, urlsTried: dedupedUrls };
      }
    } catch {}
  }

  // If the API doesn't publish a tournament field until the event starts, a ranking-based
  // provisional list can keep drafts unblocked. Default is OFF (accuracy first).
  if (rapidBase && ALLOW_PROVISIONAL_FIELDS) {
    const fallbackUrls = [
      `${rapidBase}/worldranking`,
      `${rapidBase}/worldrankings`,
      `${rapidBase}/world-rankings`,
      `${rapidBase}/players`,
      `${rapidBase}/players?orgId=1`,
    ];
    for (const url of fallbackUrls) {
      const cached = SLASHGOLF_CACHE.get(url);
      if (cached && Date.now() - cached.ts < SLASHGOLF_CACHE_TTL_MS) {
        const players = extractPlayersFromPayload(cached.json);
        if (players.length) {
          return { players, provider: "RapidAPI (ranking fallback)", url, urlsTried: [...dedupedUrls, ...fallbackUrls] };
        }
      }
      const decision = slashgolfCanCall();
      if (!decision.ok) {
        if (decision.reason === "spacing" && decision.retryAfterMs && decision.retryAfterMs < 2500) {
          await sleepMs(decision.retryAfterMs);
        } else {
          break;
        }
      }
      try {
        slashgolfRegisterCall();
        const resp = await fetch(url, { headers, timeout: 12000 });
        if (!resp.ok) continue;
        const json = await resp.json();
        SLASHGOLF_CACHE.set(url, { ts: Date.now(), json });
        const players = extractPlayersFromPayload(json);
        if (players.length) {
          return { players, provider: "RapidAPI (ranking fallback)", url, urlsTried: [...dedupedUrls, ...fallbackUrls] };
        }
      } catch {}
    }
  }

  return { players: [], provider: "RapidAPI", urlsTried: dedupedUrls };
}

async function fetchSportradarFieldPlayers(tournament) {
  const apiKey = process.env.SPORTRADAR_API_KEY || "";
  const baseUrl = (process.env.SPORTRADAR_GOLF_BASE_URL || "").replace(/\/+$/, "");
  const accessLevel = process.env.SPORTRADAR_ACCESS_LEVEL || "trial";
  const version = process.env.SPORTRADAR_GOLF_VERSION || "v3";
  const language = process.env.SPORTRADAR_LANG || "en";
  const customTemplate = process.env.SPORTRADAR_GOLF_FIELD_URL_TEMPLATE || "";
  const tournamentMapRaw = process.env.SPORTRADAR_TOURNAMENT_MAP || "{}";
  let tournamentMap = {};
  try { tournamentMap = JSON.parse(tournamentMapRaw); } catch {}

  if (!apiKey || !baseUrl) return { players: [], provider: null, urlsTried: [] };

  const mappedId = tournamentMap?.[tournament?.id] || "";
  const vars = {
    id: tournament?.id || "",
    sportradar_tournament_id: mappedId,
    name: tournament?.name || "",
    start_date: tournament?.start_date || "",
    year: String(tournament?.start_date || "").slice(0, 4),
    api_key: apiKey,
    access_level: accessLevel,
    version,
    language,
  };

  const urls = [];
  if (customTemplate) {
    urls.push(renderTemplateUrl(customTemplate, vars));
  }
  if (mappedId) {
    urls.push(
      `${baseUrl}/${accessLevel}/${version}/${language}/tournaments/${encodeURIComponent(mappedId)}/leaderboard.json?api_key=${encodeURIComponent(apiKey)}`,
      `${baseUrl}/${accessLevel}/${version}/${language}/tournaments/${encodeURIComponent(mappedId)}/summary.json?api_key=${encodeURIComponent(apiKey)}`
    );
  }

  const dedupedUrls = Array.from(new Set(urls.filter(Boolean)));
  const headers = {
    "accept": "application/json",
    "x-api-key": apiKey,
    "Authorization": `Bearer ${apiKey}`,
  };

  for (const url of dedupedUrls) {
    try {
      const resp = await fetch(url, { headers, timeout: 12000 });
      if (!resp.ok) continue;
      const json = await resp.json();
      const players = extractPlayersFromPayload(json);
      if (players.length) {
        return { players, provider: "Sportradar", url, urlsTried: dedupedUrls };
      }
    } catch {}
  }

  return { players: [], provider: "Sportradar", urlsTried: dedupedUrls };
}

async function fetchBallDontLieFieldPlayers(tournament) {
  const apiKey = process.env.BALLDONTLIE_PGA_KEY || process.env.BALLDONTLIE_API_KEY || "";
  const baseUrl = (process.env.BALLDONTLIE_PGA_BASE_URL || "https://api.balldontlie.io/pga/v1").replace(/\/+$/, "");
  if (!apiKey || !baseUrl) return { players: [], provider: null, urlsTried: [] };

  const headers = { Authorization: apiKey };
  const tournamentRawId = String(tournament?.id || "").startsWith("bdl_")
    ? String(tournament.id).slice(4)
    : "";
  const fieldSize = Number(tournament?.field_size || 0) || 156;

  const tournamentUrls = tournamentRawId ? [
    `${baseUrl}/tournament_field?tournament_id=${encodeURIComponent(tournamentRawId)}&per_page=200`,
    `${baseUrl}/tournament-fields?tournament_id=${encodeURIComponent(tournamentRawId)}&per_page=200`,
    `${baseUrl}/fields?tournament_id=${encodeURIComponent(tournamentRawId)}&per_page=200`,
  ] : [];

  for (const url of tournamentUrls) {
    try {
      const resp = await fetch(url, { headers, timeout: 12000 });
      if (!resp.ok) continue;
      const json = await resp.json();
      const players = extractPlayersFromPayload(json);
      if (players.length) return { players, provider: "BallDontLie", url, urlsTried: tournamentUrls };
    } catch {}
  }

  // If BallDontLie doesn't publish the tournament field yet, do NOT seed a fake ranking-based field
  // unless explicitly allowed. Accuracy matters for drafts.
  if (!ALLOW_PROVISIONAL_FIELDS) {
    return {
      players: [],
      provider: "BallDontLie",
      urlsTried: tournamentUrls,
      error: "BallDontLie did not return a tournament field (provisional ranking fallback disabled).",
    };
  }

  // Optional fallback: seed a ranked player pool.
  const fallbackUrls = [
    `${baseUrl}/players?per_page=200`,
    `${baseUrl}/players?sort=owgr&per_page=200`,
  ];
  for (const url of fallbackUrls) {
    try {
      const resp = await fetch(url, { headers, timeout: 12000 });
      if (!resp.ok) continue;
      const json = await resp.json();
      const players = extractPlayersFromPayload(json).slice(0, fieldSize);
      if (players.length) {
        return {
          players,
          provider: "BallDontLie (players fallback)",
          url,
          urlsTried: [...tournamentUrls, ...fallbackUrls],
        };
      }
    } catch {}
  }

  return { players: [], provider: "BallDontLie", urlsTried: [...tournamentUrls, ...fallbackUrls] };
}

async function importFieldPlayersIntoTournament(tournamentId, players) {
  const getPoolsForTournament = async () => {
    const { data, error } = await supabase
      .from("pools")
      .select("id")
      .eq("tournament_id", tournamentId);
    if (error) throw error;
    return (data || []).map((p) => p.id).filter(Boolean);
  };

  const getDraftedGolferIdsForTournament = async () => {
    const poolIds = await getPoolsForTournament();
    if (!poolIds.length) return new Set();
    const { data, error } = await supabase
      .from("draft_picks")
      .select("golfer_id")
      .in("pool_id", poolIds);
    if (error) throw error;
    return new Set((data || []).map((p) => p.golfer_id).filter(Boolean));
  };

  const tournamentHasRealScores = async () => {
    const { count, error } = await supabase
      .from("tournament_scores")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .or("position.not.is.null,r1.not.is.null,r2.not.is.null,r3.not.is.null,r4.not.is.null");
    if (error) throw error;
    return Number(count || 0) > 0;
  };

  const uniqueByName = new Map();
  for (const p of players) {
    const name = normalizePlayerName(p.name || p.player || p.full_name);
    if (!name) continue;
    const k = name.toLowerCase();
    if (!uniqueByName.has(k)) {
      uniqueByName.set(k, {
        id: Number(p.id || p.dg_id || p.dgid || p.player_id) || null,
        name,
        country: p.country || p.nationality || null,
        world_rank: Number(p.world_rank || p.rank) || null,
      });
    }
  }
  const normalizedPlayers = Array.from(uniqueByName.values());
  if (!normalizedPlayers.length) return { imported: 0 };

  const golferRows = normalizedPlayers.map((p) => ({
    id: Number.isFinite(Number(p.id)) && Number(p.id) > 0 ? Number(p.id) : toStableGolferId(p.name),
    name: p.name,
    country: p.country || null,
    world_rank: p.world_rank || null,
    updated_at: new Date().toISOString(),
  }));

  const { error: golfersError } = await supabase
    .from("golfers")
    .upsert(golferRows, { onConflict: "id" });
  if (golfersError) return { error: golfersError.message };

  // If we previously imported a provisional/incorrect shell list:
  // - Replace it completely when there are no draft picks yet
  // - Otherwise, reconcile by trimming extras that aren't in the new field and haven't been drafted
  // Never touch fields once real scoring has started.
  let draftedIds = new Set();
  let hasRealScores = false;
  try { draftedIds = await getDraftedGolferIdsForTournament(); } catch {}
  try { hasRealScores = await tournamentHasRealScores(); } catch {}

  if (!hasRealScores && draftedIds.size === 0) {
    try {
      await supabase
        .from("tournament_scores")
        .delete()
        .eq("tournament_id", tournamentId);
    } catch {}
  }

  const scoreShellRows = golferRows.map((g) => ({
    tournament_id: tournamentId,
    golfer_id: g.id,
    updated_at: new Date().toISOString(),
  }));
  const { error: scoreShellError } = await supabase
    .from("tournament_scores")
    .upsert(scoreShellRows, { onConflict: "tournament_id,golfer_id", ignoreDuplicates: true });
  if (scoreShellError) return { error: scoreShellError.message };

  // If picks exist, reconcile by deleting extra shell rows not in the new field and not drafted.
  if (!hasRealScores && draftedIds.size > 0) {
    try {
      const newIds = new Set(golferRows.map((g) => g.id));
      const keepIds = new Set([...newIds, ...draftedIds]);
      const { data: existing } = await supabase
        .from("tournament_scores")
        .select("golfer_id")
        .eq("tournament_id", tournamentId);
      const toDelete = (existing || [])
        .map((r) => r.golfer_id)
        .filter((id) => id && !keepIds.has(id));
      if (toDelete.length) {
        await supabase
          .from("tournament_scores")
          .delete()
          .eq("tournament_id", tournamentId)
          .in("golfer_id", toDelete);
      }
    } catch {}
  }

  // Keep tournaments.field_size aligned to what we actually have draftable.
  try {
    let fieldSize = golferRows.length;
    if (draftedIds.size > 0 && !hasRealScores) {
      const { count } = await supabase
        .from("tournament_scores")
        .select("*", { count: "exact", head: true })
        .eq("tournament_id", tournamentId);
      if (Number(count || 0) > 0) fieldSize = Number(count);
    }
    await supabase
      .from("tournaments")
      .update({ field_size: fieldSize })
      .eq("id", tournamentId);
  } catch {}

  return { imported: golferRows.length };
}

// Expose helpers to routes (e.g., /api/golfers can auto-seed projected fields on-demand).
app.locals.fetchDataGolfFieldPlayers = fetchDataGolfFieldPlayers;
app.locals.importFieldPlayersIntoTournament = importFieldPlayersIntoTournament;

async function tournamentHasField(tournamentId) {
  try {
    const { count } = await supabase
      .from("tournament_scores")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);
    return Number(count || 0) > 0;
  } catch {
    return false;
  }
}

async function autoSeedUpcomingFields() {
  if (!DATAGOLF_API_KEY) return;
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // next 60 days

  const { data: upcoming, error } = await supabase
    .from("tournaments")
    .select("id, name, start_date, field_size")
    .gte("start_date", today)
    .lte("start_date", cutoff)
    .order("start_date", { ascending: true });
  if (error || !Array.isArray(upcoming) || !upcoming.length) return;

  for (const t of upcoming) {
    // Also skip provider-specific ids that aren't ours (just in case).
    if (!t?.id || String(t.id).includes("::")) continue;

    // If real scoring has started, don't touch the field shell list.
    let hasRealScores = false;
    try {
      const { count } = await supabase
        .from("tournament_scores")
        .select("*", { count: "exact", head: true })
        .eq("tournament_id", t.id)
        .or("position.not.is.null,r1.not.is.null,r2.not.is.null,r3.not.is.null,r4.not.is.null");
      hasRealScores = Number(count || 0) > 0;
    } catch {}
    if (hasRealScores) continue;

    try {
      const dg = await fetchDataGolfFieldPlayers(t);
      if (!dg.players?.length) continue;
      const result = await importFieldPlayersIntoTournament(t.id, dg.players);
      if (!result?.error && (result.imported || 0) > 0) {
        console.log(`✅ Auto-seeded field: ${t.name} (${t.id}) – ${result.imported} players via DataGolf`);
      }
      // Gentle spacing between tournaments to avoid DataGolf burst suspensions.
      await sleepMs(800);
    } catch (e) {
      console.warn(`Field auto-seed failed for ${t.id}:`, e?.message || e);
    }
  }
}

app.post("/api/admin/import-field/:tournamentId", async (req, res, next) => {
  try {
    const required = process.env.ADMIN_TOKEN;
    if (required && req.headers["x-admin-token"] !== required) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tournamentId } = req.params;
    const players = parsePlayersFromBody(req.body);
    if (!players.length) {
      return res.status(400).json({
        error: "No players found. Send `players` array or `csv` text in request body.",
      });
    }

    const result = await importFieldPlayersIntoTournament(tournamentId, players);
    if (result?.error) return res.status(400).json({ error: result.error });

    return res.json({
      imported: result.imported || 0,
      tournament_id: tournamentId,
      message: "Tournament field imported. Draft list will now use this field.",
    });
  } catch (e) {
    return next(e);
  }
});

app.post("/api/admin/import-field-auto/:tournamentId", async (req, res, next) => {
  try {
    const required = process.env.ADMIN_TOKEN;
    if (required && req.headers["x-admin-token"] !== required) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tournamentId } = req.params;
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id, name, start_date")
      .eq("id", tournamentId)
      .single();
    if (!tournament) return res.status(404).json({ error: "Tournament not found." });

    const eventId = String(tournamentId || "").startsWith("tsdb_")
      ? String(tournamentId).slice(5)
      : await resolveTheSportsDbEventId(tournamentId, supabase);

    let players = [];
    let source = "unknown";
    let importedEventId = null;
    const debug = [];
    let lockedToPrimary = false;

    // 0) DataGolf first (best for upcoming fields)
    if (!players.length) {
      const dg = await fetchDataGolfFieldPlayers(tournament);
      debug.push({ provider: dg.provider || "DataGolf", url: dg.url || null, urlsTried: dg.urlsTried || [], count: dg.players?.length || 0, error: dg.error || null, event_id: dg.event_id || null });
      if (dg.players?.length) {
        players = dg.players;
        source = "DataGolf";
        importedEventId = dg.event_id != null ? String(dg.event_id) : null;
        // Do not merge in other providers after DataGolf; it makes fields inaccurate.
        lockedToPrimary = true;
      }
    }

    // 1) Sportradar first (if configured)
    if (!players.length && !lockedToPrimary) {
      const sr = await fetchSportradarFieldPlayers(tournament);
      debug.push({ provider: "Sportradar", url: sr.url || null, urlsTried: sr.urlsTried || [], count: sr.players?.length || 0, error: sr.error || null });
      if (sr.players?.length) {
        players = sr.players;
        source = "Sportradar";
      }
    }

    // 2) BallDontLie PGA
    if (!players.length && !lockedToPrimary) {
      const bdl = await fetchBallDontLieFieldPlayers(tournament);
      debug.push({ provider: "BallDontLie", url: bdl.url || null, urlsTried: bdl.urlsTried || [], count: bdl.players?.length || 0, error: bdl.error || null });
      if (bdl.players?.length) {
        players = bdl.players;
        source = bdl.provider || "BallDontLie";
      }
    }

    // 3) TheSportsDB
    if (eventId && !lockedToPrimary) {
      const tsdbKey = process.env.THE_SPORTS_DB_KEY || "3";
      const base = `https://www.thesportsdb.com/api/v1/json/${tsdbKey}`;
      const urls = [
        `${base}/lookupeventstats.php?id=${encodeURIComponent(eventId)}`,
        `${base}/lookupevent.php?id=${encodeURIComponent(eventId)}`,
        `${base}/lookupround.php?id=${encodeURIComponent(eventId)}`,
      ];

      for (const url of urls) {
        try {
          const resp = await fetch(url, { timeout: 12000 });
          if (!resp.ok) continue;
          const json = await resp.json();
          players.push(...extractPlayersFromPayload(json));
        } catch {}
      }
      if (players.length) {
        source = source === "unknown" ? "TheSportsDB" : `${source}+TheSportsDB`;
        importedEventId = String(eventId);
      }
      debug.push({ provider: "TheSportsDB", url: null, urlsTried: urls, count: players.length, error: players.length ? null : "No players in TheSportsDB payload." });
    }

    // 4) RapidAPI fallback
    if (!players.length && !lockedToPrimary) {
      const rapid = await fetchRapidApiFieldPlayers(tournament);
      debug.push({ provider: rapid.provider || "RapidAPI", url: rapid.url || null, urlsTried: rapid.urlsTried || [], count: rapid.players?.length || 0, error: rapid.error || null });
      if (rapid.players?.length) {
        players = rapid.players;
        source = rapid.provider || "RapidAPI";
      }
    }

    players = players.filter((p) => p.name);
    if (!players.length) {
      return res.status(404).json({
        error: "No player list found from DataGolf, Sportradar, BallDontLie, TheSportsDB, or RapidAPI for this tournament yet.",
        debug,
      });
    }

    const result = await importFieldPlayersIntoTournament(tournamentId, players);
    if (result?.error) return res.status(400).json({ error: result.error });

    return res.json({
      imported: result.imported || 0,
      tournament_id: tournamentId,
      source,
      event_id: importedEventId,
      datagolf_event_id: source === "DataGolf" ? importedEventId : null,
      message: "Auto-imported tournament field.",
    });
  } catch (e) {
    return next(e);
  }
});

// ─── Admin analytics ──────────────────────────────────────────
app.get("/api/admin/analytics", (req, res) => {
  const required = process.env.ADMIN_TOKEN;
  if (required && req.headers["x-admin-token"] !== required) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json({
    startedAt: analytics.startedAt,
    scoreSync: analytics.scoreSync,
    routes: {
      courses: typeof courseRoutes._stats === "function" ? courseRoutes._stats() : null,
      pools: typeof poolRoutes._stats === "function" ? poolRoutes._stats() : null,
      draft: typeof draftRoutes._stats === "function" ? draftRoutes._stats() : null,
    },
    recentErrors: analytics.errors.slice(-ANALYTICS_ERRORS_MAX),
  });
});

app.get("/api/admin/errors", (req, res) => {
  const required = process.env.ADMIN_TOKEN;
  if (required && req.headers["x-admin-token"] !== required) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json({ recentErrors: analytics.errors.slice(-ANALYTICS_ERRORS_MAX) });
});

// ─── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  try {
    analytics.errors.push({
      ts: new Date().toISOString(),
      status: err?.status || 500,
      message: String(err?.message || "Internal server error"),
      stack: String(err?.stack || ""),
    });
    while (analytics.errors.length > ANALYTICS_ERRORS_MAX) analytics.errors.shift();
  } catch {}
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ─── Live score sync cron ─────────────────────────────────────
// Every 30 seconds during active tournaments
cron.schedule("*/30 * * * * *", async () => {
  analytics.scoreSync.lastRunAt = new Date().toISOString();
  try {
    await syncLiveScores(supabase);
    analytics.scoreSync.lastOkAt = new Date().toISOString();
    analytics.scoreSync.lastErrorAt = null;
    analytics.scoreSync.lastError = null;
  } catch (e) {
    analytics.scoreSync.lastErrorAt = new Date().toISOString();
    analytics.scoreSync.lastError = String(e?.message || e);
    console.error("Score sync error:", e.message);
  }
});

// ─── Auto-seed tournament fields (DataGolf) ───────────────────
// Runs periodically so upcoming tournaments get a draftable field without manual admin calls.
cron.schedule("0 */6 * * *", async () => {
  try {
    await autoSeedUpcomingFields();
  } catch (e) {
    console.warn("Auto-seed fields job failed:", e?.message || e);
  }
});
// Kick once shortly after boot so first deploy populates quickly.
setTimeout(() => { autoSeedUpcomingFields().catch(()=>{}); }, 25_000);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🏌️  MyGolfPoolPro API running on port ${PORT}`));

module.exports = app;
