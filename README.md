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

Then fill in real Supabase/SportsDataIO keys in `server/.env`.

Optional (recommended): add GolfCourseAPI integration in `server/.env`:

```bash
GOLFCOURSE_API_KEY=your-golfcourseapi-key
GOLFCOURSE_API_BASE=https://api.golfcourseapi.com
GOLFCOURSE_DAILY_LIMIT=300
GOLFCOURSE_TIMEZONE=America/New_York
GOLFCOURSE_WINDOW_START_HOUR=8
GOLFCOURSE_WINDOW_END_HOUR=17
GOLFCOURSE_CACHE_TTL_MS=21600000
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
