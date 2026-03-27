// server/routes/admin-panel.js
// Admin panel endpoints — authenticated via JWT + email allowlist
const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");

// Hardcoded admin emails
const ADMIN_EMAILS = ["hudsonpoirier@me.com"];

function requireAdminUser(req, res, next) {
  if (!req.user?.email || !ADMIN_EMAILS.includes(req.user.email.toLowerCase())) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// GET /api/admin-panel/check — check if current user is admin
router.get("/check", requireAuth, (req, res) => {
  const isAdmin = ADMIN_EMAILS.includes((req.user?.email || "").toLowerCase());
  res.json({ isAdmin });
});

// GET /api/admin-panel/users — list all users with stats
router.get("/users", requireAuth, requireAdminUser, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;

    // Get all profiles
    const { data: profiles, error } = await sb
      .from("profiles")
      .select("id, name, avatar, email, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Get pool membership counts
    const { data: memberships } = await sb
      .from("pool_members")
      .select("user_id, pool_id");

    // Get pools hosted
    const { data: hostedPools } = await sb
      .from("pools")
      .select("host_id, id, name, status");

    // Get draft picks counts
    const { data: picks } = await sb
      .from("draft_picks")
      .select("user_id");

    // Build user stats
    const users = (profiles || []).map(p => {
      const memberOf = (memberships || []).filter(m => m.user_id === p.id).length;
      const hosted = (hostedPools || []).filter(h => h.host_id === p.id).length;
      const totalPicks = (picks || []).filter(pk => pk.user_id === p.id).length;
      return {
        ...p,
        is_admin: ADMIN_EMAILS.includes((p.email || "").toLowerCase()),
        pools_joined: memberOf,
        pools_hosted: hosted,
        total_picks: totalPicks,
      };
    });

    res.json({ users, total: users.length });
  } catch (e) { next(e); }
});

// DELETE /api/admin-panel/users/:userId — delete a user
router.delete("/users/:userId", requireAuth, requireAdminUser, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const userId = req.params.userId;

    // Don't allow deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account." });
    }

    // Check user exists
    const { data: profile } = await sb
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return res.status(404).json({ error: "User not found." });

    // Don't allow deleting other admins
    if (ADMIN_EMAILS.includes((profile.email || "").toLowerCase())) {
      return res.status(400).json({ error: "Cannot delete an admin account." });
    }

    // Delete from Supabase Auth (cascades to profiles via FK)
    const { error } = await sb.auth.admin.deleteUser(userId);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "User deleted.", userId });
  } catch (e) { next(e); }
});

// GET /api/admin-panel/stats — overall platform stats
router.get("/stats", requireAuth, requireAdminUser, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const analytics = req.app.locals.analytics;

    // Parallel queries
    const [
      { count: userCount },
      { count: poolCount },
      { count: activePoolCount },
      { count: tournamentCount },
      { count: activeTournamentCount },
      { count: scoreCount },
      { count: golferCount },
      { count: pickCount },
    ] = await Promise.all([
      sb.from("profiles").select("*", { count: "exact", head: true }),
      sb.from("pools").select("*", { count: "exact", head: true }),
      sb.from("pools").select("*", { count: "exact", head: true }).in("status", ["draft", "live"]),
      sb.from("tournaments").select("*", { count: "exact", head: true }),
      sb.from("tournaments").select("*", { count: "exact", head: true }).eq("status", "active"),
      sb.from("tournament_scores").select("*", { count: "exact", head: true }),
      sb.from("golfers").select("*", { count: "exact", head: true }),
      sb.from("draft_picks").select("*", { count: "exact", head: true }),
    ]);

    // Pool status breakdown
    const { data: poolsByStatus } = await sb
      .from("pools")
      .select("status");
    const statusCounts = {};
    for (const p of (poolsByStatus || [])) {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    }

    // Recent signups (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentSignups } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo);

    res.json({
      users: { total: userCount || 0, recentSignups: recentSignups || 0 },
      pools: { total: poolCount || 0, active: activePoolCount || 0, byStatus: statusCounts },
      tournaments: { total: tournamentCount || 0, active: activeTournamentCount || 0 },
      scores: { total: scoreCount || 0 },
      golfers: { total: golferCount || 0 },
      picks: { total: pickCount || 0 },
      server: {
        startedAt: analytics?.startedAt || null,
        scoreSync: analytics?.scoreSync || {},
        recentErrors: (analytics?.errors || []).slice(-10),
      },
    });
  } catch (e) { next(e); }
});

