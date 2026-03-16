// server/routes/pools.js

const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");

const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 12;
const MIN_TEAM_SIZE = 4;
const MAX_TEAM_SIZE = 12;

function isInt(n) {
  return Number.isInteger(n) && Number.isFinite(n);
}

const CHAT_MAX_MESSAGES = 200;
const poolChat = new Map(); // poolId -> [{ id, ts, user_id, type, text }]

function pushChat(poolId, msg) {
  const list = poolChat.get(poolId) || [];
  list.push(msg);
  while (list.length > CHAT_MAX_MESSAGES) list.shift();
  poolChat.set(poolId, list);
  return list;
}

const LOBBY_TTL_MS = 15000;
const lobbyPresence = new Map(); // poolId -> Map(userId -> lastSeenMs)

function pruneLobby(poolId) {
  const byUser = lobbyPresence.get(poolId);
  if (!byUser) return [];
  const now = Date.now();
  for (const [uid, ts] of byUser.entries()) {
    if (!Number.isFinite(ts) || now - ts > LOBBY_TTL_MS) byUser.delete(uid);
  }
  if (!byUser.size) lobbyPresence.delete(poolId);
  return [...(lobbyPresence.get(poolId)?.keys() || [])];
}

function touchLobby(poolId, userId) {
  let byUser = lobbyPresence.get(poolId);
  if (!byUser) {
    byUser = new Map();
    lobbyPresence.set(poolId, byUser);
  }
  byUser.set(userId, Date.now());
  return pruneLobby(poolId);
}

// ─── GET /api/pools ───────────────────────────────────────────
// Returns all pools the current user is a member of
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;

    // Get pool IDs for this user
    const { data: memberships, error: mErr } = await sb
      .from("pool_members")
      .select("pool_id")
      .eq("user_id", req.user.id);
    if (mErr) return res.status(500).json({ error: mErr.message });

    const poolIds = memberships.map(m => m.pool_id);
    if (!poolIds.length) return res.json({ pools: [] });

    const { data: pools, error: pErr } = await sb
      .from("pools")
      .select(`
        id, name, status, max_participants, team_size, scoring_golfers,
        cut_line, shot_clock, created_at, host_id, invite_token,
        tournament:tournaments(id, name, venue, start_date, end_date, purse, field_size)
      `)
      .in("id", poolIds)
      .order("created_at", { ascending: false });
    if (pErr) return res.status(500).json({ error: pErr.message });

    // Attach member count and user's rank to each pool
    const enriched = await Promise.all(pools.map(async pool => {
      const { data: members } = await sb
        .from("pool_members")
        .select("user_id")
        .eq("pool_id", pool.id);

      const { data: standings } = await sb
        .from("pool_standings")
        .select("user_id, score")
        .eq("pool_id", pool.id)
        .order("score", { ascending: true });

      const userStanding = standings?.findIndex(s => s.user_id === req.user.id);
      const userScore = standings?.find(s => s.user_id === req.user.id)?.score;

      return {
        ...pool,
        participants: members?.length || 0,
        yourRank: userStanding >= 0 ? userStanding + 1 : null,
        yourScore: userScore ?? null,
      };
    }));

    res.json({ pools: enriched });
  } catch (e) { next(e); }
});

// ─── GET /api/pools/:id ───────────────────────────────────────
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;

    // Verify membership
    const { data: member } = await sb
      .from("pool_members")
      .select("is_ready")
      .eq("pool_id", id)
      .eq("user_id", req.user.id)
      .single();
    if (!member) return res.status(403).json({ error: "You are not a member of this pool." });

    const { data: pool, error } = await sb
      .from("pools")
      .select(`
        *,
        tournament:tournaments(*),
        host:profiles!pools_host_id_fkey(id, name, avatar)
      `)
      .eq("id", id)
      .single();
    if (error || !pool) return res.status(404).json({ error: "Pool not found." });

    // Members
    const { data: members } = await sb
      .from("pool_members")
      .select("user_id, is_ready, joined_at, profile:profiles(id, name, avatar, email)")
      .eq("pool_id", id)
      // Draft order is based on join time; keep API ordering consistent.
      .order("joined_at");

    // Draft picks
    const { data: picks } = await sb
      .from("draft_picks")
      .select("user_id, golfer_id, pick_number, picked_at")
      .eq("pool_id", id)
      .order("pick_number");

    // Standings
    const { data: standings } = await sb
      .from("pool_standings")
      .select("*")
      .eq("pool_id", id)
      .order("score", { ascending: true });

    res.json({ pool, members, picks, standings, activeLobbyUserIds: pruneLobby(id) });
  } catch (e) { next(e); }
});

