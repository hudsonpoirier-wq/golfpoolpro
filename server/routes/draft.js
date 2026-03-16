// server/routes/draft.js
// Handles snake draft picks with strict turn & timeout validation

const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");

// In-memory controls (MVP): not persisted across restarts.
const pausedDraftPools = new Set(); // poolId -> paused boolean

// ─── GET /api/draft/:poolId ───────────────────────────────────
// Returns full draft state: picks, current turn, time remaining
router.get("/:poolId", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { poolId } = req.params;

    // Verify membership
    const { data: member } = await sb
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", poolId)
      .eq("user_id", req.user.id)
      .single();
    if (!member) return res.status(403).json({ error: "Not a pool member." });

    const { data: pool } = await sb
      .from("pools")
      .select("status, team_size, shot_clock, tournament_id")
      .eq("id", poolId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });

    const { data: members } = await sb
      .from("pool_members")
      .select("user_id, joined_at, profile:profiles(id, name, avatar)")
      .eq("pool_id", poolId)
      .order("joined_at");

    const { data: picks } = await sb
      .from("draft_picks")
      .select("user_id, golfer_id, pick_number, picked_at")
      .eq("pool_id", poolId)
      .order("pick_number");

    const totalPicks = members.length * pool.team_size;
    const pickNum = picks?.length || 0;
    const isDone = pickNum >= totalPicks;

    // Snake draft order: round by round, reversing each round
    const draftOrder = buildSnakeOrder(members.map(m => m.user_id), pool.team_size);
    const currentPickOwner = isDone ? null : draftOrder[pickNum];
    const nextPickOwners = isDone ? [] : draftOrder.slice(pickNum, pickNum + 5);
    const paused = pausedDraftPools.has(poolId);

    // Time remaining on current pick (server-side clock)
    const lastPickTime = picks?.length
      ? new Date(picks[picks.length - 1].picked_at)
      : new Date();
    const elapsed = (Date.now() - lastPickTime.getTime()) / 1000;
    const timeRemaining = paused ? pool.shot_clock : Math.max(0, pool.shot_clock - elapsed);

    // Auto-skip if clock has expired
    if (!paused && !isDone && timeRemaining <= 0 && currentPickOwner) {
      await autoSkip(sb, poolId, currentPickOwner, pool, picks, draftOrder);
      return res.redirect(307, `/api/draft/${poolId}`);
    }

    res.json({
      pool,
      members,
      picks,
      draftOrder,
      currentPickOwner,
      nextPickOwners,
      pickNumber: pickNum,
      totalPicks,
      isDone,
      timeRemaining: Math.round(timeRemaining),
      paused,
    });
  } catch (e) { next(e); }
});

// ─── POST /api/draft/:poolId/pause ────────────────────────────
// Host-only: pauses pick timer and blocks picks.
router.post("/:poolId/pause", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { poolId } = req.params;
    const { data: pool } = await sb.from("pools").select("host_id").eq("id", poolId).single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (String(pool.host_id) !== String(req.user.id)) return res.status(403).json({ error: "Only the host can pause the draft." });
    pausedDraftPools.add(poolId);
    res.json({ paused: true });
  } catch (e) { next(e); }
});

// ─── POST /api/draft/:poolId/resume ───────────────────────────
router.post("/:poolId/resume", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { poolId } = req.params;
    const { data: pool } = await sb.from("pools").select("host_id").eq("id", poolId).single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (String(pool.host_id) !== String(req.user.id)) return res.status(403).json({ error: "Only the host can resume the draft." });
    pausedDraftPools.delete(poolId);
    res.json({ paused: false });
  } catch (e) { next(e); }
});

