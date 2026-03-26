// server/services/scoresSync.js
// Syncs live tournament scores from TheSportsDB (primary)
// Called every 30 seconds by the cron job in server/index.js

const fetch = require("node-fetch");  // npm install node-fetch@2

const SPORTS_DATA_KEY = process.env.SPORTS_DATA_IO_KEY;
const SPORTS_DATA_BASE = "https://api.sportsdata.io/golf/v2/json";
const BALLDONTLIE_PGA_KEY = process.env.BALLDONTLIE_PGA_KEY || process.env.BALLDONTLIE_API_KEY || "";
const BALLDONTLIE_PGA_BASE = (process.env.BALLDONTLIE_PGA_BASE_URL || "https://api.balldontlie.io/pga/v1").replace(/\/+$/, "");
const DATAGOLF_API_KEY = process.env.DATAGOLF_API_KEY || "";
const DATAGOLF_BASE_URL = (process.env.DATAGOLF_BASE_URL || "https://feeds.datagolf.com").replace(/\/+$/, "");

// DataGolf rate-limiter + cache (local to scoresSync to avoid coupling with index.js).
// 45 calls/min with 1.5s spacing; cache results for 60s (sync runs every 30s, so one
// fresh call per minute at most).
const DG_SYNC_CACHE = new Map();          // url -> { ts, json }
const DG_SYNC_CACHE_TTL_MS = 60 * 1000;  // 60s — score sync runs every 30s
const DG_SYNC_STATE = { minuteKey: null, minuteCount: 0, nextAllowedAtMs: 0 };

function dgSyncMinuteKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
}

function dgSyncCanCall() {
  const k = dgSyncMinuteKey();
  if (DG_SYNC_STATE.minuteKey !== k) {
    DG_SYNC_STATE.minuteKey = k;
    DG_SYNC_STATE.minuteCount = 0;
  }
  if (DG_SYNC_STATE.minuteCount >= 45) return false;
  if (Date.now() < DG_SYNC_STATE.nextAllowedAtMs) return false;
  return true;
}

function dgSyncRegisterCall() {
  const k = dgSyncMinuteKey();
  if (DG_SYNC_STATE.minuteKey !== k) {
    DG_SYNC_STATE.minuteKey = k;
    DG_SYNC_STATE.minuteCount = 0;
  }
  DG_SYNC_STATE.minuteCount += 1;
  DG_SYNC_STATE.nextAllowedAtMs = Date.now() + 1500;
}

async function dgSyncFetchJson(url) {
  const cached = DG_SYNC_CACHE.get(url);
  if (cached && Date.now() - cached.ts < DG_SYNC_CACHE_TTL_MS) return cached.json;
  if (!dgSyncCanCall()) return null;  // silently skip — this is a fallback
  dgSyncRegisterCall();
  const resp = await fetch(url, { timeout: 12000 });
  if (!resp.ok) throw new Error(`DataGolf returned ${resp.status}`);
  const json = await resp.json();
  DG_SYNC_CACHE.set(url, { ts: Date.now(), json });
  return json;
}

// Alternative free API (no key required, less detail):
const THE_SPORTS_DB_KEY = process.env.THE_SPORTS_DB_KEY || "3";
const THE_SPORTS_DB = `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}`;
const SCORE_PROVIDER = (
  process.env.SCORE_PROVIDER ||
  (BALLDONTLIE_PGA_KEY ? "BALLDONTLIE" : "THESPORTSDB")
).toUpperCase();
const USE_SPORTSDATAIO = String(process.env.USE_SPORTSDATAIO || "").toLowerCase() === "true";
const AUTO_EVENT_MAP = {};
const AUTO_SDIO_MAP = {};

function parseMap(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return {};
}

// Map internal IDs (t1, t4, etc.) -> TheSportsDB event IDs
const THE_SPORTS_DB_EVENT_MAP = parseMap(process.env.THE_SPORTS_DB_EVENT_MAP);
// Optional env override for SportsDataIO mappings (e.g. '{"t4":20508}')
const SPORTS_DATA_TOURNAMENT_MAP_OVERRIDE = parseMap(process.env.SPORTS_DATA_TOURNAMENT_MAP);

/**
 * Main sync function — called by cron every 30s
 */