// ─── POST /api/pools/:id/start-draft ──────────────────────────
// Host-only: flips pool status from lobby -> draft once everyone is ready.
// This makes the backend the source of truth so clients don't "bounce" when polling.
router.post("/:id/start-draft", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;

    const { data: pool } = await sb
      .from("pools")
      .select("id, host_id, status")
      .eq("id", id)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (String(pool.host_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only the host can start the draft." });
    }

    // Idempotent: if already started, just return the current pool.
    if (pool.status === "draft") return res.json({ pool });
    if (pool.status !== "lobby") return res.status(409).json({ error: "Draft can only be started from the lobby." });

    const { data: members } = await sb
      .from("pool_members")
      .select("is_ready")
      .eq("pool_id", id);
    const memberCount = members?.length || 0;
    // Allow solo drafts for testing / single-player pools.
    if (memberCount < 1) return res.status(409).json({ error: "Need at least 1 participant to start the draft." });
    const allReady = members.every((m) => m.is_ready);
    if (!allReady) return res.status(409).json({ error: "All participants must be ready to start the draft." });

    const { data: picks } = await sb
      .from("draft_picks")
      .select("pick_number")
      .eq("pool_id", id)
      .limit(1);
    if ((picks?.length || 0) > 0) {
      return res.status(409).json({ error: "Draft has already started for this pool." });
    }

    const { data: updated, error } = await sb
      .from("pools")
      .update({ status: "draft" })
      .eq("id", id)
      .select("id, host_id, status")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ pool: updated });
  } catch (e) { next(e); }
});

// ─── POST /api/pools/:id/ready-all ────────────────────────────
// Host-only: marks every member as ready (useful for commissioner controls/testing).
router.post("/:id/ready-all", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;

    const { data: pool } = await sb
      .from("pools")
      .select("id, host_id, status")
      .eq("id", id)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (String(pool.host_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only the host can mark everyone ready." });
    }
    if (pool.status !== "lobby") {
      return res.status(409).json({ error: "You can only mark everyone ready in the lobby." });
    }

    const { error: updErr } = await sb
      .from("pool_members")
      .update({ is_ready: true })
      .eq("pool_id", id);
    if (updErr) return res.status(400).json({ error: updErr.message });

    // Re-check readiness, then auto-advance (solo pools allowed).
    const { data: members } = await sb
      .from("pool_members")
      .select("is_ready")
      .eq("pool_id", id);
    const allReady = (members?.length || 0) >= 1 && members.every((m) => m.is_ready);
    if (allReady) {
      await sb.from("pools").update({ status: "draft" }).eq("id", id);
    }

    res.json({ allReady: !!allReady });
  } catch (e) { next(e); }
});

// ─── POST /api/pools/:id/presence/heartbeat ───────────────────
router.post("/:id/presence/heartbeat", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;
    const { data: member } = await sb
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", id)
      .eq("user_id", req.user.id)
      .single();
    if (!member) return res.status(403).json({ error: "You are not a member of this pool." });
    const activeLobbyUserIds = touchLobby(id, req.user.id);
    res.json({ activeLobbyUserIds, ttlMs: LOBBY_TTL_MS });
  } catch (e) { next(e); }
});

// ─── GET /api/pools/:id/presence ─────────────────────────────
router.get("/:id/presence", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;
    const { data: member } = await sb
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", id)
      .eq("user_id", req.user.id)
      .single();
    if (!member) return res.status(403).json({ error: "You are not a member of this pool." });
    const activeLobbyUserIds = pruneLobby(id);
    res.json({ activeLobbyUserIds, ttlMs: LOBBY_TTL_MS });
  } catch (e) { next(e); }
});

// ─── DELETE /api/pools/:id/presence ──────────────────────────
router.delete("/:id/presence", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const byUser = lobbyPresence.get(id);
    if (byUser) {
      byUser.delete(req.user.id);
      if (!byUser.size) lobbyPresence.delete(id);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── GET /api/pools/:id/chat ─────────────────────────────────
// Lightweight in-memory lobby chat (not persisted).
router.get("/:id/chat", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;
    const { data: member } = await sb
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", id)
      .eq("user_id", req.user.id)
      .single();
    if (!member) return res.status(403).json({ error: "You are not a member of this pool." });
    res.json({ messages: poolChat.get(id) || [] });
  } catch (e) { next(e); }
});

