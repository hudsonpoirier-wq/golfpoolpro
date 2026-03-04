const router = require("express").Router();
const fetch = require("node-fetch");

const GOLF_COURSE_API_BASE = (process.env.GOLFCOURSE_API_BASE || "https://api.golfcourseapi.com").replace(/\/$/, "");
const GOLF_COURSE_API_KEY = process.env.GOLFCOURSE_API_KEY || "";

function authHeaders() {
  const headers = { Accept: "application/json" };
  if (GOLF_COURSE_API_KEY) headers.Authorization = `Key ${GOLF_COURSE_API_KEY}`;
  return headers;
}

function normalizeCourse(raw) {
  if (!raw || typeof raw !== "object") return null;
  const location = [
    raw.city,
    raw.state,
    raw.country,
  ].filter(Boolean).join(", ");
  return {
    id: raw.id || raw.course_id || raw.slug || raw.uuid || null,
    name: raw.name || raw.course_name || raw.strCourse || raw.title || "Unknown Course",
    city: raw.city || null,
    state: raw.state || null,
    country: raw.country || null,
    location: location || null,
    par: raw.par || raw.total_par || null,
    holes: raw.holes || raw.hole_count || null,
    yardage: raw.yardage || raw.total_yardage || null,
    website: raw.website || raw.url || null,
    raw,
  };
}

function extractCourseList(payload) {
  const candidates = [
    payload?.courses,
    payload?.data,
    payload?.results,
    payload,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.map(normalizeCourse).filter(Boolean);
  }
  return [];
}

async function fetchJson(url) {
  const resp = await fetch(url, { headers: authHeaders(), timeout: 10000 });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`GolfCourseAPI ${resp.status}: ${text || resp.statusText}`);
  }
  return resp.json();
}

async function searchCourses(query) {
  const q = encodeURIComponent(query);
  const urls = [
    `${GOLF_COURSE_API_BASE}/v1/courses?search=${q}`,
    `${GOLF_COURSE_API_BASE}/v1/courses?q=${q}`,
    `${GOLF_COURSE_API_BASE}/v1/courses?name=${q}`,
    `${GOLF_COURSE_API_BASE}/courses?search=${q}`,
    `${GOLF_COURSE_API_BASE}/courses?q=${q}`,
  ];

  for (const url of urls) {
    try {
      const json = await fetchJson(url);
      const courses = extractCourseList(json);
      if (courses.length) return courses;
    } catch {}
  }
  return [];
}

async function getCourseById(id) {
  const encoded = encodeURIComponent(id);
  const urls = [
    `${GOLF_COURSE_API_BASE}/v1/courses/${encoded}`,
    `${GOLF_COURSE_API_BASE}/courses/${encoded}`,
  ];

  for (const url of urls) {
    try {
      const json = await fetchJson(url);
      if (json?.course) return normalizeCourse(json.course);
      if (json?.data && !Array.isArray(json.data)) return normalizeCourse(json.data);
      return normalizeCourse(json);
    } catch {}
  }
  return null;
}

router.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing query string `q`." });
    if (!GOLF_COURSE_API_KEY) return res.status(400).json({ error: "GOLFCOURSE_API_KEY is not configured." });

    const courses = await searchCourses(q);
    return res.json({ courses, provider: "golfcourseapi", count: courses.length });
  } catch (e) {
    return next(e);
  }
});

router.get("/tournament/:id", async (req, res, next) => {
  try {
    if (!GOLF_COURSE_API_KEY) return res.status(400).json({ error: "GOLFCOURSE_API_KEY is not configured." });
    const sb = req.app.locals.supabase;
    const { data: tournament, error } = await sb
      .from("tournaments")
      .select("id, name, venue, start_date")
      .eq("id", req.params.id)
      .single();
    if (error || !tournament) return res.status(404).json({ error: "Tournament not found." });

    const searches = [tournament.venue, tournament.name].filter(Boolean);
    for (const q of searches) {
      const matches = await searchCourses(q);
      if (matches.length) {
        return res.json({
          tournament,
          course: matches[0],
          candidates: matches.slice(0, 5),
          provider: "golfcourseapi",
        });
      }
    }

    return res.json({ tournament, course: null, candidates: [], provider: "golfcourseapi" });
  } catch (e) {
    return next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!GOLF_COURSE_API_KEY) return res.status(400).json({ error: "GOLFCOURSE_API_KEY is not configured." });
    const course = await getCourseById(req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found." });
    return res.json({ course, provider: "golfcourseapi" });
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
