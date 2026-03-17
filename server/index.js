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

function redactUrlSecrets(url) {
  const u = String(url || "");
  if (!u) return u;
  // Basic query redaction (avoid leaking API keys in debug responses).
  return u
    .replace(/([?&]key=)[^&]+/gi, "$1REDACTED")
    .replace(/([?&]api_key=)[^&]+/gi, "$1REDACTED")
    .replace(/([?&]token=)[^&]+/gi, "$1REDACTED");
}

// ─── DataGolf (Scratch Plus) – upcoming tournament fields/tee times ─────────
const DATAGOLF_API_KEY = process.env.DATAGOLF_API_KEY || "";
const DATAGOLF_BASE_URL = (process.env.DATAGOLF_BASE_URL || "https://feeds.datagolf.com").replace(/\/+$/, "");
const DATAGOLF_TOUR = (process.env.DATAGOLF_TOUR || "pga").toLowerCase();
const DATAGOLF_CACHE_TTL_MS = Number(process.env.DATAGOLF_CACHE_TTL_MS || 10 * 60 * 1000); // 10m
const DATAGOLF_RATE_LIMIT_PER_MIN = Number(process.env.DATAGOLF_RATE_LIMIT_PER_MIN || 45);
const DATAGOLF_STATE = { minuteKey: null, minuteCount: 0, nextAllowedAtMs: 0 };
const DATAGOLF_CACHE = new Map(); // url -> { ts, json }

// Cache for DataGolf site HTML (e.g., projected major fields page).
const DATAGOLF_SITE_CACHE_TTL_MS = Number(process.env.DATAGOLF_SITE_CACHE_TTL_MS || 10 * 60 * 1000); // 10m
const DATAGOLF_SITE_CACHE = new Map(); // url -> { ts, text }

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

