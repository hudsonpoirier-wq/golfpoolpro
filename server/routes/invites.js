// server/routes/invites.js
// Handles invite link resolution and joining pools via token

const router = require("express").Router();
const { requireAuth, optionalAuth } = require("../middleware/auth");

// ─── GET /api/invite/:token ───────────────────────────────────
// Resolves an invite token → pool info (public, no auth required)
router.get("/:token", optionalAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { token } = req.params;

    const { data: pool, error } = await sb
      .from("pools")
      .select(`
        id, name, status, max_participants, team_size, scoring_golfers,
        host_id, invite_token,
        tournament:tournaments(id, name, venue, start_date, end_date),
        host:profiles!pools_host_id_fkey(name, avatar)
      `)
      .eq("invite_token", token)
      .single();

    if (error || !pool) {
      return res.status(404).json({ error: "Invite link not found or has expired." });
    }

    // Count current members
    const { count } = await sb
      .from("pool_members")
      .select("*", { count: "exact", head: true })
      .eq("pool_id", pool.id);

    if (count >= pool.max_participants) {
      return res.status(409).json({ error: "This pool is full." });
    }

    // If user is already logged in, check if they're already in the pool
    let alreadyMember = false;
    if (req.user) {
      const { data: m } = await sb
        .from("pool_members")
        .select("user_id")
        .eq("pool_id", pool.id)
        .eq("user_id", req.user.id)
        .single();
      alreadyMember = !!m;
    }

    res.json({
      pool: { ...pool, current_members: count },
      alreadyMember,
    });
  } catch (e) { next(e); }
});

// ─── POST /api/invite/:token/join ────────────────────────────
// Join a pool using an invite token (requires auth)
router.post("/:token/join", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { token } = req.params;

    const { data: pool, error } = await sb
      .from("pools")
      .select("id, name, max_participants, status")
      .eq("invite_token", token)
      .single();

    if (error || !pool) {
      return res.status(404).json({ error: "Invite link not found or has expired." });
    }
    if (pool.status === "complete") {
      return res.status(409).json({ error: "This pool has already completed." });
    }

    // Check member count
    const { count } = await sb
      .from("pool_members")
      .select("*", { count: "exact", head: true })
      .eq("pool_id", pool.id);
    if (count >= pool.max_participants) {
      return res.status(409).json({ error: "This pool is full." });
    }

    // Check if already a member (upsert handles duplicate gracefully)
    const { error: joinError } = await sb
      .from("pool_members")
      .upsert({ pool_id: pool.id, user_id: req.user.id, is_ready: false },
               { onConflict: "pool_id,user_id", ignoreDuplicates: true });
    if (joinError) return res.status(400).json({ error: joinError.message });

    res.json({
      message: `You've joined ${pool.name}!`,
      poolId: pool.id,
    });
  } catch (e) { next(e); }
});

// ─── POST /api/invite/pools/:id/regenerate ────────────────────
// Regenerate invite token (host only — invalidates old links)
router.post("/pools/:id/regenerate", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;

    const { data: pool } = await sb.from("pools").select("host_id").eq("id", id).single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (pool.host_id !== req.user.id) return res.status(403).json({ error: "Only the host can regenerate the invite link." });

    // Generate new token using DB function
    const { data, error } = await sb.rpc("regenerate_invite_token", { pool_id: id });
    if (error) {
      // Fallback: update manually
      const newToken = Math.random().toString(36).slice(2, 10);
      const { data: updated } = await sb.from("pools").update({ invite_token: newToken }).eq("id", id).select("invite_token").single();
      return res.json({ invite_token: updated.invite_token });
    }
    res.json({ invite_token: data });
  } catch (e) { next(e); }
});

module.exports = router;
