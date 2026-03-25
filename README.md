# GolfPoolPro

A full-stack fantasy golf pool platform where users create pools, invite friends, snake-draft golfers, and compete on live leaderboards during PGA Tour events.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite, deployed on Vercel |
| Backend | Express 4 (Node.js 18+), deployed on Render |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (email/password), proxied through the Express API |
| Charts | Recharts |
| Scheduling | node-cron (live score sync every 30s during active events) |

---

## Architecture

```
Browser (React / Vite)
    |  HTTPS
Vercel (Frontend)               <- golfpoolpro.vercel.app
    |  HTTPS API calls
Render (Express API)            <- golfpoolpro.onrender.com
    |  Supabase JS client
Supabase (Postgres + Auth)      <- your-project.supabase.co
    |  cron every 30s
External Data APIs              <- DataGolf, TheSportsDB, BallDontLie
```

---

## Features

- **Pool Creation** -- Create named pools tied to upcoming PGA Tour tournaments with configurable team size, scoring golfers, cut line, and shot clock.
- **Invite Links** -- Share hash-based invite URLs (`/join/<token>`). Recipients see a pool preview before signing up or logging in.
- **Snake Draft** -- Real-time snake draft with shot clock, pause/resume, force-pick (host), and auto-pick on timeout.
- **Live Scoring** -- Round-by-round scores (R1-R4) synced from external APIs every 30 seconds during active events.
- **Leaderboards** -- Pool standings computed from each member's best N golfers. Public read-only leaderboard available via invite token.
- **Lobby Presence** -- Heartbeat-based presence tracking shows who is currently in the pool lobby.
- **Pool Chat** -- In-memory chat per pool with system ping messages from the host.
- **Golfer Rankings** -- Full field view with world rank, scoring average, strokes gained, driving distance/accuracy, GIR, and putting stats.
- **Course Info** -- Course search and tournament-to-course resolution via GolfCourseAPI or RapidAPI.
- **Tournament Schedule** -- Auto-seeded upcoming tournament list with deduplication across providers (DataGolf, BallDontLie, TheSportsDB).
- **Password Reset** -- Email-based forgot/reset password flow through Supabase Auth.
- **Admin Tools** -- Seed golfers, seed tournaments, import tournament fields (manual JSON/CSV or auto-chain from providers), reset fields, and view analytics/errors.

---

## Data Sources

| Provider | Purpose |
|----------|---------|
| **DataGolf** | Projected tournament fields, player list, world rankings, field updates, major field scraping |
| **TheSportsDB** | Live scores (fallback), tournament schedule, event ID resolution |
| **BallDontLie PGA** | Live scores (primary when key is set), tournament schedule, player fields |
| **Sportradar** | Tournament fields (optional, if API key is provided) |
| **SportsDataIO** | Golfer seeding, live scores (optional, disabled by default) |
| **GolfCourseAPI / RapidAPI** | Course search, course details, tournament venue matching |

The score sync priority is: BallDontLie (if key set) -> TheSportsDB -> SportsDataIO (if enabled).

---

## API Endpoints

### Auth (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/signup` | Create account |
| POST | `/login` | Log in |
| POST | `/logout` | Log out |
| POST | `/refresh` | Refresh expired session |
| POST | `/forgot-password` | Send password reset email |
| POST | `/reset-password` | Set new password (requires auth) |
| GET | `/me` | Get current user profile |
| PATCH | `/me` | Update profile (name, avatar) |

### Pools (`/api/pools`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List pools for current user |
| POST | `/` | Create a new pool |
| GET | `/:id` | Get pool details, members, picks |
| PATCH | `/:id` | Update pool settings (host only) |
| DELETE | `/:id` | Delete pool (host only) |
| PATCH | `/:id/ready` | Toggle ready status |
| GET | `/:id/standings` | Get live standings |
| POST | `/:id/start-draft` | Start the draft (host only) |
| POST | `/:id/ready-all` | Mark all members ready (host only) |
| POST | `/:id/presence/heartbeat` | Lobby presence heartbeat |
| GET | `/:id/presence` | Get active lobby users |
| DELETE | `/:id/presence` | Leave presence |
| GET | `/:id/chat` | Get chat messages |
| POST | `/:id/chat` | Send a chat message |
| POST | `/:id/chat/ping` | Host system ping |
| DELETE | `/:id/members/:userId` | Remove a member (host only, lobby) |