// ─── POST /api/draft/:poolId/pick ─────────────────────────────
// Body: { golferId }
router.post("/:poolId/pick", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { poolId } = req.params;
    const { golferId } = req.body;

    if (!golferId) return res.status(400).json({ error: "golferId is required." });
    if (pausedDraftPools.has(poolId)) return res.status(409).json({ error: "Draft is paused." });

    const { data: pool } = await sb
      .from("pools")
      .select("status, team_size, shot_clock")
      .eq("id", poolId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (pool.status !== "draft") return res.status(400).json({ error: "Draft is not active." });

    const { data: members } = await sb
      .from("pool_members")
      .select("user_id, joined_at")
      .eq("pool_id", poolId)
      .order("joined_at");

    const { data: picks } = await sb
      .from("draft_picks")
      .select("user_id, golfer_id, pick_number, picked_at")
      .eq("pool_id", poolId)
      .order("pick_number");

    const totalPicks = members.length * pool.team_size;
    if (picks.length >= totalPicks) return res.status(400).json({ error: "Draft is complete." });

    const draftOrder = buildSnakeOrder(members.map(m => m.user_id), pool.team_size);
    const currentOwner = draftOrder[picks.length];

    if (currentOwner !== req.user.id) {
      return res.status(403).json({ error: "It is not your turn to pick." });
    }

    // Check golfer not already taken
    if (picks.find(p => p.golfer_id === golferId)) {
      return res.status(409).json({ error: "This golfer has already been drafted." });
    }

    const { data: pick, error } = await sb
      .from("draft_picks")
      .insert({ pool_id: poolId, user_id: req.user.id, golfer_id: golferId, pick_number: picks.length })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    // If draft is complete, advance pool to live
    if (picks.length + 1 >= totalPicks) {
      await sb.from("pools").update({ status: "live" }).eq("id", poolId);
    }

    res.status(201).json({ pick, isDraftComplete: picks.length + 1 >= totalPicks });
  } catch (e) { next(e); }
});

// ─── POST /api/draft/:poolId/force-pick ───────────────────────
// Host-only: pick for the current drafter. Body: { golferId }
router.post("/:poolId/force-pick", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { poolId } = req.params;
    const { golferId } = req.body;
    if (!golferId) return res.status(400).json({ error: "golferId is required." });

    const { data: pool } = await sb
      .from("pools")
      .select("host_id, status, team_size")
      .eq("id", poolId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (String(pool.host_id) !== String(req.user.id)) return res.status(403).json({ error: "Only the host can force a pick." });
    if (pool.status !== "draft") return res.status(400).json({ error: "Draft is not active." });
    if (pausedDraftPools.has(poolId)) return res.status(409).json({ error: "Draft is paused." });

    const { data: members } = await sb
      .from("pool_members")
      .select("user_id, joined_at")
      .eq("pool_id", poolId)
      .order("joined_at");

    const { data: picks } = await sb
      .from("draft_picks")
      .select("user_id, golfer_id, pick_number, picked_at")
      .eq("pool_id", poolId)
      .order("pick_number");

    const totalPicks = members.length * pool.team_size;
    if (picks.length >= totalPicks) return res.status(400).json({ error: "Draft is complete." });

    const draftOrder = buildSnakeOrder(members.map(m => m.user_id), pool.team_size);
    const currentOwner = draftOrder[picks.length];

    if (picks.find(p => p.golfer_id === golferId)) {
      return res.status(409).json({ error: "This golfer has already been drafted." });
    }

    const { data: pick, error } = await sb
      .from("draft_picks")
      .insert({ pool_id: poolId, user_id: currentOwner, golfer_id: golferId, pick_number: picks.length })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    if (picks.length + 1 >= totalPicks) {
      await sb.from("pools").update({ status: "live" }).eq("id", poolId);
    }

    res.status(201).json({ pick, forcedFor: currentOwner, isDraftComplete: picks.length + 1 >= totalPicks });
  } catch (e) { next(e); }
});

// ─── Helpers ──────────────────────────────────────────────────

function buildSnakeOrder(userIds, teamSize) {
  const order = [];
  for (let round = 0; round < teamSize; round++) {
    const roundOrder = round % 2 === 0 ? [...userIds] : [...userIds].reverse();
    order.push(...roundOrder);
  }
  return order;
}

async function autoSkip(sb, poolId, userId, pool, picks, draftOrder) {
  // Pick the highest-ranked available golfer automatically
  const { data: scores } = await sb
    .from("golfers")
    .select("id, world_rank")
    .order("world_rank")
    .limit(200);

  const takenIds = new Set(picks.map(p => p.golfer_id));
  const nextGolfer = scores?.find(g => !takenIds.has(g.id));
  if (!nextGolfer) return;

  await sb.from("draft_picks").insert({
    pool_id: poolId,
    user_id: userId,
    golfer_id: nextGolfer.id,
    pick_number: picks.length,
  });

  if (picks.length + 1 >= draftOrder.length) {
    await sb.from("pools").update({ status: "live" }).eq("id", poolId);
  }
}

router._stats = () => ({
  pausedDraftPools: pausedDraftPools.size,
});

module.exports = router;
