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
