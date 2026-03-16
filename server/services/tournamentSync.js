const fetch = require("node-fetch");

// Prefer DataGolf for schedules/fields when configured.
const DATAGOLF_API_KEY = process.env.DATAGOLF_API_KEY || "";
const DATAGOLF_BASE_URL = (process.env.DATAGOLF_BASE_URL || "https://feeds.datagolf.com").replace(/\/+$/, "");

// Fallback providers (kept as a backup if DataGolf is unavailable).
const SPORTS_DATA_KEY = process.env.SPORTS_DATA_IO_KEY;
const SPORTS_DATA_BASE = "https://api.sportsdata.io/golf/v2/json";
const USE_SPORTSDATAIO = String(process.env.USE_SPORTSDATAIO || "").toLowerCase() === "true";
const BALLDONTLIE_PGA_KEY = process.env.BALLDONTLIE_PGA_KEY || process.env.BALLDONTLIE_API_KEY || "";
const BALLDONTLIE_PGA_BASE = (process.env.BALLDONTLIE_PGA_BASE_URL || "https://api.balldontlie.io/pga/v1").replace(/\/+$/, "");

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

async function fetchBallDontLieTournaments(year, today) {
  if (!BALLDONTLIE_PGA_KEY) return [];

  const headers = { Authorization: BALLDONTLIE_PGA_KEY };
  const urls = [
    `${BALLDONTLIE_PGA_BASE}/tournaments?season=${encodeURIComponent(String(year))}&per_page=100`,
    `${BALLDONTLIE_PGA_BASE}/tournaments?seasons[]=${encodeURIComponent(String(year))}&per_page=100`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, { headers, timeout: 12000 });
      if (!resp.ok) continue;
      const json = await resp.json();
      const items = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      if (!items.length) continue;

      const rows = items
        .map((t) => {
          const start = asDateOnly(t.start_date || t.startDate || t.date || t.starts_at);
          if (!start || start < today) return null;
          const idRaw = t.id || t.tournament_id || t.event_id;
          if (!idRaw) return null;
          const end = asDateOnly(t.end_date || t.endDate || t.ends_at) || plusDays(start, 3);
          return {
            id: `bdl_${idRaw}`,
            name: t.name || t.tournament || t.event_name || `Tournament ${idRaw}`,
            venue: t.venue || t.course || t.location || null,
            start_date: start,
            end_date: end,
            purse: t.purse || t.total_purse || null,
            field_size: Number(t.field_size || t.fieldSize || t.players_count || 0) || null,
            status: start > today ? "upcoming" : "active",
          };
        })
        .filter(Boolean);
      if (rows.length) return rows;
    } catch {}
  }
  return [];
}

async function fetchDataGolfTournaments(season, today) {
  if (!DATAGOLF_API_KEY) return [];
  const url = `${DATAGOLF_BASE_URL}/get-schedule?tour=all&season=${encodeURIComponent(String(season))}&upcoming_only=no&file_format=json&key=${encodeURIComponent(DATAGOLF_API_KEY)}`;
  try {
    const resp = await fetch(url, { timeout: 12000 });
    if (!resp.ok) return [];
    const json = await resp.json();
    const items = []
      .concat(json?.schedule || [])
      .concat(json?.events || [])
      .concat(json?.data || [])
      .concat(Array.isArray(json) ? json : [])
      .filter((x) => x && typeof x === "object");

    const rows = items
      .map((t) => {
        const externalId = t.event_id || t.eventId || t.id || t.tournament_id || t.tournamentId;
        const start = asDateOnly(t.start_date || t.startDate || t.date || t.starts_at);
        if (!externalId || !start || start < today) return null;
        const end = asDateOnly(t.end_date || t.endDate || t.ends_at) || plusDays(start, 3);
        const name = t.event_name || t.name || t.tournament || t.event || `Tournament ${externalId}`;
        const venue =
          t.course_name ||
          t.course ||
          t.venue ||
          t.location ||
          t.city ||
          null;
        const purse = t.purse || t.purse_usd || t.total_purse || null;
        const fieldSize = Number(t.field_size || t.fieldSize || 0) || null;
        return {
          id: `dg_${externalId}`,
          name,
          venue,
          start_date: start,
          end_date: end,
          purse,
          field_size: fieldSize,
          status: start > today ? "upcoming" : "active",
        };
      })
      .filter(Boolean);

    return rows;
  } catch {
    return [];
  }
}

