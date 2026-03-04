const router = require("express").Router();
const fetch = require("node-fetch");

const GOLF_COURSE_API_BASE = (
  process.env.GOLFCOURSE_API_BASE ||
  process.env.RAPIDAPI_BASE_URL ||
  "https://api.golfcourseapi.com"
).replace(/\/$/, "");
const GOLF_COURSE_API_KEY = process.env.GOLFCOURSE_API_KEY || "";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "";
const COURSE_PROVIDER = RAPIDAPI_KEY ? "rapidapi-golf-course-api" : "golfcourseapi";
const COURSE_CACHE_TTL_MS = Number(process.env.GOLFCOURSE_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6h
const COURSE_TZ = process.env.RAPIDAPI_TIMEZONE || process.env.GOLFCOURSE_TIMEZONE || "America/New_York";
const DAILY_LIMIT = Number(process.env.RAPIDAPI_DAILY_LIMIT || process.env.GOLFCOURSE_DAILY_LIMIT || 50);
const WINDOW_START_HOUR = Number(process.env.RAPIDAPI_WINDOW_START_HOUR || process.env.GOLFCOURSE_WINDOW_START_HOUR || 8);
const WINDOW_END_HOUR = Number(process.env.RAPIDAPI_WINDOW_END_HOUR || process.env.GOLFCOURSE_WINDOW_END_HOUR || 19); // exclusive
const WINDOW_DURATION_MS = Math.max(1, WINDOW_END_HOUR - WINDOW_START_HOUR) * 60 * 60 * 1000;
const MIN_INTERVAL_MS = Math.max(1000, Math.floor(WINDOW_DURATION_MS / Math.max(1, DAILY_LIMIT)));
const RESPONSE_CACHE = new Map();
const RATE_STATE = {
  dayKey: null,
  count: 0,
  nextAllowedAtMs: 0,
};

function authHeaders() {
  const headers = { Accept: "application/json" };
  if (RAPIDAPI_KEY) {
    headers["x-rapidapi-key"] = RAPIDAPI_KEY;
    if (RAPIDAPI_HOST) headers["x-rapidapi-host"] = RAPIDAPI_HOST;
  } else if (GOLF_COURSE_API_KEY) {
    headers.Authorization = `Key ${GOLF_COURSE_API_KEY}`;
  }
  return headers;
}

function hasProviderCreds() {
  return Boolean(RAPIDAPI_KEY || GOLF_COURSE_API_KEY);
}

function nowEtParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COURSE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  return {
    dayKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minutes: hour * 60 + minute,
  };
}

function maybeResetDailyWindow() {
  const { dayKey } = nowEtParts();
  if (RATE_STATE.dayKey !== dayKey) {
    RATE_STATE.dayKey = dayKey;
    RATE_STATE.count = 0;
    RATE_STATE.nextAllowedAtMs = 0;
  }
}

function getRateDecision() {
  maybeResetDailyWindow();
  const { minutes } = nowEtParts();
  const windowStartMinutes = WINDOW_START_HOUR * 60;
  const windowEndMinutes = WINDOW_END_HOUR * 60;
  const inWindow = minutes >= windowStartMinutes && minutes < windowEndMinutes;
  if (!inWindow) {
    return { ok: false, reason: "outside_window", retryAfterMs: 60 * 1000 };
  }
  if (RATE_STATE.count >= DAILY_LIMIT) {
    return { ok: false, reason: "daily_limit", retryAfterMs: 60 * 1000 };
  }
  const now = Date.now();
  if (now < RATE_STATE.nextAllowedAtMs) {
    return { ok: false, reason: "spacing", retryAfterMs: RATE_STATE.nextAllowedAtMs - now };
  }
  return { ok: true };
}

function registerCall() {
  RATE_STATE.count += 1;
  RATE_STATE.nextAllowedAtMs = Date.now() + MIN_INTERVAL_MS;
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
  const cached = RESPONSE_CACHE.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const gate = getRateDecision();
  if (!gate.ok) {
    const err = new Error(
      gate.reason === "outside_window"
        ? `${COURSE_PROVIDER} calls are allowed only between ${WINDOW_START_HOUR}:00-${WINDOW_END_HOUR}:00 ${COURSE_TZ}.`
        : gate.reason === "daily_limit"
          ? `${COURSE_PROVIDER} daily limit reached (${DAILY_LIMIT} calls).`
          : `${COURSE_PROVIDER} call deferred to keep calls evenly spaced.`
    );
    err.status = 429;
    err.retryAfterSeconds = Math.max(1, Math.ceil((gate.retryAfterMs || 1000) / 1000));
    if (cached) return cached.payload;
    throw err;
  }

  const resp = await fetch(url, { headers: authHeaders(), timeout: 10000 });
  registerCall();
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${COURSE_PROVIDER} ${resp.status}: ${text || resp.statusText}`);
  }
  const payload = await resp.json();
  RESPONSE_CACHE.set(url, { payload, expiresAt: Date.now() + COURSE_CACHE_TTL_MS });
  return payload;
}

async function searchCourses(query) {
  const q = encodeURIComponent(query);
  const urls = [
    `${GOLF_COURSE_API_BASE}/search?name=${q}`,
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
    if (!hasProviderCreds()) {
      return res.status(400).json({ error: "Set RAPIDAPI_KEY (+ RAPIDAPI_HOST) or GOLFCOURSE_API_KEY." });
    }

    const courses = await searchCourses(q);
    return res.json({ courses, provider: COURSE_PROVIDER, count: courses.length });
  } catch (e) {
    if (e.status === 429) {
      res.setHeader("Retry-After", String(e.retryAfterSeconds || 60));
      return res.status(429).json({ error: e.message, retryAfterSeconds: e.retryAfterSeconds || 60 });
    }
    return next(e);
  }
});

router.get("/tournament/:id", async (req, res, next) => {
  try {
    if (!hasProviderCreds()) {
      return res.status(400).json({ error: "Set RAPIDAPI_KEY (+ RAPIDAPI_HOST) or GOLFCOURSE_API_KEY." });
    }
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
          provider: COURSE_PROVIDER,
        });
      }
    }

    return res.json({ tournament, course: null, candidates: [], provider: COURSE_PROVIDER });
  } catch (e) {
    if (e.status === 429) {
      res.setHeader("Retry-After", String(e.retryAfterSeconds || 60));
      return res.status(429).json({ error: e.message, retryAfterSeconds: e.retryAfterSeconds || 60 });
    }
    return next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!hasProviderCreds()) {
      return res.status(400).json({ error: "Set RAPIDAPI_KEY (+ RAPIDAPI_HOST) or GOLFCOURSE_API_KEY." });
    }
    const course = await getCourseById(req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found." });
    return res.json({ course, provider: COURSE_PROVIDER });
  } catch (e) {
    if (e.status === 429) {
      res.setHeader("Retry-After", String(e.retryAfterSeconds || 60));
      return res.status(429).json({ error: e.message, retryAfterSeconds: e.retryAfterSeconds || 60 });
    }
    return next(e);
  }
});

module.exports = router;