### Draft (`/api/draft`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:poolId` | Get draft state (picks, current turn, time) |
| POST | `/:poolId/pick` | Make a draft pick |
| POST | `/:poolId/pause` | Pause the draft (host only) |
| POST | `/:poolId/resume` | Resume the draft (host only) |
| POST | `/:poolId/force-pick` | Force-pick for current drafter (host only) |

### Invites (`/api/invite`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:token` | Resolve invite token (public) |
| POST | `/:token/join` | Join pool via invite (requires auth) |
| POST | `/pools/:id/regenerate` | Regenerate invite token (host only) |

### Golfers and Scores

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/golfers?tournament=<id>` | Get field for a tournament |
| GET | `/api/scores/:tournamentId` | Get live leaderboard scores |

### Tournaments (`/api/tournaments`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/future` | List upcoming tournaments (auto-seeds if low) |

### Courses (`/api/courses`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q=<query>` | Search courses by name |
| GET | `/:id` | Get course by provider ID |
| GET | `/tournament/:id` | Resolve course for a tournament |

### Public (`/api/public`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/pools/:token/leaderboard` | Read-only pool leaderboard (no auth) |

### Admin (`/api/admin`)

All admin endpoints require the `x-admin-token` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/seed-golfers` | Seed golfer data from provider |
| POST | `/seed-tournaments` | Seed upcoming tournaments for a year |
| GET | `/tournaments/suggest-map` | Suggest TheSportsDB event ID mapping |
| POST | `/import-field/:tournamentId` | Import field (JSON array or CSV) |
| POST | `/import-field-auto/:tournamentId` | Auto-import field (provider chain) |
| POST | `/field-reset/:tournamentId` | Reset tournament field |
| GET | `/datagolf/field-updates-debug` | Debug DataGolf field updates |
| GET | `/datagolf/major-fields-debug` | Debug DataGolf major fields |
| GET | `/analytics` | Server analytics (uptime, sync status) |
| GET | `/errors` | Recent error log |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |

---

## Data Model

Defined in `schema.sql`. Key tables:

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (extends Supabase `auth.users`). Auto-created via trigger on signup. |
| `tournaments` | PGA Tour events with name, venue, dates, purse, field size, and status. |
| `golfers` | Cached golfer data: name, country, world rank, scoring avg, strokes gained, driving, GIR, putting. |
| `tournament_scores` | Per-golfer round scores (R1-R4), position, birdies/eagles/bogeys arrays. Refreshed every 30s. |
| `pools` | Pool configuration: tournament, host, max participants, team size, scoring golfers, cut line, shot clock, invite token. |
| `pool_members` | Pool membership with ready status. |
| `draft_picks` | Draft selections with pick order. Each golfer can only be drafted once per pool. |
| `pool_standings` | (View) Computed standings using each member's best N golfer scores. |

Row Level Security is enabled on all tables. Scores, golfers, and tournaments are publicly readable. Pools and picks are scoped to members.

---

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 4000) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (keep secret) |
| `SITE_URL` | Yes | Frontend URL for redirects |
| `ALLOWED_ORIGINS` | Yes | Comma-separated CORS origins |
| `ADMIN_TOKEN` | Yes | Secret token for admin endpoints |
| `SCORE_PROVIDER` | No | Score source override: `BALLDONTLIE`, `THESPORTSDB`, or `SPORTSDATAIO` |
| `THE_SPORTS_DB_KEY` | No | TheSportsDB API key (default: `3` for free tier) |
| `THE_SPORTS_DB_EVENT_MAP` | No | JSON map of tournament IDs to TheSportsDB event IDs |
| `BALLDONTLIE_PGA_KEY` | No | BallDontLie PGA API key (enables as primary score provider) |
| `BALLDONTLIE_PGA_BASE_URL` | No | BallDontLie base URL |
| `DATAGOLF_API_KEY` | No | DataGolf API key for fields and rankings |
| `DATAGOLF_BASE_URL` | No | DataGolf API base URL |
| `DATAGOLF_TOUR` | No | Tour filter (default: `pga`) |
| `SPORTS_DATA_IO_KEY` | No | SportsDataIO API key |
| `USE_SPORTSDATAIO` | No | Enable SportsDataIO (default: `false`) |
| `SPORTRADAR_API_KEY` | No | Sportradar Golf API key |
| `SPORTRADAR_TOURNAMENT_MAP` | No | JSON map of internal IDs to Sportradar tournament IDs |
| `GOLFCOURSE_API_KEY` | No | GolfCourseAPI key |
| `RAPIDAPI_KEY` | No | RapidAPI key (for golf course or live golf data) |
| `RAPIDAPI_GOLF_KEY` | No | RapidAPI key for tournament field provider |
| `ALLOW_PROVISIONAL_FIELDS` | No | Allow ranking-based fallback fields (default: `false`) |
| `MIN_TOURNAMENT_ROWS` | No | Min future tournaments before auto-backfill (default: 12) |

See `server/.env.example` for the full list including rate-limit and cache tuning options.

### Client (`client/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (default: `http://localhost:4000`) |
| `VITE_SITE_URL` | Frontend URL (default: `http://localhost:5173`) |

