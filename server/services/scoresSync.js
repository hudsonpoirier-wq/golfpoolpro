// server/services/scoresSync.js
// Syncs live tournament scores from TheSportsDB (primary)
// Called every 30 seconds by the cron job in server/index.js

const fetch = require("node-fetch");  // npm install node-fetch@2

const SPORTS_DATA_KEY = process.env.SPORTS_DATA_IO_KEY;
const SPORTS_DATA_BASE = "https://api.sportsdata.io/golf/v2/json";

// Alternative free API (no key required, less detail):
const THE_SPORTS_DB_KEY = process.env.THE_SPORTS_DB_KEY || "3";
const THE_SPORTS_DB = `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}`;
const SCORE_PROVIDER = (process.env.SCORE_PROVIDER || "THESPORTSDB").toUpperCase();
const USE_SPORTSDATAIO = String(process.env.USE_SPORTSDATAIO || "").toLowerCase() === "true";
const AUTO_EVENT_MAP = {};

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
// Map internal IDs (t1, t4, etc.) -> SportsDataIO tournament IDs
const SPORTS_DATA_TOURNAMENT_MAP = {
  t4: 20508,
  t8: 20512,
  t11: 20516,
  t15: 20520,
  t1: 20505,
  ...parseMap(process.env.SPORTS_DATA_TOURNAMENT_MAP),
};

/**
 * Main sync function — called by cron every 30s
 */
async function syncLiveScores(supabase) {
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
      else console.log(`✅ Synced ${rows.length} scores for ${tournament.name}`);
    } catch (e) {
      console.error(`Score sync failed for tournament ${tournament.id}:`, e.message);
    }
  }
}

async function fetchScores(internalTournamentId, supabase) {
  if (USE_SPORTSDATAIO && SCORE_PROVIDER === "SPORTSDATAIO") {
    const sportsData = await fetchSportsDataScores(internalTournamentId);
    if (sportsData?.length) return sportsData;
    return fetchTheSportsDbScores(internalTournamentId, supabase);
  }
  const theSportsDb = await fetchTheSportsDbScores(internalTournamentId, supabase);
  if (theSportsDb?.length) return theSportsDb;
  if (!USE_SPORTSDATAIO) return null;
  return fetchSportsDataScores(internalTournamentId);
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

async function fetchSportsDataScores(internalTournamentId) {
  if (!SPORTS_DATA_KEY) return null;

  const explicit = String(internalTournamentId || "").match(/^sdio_(\d+)$/i);
  const externalId = explicit ? Number(explicit[1]) : SPORTS_DATA_TOURNAMENT_MAP[internalTournamentId];
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
    rows = SCORE_PROVIDER === "SPORTSDATAIO" && USE_SPORTSDATAIO
      ? await fromSportsData()
      : await fromTheSportsDb();
    if (!rows?.length && USE_SPORTSDATAIO) rows = await fromSportsData();
  } catch {
    rows = USE_SPORTSDATAIO ? await fromSportsData() : null;
  }

  if (!rows?.length) return { error: "No golfers returned from provider(s)" };

  const { error } = await supabase
    .from("golfers")
    .upsert(rows, { onConflict: "id" });

  return error ? { error: error.message } : { seeded: rows.length };
}

module.exports = { syncLiveScores, seedGolfers, resolveTheSportsDbEventId };
