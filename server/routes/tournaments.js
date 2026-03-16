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

    const providerRank = (id) => {
      // Keep stable internal ids (t1..t20) preferred so existing pools don't lose their tournament reference.
      if (/^t\\d+$/i.test(String(id || ""))) return 5;
      // Prefer DataGolf schedule over other external sources.
      if (String(id || "").startsWith("dg_")) return 4;
      if (String(id || "").startsWith("bdl_")) return 3;
      if (String(id || "").startsWith("sdio_")) return 2;
      if (String(id || "").startsWith("tsdb_")) return 1;
      return 0;
    };
    const dedupedMap = new Map();
    for (const t of (data || [])) {
      const key = `${String(t.name || "").trim().toLowerCase()}|${String(t.start_date || "")}`;
      const current = dedupedMap.get(key);
      if (!current || providerRank(t.id) > providerRank(current.id)) dedupedMap.set(key, t);
    }
    const deduped = Array.from(dedupedMap.values())
      .sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || "")));

    res.json({ tournaments: deduped });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
