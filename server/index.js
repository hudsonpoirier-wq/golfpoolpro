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
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000","https://mygolfpoolpro.com"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 20,
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

    const uniqueByName = new Map();
    for (const p of players) {
      const k = p.name.toLowerCase();
      if (!uniqueByName.has(k)) uniqueByName.set(k, p);
    }
    const normalizedPlayers = Array.from(uniqueByName.values());

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
    if (golfersError) return res.status(400).json({ error: golfersError.message });

    const scoreShellRows = golferRows.map((g) => ({
      tournament_id: tournamentId,
      golfer_id: g.id,
      updated_at: new Date().toISOString(),
    }));
    const { error: scoreShellError } = await supabase
      .from("tournament_scores")
      .upsert(scoreShellRows, { onConflict: "tournament_id,golfer_id", ignoreDuplicates: true });
    if (scoreShellError) return res.status(400).json({ error: scoreShellError.message });

    return res.json({
      imported: golferRows.length,
      tournament_id: tournamentId,
      message: "Tournament field imported. Draft list will now use this field.",
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
