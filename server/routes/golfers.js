// server/routes/golfers.js
const router = require("express").Router();
const { optionalAuth } = require("../middleware/auth");

// Prevent repeated provider calls from hammering external APIs.
const FIELD_SEED_ATTEMPTS = new Map(); // tournamentId -> { ts }
const FIELD_SEED_MIN_INTERVAL_MS = Number(process.env.FIELD_SEED_MIN_INTERVAL_MS || 10 * 60 * 1000); // 10m

// GET /api/golfers?tournament=t4
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { tournament } = req.query;
    let query = sb.from("golfers").select("*").order("world_rank");
    // If tournament provided, only return golfers with scores for that tournament
    if (tournament) {
      const { data: scoredIds } = await sb
        .from("tournament_scores")
        .select("golfer_id")
        .eq("tournament_id", tournament);
      let ids = (scoredIds || []).map((s) => s.golfer_id).filter(Boolean);

      // If the tournament is upcoming, we may not have any score rows yet.
      // Try to auto-seed a projected field once in a while using DataGolf (if configured).
      if (!ids.length) {
        const now = Date.now();
        const prev = FIELD_SEED_ATTEMPTS.get(String(tournament)) || null;
        const shouldAttempt = !prev || (now - prev.ts) >= FIELD_SEED_MIN_INTERVAL_MS;
        if (shouldAttempt) {
          FIELD_SEED_ATTEMPTS.set(String(tournament), { ts: now });
          try {
            const { data: tRow } = await sb
              .from("tournaments")
              .select("id, name, start_date, field_size")
              .eq("id", tournament)
              .single();

            const fetchDataGolfFieldPlayers = req.app.locals.fetchDataGolfFieldPlayers;
            const importFieldPlayersIntoTournament = req.app.locals.importFieldPlayersIntoTournament;
            if (tRow && typeof fetchDataGolfFieldPlayers === "function" && typeof importFieldPlayersIntoTournament === "function") {
              const dg = await fetchDataGolfFieldPlayers(tRow);
              if (dg?.players?.length) {
                await importFieldPlayersIntoTournament(String(tournament), dg.players);
                const { data: scoredIds2 } = await sb
                  .from("tournament_scores")
                  .select("golfer_id")
                  .eq("tournament_id", tournament);
                ids = (scoredIds2 || []).map((s) => s.golfer_id).filter(Boolean);
              }
            }
          } catch {}
        }
      }

      if (!ids.length) return res.json({ golfers: [] });
      query = query.in("id", ids);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ golfers: data });
  } catch (e) { next(e); }
});

// server/routes/scores.js (bundled here for brevity)
const scoresRouter = require("express").Router();

// GET /api/scores/:tournamentId
scoresRouter.get("/:tournamentId", optionalAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { data, error } = await sb
      .from("tournament_scores")
      .select("*, golfer:golfers(id, name, country, world_rank, driv_dist, driv_acc, gir, putts, scoring_avg, sg_total)")
      .eq("tournament_id", req.params.tournamentId)
      .order("position");
    if (error) return res.status(500).json({ error: error.message });
    res.json({ scores: data });
  } catch (e) { next(e); }
});

module.exports = router;
// Export scores router separately
module.exports.scoresRouter = scoresRouter;
