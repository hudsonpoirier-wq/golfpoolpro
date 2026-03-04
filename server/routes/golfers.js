// server/routes/golfers.js
const router = require("express").Router();
const { optionalAuth } = require("../middleware/auth");

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
      if (scoredIds?.length) {
        query = query.in("id", scoredIds.map(s => s.golfer_id));
      }
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
      .select("*, golfer:golfers(id, name, country, world_rank, driv_dist, gir, scoring_avg, sg_total)")
      .eq("tournament_id", req.params.tournamentId)
      .order("position");
    if (error) return res.status(500).json({ error: error.message });
    res.json({ scores: data });
  } catch (e) { next(e); }
});

module.exports = router;
// Export scores router separately
module.exports.scoresRouter = scoresRouter;
