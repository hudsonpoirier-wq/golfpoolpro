# GolfPoolPro Website

This repository is now structured as a full-stack website from your `golfpro.zip` files.

## Project Structure

- `client/` React + Vite frontend (uses `GolfPoolPro_v2.jsx`)
- `server/` Express backend (Supabase + draft/invite/pool routes)
- `DEPLOYMENT.md` deployment guide from your archive

## Run Locally

1. Install dependencies:

```bash
npm install
npm --prefix client install
npm --prefix server install
```

2. Configure backend env:

```bash
cp server/.env.example server/.env
```

Then fill in real Supabase keys in `server/.env`.

Optional (recommended): add GolfCourseAPI integration in `server/.env`:

```bash
GOLFCOURSE_API_KEY=your-golfcourseapi-key
GOLFCOURSE_API_BASE=https://api.golfcourseapi.com
GOLFCOURSE_DAILY_LIMIT=300
GOLFCOURSE_TIMEZONE=America/New_York
GOLFCOURSE_WINDOW_START_HOUR=8
GOLFCOURSE_WINDOW_END_HOUR=17
GOLFCOURSE_CACHE_TTL_MS=21600000

# RapidAPI mode (preferred if you subscribed there)
RAPIDAPI_KEY=your-rapidapi-key
RAPIDAPI_HOST=golf-course-api.p.rapidapi.com
RAPIDAPI_BASE_URL=https://golf-course-api.p.rapidapi.com
RAPIDAPI_DAILY_LIMIT=50
RAPIDAPI_TIMEZONE=America/New_York
RAPIDAPI_WINDOW_START_HOUR=8
RAPIDAPI_WINDOW_END_HOUR=19

# RapidAPI tournament-player fallback (for import-field-auto)
# Recommended provider from RapidAPI search: "Live Golf Data" (slashgolf)
RAPIDAPI_GOLF_KEY=your-rapidapi-key
RAPIDAPI_GOLF_HOST=live-golf-data.p.rapidapi.com
RAPIDAPI_GOLF_BASE_URL=https://live-golf-data.p.rapidapi.com
# Optional: set if your chosen provider uses a different endpoint shape
# Placeholders available: {id} {tsdb_event_id} {name} {start_date} {year}
RAPIDAPI_GOLF_FIELD_URL_TEMPLATE=

# Sportradar (optional, preferred if you have access)
SPORTRADAR_API_KEY=your-sportradar-key
SPORTRADAR_GOLF_BASE_URL=https://api.sportradar.com/golf
SPORTRADAR_ACCESS_LEVEL=trial
SPORTRADAR_GOLF_VERSION=v3
SPORTRADAR_LANG=en
# Map internal ids (t1, t4, etc.) to Sportradar tournament ids
SPORTRADAR_TOURNAMENT_MAP={}
# Optional custom field URL template:
# placeholders: {id} {sportradar_tournament_id} {api_key} {access_level} {version} {language}
SPORTRADAR_GOLF_FIELD_URL_TEMPLATE=

# BallDontLie PGA (recommended primary for free-tier schedules + players)
BALLDONTLIE_PGA_KEY=your-balldontlie-key
BALLDONTLIE_PGA_BASE_URL=https://api.balldontlie.io/pga/v1
```

3. Start website (frontend + backend):

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

4. Frontend API target (for production):

`client/.env` should point to your backend:

```bash
VITE_API_URL=https://golfpoolpro.onrender.com
VITE_SITE_URL=https://golfpoolpro.vercel.app
```

## Notes

- Frontend source entry: `client/src/main.jsx`
- Main UI component: `client/src/GolfPoolPro_v2.jsx`
- Backend API entry: `server/index.js`
- SQL schema: `server/schema.sql`
- GolfCourse endpoints:
  - `GET /api/courses/search?q=augusta`
  - `GET /api/courses/:id`
  - `GET /api/courses/tournament/:id`
- Admin field import endpoint:
  - `POST /api/admin/import-field/:tournamentId` with `x-admin-token`
  - `POST /api/admin/import-field-auto/:tournamentId` (provider chain: Sportradar -> BallDontLie -> TheSportsDB -> RapidAPI)
  - Body supports either:
    - JSON: `{"players":[{"name":"Scottie Scheffler","country":"USA","world_rank":1}]}`
    - CSV text: `{"csv":"name,country,world_rank\nScottie Scheffler,USA,1"}`

- Tournament source behavior:
  - Default provider compares BallDontLie vs TheSportsDB vs template and seeds from the provider with more upcoming events.
  - `/api/tournaments/future` deduplicates overlapping events by name/date and prefers BallDontLie IDs.
  - SportsDataIO is disabled by default and only used if `USE_SPORTSDATAIO=true`.
  - If enabled, backend also compares SportsDataIO counts.
  - It seeds from whichever provider returns more upcoming events.
  - If future tournament rows are low, `/api/tournaments/future` auto-backfills.