async function syncLiveScores(supabase) {
  // Auto-activate tournaments whose start_date is today or earlier and end_date hasn't passed
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcomingReady } = await supabase
    .from("tournaments")
    .select("id, name, start_date, end_date")
    .eq("status", "upcoming")
    .lte("start_date", today);
  if (upcomingReady?.length) {
    for (const t of upcomingReady) {
      // Only activate if end_date hasn't passed (or no end_date set)
      if (!t.end_date || t.end_date >= today) {
        await supabase.from("tournaments").update({ status: "active" }).eq("id", t.id);
        console.log(`Auto-activated tournament: ${t.name} (${t.id})`);
      }
    }
  }

  // Auto-complete tournaments whose end_date has passed
  const { data: expiredActive } = await supabase
    .from("tournaments")
    .select("id, name, end_date")
    .eq("status", "active")
    .lt("end_date", today);
  if (expiredActive?.length) {
    for (const t of expiredActive) {
      await supabase.from("tournaments").update({ status: "complete" }).eq("id", t.id);
      console.log(`Auto-completed tournament: ${t.name} (${t.id})`);
    }
  }

  // Find active tournaments
  const { data: activeTournaments } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("status", "active");

  if (!activeTournaments?.length) return;  // Nothing to sync

  for (const tournament of activeTournaments) {
    try {
      const scores = await fetchScores(tournament.id, supabase);
      if (!scores?.length) continue;

      const golferRows = scores
        .filter((s) => Number.isFinite(Number(s.golferId)) && s.playerName)
        .map((s) => ({
          id: Number(s.golferId),
          name: String(s.playerName || "").trim(),
          country: s.country || null,
          updated_at: new Date().toISOString(),
        }))
        .filter((g) => g.id > 0 && g.name);
      if (golferRows.length) {
        await supabase.from("golfers").upsert(golferRows, { onConflict: "id" });
      }

      // Upsert scores in bulk
      const rows = scores.map(s => ({
        tournament_id: tournament.id,
        golfer_id: s.golferId,
        position: s.position,
        r1: s.r1 ?? null,
        r2: s.r2 ?? null,
        r3: s.r3 ?? null,
        r4: s.r4 ?? null,
        birdies: s.birdies || [0,0,0,0],
        eagles: s.eagles || [0,0,0,0],
        bogeys: s.bogeys || [0,0,0,0],
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("tournament_scores")
        .upsert(rows, { onConflict: "tournament_id,golfer_id" });

      if (error) console.error(`Score upsert error [${tournament.name}]:`, error.message);
      else {
        console.log(`✅ Synced ${rows.length} scores for ${tournament.name}`);
        // Clean up any stale golfer rows from previous wrong-tour syncs.
        // Only keep golfer IDs that are in the current sync batch.
        const validIds = rows.map(r => r.golfer_id).filter(Number.isFinite);
        if (validIds.length >= 10) {  // Only clean if we have a substantial field
          const { data: existing } = await supabase
            .from("tournament_scores")
            .select("golfer_id")
            .eq("tournament_id", tournament.id);
          const staleIds = (existing || [])
            .map(e => e.golfer_id)
            .filter(id => !validIds.includes(id));
          if (staleIds.length > 0 && staleIds.length < 300) {
            await supabase
              .from("tournament_scores")
              .delete()
              .eq("tournament_id", tournament.id)
              .in("golfer_id", staleIds);
            console.log(`🧹 Cleaned ${staleIds.length} stale scores from ${tournament.name}`);
          }
        }
      }
    } catch (e) {
      console.error(`Score sync failed for tournament ${tournament.id}:`, e.message);
    }
  }
}

async function fetchScores(internalTournamentId, supabase) {
  if (SCORE_PROVIDER === "BALLDONTLIE") {
    const bdl = await fetchBallDontLieScores(internalTournamentId, supabase);
    if (bdl?.length) return bdl;
    const tsdbFallback = await fetchTheSportsDbScores(internalTournamentId, supabase);
    if (tsdbFallback?.length) return tsdbFallback;
    if (USE_SPORTSDATAIO) {
      const sd = await fetchSportsDataScores(internalTournamentId, supabase);
      if (sd?.length) return sd;
    }
    return fetchDataGolfLiveScores(internalTournamentId, supabase);
  }
  if (USE_SPORTSDATAIO && SCORE_PROVIDER === "SPORTSDATAIO") {
    const sportsData = await fetchSportsDataScores(internalTournamentId, supabase);
    if (sportsData?.length) return sportsData;
    const tsdb = await fetchTheSportsDbScores(internalTournamentId, supabase);
    if (tsdb?.length) return tsdb;
    return fetchDataGolfLiveScores(internalTournamentId, supabase);
  }
  const theSportsDb = await fetchTheSportsDbScores(internalTournamentId, supabase);
  if (theSportsDb?.length) return theSportsDb;
  if (USE_SPORTSDATAIO) {
    const sd = await fetchSportsDataScores(internalTournamentId, supabase);
    if (sd?.length) return sd;
  }
  return fetchDataGolfLiveScores(internalTournamentId, supabase);
}

function normalizeScoreRow(raw) {
  const rankRaw = raw.rank || raw.position || raw.intRank || raw.strPosition || raw.Place;
  const scoreRaw = raw.score || raw.intScore || raw.TotalScore || raw.TotalStrokes;
  const toParRaw = raw.toPar || raw.strToPar || raw.TotalToPar;
  const r1 = Number(raw.r1 ?? raw.Round1 ?? raw.intRound1 ?? 0);
  const r2 = Number(raw.r2 ?? raw.Round2 ?? raw.intRound2 ?? 0);
  const r3 = Number(raw.r3 ?? raw.Round3 ?? raw.intRound3 ?? 0);
  const r4 = Number(raw.r4 ?? raw.Round4 ?? raw.intRound4 ?? 0);

  const derivedRoundSum = [r1, r2, r3, r4].reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  const scoreNum = Number(scoreRaw);
  const toParNum = Number(toParRaw);

  return {
    golferId: Number(raw.golferId || raw.idPlayer || raw.PlayerID || raw.player_id),
    playerName: raw.playerName || raw.strPlayer || raw.name || raw.player?.name || [raw.first_name, raw.last_name].filter(Boolean).join(" ") || null,
    country: raw.country || raw.nationality || raw.player?.country || null,
    position: Number(rankRaw) || 999,
    r1: Number.isFinite(r1) ? r1 : null,
    r2: Number.isFinite(r2) ? r2 : null,
    r3: Number.isFinite(r3) ? r3 : null,
    r4: Number.isFinite(r4) ? r4 : null,
    // If provider only gives total-to-par, place it in R4 so standings can still move.
    ...(Number.isFinite(scoreNum) || Number.isFinite(toParNum) ? {
      r4: Number.isFinite(toParNum) ? toParNum : Number.isFinite(scoreNum) ? scoreNum : derivedRoundSum,
    } : {}),
    birdies: [0, 0, 0, 0],
    eagles: [0, 0, 0, 0],
    bogeys: [0, 0, 0, 0],
  };
}

function normalizeName(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateDistanceDays(a, b) {
  if (!a || !b) return 3650;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 3650;
  return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}

async function resolveTheSportsDbEventId(internalTournamentId, supabase) {
  if (THE_SPORTS_DB_EVENT_MAP[internalTournamentId]) return THE_SPORTS_DB_EVENT_MAP[internalTournamentId];
  if (AUTO_EVENT_MAP[internalTournamentId]) return AUTO_EVENT_MAP[internalTournamentId];

  if (!supabase) return null;
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, start_date")
    .eq("id", internalTournamentId)
    .single();
  if (!tournament?.name) return null;

  const query = encodeURIComponent(tournament.name);
  const url = `${THE_SPORTS_DB}/searchevents.php?e=${query}`;
  try {
    const resp = await fetch(url, { timeout: 8000 });
    if (!resp.ok) return null;
    const json = await resp.json();
    const events = json?.event || [];
    if (!Array.isArray(events) || !events.length) return null;

    const targetName = normalizeName(tournament.name);
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const ev of events) {
      const eventName = normalizeName(ev.strEvent);
      const includes = eventName.includes(targetName) || targetName.includes(eventName) ? 0 : 25;
      const datePenalty = dateDistanceDays(tournament.start_date, ev.dateEvent);
      const score = includes + datePenalty;
      if (score < bestScore) {
        bestScore = score;
        best = ev;
      }
    }

    const resolved = best?.idEvent ? String(best.idEvent) : null;
    if (resolved) AUTO_EVENT_MAP[internalTournamentId] = resolved;
    return resolved;
  } catch {
    return null;
  }
}

async function fetchTheSportsDbScores(internalTournamentId, supabase) {
  const explicit = String(internalTournamentId || "").match(/^tsdb_(\d+)$/i);
  const eventId = explicit ? explicit[1] : await resolveTheSportsDbEventId(internalTournamentId, supabase);
  if (!eventId) {
    console.warn(`No TheSportsDB event ID resolved for tournament ${internalTournamentId}`);
    return null;
  }

  // Try multiple endpoints because TheSportsDB payload shape can vary by event/sport.
  const urls = [
    `${THE_SPORTS_DB}/lookupeventstats.php?id=${eventId}`,
    `${THE_SPORTS_DB}/lookupevent.php?id=${eventId}`,
    `${THE_SPORTS_DB}/lookupround.php?id=${eventId}`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, { timeout: 8000 });
      if (!resp.ok) continue;
      const json = await resp.json();
      const candidateLists = [
        json?.players,
        json?.playerstats,
        json?.eventstats,
        json?.leaderboard,
        json?.results,
      ].filter(Array.isArray);

      for (const list of candidateLists) {
        const normalized = list
          .map(normalizeScoreRow)
          .filter((row) => Number.isFinite(row.golferId));
        if (normalized.length) return normalized;
      }
    } catch {}
  }

  return null;
}