async function datagolfFetchText(url) {
  const cached = DATAGOLF_SITE_CACHE.get(url);
  if (cached && Date.now() - cached.ts < DATAGOLF_SITE_CACHE_TTL_MS) return cached.text;

  // Reuse the same rate limiter to avoid bursts.
  const decision = datagolfCanCall();
  if (!decision.ok) {
    if (decision.reason === "spacing" && decision.retryAfterMs && decision.retryAfterMs < 2500) {
      await sleepMs(decision.retryAfterMs);
    } else {
      throw new Error("DataGolf rate limit/spacing in effect.");
    }
  }
  datagolfRegisterCall();

  const resp = await fetch(url, {
    timeout: 12000,
    headers: {
      // Use browser-like headers to avoid receiving a JS-only shell or bot-block page.
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "upgrade-insecure-requests": "1",
      referer: "https://datagolf.com/",
    },
  });
  if (!resp.ok) throw new Error(`DataGolf site returned ${resp.status}`);
  const text = await resp.text();
  DATAGOLF_SITE_CACHE.set(url, { ts: Date.now(), text });
  return text;
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

  const normToken = (t) =>
    String(t || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      // Common abbreviations/variants in feeds
      .replace(/^championship$/, "champ")
      .replace(/^tourn(?:ament)?$/, "tourney")
      .replace(/^u(?:nited)?s(?:tates)?$/, "us");

  const ta = aa.split(" ").map(normToken).filter((t) => t && !stop.has(t));
  const tb = bb.split(" ").map(normToken).filter((t) => t && !stop.has(t));
  const small = ta.length <= tb.length ? ta : tb;
  const big = ta.length <= tb.length ? tb : ta;
  if (!small.length || !big.length) return false;

  const tokenMatches = (x, y) => {
    if (!x || !y) return false;
    if (x === y) return true;
    const min = Math.min(x.length, y.length);
    if (min >= 4 && (x.startsWith(y) || y.startsWith(x))) return true;
    return false;
  };

  const covered = small.filter((t) => big.some((u) => tokenMatches(t, u))).length;
  // Two-token names like "mast masters" vs "masters tournament" can be abbreviated; allow 50% coverage.
  const threshold = small.length <= 2 ? 0.5 : 0.6;
  return covered >= Math.max(1, Math.ceil(small.length * threshold));
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

function majorParamFromTournamentName(name) {
  const n = normKey(name);
  if (!n) return null;
  if (n.includes("masters")) return "masters";
  if (n.includes("pga champ")) return "pga";
  if (n.includes("u s open") || n.includes("us open")) return "us_open";
  if (n.includes("open champ") || n === "the open" || n.includes("the open")) return "open";
  return null;
}

function extractPlayersFromAnyJson(node) {
  const out = [];
  const seen = new Set();
  const walk = (x, depth) => {
    if (!x || depth > 8) return;
    if (Array.isArray(x)) {
      for (const el of x) walk(el, depth + 1);
      return;
    }
    if (typeof x !== "object") return;
    if (seen.has(x)) return;
    seen.add(x);

    // If this object looks like a player.
    const rawName = x.player_name || x.full_name || x.name || x.player || x.playerName;
    const rawId = x.dg_id ?? x.dgid ?? x.datagolf_id ?? x.player_id ?? x.id;
    if (rawName || rawId) out.push(x);

    for (const v of Object.values(x)) walk(v, depth + 1);
  };
  walk(node, 0);
  return out;
}

function majorExpectedCountRange(major) {
  // Use broad but realistic bounds so we never import garbage lists.
  if (major === "masters") return { min: 60, max: 110 };
  if (major === "pga") return { min: 120, max: 180 };
  if (major === "us_open") return { min: 120, max: 180 };
  if (major === "open") return { min: 120, max: 180 };
  return { min: 50, max: 200 };
}

function pickProjectedFieldArrayFromNextData(major, nextDataJson) {
  const candidates = [];
  const seen = new Set();
  const walk = (x, path, depth) => {
    if (!x || depth > 10) return;
    if (Array.isArray(x)) {
      if (x.length >= 40 && x.length <= 250 && typeof x[0] === "object") {
        const sample = x.slice(0, 20).filter(Boolean);
        const nameCount = sample.filter((p) => typeof (p?.player_name || p?.name || p?.full_name) === "string").length;
        const idCount = sample.filter((p) => Number(p?.dg_id ?? p?.dgid ?? p?.datagolf_id ?? p?.player_id ?? p?.id) > 0).length;
        // Major fields often have stable DG ids even if names are stored elsewhere in the payload.
        const looksLikePlayers =
          (nameCount >= Math.max(6, Math.floor(sample.length * 0.4))) ||
          (idCount >= Math.max(10, Math.floor(sample.length * 0.6)));
        if (looksLikePlayers) {
          const hasLocked = sample.some((p) => "locked" in p || "on_track" in p || "onTrack" in p);
          const hasExempt = sample.some((p) => "exemptions" in p || "exemption" in p || "exempt" in p);
          const hasInField = sample.some((p) => "in_field" in p || "inField" in p || "projected" in p);
          const key = `${path}:${x.length}:${hasLocked ? "L" : ""}${hasExempt ? "E" : ""}${hasInField ? "F" : ""}`;
          candidates.push({ path, arr: x, len: x.length, hasLocked, hasExempt, hasInField, key });
        }
      }
      for (let i = 0; i < Math.min(60, x.length); i += 1) walk(x[i], `${path}[${i}]`, depth + 1);
      return;
    }
    if (typeof x !== "object") return;
    if (seen.has(x)) return;
    seen.add(x);
    for (const [k, v] of Object.entries(x)) {
      const nextPath = path ? `${path}.${k}` : k;
      walk(v, nextPath, depth + 1);
    }
  };
  walk(nextDataJson, "", 0);

  if (!candidates.length) return null;

  const { min, max } = majorExpectedCountRange(major);

  // Heuristic scoring: prefer arrays that look like the "Projected Field" table.
  const score = (c) => {
    const p = c.path.toLowerCase();
    let s = 0;
    if (p.includes("project")) s += 30;
    if (p.includes("field")) s += 20;
    if (p.includes("bubble")) s -= 25;
    if (p.includes("eligible")) s -= 25;
    if (p.includes("not_in_field") || p.includes("notinfield")) s -= 30;
    if (c.hasLocked) s += 10;
    if (c.hasExempt) s += 8;
    if (c.hasInField) s += 8;
    // Prefer the correct major-sized array, strongly.
    if (c.len >= min && c.len <= max) {
      s += 50;
    } else {
      // Penalize out-of-range arrays heavily.
      const off = c.len < min ? (min - c.len) : (c.len - max);
      s -= Math.min(60, Math.max(15, off));
    }
    return s;
  };
  candidates.sort((a, b) => score(b) - score(a));
  const best = candidates[0];
  if (!best) return null;
  // Only accept arrays that match expected size; otherwise, treat Next.js extraction as unavailable.
  if (!(best.len >= min && best.len <= max)) return null;
  return best.arr;
}

async function fetchDataGolfMajorFieldPlayers(tournament) {
  const major = majorParamFromTournamentName(tournament?.name || "");
  if (!major) return { players: [], provider: "DataGolf major-fields", urlsTried: [], error: "Not a supported major." };

  // Cache-bust at an hourly granularity so we don't get stuck with a cached "shell" or block page.
  const cacheBuster = Math.floor(Date.now() / (60 * 60 * 1000));
  const url = `https://datagolf.com/major-fields?major=${encodeURIComponent(major)}&_=${cacheBuster}`;
  try {
    const html = await datagolfFetchText(url);
    const lowerHtml = String(html || "").toLowerCase();
    if (/(cloudflare|cf-ray|attention required|captcha|verify you are human)/i.test(lowerHtml)) {
      return {
        players: [],
        provider: "DataGolf major-fields (scrape)",
        urlsTried: [url],
        error: "DataGolf page appears to be bot-protected (captcha/block page).",
      };
    }

    // Try: Next.js/SSR JSON blob.
    let playerObjs = [];
    const nextDataMatch = html.match(/<script[^>]+id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const json = JSON.parse(nextDataMatch[1]);
        const projected = pickProjectedFieldArrayFromNextData(major, json);
        if (Array.isArray(projected) && projected.length) playerObjs = projected;
      } catch {}
    }

    // Try: Next.js data route (works even when the SSR HTML doesn't include the full dataset).
    // Example: https://datagolf.com/_next/data/<buildId>/major-fields.json?major=masters
    if (!playerObjs.length) {
      const buildIdMatch =
        html.match(/\"buildId\"\s*:\s*\"([^\"]+)\"/i) ||
        html.match(/\/_next\/static\/([^/]+)\/_buildManifest\.js/i) ||
        html.match(/\/_next\/static\/([^/]+)\/_ssgManifest\.js/i);
      const buildId = buildIdMatch && buildIdMatch[1] ? String(buildIdMatch[1]) : null;
      if (buildId) {
        try {
          const dataUrl = `https://datagolf.com/_next/data/${encodeURIComponent(buildId)}/major-fields.json?major=${encodeURIComponent(major)}`;
          const json = await datagolfFetchJson(dataUrl);
          const projected = pickProjectedFieldArrayFromNextData(major, json);
          if (Array.isArray(projected) && projected.length) {
            playerObjs = projected;
          } else {
            playerObjs = extractPlayersFromAnyJson(json);
          }
        } catch {}
      }
    }

    const sliceProjectedSection = (s) => {
      const lower = String(s || "").toLowerCase();
      const start = lower.indexOf("projected field");
      if (start < 0) return String(s || "");
      const tails = [
        "best (eligible) players not in field",
        "eligible players not in field",
        "bubble watch",
        "recent movements",
        "recent locks",
        "recent outs",
      ];
      let end = -1;
      for (const t of tails) {
        const i = lower.indexOf(t, start + 20);
        if (i >= 0 && (end < 0 || i < end)) end = i;
      }
      if (end < 0) end = Math.min(lower.length, start + 220000);
      return String(s || "").slice(start, end);
    };

    // Try: JSON-ish patterns in page source.
    if (!playerObjs.length) {
      const matches = [];
      const window = sliceProjectedSection(html);
      const re = /\"player_name\"\s*:\s*\"([^\"]+)\"/g;
      let m = null;
      while ((m = re.exec(window))) {
        if (m[1]) matches.push({ player_name: m[1] });
        if (matches.length > 2000) break;
      }
      playerObjs = matches;
    }

    // Fallback: Pull likely names from table cells.
    if (!playerObjs.length) {
      const candidates = [];
      const window = sliceProjectedSection(html);
      const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let m = null;
      while ((m = tdRe.exec(window))) {
        const raw = String(m[1] || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, "\"")
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
        if (!raw) continue;
        if (raw.length < 6 || raw.length > 40) continue;
        if (!/[a-z]/i.test(raw) || !/\s/.test(raw)) continue;
        // Skip obvious non-names.
        if (/projected field|exemption|locked|owgr|rank|country|eligible/i.test(raw)) continue;
        candidates.push({ player_name: raw });
        if (candidates.length > 1000) break;
      }
      playerObjs = candidates;
    }

    // Normalize + dedupe. Prefer DG ids when present; otherwise fall back to name keying.
    const unique = new Map(); // key -> { id, name }
    for (const p of playerObjs || []) {
      const id = Number(p?.dg_id ?? p?.dgid ?? p?.datagolf_id ?? p?.player_id ?? p?.id) || null;
      const name = normalizePlayerName(p?.player_name || p?.full_name || p?.name || p?.player || p?.playerName || "");
      const key = (id && id > 0) ? `id:${id}` : (name ? `name:${normKey(name)}` : null);
      if (!key) continue;
      if (!unique.has(key)) unique.set(key, { id, name });
    }
    const rawPlayers = Array.from(unique.values())
      .map((p) => ({
        id: Number(p.id) || null,
        name: p.name || "",
      }))
      .filter((p) => p.id || p.name);

    // Prefer mapping scraped names to DataGolf ids using the official player list.
    const listMap = await getDataGolfPlayerListMap(); // dg_id -> { name, country }
    const nameToId = new Map();
    for (const [dgId, meta] of listMap.entries()) {
      const k = normKey(meta?.name || "");
      if (k && !nameToId.has(k)) nameToId.set(k, dgId);
    }

    const players = rawPlayers
      .map((p) => {
        const k = normKey(p.name);
        const dgId = (Number(p.id) > 0) ? Number(p.id) : (k && nameToId.get(k) ? Number(nameToId.get(k)) : null);
        const meta = dgId && listMap.has(dgId) ? listMap.get(dgId) : null;
        return {
          id: dgId || null,
          name: meta?.name || p.name,
          country: meta?.country || null,
          world_rank: null,
        };
      })
      .filter((p) => p?.name);

    // Sanity check: majors have well-known field sizes; reject obviously wrong scrapes.
    const { min, max } = majorExpectedCountRange(major);
    if (players.length < min || players.length > max) {
      return {
        players: [],
        provider: "DataGolf major-fields (scrape)",
        urlsTried: [url],
        error: `Scrape extracted ${players.length} names, outside expected range ${min}-${max} for ${major}.`,
      };
    }

    const enriched = await enrichPlayersFromDataGolfRefs(players);
    return { players: enriched, provider: "DataGolf major-fields (scrape)", urlsTried: [url], error: null };
  } catch (e) {
    return { players: [], provider: "DataGolf major-fields (scrape)", urlsTried: [url], error: e?.message || String(e) };
  }
}

async function fetchDataGolfFieldPlayers(tournament) {
  if (!DATAGOLF_API_KEY) return { players: [], provider: null, urlsTried: [], error: "DATAGOLF_API_KEY not set." };

  const targetName = normKey(tournament?.name || "");
  const targetDate = tournament?.start_date || "";

  // DataGolf `field-updates` supports specific tour codes (per DataGolf docs).
  // Trying unsupported codes wastes quota and makes failures harder to reason about.
  const FIELD_UPDATES_TOURS = new Set(["pga", "upcoming_pga", "opp", "euro", "kft", "alt"]);
  const toursToTry = Array.from(new Set(
    [DATAGOLF_TOUR, "pga", "upcoming_pga", "opp", "euro", "kft", "alt"]
      .map((t) => String(t || "").toLowerCase())
      .filter((t) => FIELD_UPDATES_TOURS.has(t))
  ));

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
      const bestName = bestEvent?.event_name || bestEvent?.name || "";
      // IMPORTANT: Only trust this schedule match if the name strongly matches.
      // If a given schedule feed excludes majors, "closest-by-date" will be the wrong event.
      if (bestName && strongNameMatch(bestName, tournament?.name || "")) {
        const rawEventId = bestEvent?.event_id ?? bestEvent?.eventId ?? bestEvent?.dg_event_id ?? bestEvent?.dgEventId ?? bestEvent?.id ?? null;
        const rawStr = String(rawEventId || "").trim();
        // DataGolf sometimes uses "TBD" placeholders. Never treat those as matchable event_ids.
        scheduleEventId = rawStr && !/^tbd$/i.test(rawStr) ? rawEventId : null;
        scheduleEventName = scheduleEventName || bestName || null;
      }
    } catch {}
  }
  if (scheduleEventId && !scheduleEventName) scheduleEventName = tournament?.name || null;

  const year = String(tournament?.start_date || "").slice(0, 4) || String(new Date().getUTCFullYear());

  const coercePlayers = (arr) => (arr || [])
    .map((p) => ({
      id: Number(p.dg_id || p.dgid || p.datagolf_id || p.player_id || p.id) || null,
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
          const nameCount = sample.filter((p) => p && typeof p === "object" && (p.player_name || p.full_name || p.name || p.player)).length;
          const idCount = sample.filter((p) => Number(p?.dg_id ?? p?.dgid ?? p?.datagolf_id ?? p?.player_id ?? p?.id) > 0).length;
          // Some DataGolf payloads provide dg_id without names; accept id-only "player arrays" too.
          const looksLikePlayers = nameCount > 0 || idCount >= 6;
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
  const getRowEventId = (r) => r?.event_id ?? r?.eventId ?? r?.dg_event_id ?? r?.dgEventId ?? r?.tournament_id ?? r?.tournamentId ?? r?.dg_tournament_id ?? r?.dgTournamentId ?? r?.id ?? null;
  const getRowEventName = (r) => r?.event_name || r?.eventName || r?.event || r?.tournament_name || r?.tournament || r?.name || "";
  const getRowEventDate = (r) => r?.start_date || r?.startDate || r?.event_start_date || r?.date || r?.start || r?.starts_at || "";
  const looksLikeFlatPlayerRow = (r) => {
    if (!r || typeof r !== "object") return false;
    const hasPlayer = !!(r.player_name || r.full_name || r.player || r.name || (Number(r.dg_id ?? r.dgid ?? r.datagolf_id ?? r.player_id ?? r.id) > 0));
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
      // Protect against schedule mismatches (especially majors) where the schedule feed can
      // return the closest-by-date event rather than the actual intended tournament.
      if (direct && strongNameMatch(direct.event_name || "", strictName)) {
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
    // Never "guess" an event purely by date when we're importing a field.
    // If DataGolf doesn't publish the event in this payload yet, we'd rather return no field
    // than import the wrong tournament's players (common failure mode for majors).
    const strictName = scheduleEventName || tournament?.name || "";
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
        bestEventId = ev?.event_id ?? ev?.eventId ?? ev?.dg_event_id ?? ev?.dgEventId ?? ev?.id ?? null;
      }
    }
    return { best, players: bestPlayers, event_id: bestEventId };
  };

  for (const tour of toursToTry) {
    const url = `${DATAGOLF_BASE_URL}/field-updates?tour=${encodeURIComponent(tour)}&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
    urlsTried.push(url);
    try {
      const json = await datagolfFetchJson(url);

      // DataGolf sometimes returns a single event object with a top-level `field` array.
      // Treat that as the "current/upcoming event" feed.
      if (json && typeof json === "object" && !Array.isArray(json) && Array.isArray(json.field)) {
        const evNameRaw = json.event_name || json.eventName || json.name || "";
        const evName = normKey(evNameRaw);
        const target = normKey(tournament?.name || "");
        // Only accept when it clearly matches the tournament we're importing.
        if (evNameRaw && tournament?.name && strongNameMatch(evNameRaw, tournament.name)) {
          const rawList = json.field;
          const players = coercePlayers(rawList);
          if (players.length) {
            const enriched = await enrichPlayersFromDataGolfRefs(players);
            const evId = json.event_id ?? json.eventId ?? json.dg_event_id ?? json.dgEventId ?? json.id ?? null;
            return { players: enriched, provider: "DataGolf", url, urlsTried, event_id: evId != null ? String(evId) : null };
          }
        } else if (target && evName && (evName.includes(target) || target.includes(evName))) {
          // Slightly weaker match for abbreviation/punctuation differences.
          const players = coercePlayers(json.field);
          if (players.length) {
            const enriched = await enrichPlayersFromDataGolfRefs(players);
            const evId = json.event_id ?? json.eventId ?? json.dg_event_id ?? json.dgEventId ?? json.id ?? null;
            return { players: enriched, provider: "DataGolf", url, urlsTried, event_id: evId != null ? String(evId) : null };
          }
        }
        // If it doesn't match, keep trying other tours.
      }

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
          String(ev?.event_id ?? ev?.eventId ?? ev?.dg_event_id ?? ev?.dgEventId ?? ev?.id ?? "") === String(scheduleEventId)
        );
        if (match) {
          const matchName = match?.event_name || match?.eventName || match?.name || match?.tournament_name || match?.tournament || "";
          if (matchName && tournament?.name && !strongNameMatch(matchName, tournament.name)) {
            // Ignore this "id match" if it clearly isn't the intended tournament.
            // This prevents majors from being mapped to the wrong PGA week when schedules differ.
            // Fall through to the name/date matching logic below.
          } else {
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
      }

      const out = pickBestEventFromPayload(json);
      if (out.players?.length) {
        const players = await enrichPlayersFromDataGolfRefs(out.players);
        return { players, provider: "DataGolf", url, urlsTried, event_id: out.event_id || null };
      }
    } catch {}
  }

  // DataGolf sometimes has a full projected field available via predictions endpoints
  // before `field-updates` is populated. This avoids scraping (which can be captcha-blocked).
  // We only use this as a fallback because the response shapes vary by feed.
  try {
    // Prefer a stable DataGolf event_id if we have one (dg_<event_id>).
    const rawEventId = scheduleEventId || (String(tournament?.id || "").startsWith("dg_") ? String(tournament.id).slice(3) : null);
    const eventId = rawEventId && !/^\d{4}_[0-9a-f]{12}$/i.test(String(rawEventId)) ? String(rawEventId).trim() : null;

    const predUrls = [];
    if (eventId) {
      predUrls.push(
        `${DATAGOLF_BASE_URL}/preds/pre-tournament-archive?event_id=${encodeURIComponent(eventId)}&year=${encodeURIComponent(year)}&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`,
        `${DATAGOLF_BASE_URL}/preds/pre-tournament-archive?event_id=${encodeURIComponent(eventId)}&year=${encodeURIComponent(year)}&odds_format=percent&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`
      );
    }
    // Last resort: "next tournament" prediction feed for common tours.
    predUrls.push(
      `${DATAGOLF_BASE_URL}/preds/pre-tournament?tour=pga&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`,
      `${DATAGOLF_BASE_URL}/preds/pre-tournament?tour=opp&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`,
      `${DATAGOLF_BASE_URL}/preds/pre-tournament?tour=euro&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`
    );

    for (const u of predUrls) {
      urlsTried.push(u);
      let json = null;
      try {
        json = await datagolfFetchJson(u);
      } catch {
        continue;
      }

      // Heuristic: if this is an archive feed for a specific event, ensure it matches our tournament name when possible.
      const payloadEventName =
        json?.event_name || json?.eventName || json?.tournament_name || json?.tournamentName || json?.name || null;
      if (payloadEventName && tournament?.name && !strongNameMatch(payloadEventName, tournament.name)) {
        // Some feeds can return a different event if the event_id/year pairing is wrong; ignore.
        continue;
      }

      const candidates =
        pickFirstArray(json, ["preds", "predictions", "data", "players", "field", "rows", "results"]) ||
        (Array.isArray(json) ? json : []);
      const players = coercePlayers(candidates);
      if (players.length >= 50) {
        const enriched = await enrichPlayersFromDataGolfRefs(players);
        return { players: enriched, provider: "DataGolf (preds)", url: u, urlsTried, event_id: eventId || null };
      }
    }
  } catch {}

  // Majors: DataGolf sometimes publishes projected majors fields via the site page earlier than `field-updates`.
  // As a last resort, scrape the major fields page for names and map them back to DG ids via get-player-list.
  const majorFallback = await fetchDataGolfMajorFieldPlayers(tournament);
  if (majorFallback.players?.length) {
    return {
      players: majorFallback.players,
      provider: majorFallback.provider,
      url: null,
      urlsTried: [...urlsTried, ...(majorFallback.urlsTried || [])],
      event_id: null,
    };
  }

  const extra = majorFallback?.error ? ` Major scrape: ${majorFallback.error}` : "";
  return { players: [], provider: "DataGolf", urlsTried, error: `No matching projected field found in DataGolf field-updates yet.${extra}` };
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
      debug.push({
        provider: dg.provider || "DataGolf",
        url: dg.url ? redactUrlSecrets(dg.url) : null,
        urlsTried: (dg.urlsTried || []).map(redactUrlSecrets),
        count: dg.players?.length || 0,
        error: dg.error || null,
        event_id: dg.event_id || null,
      });
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
      debug.push({
        provider: "Sportradar",
        url: sr.url ? redactUrlSecrets(sr.url) : null,
        urlsTried: (sr.urlsTried || []).map(redactUrlSecrets),
        count: sr.players?.length || 0,
        error: sr.error || null,
      });
      if (sr.players?.length) {
        players = sr.players;
        source = "Sportradar";
      }
    }

    // 2) BallDontLie PGA
    if (!players.length && !lockedToPrimary) {
      const bdl = await fetchBallDontLieFieldPlayers(tournament);
      debug.push({
        provider: "BallDontLie",
        url: bdl.url ? redactUrlSecrets(bdl.url) : null,
        urlsTried: (bdl.urlsTried || []).map(redactUrlSecrets),
        count: bdl.players?.length || 0,
        error: bdl.error || null,
      });
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
      debug.push({
        provider: "TheSportsDB",
        url: null,
        urlsTried: (urls || []).map(redactUrlSecrets),
        count: players.length,
        error: players.length ? null : "No players in TheSportsDB payload.",
      });
    }

    // 4) RapidAPI fallback
    if (!players.length && !lockedToPrimary) {
      const rapid = await fetchRapidApiFieldPlayers(tournament);
      debug.push({
        provider: rapid.provider || "RapidAPI",
        url: rapid.url ? redactUrlSecrets(rapid.url) : null,
        urlsTried: (rapid.urlsTried || []).map(redactUrlSecrets),
        count: rapid.players?.length || 0,
        error: rapid.error || null,
      });
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

// Force-reset a tournament field shell list (tournament_scores rows) so a clean projected field can be imported.
// Safe by default: refuses if real scoring has started, and refuses if draft picks exist unless `{"force": true}`.
app.post("/api/admin/field-reset/:tournamentId", async (req, res, next) => {
  try {
    const required = process.env.ADMIN_TOKEN;
    if (required && req.headers["x-admin-token"] !== required) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tournamentId } = req.params;
    const force = !!req.body?.force;

    const { data: tRow, error: tErr } = await supabase
      .from("tournaments")
      .select("id, name")
      .eq("id", tournamentId)
      .single();
    if (tErr || !tRow) return res.status(404).json({ error: "Tournament not found." });

    // Never reset once real scoring is present.
    const { count: realCount, error: realErr } = await supabase
      .from("tournament_scores")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .or("position.not.is.null,r1.not.is.null,r2.not.is.null,r3.not.is.null,r4.not.is.null");
    if (realErr) return res.status(500).json({ error: realErr.message });
    if (Number(realCount || 0) > 0) {
      return res.status(400).json({ error: "Refusing to reset: tournament has real scoring data already." });
    }

    // If pools have picks for this tournament, reset can invalidate drafts.
    const { data: pools, error: poolsErr } = await supabase
      .from("pools")
      .select("id")
      .eq("tournament_id", tournamentId);
    if (poolsErr) return res.status(500).json({ error: poolsErr.message });
    const poolIds = (pools || []).map((p) => p.id).filter(Boolean);

    let pickCount = 0;
    if (poolIds.length) {
      const { count, error: picksErr } = await supabase
        .from("draft_picks")
        .select("*", { count: "exact", head: true })
        .in("pool_id", poolIds);
      if (picksErr) return res.status(500).json({ error: picksErr.message });
      pickCount = Number(count || 0);
    }

    if (pickCount > 0 && !force) {
      return res.status(400).json({
        error: "Refusing to reset: draft picks exist for this tournament. Delete the pool(s) or retry with {\"force\": true}.",
        draft_picks: pickCount,
      });
    }

    const { count: beforeCount } = await supabase
      .from("tournament_scores")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);

    const { error: delErr } = await supabase
      .from("tournament_scores")
      .delete()
      .eq("tournament_id", tournamentId);
    if (delErr) return res.status(500).json({ error: delErr.message });

    try {
      await supabase
        .from("tournaments")
        .update({ field_size: 0 })
        .eq("id", tournamentId);
    } catch {}

    return res.json({
      ok: true,
      tournament_id: tournamentId,
      tournament_name: tRow.name,
      deleted_tournament_scores: Number(beforeCount || 0),
      message: "Tournament field reset. Re-run import-field-auto to import a fresh projected field.",
    });
  } catch (e) {
    return next(e);
  }
});

// Debug endpoints to understand DataGolf payload shapes without exposing secrets.
app.get("/api/admin/datagolf/field-updates-debug", async (req, res) => {
  const required = process.env.ADMIN_TOKEN;
  if (required && req.headers["x-admin-token"] !== required) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!DATAGOLF_API_KEY) return res.status(400).json({ error: "DATAGOLF_API_KEY not set." });

  const tour = String(req.query.tour || "pga").toLowerCase();
  const url = `${DATAGOLF_BASE_URL}/field-updates?tour=${encodeURIComponent(tour)}&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
  try {
    const json = await datagolfFetchJson(url);

    // Best-effort: detect "flat rows" vs event objects.
    const isFlatRows =
      Array.isArray(json) &&
      json.length &&
      typeof json[0] === "object" &&
      // Allow id-only player rows (some feeds omit names).
      (json[0].player_name || json[0].name || Number(json[0].dg_id ?? json[0].dgid ?? json[0].datagolf_id ?? json[0].player_id ?? json[0].id) > 0) &&
      (json[0].event_id || json[0].event_name);

    const rows = [];
    const pushEv = (ev, players) => {
      if (!ev || typeof ev !== "object") return;
      const event_id = ev.event_id ?? ev.eventId ?? ev.dg_event_id ?? ev.dgEventId ?? ev.id ?? null;
      const event_name = ev.event_name ?? ev.eventName ?? ev.name ?? ev.tournament_name ?? ev.tournament ?? null;
      const start_date = ev.start_date ?? ev.startDate ?? ev.event_start_date ?? ev.date ?? null;
      const count = Array.isArray(players) ? players.length : 0;
      rows.push({ event_id, event_name, start_date, count });
    };

    if (isFlatRows) {
      const by = new Map();
      for (const r of json.slice(0, 5000)) {
        const eid = r.event_id ?? r.eventId ?? r.dg_event_id ?? r.dgEventId ?? null;
        const en = r.event_name ?? r.eventName ?? r.event ?? r.tournament_name ?? r.tournament ?? r.name ?? null;
        const key = eid != null ? `id:${String(eid)}` : (en ? `name:${normKey(en)}` : null);
        if (!key) continue;
        const g = by.get(key) || { event_id: eid, event_name: en, start_date: r.start_date ?? r.startDate ?? r.date ?? null, count: 0 };
        g.count += 1;
        by.set(key, g);
      }
      const events = Array.from(by.values())
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 30);
      return res.json({
        provider: "DataGolf",
        tour,
        shape: "flat_rows",
        url: redactUrlSecrets(url),
        events,
      });
    }

    // Some DataGolf responses are a single event object with a top-level `field` array.
    // (Rather than an array of events.)
    if (json && typeof json === "object" && !Array.isArray(json) && Array.isArray(json.field)) {
      return res.json({
        provider: "DataGolf",
        tour,
        shape: "single_event",
        url: redactUrlSecrets(url),
        event: {
          event_id: json.event_id ?? json.eventId ?? json.dg_event_id ?? json.dgEventId ?? json.id ?? null,
          event_name: json.event_name ?? json.eventName ?? json.name ?? null,
          start_date: json.date_start ?? json.start_date ?? json.startDate ?? null,
          end_date: json.date_end ?? json.end_date ?? json.endDate ?? null,
          count: Array.isArray(json.field) ? json.field.length : 0,
          last_updated: json.last_updated || null,
        },
        topLevelKeys: Object.keys(json).slice(0, 30),
      });
    }

    const events =
      (Array.isArray(json?.events) && json.events) ||
      (Array.isArray(json?.tournaments) && json.tournaments) ||
      (Array.isArray(json?.data) && json.data) ||
      (Array.isArray(json) ? json : []);

    for (const ev of (events || []).slice(0, 200)) {
      const players =
        (Array.isArray(ev?.field) && ev.field) ||
        (Array.isArray(ev?.players) && ev.players) ||
        (Array.isArray(ev?.entries) && ev.entries) ||
        (Array.isArray(ev?.data) && ev.data) ||
        [];
      pushEv(ev, players);
    }

    rows.sort((a, b) => (b.count || 0) - (a.count || 0));
    return res.json({
      provider: "DataGolf",
      tour,
      shape: "events",
      url: redactUrlSecrets(url),
      events: rows.slice(0, 30),
      topLevelKeys: (json && typeof json === "object" && !Array.isArray(json)) ? Object.keys(json).slice(0, 30) : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e), url: redactUrlSecrets(url) });
  }
});