// ─── POST /api/pools/:id/chat ────────────────────────────────
// Body: { text }
router.post("/:id/chat", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Message text is required." });
    if (text.length > 300) return res.status(400).json({ error: "Message too long (max 300 chars)." });
    const { data: member } = await sb
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", id)
      .eq("user_id", req.user.id)
      .single();
    if (!member) return res.status(403).json({ error: "You are not a member of this pool." });

    const msg = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      user_id: req.user.id,
      type: "chat",
      text,
    };
    pushChat(id, msg);
    res.status(201).json({ message: msg });
  } catch (e) { next(e); }
});

// ─── POST /api/pools/:id/chat/ping ───────────────────────────
// Host-only: posts a system ping into chat.
router.post("/:id/chat/ping", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;
    const { data: pool } = await sb.from("pools").select("host_id").eq("id", id).single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (String(pool.host_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only the host can ping the lobby." });
    }
    const msg = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      user_id: req.user.id,
      type: "ping",
      text: "Host pinged the lobby: draft starting soon.",
    };
    pushChat(id, msg);
    res.status(201).json({ message: msg });
  } catch (e) { next(e); }
});

// ─── DELETE /api/pools/:id/members/:userId ────────────────────
// Host-only: remove a member (only before draft starts).
router.delete("/:id/members/:userId", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id, userId } = req.params;

    const { data: pool } = await sb.from("pools").select("host_id, status").eq("id", id).single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (String(pool.host_id) !== String(req.user.id)) return res.status(403).json({ error: "Only the host can remove members." });
    if (pool.status !== "lobby") return res.status(409).json({ error: "Members can only be removed before the draft starts." });

    if (String(userId) === String(pool.host_id)) {
      return res.status(400).json({ error: "Host cannot be removed from their own pool." });
    }

    const { error: delErr } = await sb
      .from("pool_members")
      .delete()
      .eq("pool_id", id)
      .eq("user_id", userId);
    if (delErr) return res.status(400).json({ error: delErr.message || "Could not remove member." });

    // Remove presence entry if present.
    const byUser = lobbyPresence.get(id);
    if (byUser) {
      byUser.delete(userId);
      if (!byUser.size) lobbyPresence.delete(id);
    }

    pushChat(id, {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      user_id: req.user.id,
      type: "ping",
      text: "Host removed a participant from the pool.",
    });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── POST /api/pools ──────────────────────────────────────────
// Create a new pool
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const {
      name, tournament_id, max_participants = 12,
      team_size = 4, scoring_golfers = 2,
      cut_line = 2, shot_clock = 60,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "Pool name is required." });
    if (!tournament_id) return res.status(400).json({ error: "Tournament is required." });

    const mp = Number(max_participants);
    const ts = Number(team_size);
    const sg = Number(scoring_golfers);

    if (!isInt(mp) || mp < MIN_PARTICIPANTS || mp > MAX_PARTICIPANTS) {
      return res.status(400).json({ error: `max_participants must be an integer between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS}.` });
    }
    if (!isInt(ts) || ts < MIN_TEAM_SIZE || ts > MAX_TEAM_SIZE) {
      return res.status(400).json({ error: `team_size must be an integer between ${MIN_TEAM_SIZE} and ${MAX_TEAM_SIZE}.` });
    }
    if (!isInt(sg) || sg < 1 || sg > ts) {
      return res.status(400).json({ error: "scoring_golfers must be an integer between 1 and team_size." });
    }

    const { data: pool, error } = await sb
      .from("pools")
      .insert({
        name: name.trim(),
        tournament_id,
        host_id: req.user.id,
        max_participants: mp,
        team_size: ts,
        scoring_golfers: sg,
        cut_line,
        shot_clock,
        status: "lobby",
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    // Host automatically joins their own pool
    await sb.from("pool_members").insert({ pool_id: pool.id, user_id: req.user.id, is_ready: false });

    res.status(201).json({ pool });
  } catch (e) { next(e); }
});