async function resolveBallDontLieTournamentId(internalTournamentId, supabase) {
  const explicit = String(internalTournamentId || "").match(/^bdl_(\d+)$/i);
  if (explicit) return explicit[1];
  if (!supabase || !BALLDONTLIE_PGA_KEY) return null;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, start_date")
    .eq("id", internalTournamentId)
    .single();
  if (!tournament?.name || !tournament?.start_date) return null;

  const year = String(tournament.start_date).slice(0, 4);
  const url = `${BALLDONTLIE_PGA_BASE}/tournaments?season=${encodeURIComponent(year)}&per_page=100`;
  try {
    const resp = await fetch(url, { headers: { Authorization: BALLDONTLIE_PGA_KEY }, timeout: 12000 });
    if (!resp.ok) return null;
    const json = await resp.json();
    const events = Array.isArray(json?.data) ? json.data : [];
    if (!events.length) return null;
    const targetName = normalizeName(tournament.name);
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const ev of events) {
      const nameScore = normalizeName(ev.name).includes(targetName) || targetName.includes(normalizeName(ev.name)) ? 0 : 25;
      const dateScore = dateDistanceDays(tournament.start_date, ev.start_date || ev.startDate || ev.date);
      const score = nameScore + dateScore;
      if (score < bestScore) {
        bestScore = score;
        best = ev;
      }
    }
    return best?.id ? String(best.id) : null;
  } catch {
    return null;
  }
}