app.get("/api/admin/datagolf/major-fields-debug", async (req, res) => {
  const required = process.env.ADMIN_TOKEN;
  if (required && req.headers["x-admin-token"] !== required) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const major = String(req.query.major || "masters").toLowerCase();
  const bust = String(req.query.bust || "").toLowerCase() === "1";
  const cacheBuster = bust ? Math.floor(Date.now() / (60 * 60 * 1000)) : null;
  const url = cacheBuster != null
    ? `https://datagolf.com/major-fields?major=${encodeURIComponent(major)}&_=${cacheBuster}`
    : `https://datagolf.com/major-fields?major=${encodeURIComponent(major)}`;
  try {
    const html = await datagolfFetchText(url);
    const lower = html.toLowerCase();
    const nextMatch = html.match(/<script[^>]+id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/i);
    const hasNextData = !!(nextMatch && nextMatch[1] && nextMatch[1].trim().startsWith("{"));
    let nextSize = null;
    if (hasNextData) {
      try {
        const json = JSON.parse(nextMatch[1]);
        const proj = pickProjectedFieldArrayFromNextData(major, json);
        nextSize = Array.isArray(proj) ? proj.length : 0;
      } catch {
        nextSize = -1;
      }
    }
    return res.json({
      provider: "DataGolf",
      url,
      html_bytes: Buffer.byteLength(html || "", "utf8"),
      has_next_data: hasNextData,
      projected_array_len: nextSize,
      has_projected_field_text: lower.includes("projected field"),
      has_player_name_key: lower.includes("\"player_name\""),
      has_dg_id_key: lower.includes("\"dg_id\"") || lower.includes("\"dgid\""),
      preview: html.slice(0, 200),
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e), url });
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
