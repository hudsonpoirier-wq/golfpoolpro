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
const { syncLiveScores, seedGolfers, resolveTheSportsDbEventId } = require("./services/scoresSync");
const { seedUpcomingTournaments } = require("./services/tournamentSync");

const app = express();

// ─── Supabase admin client (service role — never expose to client) ───
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);
app.locals.supabase = supabase;

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
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim();
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

async function fetchRapidApiFieldPlayers(tournament) {
  const rapidKey = process.env.RAPIDAPI_GOLF_KEY || process.env.RAPIDAPI_KEY;
  const rapidHost = process.env.RAPIDAPI_GOLF_HOST || process.env.RAPIDAPI_HOST;
  const rapidBase = (
    process.env.RAPIDAPI_GOLF_BASE_URL ||
    process.env.RAPIDAPI_BASE_URL ||
    ""
  ).replace(/\/+$/, "");
  const customTemplate = process.env.RAPIDAPI_GOLF_FIELD_URL_TEMPLATE || "";

  if (!rapidKey || !rapidHost) return { players: [], provider: null, urlsTried: [] };

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

  const dedupedUrls = Array.from(new Set(urls.filter(Boolean)));
  const headers = {
    "x-rapidapi-key": rapidKey,
    "x-rapidapi-host": rapidHost,
  };

  for (const url of dedupedUrls) {
    try {
      const resp = await fetch(url, { headers, timeout: 12000 });
      if (!resp.ok) continue;
      const json = await resp.json();
      const players = extractPlayersFromPayload(json);
      if (players.length) {
        return { players, provider: "RapidAPI", url, urlsTried: dedupedUrls };
      }
    } catch {}
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

async function importFieldPlayersIntoTournament(tournamentId, players) {
  const uniqueByName = new Map();
  for (const p of players) {
    const name = normalizePlayerName(p.name || p.player || p.full_name);
    if (!name) continue;
    const k = name.toLowerCase();
    if (!uniqueByName.has(k)) {
      uniqueByName.set(k, {
        name,
        country: p.country || p.nationality || null,
        world_rank: Number(p.world_rank || p.rank) || null,
      });
    }
  }
  const normalizedPlayers = Array.from(uniqueByName.values());
  if (!normalizedPlayers.length) return { imported: 0 };

  const golferRows = normalizedPlayers.map((p) => ({
    id: toStableGolferId(p.name),
    name: p.name,
    country: p.country || null,
    world_rank: p.world_rank || null,
    updated_at: new Date().toISOString(),
  }));

  const { error: golfersError } = await supabase
    .from("golfers")
    .upsert(golferRows, { onConflict: "id" });
  if (golfersError) return { error: golfersError.message };

  const scoreShellRows = golferRows.map((g) => ({
    tournament_id: tournamentId,
    golfer_id: g.id,
    updated_at: new Date().toISOString(),
  }));
  const { error: scoreShellError } = await supabase
    .from("tournament_scores")
    .upsert(scoreShellRows, { onConflict: "tournament_id,golfer_id", ignoreDuplicates: true });
  if (scoreShellError) return { error: scoreShellError.message };

  return { imported: golferRows.length };
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

    // 1) Sportradar first (if configured)
    if (!players.length) {
      const sr = await fetchSportradarFieldPlayers(tournament);
      if (sr.players?.length) {
        players = sr.players;
        source = "Sportradar";
      }
    }

    // 2) TheSportsDB
    if (eventId) {
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
    }

    // 3) RapidAPI fallback
    if (!players.length) {
      const rapid = await fetchRapidApiFieldPlayers(tournament);
      if (rapid.players?.length) {
        players = rapid.players;
        source = "RapidAPI";
      }
    }

    players = players.filter((p) => p.name);
    if (!players.length) {
      return res.status(404).json({
        error: "No player list found from Sportradar, TheSportsDB, or RapidAPI for this tournament yet.",
      });
    }

    const result = await importFieldPlayersIntoTournament(tournamentId, players);
    if (result?.error) return res.status(400).json({ error: result.error });

    return res.json({
      imported: result.imported || 0,
      tournament_id: tournamentId,
      source,
      event_id: importedEventId,
      message: "Auto-imported tournament field.",
    });
  } catch (e) {
    return next(e);
  }
});

// ─── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ─── Live score sync cron ─────────────────────────────────────
// Every 30 seconds during active tournaments
cron.schedule("*/30 * * * * *", async () => {
  try { await syncLiveScores(supabase); }
  catch (e) { console.error("Score sync error:", e.message); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🏌️  MyGolfPoolPro API running on port ${PORT}`));

module.exports = app;
