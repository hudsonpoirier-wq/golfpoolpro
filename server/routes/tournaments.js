const router = require("express").Router();
const { seedUpcomingTournaments } = require("../services/tournamentSync");

// GET /api/tournaments/future
router.get("/future", async (_req, res, next) => {
  try {
    const sb = _req.app.locals.supabase;
    const today = new Date().toISOString().slice(0, 10);
    const minRows = Number(process.env.MIN_TOURNAMENT_ROWS || 12);

    const query = () => sb
      .from("tournaments")
      .select("id, name, venue, start_date, end_date, purse, field_size, status")
      .gte("start_date", today)
      .order("start_date", { ascending: true });
    let { data, error } = await query();
    if (error) return res.status(500).json({ error: error.message });

    if ((data || []).length < minRows) {
      await seedUpcomingTournaments(sb, new Date().getUTCFullYear());
      const rerun = await query();
      if (!rerun.error) data = rerun.data || data;
    }

    res.json({ tournaments: data || [] });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
