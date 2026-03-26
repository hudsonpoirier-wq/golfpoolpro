// server/routes/draft.js
// Handles snake draft picks with strict turn & timeout validation

const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");

// In-memory controls (MVP): not persisted across restarts.
const pausedDraftPools = new Set(); // poolId -> paused boolean
const draftClocks = new Map(); // poolId -> { pickNum, startedAtMs, pausedRemainingSec }

function resetDraftRuntime(poolId) {
  const key = String(poolId);
  pausedDraftPools.delete(key);
  draftClocks.delete(key);
}

function ensureDraftClock(poolId, pickNum, shotClock, lastPickAtMs) {
  const key = String(poolId);
  const existing = draftClocks.get(key);
  if (!existing || existing.pickNum !== pickNum) {
    // Start the current pick clock at the time the previous pick was made (or now for pick 0).
    const lastMs = typeof lastPickAtMs === "number" ? lastPickAtMs : null;
    const startedAtMs = Number.isFinite(lastMs) && lastMs > 0 ? lastMs : Date.now();
    const next = { pickNum, startedAtMs, pausedRemainingSec: null };
    draftClocks.set(key, next);
    return next;
  }
  // Ensure pausedRemainingSec is within bounds if shotClock changed.
  if (existing.pausedRemainingSec != null) {
    const capped = Math.max(0, Math.min(Number(existing.pausedRemainingSec), Number(shotClock || 0)));
    if (capped !== existing.pausedRemainingSec) existing.pausedRemainingSec = capped;
  }
  return existing;
}

function computeTimeRemaining(clock, shotClock) {
  const total = Number.isFinite(Number(shotClock)) && Number(shotClock) > 0 ? Number(shotClock) : 60;
  const elapsed = (Date.now() - Number(clock.startedAtMs || 0)) / 1000;
  return Math.max(0, total - elapsed);
}

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

    // Time remaining on current pick (server-side clock).
    // Important: when pickNum==0, we must not reset the clock on every poll.
    const lastPickAtMs = picks?.length ? new Date(picks[picks.length - 1].picked_at).getTime() : null;
    const clock = ensureDraftClock(poolId, pickNum, pool.shot_clock, lastPickAtMs);
    let timeRemaining = computeTimeRemaining(clock, pool.shot_clock);
    if (paused) {
      if (clock.pausedRemainingSec == null) clock.pausedRemainingSec = Math.round(timeRemaining);
      timeRemaining = Number(clock.pausedRemainingSec);
    } else if (clock.pausedRemainingSec != null) {
      // If the draft was resumed without hitting the resume endpoint (e.g., server restart),
      // restart the clock using the previously frozen remaining time.
      const remain = Number(clock.pausedRemainingSec);
      clock.startedAtMs = Date.now() - (Number(pool.shot_clock || 0) - remain) * 1000;
      clock.pausedRemainingSec = null;
      timeRemaining = computeTimeRemaining(clock, pool.shot_clock);
    }

    // Auto-skip if clock has expired (only for active drafts)
    if (!paused && !isDone && pool.status === "draft" && timeRemaining <= 0 && currentPickOwner) {
      const didSkip = await autoSkip(sb, poolId, currentPickOwner, pool, picks, draftOrder);
      if (didSkip) return res.redirect(307, `/api/draft/${poolId}`);
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
    const { data: pool } = await sb.from("pools").select("host_id, status, shot_clock, team_size").eq("id", poolId).single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (String(pool.host_id) !== String(req.user.id)) return res.status(403).json({ error: "Only the host can pause the draft." });
    if (pool.status !== "draft") return res.status(400).json({ error: "Draft is not active." });
    // Freeze the current pick time remaining.
    try {
      const { data: members } = await sb
        .from("pool_members")
        .select("user_id, joined_at")
        .eq("pool_id", poolId)
        .order("joined_at");
      const { data: picks } = await sb
        .from("draft_picks")
        .select("picked_at")
        .eq("pool_id", poolId)
        .order("pick_number");
      const pickNum = picks?.length || 0;
      const lastPickAtMs = picks?.length ? new Date(picks[picks.length - 1].picked_at).getTime() : null;
      const clock = ensureDraftClock(poolId, pickNum, pool.shot_clock, lastPickAtMs);
      const remaining = computeTimeRemaining(clock, pool.shot_clock);
      clock.pausedRemainingSec = Math.round(remaining);
    } catch {}
    pausedDraftPools.add(poolId);
    res.json({ paused: true });
  } catch (e) { next(e); }
});

