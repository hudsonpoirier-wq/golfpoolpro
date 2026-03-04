const fetch = require("node-fetch");

const SPORTS_DATA_KEY = process.env.SPORTS_DATA_IO_KEY;
const SPORTS_DATA_BASE = "https://api.sportsdata.io/golf/v2/json";
const USE_SPORTSDATAIO = String(process.env.USE_SPORTSDATAIO || "").toLowerCase() === "true";

const THE_SPORTS_DB_KEY = process.env.THE_SPORTS_DB_KEY || "3";
const THE_SPORTS_DB = `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}`;
const THE_SPORTS_DB_LEAGUES = (process.env.THE_SPORTS_DB_LEAGUES || "4761,4765,5556,4774,5557,4758,4771,4776,4760,4777")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const UPCOMING_TEMPLATE = [
  ["t1", "THE PLAYERS Championship", "TPC Sawgrass", 3, 12, 25000000, 144],
  ["t2", "Valspar Championship", "Innisbrook Resort", 3, 19, 8400000, 132],
  ["t3", "Texas Children's Houston Open", "Memorial Park GC", 3, 26, 9200000, 132],
  ["t4", "Masters Tournament", "Augusta National GC", 4, 9, 20000000, 88],
  ["t5", "RBC Heritage", "Harbour Town GL", 4, 16, 20000000, 132],
  ["t6", "Zurich Classic of New Orleans", "TPC Louisiana", 4, 23, 8900000, 80],
  ["t7", "Wells Fargo Championship", "Quail Hollow Club", 4, 30, 20000000, 132],
  ["t8", "PGA Championship", "Valhalla Golf Club", 5, 14, 19000000, 156],
  ["t9", "Charles Schwab Challenge", "Colonial CC", 5, 21, 9500000, 132],
  ["t10", "Memorial Tournament", "Muirfield Village GC", 5, 28, 20000000, 120],
  ["t11", "U.S. Open", "Shinnecock Hills GC", 6, 18, 21500000, 156],
  ["t12", "Travelers Championship", "TPC River Highlands", 6, 25, 9200000, 156],
  ["t13", "Rocket Classic", "Detroit GC", 7, 2, 8700000, 132],
  ["t14", "John Deere Classic", "TPC Deere Run", 7, 9, 8300000, 132],
  ["t15", "The Open Championship", "Royal Portrush GC", 7, 16, 17000000, 156],
  ["t16", "3M Open", "TPC Twin Cities", 7, 23, 8400000, 132],
  ["t17", "Wyndham Championship", "Sedgefield CC", 8, 13, 7900000, 156],
  ["t18", "FedEx St. Jude Championship", "TPC Southwind", 8, 20, 20000000, 70],
  ["t19", "BMW Championship", "Aronimink GC", 8, 27, 20000000, 50],
  ["t20", "TOUR Championship", "East Lake GC", 9, 3, 100000000, 30],
];

function dateStr(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function asDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function plusDays(isoDate, days) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeTemplate(year, today) {
  return UPCOMING_TEMPLATE
    .map(([id, name, venue, month, day, purse, fieldSize]) => ({
      id,
      name,
      venue,
      start_date: dateStr(year, month, day),
      end_date: dateStr(year, month, day + 3),
      purse,
      field_size: fieldSize,
      status: dateStr(year, month, day) > today ? "upcoming" : "active",
    }))
    .filter((t) => t.start_date >= today);
}

async function fetchSportsDataTournaments(year, today) {
  if (!USE_SPORTSDATAIO) return [];
  if (!SPORTS_DATA_KEY) return [];
  const url = `${SPORTS_DATA_BASE}/Tournaments/${year}?key=${SPORTS_DATA_KEY}`;
  try {
    const resp = await fetch(url, { timeout: 12000 });
    if (!resp.ok) return [];
    const items = await resp.json();
    if (!Array.isArray(items)) return [];

    return items
      .map((t) => {
        const externalId = t.TournamentID || t.TournamentId || t.ID;
        const start = asDateOnly(t.StartDate || t.StartDateTime || t.DateTime);
        if (!externalId || !start) return null;
        const end = asDateOnly(t.EndDate || t.EndDateTime) || plusDays(start, 3);
        return {
          id: `sdio_${externalId}`,
          name: t.Name || t.TournamentName || `Tournament ${externalId}`,
          venue: t.Venue || t.Course || t.Location || null,
          start_date: start,
          end_date: end,
          purse: t.Purse || null,
          field_size: t.FieldSize || null,
          status: start > today ? "upcoming" : "active",
        };
      })
      .filter(Boolean)
      .filter((t) => t.start_date >= today);
  } catch {
    return [];
  }
}

async function fetchTheSportsDbTournaments(year, today) {
  const seen = new Set();
  const out = [];
  for (const leagueId of THE_SPORTS_DB_LEAGUES) {
    const url = `${THE_SPORTS_DB}/eventsseason.php?id=${encodeURIComponent(leagueId)}&s=${encodeURIComponent(String(year))}`;
    try {
      const resp = await fetch(url, { timeout: 12000 });
      if (!resp.ok) continue;
      const json = await resp.json();
      const events = Array.isArray(json?.events) ? json.events : [];
      for (const ev of events) {
        const externalId = ev.idEvent;
        const start = asDateOnly(ev.dateEvent || ev.strTimestamp || ev.strTimeLocal);
        if (!externalId || !start || start < today) continue;
        const id = `tsdb_${externalId}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          name: ev.strEvent || ev.strFilename || `Event ${externalId}`,
          venue: ev.strVenue || ev.strCircuit || ev.strLocation || null,
          start_date: start,
          end_date: asDateOnly(ev.dateEventEnd) || plusDays(start, 3),
          purse: null,
          field_size: null,
          status: start > today ? "upcoming" : "active",
        });
      }
    } catch {}
  }
  return out;
}

function pickBestSource(sourceRows) {
  const sorted = Object.entries(sourceRows)
    .map(([provider, rows]) => ({ provider, rows: rows || [], count: (rows || []).length }))
    .sort((a, b) => b.count - a.count);
  const best = sorted[0] || { provider: "TEMPLATE", rows: [], count: 0 };
  return { best, counts: sorted.reduce((acc, x) => ({ ...acc, [x.provider]: x.count }), {}) };
}

async function seedUpcomingTournaments(supabase, year = new Date().getUTCFullYear()) {
  const today = new Date().toISOString().slice(0, 10);
  const years = [year, year + 1];

  const sportsDataRows = [];
  const theSportsDbRows = [];
  for (const y of years) {
    sportsDataRows.push(...(await fetchSportsDataTournaments(y, today)));
    theSportsDbRows.push(...(await fetchTheSportsDbTournaments(y, today)));
  }
  const templateRows = normalizeTemplate(year, today);

  const { best, counts } = pickBestSource({
    ...(USE_SPORTSDATAIO ? { SPORTSDATAIO: sportsDataRows } : {}),
    THESPORTSDB: theSportsDbRows,
    TEMPLATE: templateRows,
  });

  const rows = best.count ? best.rows : templateRows;
  if (!rows.length) return { seeded: 0, source: "NONE", counts };

  const { error } = await supabase
    .from("tournaments")
    .upsert(rows, { onConflict: "id" });

  if (error) return { error: error.message, source: best.provider, counts };
  return { seeded: rows.length, source: best.provider, counts };
}

module.exports = { seedUpcomingTournaments };