---

## Local Development

1. **Install dependencies:**

```bash
npm install
npm --prefix client install
npm --prefix server install
```

2. **Configure environment:**

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` with your Supabase credentials and any data provider API keys.

3. **Set up the database:**

Run the contents of `schema.sql` in the Supabase SQL Editor.

4. **Start the dev servers:**

```bash
npm run dev
```

This runs the frontend (http://localhost:5173) and backend (http://localhost:4000) concurrently.

**Other scripts:**

| Command | Description |
|---------|-------------|
| `npm run dev:server` | Backend only |
| `npm run dev:client` | Frontend only |
| `npm run build` | Build the client for production |
| `npm start` | Start the production server |

---

## Deployment

- **Frontend:** Vercel (root directory: `client`, framework: Vite, output: `dist`)
- **Backend:** Render (root directory: `server`, build: `npm install`, start: `npm start`)
- **Database:** Supabase (free tier works for development)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step guide covering Supabase setup, Render/Vercel configuration, custom domain DNS, invite link routing, and cost breakdown.

---

## Project Structure

```
.
├── client/                   # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx          # App entry point
│   │   ├── GolfPoolPro_v2.jsx # Main UI component (all views)
│   │   └── api.js            # API client (Auth, Pools, Draft, Invites, Golfers, Courses)
│   ├── .env.example
│   └── package.json
├── server/                   # Express backend
│   ├── index.js              # Server entry, middleware, admin routes, cron jobs, DataGolf integration
│   ├── routes/
│   │   ├── auth.js           # Authentication (signup, login, password reset)
│   │   ├── pools.js          # Pool CRUD, chat, presence, member management
│   │   ├── draft.js          # Snake draft (pick, pause, resume, force-pick)
│   │   ├── invites.js        # Invite resolution and joining
│   │   ├── golfers.js        # Golfer field queries
│   │   ├── scores.js         # Live tournament scores
│   │   ├── tournaments.js    # Upcoming tournament list
│   │   ├── courses.js        # Course search and lookup
│   │   └── public.js         # Public leaderboard (no auth)
│   ├── services/
│   │   ├── scoresSync.js     # Live score sync (cron), golfer seeding
│   │   └── tournamentSync.js # Tournament schedule seeding
│   ├── middleware/
│   │   └── auth.js           # JWT verification (requireAuth, optionalAuth)
│   ├── .env.example
│   └── package.json
├── schema.sql                # PostgreSQL schema (tables, RLS policies, views, indexes)
├── DEPLOYMENT.md             # Full deployment guide
└── package.json              # Root scripts (dev, build, start)
```
