// server/routes/scores.js
const router = require("express").Router();

// GET /api/scores/:tournamentId
router.get("/:tournamentId", async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { data, error } = await sb
      .from("tournament_scores")
      .select(`
        position, r1, r2, r3, r4, birdies, eagles, bogeys, tee_time, updated_at,
        golfer:golfers(id, name, country, world_rank, driv_dist, driv_acc, gir, putts, scoring_avg, sg_total)
      `)
      .eq("tournament_id", req.params.tournamentId)
      .order("position");
    if (error) return res.status(500).json({ error: error.message });
    res.json({ scores: data, updatedAt: data?.[0]?.updated_at || null });
  } catch (e) { next(e); }
});

module.exports = router;
