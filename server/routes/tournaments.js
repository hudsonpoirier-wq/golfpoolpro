const router = require("express").Router();

// GET /api/tournaments/future
router.get("/future", async (_req, res, next) => {
  try {
    const sb = _req.app.locals.supabase;
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await sb
      .from("tournaments")
      .select("id, name, venue, start_date, end_date, purse, field_size, status")
      .gte("start_date", today)
      .order("start_date", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ tournaments: data || [] });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