function normalizeBallDontLieScoreRow(raw) {
  if (!raw) return null;
  const player = raw.player || raw.golfer || raw.athlete || {};
  const rounds = Array.isArray(raw.rounds) ? raw.rounds : Array.isArray(raw.scores) ? raw.scores : [];
  const r = (idx) => {
    const v = rounds[idx];
    if (v == null) return null;
    if (typeof v === "number") return v;
    return Number(v.score ?? v.strokes ?? v.to_par ?? v.total ?? null);
  };
  const position = Number(raw.position ?? raw.rank ?? raw.place ?? raw.standing ?? raw.order ?? 999) || 999;
  const golferId = Number(raw.player_id ?? player.id ?? raw.idPlayer ?? raw.id);
  const playerName = [player.first_name, player.last_name].filter(Boolean).join(" ")
    || player.name
    || raw.player_name
    || raw.name
    || null;
  const toPar = Number(raw.to_par ?? raw.score_to_par ?? raw.total_to_par ?? raw.score ?? null);

  if (!Number.isFinite(golferId) || !playerName) return null;
  return {
    golferId,
    playerName,
    country: player.country || raw.country || null,
    position,
    r1: Number.isFinite(r(0)) ? r(0) : null,
    r2: Number.isFinite(r(1)) ? r(1) : null,
    r3: Number.isFinite(r(2)) ? r(2) : null,
    r4: Number.isFinite(r(3)) ? r(3) : (Number.isFinite(toPar) ? toPar : null),
    birdies: [0, 0, 0, 0],
    eagles: [0, 0, 0, 0],
    bogeys: [0, 0, 0, 0],
  };
}

async function fetchBallDontLieScores(internalTournamentId, supabase) {
  if (!BALLDONTLIE_PGA_KEY) return null;
  const tournamentId = await resolveBallDontLieTournamentId(internalTournamentId, supabase);
  if (!tournamentId) return null;

  const headers = { Authorization: BALLDONTLIE_PGA_KEY };
  const urls = [
    `${BALLDONTLIE_PGA_BASE}/leaderboards?tournament_id=${encodeURIComponent(tournamentId)}&per_page=200`,
    `${BALLDONTLIE_PGA_BASE}/tournaments/${encodeURIComponent(tournamentId)}/leaderboard`,
    `${BALLDONTLIE_PGA_BASE}/leaderboards/${encodeURIComponent(tournamentId)}`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, { headers, timeout: 12000 });
      if (!resp.ok) continue;
      const json = await resp.json();
      const lists = [
        json?.data,
        json?.leaderboard,
        json?.results,
        json?.entries,
      ].filter(Array.isArray);
      for (const list of lists) {
        const rows = list.map(normalizeBallDontLieScoreRow).filter(Boolean);
        if (rows.length) return rows;
      }
    } catch {}
  }
  return null;
}

// ─── DataGolf live score fallback ───────────────────────────────────────
// Uses two endpoints:
//   1. /preds/in-play  — in-play predictions with current scores/position
//   2. /field-updates  — field data that includes per-round scores
// Both are tried; in-play is preferred because it has live position + thru data.