// ─── PATCH /api/pools/:id ─────────────────────────────────────
// Update pool settings (host only)
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;

    const { data: pool } = await sb.from("pools").select("host_id").eq("id", id).single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (pool.host_id !== req.user.id) return res.status(403).json({ error: "Only the host can edit pool settings." });

    const allowed = ["name","status","max_participants","team_size","scoring_golfers","cut_line","shot_clock"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    if (Object.prototype.hasOwnProperty.call(updates, "max_participants")) {
      const mp = Number(updates.max_participants);
      if (!isInt(mp) || mp < MIN_PARTICIPANTS || mp > MAX_PARTICIPANTS) {
        return res.status(400).json({ error: `max_participants must be an integer between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS}.` });
      }
      updates.max_participants = mp;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "team_size")) {
      const ts = Number(updates.team_size);
      if (!isInt(ts) || ts < MIN_TEAM_SIZE || ts > MAX_TEAM_SIZE) {
        return res.status(400).json({ error: `team_size must be an integer between ${MIN_TEAM_SIZE} and ${MAX_TEAM_SIZE}.` });
      }
      updates.team_size = ts;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "scoring_golfers")) {
      const sg = Number(updates.scoring_golfers);
      const effectiveTeamSize = Object.prototype.hasOwnProperty.call(updates, "team_size")
        ? updates.team_size
        : null;
      if (!isInt(sg) || sg < 1) {
        return res.status(400).json({ error: "scoring_golfers must be a positive integer." });
      }
      if (effectiveTeamSize !== null && sg > effectiveTeamSize) {
        return res.status(400).json({ error: "scoring_golfers must be an integer between 1 and team_size." });
      }
      updates.scoring_golfers = sg;
    }

    const { data, error } = await sb.from("pools").update(updates).eq("id", id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ pool: data });
  } catch (e) { next(e); }
});

// ─── DELETE /api/pools/:id ────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;

    const { data: pool } = await sb.from("pools").select("host_id").eq("id", id).single();
    if (!pool) return res.status(404).json({ error: "Pool not found." });
    if (pool.host_id !== req.user.id) return res.status(403).json({ error: "Only the host can delete this pool." });

    // Best-effort cleanup so deletion behaves consistently even if a FK/cascade
    // is missing in an older schema revision.
    const { error: pickErr } = await sb.from("draft_picks").delete().eq("pool_id", id);
    if (pickErr) return res.status(400).json({ error: pickErr.message || "Could not delete pool picks." });

    const { error: memberErr } = await sb.from("pool_members").delete().eq("pool_id", id);
    if (memberErr) return res.status(400).json({ error: memberErr.message || "Could not delete pool members." });

    const { data: deleted, error: delErr } = await sb
      .from("pools")
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (delErr) return res.status(400).json({ error: delErr.message || "Could not delete pool." });
    if (!deleted?.id) return res.status(500).json({ error: "Pool deletion was not confirmed." });
    lobbyPresence.delete(id);

    res.json({ message: "Pool deleted.", id: deleted.id });
  } catch (e) { next(e); }
});

// ─── PATCH /api/pools/:id/ready ───────────────────────────────
// Toggle current user's ready status
router.patch("/:id/ready", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { id } = req.params;
    const { is_ready } = req.body;
    if (typeof is_ready !== "boolean") {
      return res.status(400).json({ error: "is_ready must be a boolean." });
    }

    const { data: member } = await sb
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", id)
      .eq("user_id", req.user.id)
      .single();
    if (!member) return res.status(403).json({ error: "You are not a member of this pool." });

    const { error } = await sb
      .from("pool_members")
      .update({ is_ready })
      .eq("pool_id", id)
      .eq("user_id", req.user.id);
    if (error) return res.status(400).json({ error: error.message });

    // Check if ALL members are ready — if so, auto-advance to draft
    const { data: members } = await sb
      .from("pool_members")
      .select("is_ready")
      .eq("pool_id", id);
    // Allow solo pools for testing / single-player pools.
    const allReady = members?.length >= 1 && members.every(m => m.is_ready);
    if (allReady) {
      await sb.from("pools").update({ status: "draft" }).eq("id", id);
    }

    res.json({ allReady });
  } catch (e) { next(e); }
});

// ─── GET /api/pools/:id/standings ─────────────────────────────
router.get("/:id/standings", requireAuth, async (req, res, next) => {
  try {
    const sb = req.app.locals.supabase;
    const { data, error } = await sb
      .from("pool_standings")
      .select("*")
      .eq("pool_id", req.params.id)
      .order("score", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ standings: data });
  } catch (e) { next(e); }
});

router._stats = () => ({
  chatPools: poolChat.size,
  chatMessages: [...poolChat.values()].reduce((s, arr) => s + (arr?.length || 0), 0),
  lobbyPools: lobbyPresence.size,
  lobbyUsers: [...lobbyPresence.values()].reduce((s, m) => s + (m?.size || 0), 0),
});

module.exports = router;