// ─── POST /api/draft/:poolId/resume ───────────────────────────
router.post("/:poolId/resume", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { poolId } = req.params;
    const { data: pool } = await sb.from("pools").select("host_id, status, shot_clock").eq("id", poolId).single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (String(pool.host_id) !== String(req.user.id)) return res.status(403).json({ error: "Only the host can resume the draft." });
    if (pool.status !== "draft") return res.status(400).json({ error: "Draft is not active." });
    pausedDraftPools.delete(poolId);
    // Continue clock from the frozen remaining time.
    try {
      const { data: picks } = await sb
        .from("draft_picks")
        .select("picked_at")
        .eq("pool_id", poolId)
        .order("pick_number");
      const pickNum = picks?.length || 0;
      const lastPickAtMs = picks?.length ? new Date(picks[picks.length - 1].picked_at).getTime() : null;
      const clock = ensureDraftClock(poolId, pickNum, pool.shot_clock, lastPickAtMs);
      const remain = clock.pausedRemainingSec;
      if (remain != null) {
        clock.startedAtMs = Date.now() - (Number(pool.shot_clock || 0) - Number(remain)) * 1000;
        clock.pausedRemainingSec = null;
      }
    } catch {}
    res.json({ paused: false });
  } catch (e) { next(e); }
});

// ─── POST /api/draft/:poolId/pick ─────────────────────────────
// Body: { golferId }
router.post("/:poolId/pick", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { poolId } = req.params;
    const rawGolferId = req.body.golferId;
    const golferId = Number(rawGolferId);

    if (!rawGolferId || !Number.isFinite(golferId) || golferId <= 0) {
      return res.status(400).json({ error: "golferId must be a positive integer." });
    }
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

    // Check golfer not already taken (numeric comparison to avoid type mismatch)
    if (picks.find(p => Number(p.golfer_id) === golferId)) {
      return res.status(409).json({ error: "This golfer has already been drafted." });
    }

    const { data: pick, error } = await sb
      .from("draft_picks")
      .insert({ pool_id: poolId, user_id: req.user.id, golfer_id: golferId, pick_number: picks.length })
      .select()
      .single();
    if (error) {
      // Handle race condition: unique constraint on (pool_id, pick_number) or (pool_id, golfer_id)
      if (error.code === "23505") {
        return res.status(409).json({ error: "Pick conflict — another pick was made simultaneously. Please retry." });
      }
      return res.status(400).json({ error: error.message });
    }

    // Start the next pick timer now.
    try {
      const nextPickNum = picks.length + 1;
      const clock = ensureDraftClock(poolId, nextPickNum, pool.shot_clock, Date.now());
      clock.startedAtMs = Date.now();
      clock.pausedRemainingSec = null;
    } catch {}

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
    const rawGolferId = req.body.golferId;
    const golferId = Number(rawGolferId);
    if (!rawGolferId || !Number.isFinite(golferId) || golferId <= 0) {
      return res.status(400).json({ error: "golferId must be a positive integer." });
    }

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

    if (picks.find(p => Number(p.golfer_id) === golferId)) {
      return res.status(409).json({ error: "This golfer has already been drafted." });
    }

    const { data: pick, error } = await sb
      .from("draft_picks")
      .insert({ pool_id: poolId, user_id: currentOwner, golfer_id: golferId, pick_number: picks.length })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Pick conflict — another pick was made simultaneously. Please retry." });
      }
      return res.status(400).json({ error: error.message });
    }

    // Start the next pick timer now.
    try {
      const { data: poolClock } = await sb.from("pools").select("shot_clock").eq("id", poolId).single();
      const sc = poolClock?.shot_clock ?? 60;
      const nextPickNum = picks.length + 1;
      const clock = ensureDraftClock(poolId, nextPickNum, sc, Date.now());
      clock.startedAtMs = Date.now();
      clock.pausedRemainingSec = null;
    } catch {}

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
  // Pick the highest-ranked available golfer automatically, but ONLY from this tournament's field.
  const tournamentId = pool?.tournament_id;
  if (!tournamentId) return false;

  const { data: fieldRows } = await sb
    .from("tournament_scores")
    .select("golfer_id, golfer:golfers(id, world_rank)")
    .eq("tournament_id", tournamentId);

  const field = (fieldRows || []).map((r) => r.golfer).filter(Boolean);
  field.sort((a, b) => Number(a.world_rank || 9999) - Number(b.world_rank || 9999));

  const takenIds = new Set(picks.map((p) => p.golfer_id));
  const nextGolfer = field.find((g) => !takenIds.has(g.id));
  if (!nextGolfer) return false;

  const { error: insertErr } = await sb.from("draft_picks").insert({
    pool_id: poolId,
    user_id: userId,
    golfer_id: nextGolfer.id,
    pick_number: picks.length,
  });
  // If a concurrent request already filled this pick slot, bail gracefully.
  if (insertErr) return false;

  // Start the next pick timer now.
  try {
    const nextPickNum = picks.length + 1;
    const sc = pool?.shot_clock ?? 60;
    const clock = ensureDraftClock(poolId, nextPickNum, sc, Date.now());
    clock.startedAtMs = Date.now();
    clock.pausedRemainingSec = null;
  } catch {}

  if (picks.length + 1 >= draftOrder.length) {
    await sb.from("pools").update({ status: "live" }).eq("id", poolId);
  }

  return true;
}

router._stats = () => ({
  pausedDraftPools: pausedDraftPools.size,
});

// Used by pool routes to ensure a fresh clock when transitioning lobby -> draft.
router._resetDraftRuntime = resetDraftRuntime;

module.exports = router;