function normalizeDataGolfScoreRow(raw, coursePar) {
  if (!raw) return null;

  // Player identification — DataGolf uses dg_id as primary key
  const golferId = Number(
    raw.dg_id ?? raw.dgid ?? raw.datagolf_id ?? raw.player_id ?? raw.id ?? 0
  );
  if (!Number.isFinite(golferId) || golferId <= 0) return null;

  const playerName = String(
    raw.player_name ?? raw.full_name ?? raw.name ?? raw.player ?? ""
  ).trim();
  if (!playerName) return null;

  const country = raw.country ?? raw.nationality ?? raw.country_code ?? null;

  // Position — in-play uses "current_pos"; field-updates may use "position"
  const posRaw = raw.current_pos ?? raw.position ?? raw.pos ?? raw.rank ?? raw.fin_text ?? null;
  let position = 999;
  if (posRaw != null) {
    const numMatch = String(posRaw).match(/(\d+)/);
    if (numMatch) position = Number(numMatch[1]);
  }

  // ─── Score normalization ───────────────────────────────────────
  // ALL scores are stored as TO-PAR values (negative = under par).
  // DataGolf in-play returns:
  //   - R1/R2/R3/R4: raw strokes (66, 71...) when round is complete, null when in-progress
  //   - current_score: cumulative to-par (-5, +2...)
  //   - today: today's round to-par
  //   - round: current round number (1-4)
  //   - thru: holes completed in current round
  // We convert raw strokes to to-par using course par (default 72).

  const par = Number(coursePar) || 72;
  const curRound = Number(raw.current_round ?? raw.round ?? raw.thru_round ?? 0);
  const currentScore = Number(raw.current_score ?? raw.total_to_par ?? raw.total ?? raw.score ?? NaN);
  const todayScore = Number(raw.today ?? NaN);

  // Helper: convert raw strokes to to-par, or pass through if already to-par
  const strokesToPar = (v) => {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    // If value looks like raw strokes (typically 55-90 range), convert to to-par
    if (n > 50) return n - par;
    // Already to-par (small number like -4, 0, +3)
    return n;
  };

  // Extract per-round scores from DataGolf flat fields
  let r1 = strokesToPar(raw.R1 ?? raw.r1 ?? raw.round1 ?? raw.Round1);
  let r2 = strokesToPar(raw.R2 ?? raw.r2 ?? raw.round2 ?? raw.Round2);
  let r3 = strokesToPar(raw.R3 ?? raw.r3 ?? raw.round3 ?? raw.Round3);
  let r4 = strokesToPar(raw.R4 ?? raw.r4 ?? raw.round4 ?? raw.Round4);

  // Handle rounds as array or object
  const rounds = raw.rounds ?? raw.round_scores ?? null;
  if (Array.isArray(rounds)) {
    const rv = (idx) => strokesToPar(typeof rounds[idx] === "object" ? (rounds[idx]?.score ?? rounds[idx]?.strokes ?? rounds[idx]?.total) : rounds[idx]);
    if (r1 == null) r1 = rv(0);
    if (r2 == null) r2 = rv(1);
    if (r3 == null) r3 = rv(2);
    if (r4 == null) r4 = rv(3);
  } else if (rounds && typeof rounds === "object") {
    const rv = (k) => strokesToPar(rounds[k]);
    if (r1 == null) r1 = rv("1") ?? rv(1);
    if (r2 == null) r2 = rv("2") ?? rv(2);
    if (r3 == null) r3 = rv("3") ?? rv(3);
    if (r4 == null) r4 = rv("4") ?? rv(4);
  }

  // If we still have no round scores, use current_score/today as the live score
  // for the current round. This handles mid-round scoring.
  if (r1 == null && r2 == null && r3 == null && r4 == null && Number.isFinite(currentScore)) {
    // Place the cumulative to-par score in the current round slot
    if (curRound === 1) r1 = currentScore;
    else if (curRound === 2) r2 = currentScore;
    else if (curRound === 3) r3 = currentScore;
    else r4 = currentScore;
  }

  // Status mapping: active / cut / wd
  const statusRaw = String(raw.status ?? raw.fin_text ?? raw.current_pos ?? "").toLowerCase();
  let status = "active";
  if (statusRaw.includes("cut") || statusRaw === "mc") status = "cut";
  else if (statusRaw.includes("wd") || statusRaw === "withdrawn") status = "wd";

  // Thru (holes completed in current round)
  const thruRaw = raw.thru ?? raw.holes_completed ?? raw.today_holes ?? null;
  let thru = null;
  if (thruRaw != null) {
    if (String(thruRaw).toUpperCase() === "F") thru = 18;
    else {
      const n = Number(thruRaw);
      thru = Number.isFinite(n) ? n : null;
    }
  }

  return {
    golferId,
    playerName,
    country,
    position,
    r1,
    r2,
    r3,
    r4,
    status,
    thru,
    birdies: [0, 0, 0, 0],
    eagles: [0, 0, 0, 0],
    bogeys: [0, 0, 0, 0],
  };
}