// GET /api/admin-panel/api-health — check all API integrations
router.get("/api-health", requireAuth, requireAdminUser, async (req, res, next) => {
  try {
    const results = {};

    // 1. Supabase health
    const sbStart = Date.now();
    try {
      const { count, error } = await req.app.locals.supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      results.supabase = {
        status: error ? "error" : "ok",
        latencyMs: Date.now() - sbStart,
        error: error?.message || null,
      };
    } catch (e) {
      results.supabase = { status: "error", latencyMs: Date.now() - sbStart, error: e.message };
    }

    // 2. DataGolf API health
    const dgKey = process.env.DATAGOLF_API_KEY;
    const dgBase = (process.env.DATAGOLF_BASE_URL || "https://feeds.datagolf.com").replace(/\/+$/, "");
    if (dgKey) {
      const dgStart = Date.now();
      try {
        const dgFetch = require("node-fetch");
        const dgRes = await dgFetch(`${dgBase}/get-schedule?tour=pga&file_format=json&key=${encodeURIComponent(dgKey)}`, { timeout: 8000 });
        const dgJson = await dgRes.json().catch(() => null);
        results.dataGolf = {
          status: dgRes.ok ? "ok" : "error",
          latencyMs: Date.now() - dgStart,
          httpStatus: dgRes.status,
          eventsReturned: Array.isArray(dgJson?.schedule) ? dgJson.schedule.length : null,
          error: dgRes.ok ? null : `HTTP ${dgRes.status}`,
        };
      } catch (e) {
        results.dataGolf = { status: "error", latencyMs: Date.now() - dgStart, error: e.message };
      }
    } else {
      results.dataGolf = { status: "not_configured", error: "DATAGOLF_API_KEY not set" };
    }

    // 3. TheSportsDB health
    const tsdbKey = process.env.THE_SPORTS_DB_KEY || "3";
    const tsdbStart = Date.now();
    try {
      const tsdbFetch = require("node-fetch");
      const tsdbRes = await tsdbFetch(`https://www.thesportsdb.com/api/v1/json/${tsdbKey}/all_sports.php`, { timeout: 8000 });
      results.theSportsDB = {
        status: tsdbRes.ok ? "ok" : "error",
        latencyMs: Date.now() - tsdbStart,
        httpStatus: tsdbRes.status,
        error: tsdbRes.ok ? null : `HTTP ${tsdbRes.status}`,
      };
    } catch (e) {
      results.theSportsDB = { status: "error", latencyMs: Date.now() - tsdbStart, error: e.message };
    }

    // 4. Score sync status from analytics
    const analytics = req.app.locals.analytics;
    results.scoreSync = {
      provider: process.env.SCORE_PROVIDER || "auto",
      lastRunAt: analytics?.scoreSync?.lastRunAt || null,
      lastOkAt: analytics?.scoreSync?.lastOkAt || null,
      lastErrorAt: analytics?.scoreSync?.lastErrorAt || null,
      lastError: analytics?.scoreSync?.lastError || null,
    };

    res.json(results);
  } catch (e) { next(e); }
});

// GET /api/admin-panel/pools — list all pools with details
router.get("/pools", requireAuth, requireAdminUser, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { data: pools, error } = await sb
      .from("pools")
      .select("id, name, tournament_id, host_id, status, max_participants, team_size, scoring_golfers, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Get member counts
    const { data: members } = await sb.from("pool_members").select("pool_id, user_id");
    const memberMap = {};
    for (const m of (members || [])) {
      memberMap[m.pool_id] = (memberMap[m.pool_id] || 0) + 1;
    }

    // Get host names
    const hostIds = [...new Set((pools || []).map(p => p.host_id).filter(Boolean))];
    const { data: hostProfiles } = hostIds.length
      ? await sb.from("profiles").select("id, name, email").in("id", hostIds)
      : { data: [] };
    const hostMap = {};
    for (const h of (hostProfiles || [])) hostMap[h.id] = h;

    const enriched = (pools || []).map(p => ({
      ...p,
      member_count: memberMap[p.id] || 0,
      host_name: hostMap[p.host_id]?.name || "Unknown",
      host_email: hostMap[p.host_id]?.email || "",
    }));

    res.json({ pools: enriched, total: enriched.length });
  } catch (e) { next(e); }
});

module.exports = router;
