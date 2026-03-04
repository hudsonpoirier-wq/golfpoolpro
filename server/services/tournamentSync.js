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

async function seedUpcomingTournaments(supabase, year = new Date().getUTCFullYear()) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = UPCOMING_TEMPLATE
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

  if (!rows.length) return { seeded: 0 };

  const { error } = await supabase
    .from("tournaments")
    .upsert(rows, { onConflict: "id" });

  if (error) return { error: error.message };
  return { seeded: rows.length };
}

module.exports = { seedUpcomingTournaments };