/**
 * Extract an array of player rows from a DataGolf JSON response, handling
 * the various payload shapes the API may return.
 */
function extractDataGolfPlayerArray(json) {
  if (!json || typeof json !== "object") return [];
  if (Array.isArray(json)) return json;
  const candidateKeys = [
    "data", "leaderboard", "players", "field", "results",
    "live_stats", "scorecard", "in_play", "entries",
  ];
  for (const k of candidateKeys) {
    if (Array.isArray(json[k]) && json[k].length) return json[k];
  }
  // Single-event wrapper: { event_name: "...", field: [...] }
  for (const v of Object.values(json)) {
    if (Array.isArray(v) && v.length > 5) return v;
  }
  return [];
}

// Cache which tour each tournament maps to, so we don't re-scan all tours every 30s
const TOURNAMENT_TOUR_CACHE = new Map(); // tournamentId -> { tour, eventName, ts }
const TOUR_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchDataGolfLiveScores(internalTournamentId, supabase) {
  if (!DATAGOLF_API_KEY) return null;

  // Resolve tournament name for matching against DataGolf event names
  let tournamentName = "";
  if (supabase) {
    const { data: tRow } = await supabase
      .from("tournaments")
      .select("name")
      .eq("id", internalTournamentId)
      .single();
    tournamentName = normalizeName(tRow?.name || "");
  }

  // FAIL-SAFE: if we can't resolve the tournament name, skip entirely
  // to avoid pulling wrong tournament's data
  if (!tournamentName) {
    console.warn(`DataGolf: cannot resolve name for ${internalTournamentId}, skipping`);
    return null;
  }

  // Check cache for which tour this tournament belongs to
  const cached = TOURNAMENT_TOUR_CACHE.get(internalTournamentId);
  const toursToTry = (cached && Date.now() - cached.ts < TOUR_CACHE_TTL_MS)
    ? [cached.tour]  // Use cached tour first
    : ["pga", "euro", "kft", "opp", "alt"];

  // 1. Try the in-play predictions endpoint
  for (const tour of toursToTry) {
    const inPlayUrl = `${DATAGOLF_BASE_URL}/preds/in-play?tour=${encodeURIComponent(tour)}&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
    try {
      const json = await dgSyncFetchJson(inPlayUrl);
      if (!json) continue;
      const eventName = normalizeName(json.event_name || json.info?.event_name || "");
      // STRICT name matching — both must exist and match
      if (!eventName || (!eventName.includes(tournamentName) && !tournamentName.includes(eventName))) {
        continue;
      }
      // Extract course par from the API response
      const coursePar = Number(json.course_par ?? json.info?.course_par ?? json.par ?? 72) || 72;
      const players = extractDataGolfPlayerArray(json);
      const rows = players.map(p => normalizeDataGolfScoreRow(p, coursePar)).filter(Boolean);
      if (rows.length) {
        // Cache this tour mapping
        TOURNAMENT_TOUR_CACHE.set(internalTournamentId, { tour, eventName, ts: Date.now() });
        console.log(`DataGolf in-play (${tour}) returned ${rows.length} scores for "${tournamentName}" [par ${coursePar}]`);
        return rows;
      }
    } catch (e) {
      console.warn(`DataGolf in-play (${tour}) fetch failed: ${e.message}`);
    }
  }

  // 2. Fallback to field-updates
  for (const tour of toursToTry) {
    const fieldUrl = `${DATAGOLF_BASE_URL}/field-updates?tour=${encodeURIComponent(tour)}&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
    try {
      const json = await dgSyncFetchJson(fieldUrl);
      if (!json) continue;
      const eventName = normalizeName(json.event_name || "");
      if (!eventName || (!eventName.includes(tournamentName) && !tournamentName.includes(eventName))) {
        continue;
      }
      const coursePar = Number(json.course_par ?? json.par ?? 72) || 72;
      const players = extractDataGolfPlayerArray(json);
      const rows = players.map(p => normalizeDataGolfScoreRow(p, coursePar)).filter(Boolean);
      if (rows.length) {
        TOURNAMENT_TOUR_CACHE.set(internalTournamentId, { tour, eventName, ts: Date.now() });
        console.log(`DataGolf field-updates (${tour}) returned ${rows.length} scores for "${tournamentName}"`);
        return rows;
      }
    } catch (e) {
      console.warn(`DataGolf field-updates (${tour}) fetch failed: ${e.message}`);
    }
  }

  return null;
}