function pickBestSource(sourceRows) {
  const sorted = Object.entries(sourceRows)
    .map(([provider, rows]) => ({ provider, rows: rows || [], count: (rows || []).length }))
    .sort((a, b) => b.count - a.count);
  const best = sorted[0] || { provider: "TEMPLATE", rows: [], count: 0 };
  return { best, counts: sorted.reduce((acc, x) => ({ ...acc, [x.provider]: x.count }), {}) };
}

function normKey(v) {
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

function overlayTemplateFromDataGolf(templateRows, dataGolfRows) {
  if (!Array.isArray(templateRows) || !Array.isArray(dataGolfRows) || !dataGolfRows.length) return templateRows;
  const dg = dataGolfRows
    .map((t) => ({ ...t, _k: `${normKey(t.name)}|${t.start_date}` }))
    .filter((t) => t.name && t.start_date);

  return templateRows.map((t) => {
    const targetName = normKey(t.name);
    const targetDate = t.start_date;
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const ev of dg) {
      const evName = normKey(ev.name);
      const namePenalty = (evName.includes(targetName) || targetName.includes(evName)) ? 0 : 35;
      const datePenalty = dateDistanceDays(targetDate, ev.start_date);
      const score = namePenalty + datePenalty;
      if (score < bestScore) { bestScore = score; best = ev; }
    }
    // Only overlay when reasonably close (prevents accidental mismatches).
    if (!best || bestScore > 10) return t;
    return {
      ...t,
      name: best.name || t.name,
      venue: best.venue || t.venue,
      start_date: best.start_date || t.start_date,
      end_date: best.end_date || t.end_date,
      purse: best.purse ?? t.purse,
      field_size: best.field_size ?? t.field_size,
      status: best.status || t.status,
    };
  });
}

async function seedUpcomingTournaments(supabase, year = new Date().getUTCFullYear()) {
  const today = new Date().toISOString().slice(0, 10);
  const years = [year, year + 1];

  const dataGolfRows = [];
  const sportsDataRows = [];
  const theSportsDbRows = [];
  const ballDontLieRows = [];
  for (const y of years) {
    dataGolfRows.push(...(await fetchDataGolfTournaments(y, today)));
    sportsDataRows.push(...(await fetchSportsDataTournaments(y, today)));
    theSportsDbRows.push(...(await fetchTheSportsDbTournaments(y, today)));
    ballDontLieRows.push(...(await fetchBallDontLieTournaments(y, today)));
  }
  const templateRows = normalizeTemplate(year, today);

  const { best, counts } = pickBestSource({
    ...(DATAGOLF_API_KEY ? { DATAGOLF: dataGolfRows } : {}),
    ...(BALLDONTLIE_PGA_KEY ? { BALLDONTLIE: ballDontLieRows } : {}),
    ...(USE_SPORTSDATAIO ? { SPORTSDATAIO: sportsDataRows } : {}),
    THESPORTSDB: theSportsDbRows,
    TEMPLATE: templateRows,
  });

  // If DataGolf is available, always upsert:
  // 1) DataGolf schedule rows (dg_* ids) for breadth/accuracy
  // 2) Our stable internal ids (t1..t20) overlaid with DataGolf values so existing pools keep working
  const templateOverlaid = DATAGOLF_API_KEY ? overlayTemplateFromDataGolf(templateRows, dataGolfRows) : templateRows;
  const rows = DATAGOLF_API_KEY
    ? [...dataGolfRows, ...templateOverlaid]
    : (best.count ? best.rows : templateRows);
  if (!rows.length) return { seeded: 0, source: "NONE", counts };

  const { error } = await supabase
    .from("tournaments")
    .upsert(rows, { onConflict: "id" });

  if (error) return { error: error.message, source: best.provider, counts };
  return { seeded: rows.length, source: best.provider, counts };
}

module.exports = { seedUpcomingTournaments };
