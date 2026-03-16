// server/routes/public.js
// Public, read-only endpoints (no auth required).

const router = require("express").Router();

// ─── GET /api/public/pools/:token/leaderboard ────────────────
// Read-only pool summary + standings by invite token (no login).
router.get("/pools/:token/leaderboard", async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { token } = req.params;

    const { data: pool, error: pErr } = await sb
      .from("pools")
      .select(`
        id, name, status, max_participants, team_size, scoring_golfers, cut_line, shot_clock, invite_token,
        tournament:tournaments(id, name, venue, start_date, end_date, purse, field_size),
        host:profiles!pools_host_id_fkey(id, name, avatar)
      `)
      .eq("invite_token", token)
      .single();
    if (pErr || !pool) return res.status(404).json({ error: "Pool not found." });

    const { data: members, error: mErr } = await sb
      .from("pool_members")
      .select("user_id, joined_at, profile:profiles(id, name, avatar)")
      .eq("pool_id", pool.id)
      .order("joined_at");
    if (mErr) return res.status(400).json({ error: mErr.message });

    const { data: standingsRows } = await sb
      .from("pool_standings")
      .select("user_id, player_name, avatar, score")
      .eq("pool_id", pool.id)
      .order("score", { ascending: true });

    const standingsByUser = new Map((standingsRows || []).map((s) => [String(s.user_id), s]));
    const standings = (members || []).map((m) => {
      const s = standingsByUser.get(String(m.user_id));
      return {
        user_id: m.user_id,
        name: s?.player_name || m.profile?.name || "Player",
        avatar: s?.avatar || m.profile?.avatar || null,
        score: typeof s?.score === "number" ? s.score : null,
      };
    }).sort((a, b) => (a.score ?? 999999999) - (b.score ?? 999999999));

    res.json({
      pool: {
        id: pool.id,
        name: pool.name,
        status: pool.status,
        invite_token: pool.invite_token,
        max_participants: pool.max_participants,
        team_size: pool.team_size,
        scoring_golfers: pool.scoring_golfers,
        cut_line: pool.cut_line,
        shot_clock: pool.shot_clock,
        tournament: pool.tournament || null,
        host: pool.host || null,
      },
      members: (members || []).map((m) => ({
        user_id: m.user_id,
        name: m.profile?.name || "Player",
        avatar: m.profile?.avatar || null,
      })),
      standings,
    });
  } catch (e) { next(e); }
});

module.exports = router;