async function resolveSportsDataTournamentId(internalTournamentId, supabase) {
  // 1. Explicit sdio_ prefix
  const explicit = String(internalTournamentId || "").match(/^sdio_(\d+)$/i);
  if (explicit) return Number(explicit[1]);

  // 2. Env override
  if (SPORTS_DATA_TOURNAMENT_MAP_OVERRIDE[internalTournamentId]) {
    return Number(SPORTS_DATA_TOURNAMENT_MAP_OVERRIDE[internalTournamentId]);
  }

  // 3. In-memory cache from a previous lookup
  if (AUTO_SDIO_MAP[internalTournamentId]) return AUTO_SDIO_MAP[internalTournamentId];

  // 4. Look up by tournament name/date against the SportsDataIO schedule
  if (!supabase || !SPORTS_DATA_KEY) return null;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, start_date")
    .eq("id", internalTournamentId)
    .single();
  if (!tournament?.name) return null;

  const year = String(tournament.start_date || "").slice(0, 4) || new Date().getUTCFullYear();
  const url = `${SPORTS_DATA_BASE}/Tournaments/${year}?key=${SPORTS_DATA_KEY}`;
  try {
    const resp = await fetch(url, { timeout: 12000 });
    if (!resp.ok) return null;
    const items = await resp.json();
    if (!Array.isArray(items)) return null;

    const targetName = normalizeName(tournament.name);
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const t of items) {
      const tName = normalizeName(t.Name || t.TournamentName || "");
      const tStart = (t.StartDate || t.StartDateTime || "").slice(0, 10);
      const namePenalty = (tName.includes(targetName) || targetName.includes(tName)) ? 0 : 25;
      const datePenalty = dateDistanceDays(tournament.start_date, tStart);
      const score = namePenalty + datePenalty;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }

    // Only accept close matches (name match within 10 days, or date match within 3 days)
    if (!best || bestScore > 10) return null;
    const resolvedId = Number(best.TournamentID || best.TournamentId || best.ID);
    if (!Number.isFinite(resolvedId)) return null;

    AUTO_SDIO_MAP[internalTournamentId] = resolvedId;
    return resolvedId;
  } catch {
    return null;
  }
}

async function fetchSportsDataScores(internalTournamentId, supabase) {
  if (!SPORTS_DATA_KEY) return null;

  const externalId = await resolveSportsDataTournamentId(internalTournamentId, supabase);
  if (!externalId) return null;

  const url = `${SPORTS_DATA_BASE}/Leaderboard/${externalId}?key=${SPORTS_DATA_KEY}`;
  const resp = await fetch(url, { timeout: 8000 });
  if (!resp.ok) throw new Error(`SportsDataIO returned ${resp.status}`);

  const json = await resp.json();
  const players = json.Players || [];

  return players.map((p) => ({
    golferId: p.PlayerID,
    position: parseInt(p.Rank) || 999,
    r1: p.Round1 ?? null,
    r2: p.Round2 ?? null,
    r3: p.Round3 ?? null,
    r4: p.Round4 ?? null,
    birdies: [0,0,0,0],
    eagles: [0,0,0,0],
    bogeys: [0,0,0,0],
  }));
}

/**
 * Seed golfer table from SportsDataIO player list
 * Call this once when setting up: GET /api/admin/seed-golfers
 */
