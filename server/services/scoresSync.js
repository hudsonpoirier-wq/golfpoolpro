// server/services/scoresSync.js
// Syncs live tournament scores from SportsDataIO (or fallback: TheSportsDB)
// Called every 30 seconds by the cron job in server/index.js

const fetch = require("node-fetch");  // npm install node-fetch@2

const SPORTS_DATA_KEY = process.env.SPORTS_DATA_IO_KEY;
const SPORTS_DATA_BASE = "https://api.sportsdata.io/golf/v2/json";

// Alternative free API (no key required, less detail):
const THE_SPORTS_DB = "https://www.thesportsdb.com/api/v1/json/3";

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
      const scores = await fetchScores(tournament.id);
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

/**
 * Fetch scores from SportsDataIO
 *
 * GET https://api.sportsdata.io/golf/v2/json/Leaderboard/{tournamentId}
 *     ?key={SPORTS_DATA_IO_KEY}
 *
 * Docs: https://sportsdata.io/developers/api-documentation/golf
 * Free tier: 1,000 calls/month. Paid: real-time updates.
 *
 * IMPORTANT: Replace tournamentId mapping below with real SportsDataIO IDs
 * once you have your API key and know your tournament IDs.
 */
async function fetchScores(internalTournamentId) {
  if (!SPORTS_DATA_KEY) {
    console.warn("SPORTS_DATA_IO_KEY not set — using mock score data");
    return null;  // Falls back to existing mock data in DB
  }

  // Map your internal tournament IDs to SportsDataIO tournament IDs
  // You can get these from: GET /golf/v2/json/Tournaments/{year}
  const tournamentIdMap = {
    "t4":  20508,  // Masters 2026 — UPDATE with real ID
    "t8":  20512,  // PGA Championship 2026 — UPDATE with real ID
    "t11": 20516,  // US Open 2026 — UPDATE with real ID
    "t15": 20520,  // The Open 2026 — UPDATE with real ID
    "t1":  20505,  // THE PLAYERS — UPDATE with real ID
  };

  const externalId = tournamentIdMap[internalTournamentId];
  if (!externalId) return null;

  const url = `${SPORTS_DATA_BASE}/Leaderboard/${externalId}?key=${SPORTS_DATA_KEY}`;
  const resp = await fetch(url, { timeout: 8000 });
  if (!resp.ok) throw new Error(`SportsDataIO returned ${resp.status}`);

  const json = await resp.json();
  const players = json.Players || [];

  return players.map(p => ({
    golferId: p.PlayerID,
    position: parseInt(p.Rank) || 999,
    r1: p.Round1 ?? null,
    r2: p.Round2 ?? null,
    r3: p.Round3 ?? null,
    r4: p.Round4 ?? null,
    // SportsDataIO doesn't provide per-round birdie/eagle/bogey breakdowns in free tier
    // You'd compute these from hole-by-hole data (paid plan)
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
  if (!SPORTS_DATA_KEY) return { error: "SPORTS_DATA_IO_KEY not set" };

  const url = `${SPORTS_DATA_BASE}/Players?key=${SPORTS_DATA_KEY}`;
  const resp = await fetch(url);
  const players = await resp.json();

  const rows = players.map(p => ({
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

  const { error } = await supabase
    .from("golfers")
    .upsert(rows, { onConflict: "id" });

  return error ? { error: error.message } : { seeded: rows.length };
}

module.exports = { syncLiveScores, seedGolfers };