async function seedGolfers(supabase) {
  const pickFirstArray = (json, keys) => {
    if (Array.isArray(json)) return json;
    if (!json || typeof json !== "object") return [];
    for (const k of keys || []) {
      if (Array.isArray(json[k])) return json[k];
    }
    for (const v of Object.values(json)) {
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const fromDataGolf = async () => {
    if (!DATAGOLF_API_KEY) return null;
    const plUrl = `${DATAGOLF_BASE_URL}/get-player-list?file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
    const rkUrl = `${DATAGOLF_BASE_URL}/preds/get-dg-rankings?file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;

    const [plResp, rkResp] = await Promise.all([
      fetch(plUrl, { timeout: 12000 }),
      fetch(rkUrl, { timeout: 12000 }),
    ]);
    if (!plResp.ok) throw new Error(`DataGolf player list returned ${plResp.status}`);
    if (!rkResp.ok) throw new Error(`DataGolf rankings returned ${rkResp.status}`);

    const [plJson, rkJson] = await Promise.all([plResp.json(), rkResp.json()]);
    const players = pickFirstArray(plJson, ["players", "data", "player_list", "list"]);
    const ranks = pickFirstArray(rkJson, ["rankings", "data", "players", "results"]);

    const rankMap = new Map();
    for (const r of ranks) {
      const id = Number(r?.dg_id ?? r?.dgid ?? r?.datagolf_id ?? r?.player_id ?? r?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const owgr = Number(r?.owgr_rank ?? r?.owgr ?? r?.world_rank ?? r?.rank ?? r?.owgrRank);

      const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

      rankMap.set(id, {
        world_rank: (Number.isFinite(owgr) && owgr > 0) ? owgr : null,
        sg_total:    toNum(r?.sg_total ?? r?.sg_t ?? r?.strokes_gained_total),
        driv_dist:   toNum(r?.driving_dist ?? r?.driv_dist ?? r?.distance ?? r?.driving_distance),
        driv_acc:    toNum(r?.driving_acc ?? r?.driv_acc ?? r?.accuracy ?? r?.driving_accuracy),
        gir:         toNum(r?.gir ?? r?.gir_pct ?? r?.greens_in_regulation),
        putts:       toNum(r?.putting_avg ?? r?.putts_per_round ?? r?.putt_avg ?? r?.sg_putt ?? r?.sg_putting),
        scoring_avg: toNum(r?.scoring_avg ?? r?.scoring_average ?? r?.score_avg),
      });
    }

    const nowIso = new Date().toISOString();
    const rows = [];
    for (const p of players) {
      const id = Number(p?.dg_id ?? p?.dgid ?? p?.datagolf_id ?? p?.player_id ?? p?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const name = String(p?.player_name ?? p?.full_name ?? p?.name ?? p?.player ?? "").trim();
      if (!name) continue;
      const country = p?.country || p?.nationality || p?.country_code || p?.country_name || null;
      const stats = rankMap.get(id) || {};
      rows.push({
        id,
        name,
        country,
        world_rank:  stats.world_rank ?? null,
        sg_total:    stats.sg_total ?? null,
        driv_dist:   stats.driv_dist != null ? Math.round(stats.driv_dist) : null,
        driv_acc:    stats.driv_acc ?? null,
        gir:         stats.gir ?? null,
        putts:       stats.putts ?? null,
        scoring_avg: stats.scoring_avg ?? null,
        updated_at:  nowIso,
      });
    }
    return rows.length ? rows : null;
  };

  const fromSportsData = async () => {
    if (!SPORTS_DATA_KEY) return null;
    const url = `${SPORTS_DATA_BASE}/Players?key=${SPORTS_DATA_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`SportsDataIO returned ${resp.status}`);
    const players = await resp.json();
    return players.map((p) => ({
      id: p.PlayerID,
      name: `${p.FirstName} ${p.LastName}`,
      country: p.Country || "🌍",
      world_rank: p.WorldGolfRank || 999,
      scoring_avg: p.FantasyPoints || null,
      sg_total: null,
      driv_dist: p.DrivingDistance || null,
      driv_acc: p.DrivingAccuracy || null,
      gir: p.GreensInRegulation || null,
      putts: p.PuttingAverage || null,
      updated_at: new Date().toISOString(),
    }));
  };

  const fromTheSportsDb = async () => {
    // This endpoint is sport-agnostic and may return partial profile fields.
    const url = `${THE_SPORTS_DB}/searchplayers.php?p=`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json = await resp.json();
    const players = json?.player;
    if (!Array.isArray(players) || !players.length) return null;
    return players
      .map((p) => ({
        id: Number(p.idPlayer),
        name: p.strPlayer,
        country: p.strNationality || "🌍",
        world_rank: null,
        scoring_avg: null,
        sg_total: null,
        driv_dist: null,
        driv_acc: null,
        gir: null,
        putts: null,
        updated_at: new Date().toISOString(),
      }))
      .filter((p) => Number.isFinite(p.id) && p.name);
  };

  let rows = null;
  try {
    // Prefer DataGolf when configured (best coverage for players + OWGR).
    rows = DATAGOLF_API_KEY ? await fromDataGolf() : null;
    if (!rows?.length) {
      rows = SCORE_PROVIDER === "SPORTSDATAIO" && USE_SPORTSDATAIO
        ? await fromSportsData()
        : await fromTheSportsDb();
    }
    if (!rows?.length && USE_SPORTSDATAIO) rows = await fromSportsData();
  } catch {
    try {
      rows = DATAGOLF_API_KEY ? await fromDataGolf() : null;
    } catch {
      rows = USE_SPORTSDATAIO ? await fromSportsData() : null;
    }
  }

  if (!rows?.length) return { error: "No golfers returned from provider(s)" };

  const { error } = await supabase
    .from("golfers")
    .upsert(rows, { onConflict: "id" });

  return error ? { error: error.message } : { seeded: rows.length };
}

module.exports = { syncLiveScores, seedGolfers, resolveTheSportsDbEventId };
