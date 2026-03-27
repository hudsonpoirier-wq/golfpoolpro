# GolfPoolPro

A full-stack fantasy golf pool platform where users create pools, invite friends, snake-draft golfers, and compete on live leaderboards during PGA Tour, European Tour, and Korn Ferry Tour events. Built with React, Express, and Supabase.

**Live at:** [golfpoolpro.vercel.app](https://golfpoolpro.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Screenshots & UI](#screenshots--ui)
- [How It Works](#how-it-works)
- [Data Sources & Score Pipeline](#data-sources--score-pipeline)
- [Charts & Analytics](#charts--analytics)
- [Draft System](#draft-system)
- [API Endpoints](#api-endpoints)
- [Data Model](#data-model)
- [Security](#security)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## Overview

GolfPoolPro is a fantasy golf platform designed for friend groups, offices, and golf communities. The core loop is:

1. **Create a Pool** tied to an upcoming tournament (e.g., The Masters, US Open)
2. **Invite Friends** via shareable link
3. **Snake Draft** golfers in real-time with a shot clock
4. **Watch Live Scores** update automatically during the tournament
5. **Win** by having your best golfers post the lowest combined to-par scores

The platform supports any tournament across the PGA Tour, European Tour, Korn Ferry Tour, and other professional tours. Scores sync automatically from the DataGolf API every 30 seconds during active events.

---

## Tech Stack

| Layer | Technology | Details |
|-------|------------|---------|
| Frontend | React 18 + Vite | Single-page app with all views in one component, deployed on Vercel |
| Backend | Express 4 (Node.js 18+) | RESTful API with JWT auth, deployed on Render |
| Database | Supabase (PostgreSQL) | Row Level Security, real-time capabilities, managed auth |
| Auth | Supabase Auth | Email/password with password complexity requirements (8+ chars, upper/lower/digit) |
| Charts | Recharts | BarChart, LineChart, AreaChart, RadarChart with custom tooltips |
| Scheduling | node-cron | Live score sync every 30 seconds during active tournaments |
| Styling | Inline CSS-in-JS | Custom design system with forest green/gold/parchment theme |
| Fonts | Google Fonts | Cormorant Garamond (headings) + DM Sans (body) |

---

## Architecture

```
Browser (React / Vite SPA)
    |  HTTPS
Vercel (Frontend CDN)               <- golfpoolpro.vercel.app
    |  HTTPS API calls
Render (Express API)                 <- golfpoolpro.onrender.com
    |  Supabase JS client
Supabase (Postgres + Auth + RLS)     <- your-project.supabase.co
    |  node-cron every 30s
DataGolf API                         <- Primary data source
    |  Fallback providers
TheSportsDB / BallDontLie / SportsDataIO
```

### Request Flow

1. User interacts with the React frontend on Vercel
2. Frontend makes authenticated API calls to the Express backend on Render
3. Backend validates JWT tokens via Supabase Auth
4. Backend reads/writes to Supabase PostgreSQL with service role key
5. Cron jobs sync live scores from DataGolf every 30 seconds
6. Frontend polls for updates every 2-4 seconds during active drafts/tournaments

---

## Features

### Pool Management
- **Create Pools** with configurable settings: team size (1-8 golfers), scoring golfers (best N count), cut line, and shot clock timer
- **Invite Friends** via shareable hash-based URLs (`/join/<token>`) -- recipients see a pool preview before signing up
- **Pool Chat** with in-memory messaging and host system pings
- **Lobby Presence** with heartbeat-based tracking showing who's currently online
- **Public Leaderboard** via invite token (no login required for spectators)

### Snake Draft
- **Real-time snake draft** with server-enforced shot clock (configurable 10-300 seconds)
- **Pause/Resume** by the host at any time
- **Force-Pick** allows the host to pick for AFK players
- **Auto-Pick** on timeout selects the best available golfer by world ranking
- **Optimistic UI** updates show picks instantly before server confirmation
- **Conflict Resolution** handles simultaneous picks with database constraints and automatic retry
- **Auto-transition** to live mode after the final pick (no page refresh needed)
- **2-second polling** for near-real-time multi-user synchronization

### Live Scoring
- **Round-by-round scores** (R1-R4) synced from DataGolf every 30 seconds
- **To-par scoring** with intelligent conversion (raw strokes like 66 auto-converted using course par)
- **Multi-tour support** covering PGA, European, Korn Ferry, Opposite Field, and Alt tours
- **Strict tournament matching** prevents cross-tour score contamination
- **Auto-activation** transitions tournaments from upcoming to active on start_date
- **Auto-completion** transitions tournaments to complete after end_date
- **Stale data cleanup** removes orphaned golfer rows after each sync
- **Tee time display** shows next-day tee times when available from the API

### Standings & Scoring
- **Best-N scoring** -- only your top N golfers' scores count (configurable per pool)
- **Cut line enforcement** -- teams need a minimum number of golfers to make the cut
- **Projected scores** estimated from current pace
- **Tie-breaking** by eagles, then birdies, then head-to-head comparison
- **Counting golfer indicators** show which golfers are contributing to your score

### Tournament Management
- **Auto-seeded schedule** from DataGolf with deduplication across providers
- **Provider ranking** prefers stable internal IDs > DataGolf > BallDontLie > SportsDataIO > TheSportsDB
- **Active tournament persistence** -- in-progress tournaments remain visible after their start date passes
- **Cooldown-based backfill** prevents re-seeding on every request

### User Accounts
- **Email/password auth** with password complexity (8+ chars, upper + lower + digit)
- **Password reset** via email through Supabase Auth
- **Profile management** with name and avatar customization
- **Session persistence** via localStorage with automatic token refresh

---

## Screenshots & UI

The app uses a premium golf-inspired design with:

- **Color palette:** Forest green (#1B4332), Gold (#C8A94F), Parchment cream, warm whites
- **Typography:** Cormorant Garamond serif for headings, DM Sans for body text
- **Cards:** Rounded corners with subtle shadows on warm cream backgrounds
- **Animations:** Smooth transitions, fade-up notifications, pulse dots for live indicators
- **Responsive:** Works on desktop and mobile with flexible grid layouts

### Key Views

| View | Description |
|------|-------------|
| **Home** | Pool list with status badges, quick-create, and navigation |
| **Lobby** | Pre-draft waiting room with ready toggles, presence, and chat |
| **Draft** | Split-panel layout: available golfers (left) and team rosters (right) with live timer |
| **Live** | Tab-based interface: Standings, Round-by-Round chart, Win Probability, Statistics |
| **Statistics** | Deep analytics with 10+ interactive charts and player spotlights |
| **Analytics** | Global tournament view with leaderboard, cumulative scores, team breakdowns |
| **Settings** | Pool configuration, password change, account management |

---

## How It Works

### 1. Creating a Pool

The host creates a pool by selecting an upcoming tournament and configuring:

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Team Size | 1-8 | 4 | Number of golfers each player drafts |
| Scoring Golfers | 1-8 | 2 | Best N scores count toward standings |
| Cut Line | 0-12 | 2 | Minimum golfers who must make the cut for team to be eligible |
| Shot Clock | 10-300s | 60s | Time per draft pick before auto-pick |

### 2. Inviting & Joining

- Host shares an invite link (cryptographically random 12-character hex token)
- Invitees see pool details (tournament, settings, current members) before joining
- Users can sign up or log in directly from the invite page
- Host can remove members from the lobby before the draft starts

### 3. Snake Draft

The draft uses a snake order based on join time:

```
Round 1: Player A → Player B → Player C → Player D
Round 2: Player D → Player C → Player B → Player A
Round 3: Player A → Player B → Player C → Player D
Round 4: Player D → Player C → Player B → Player A
```

- Server enforces turn order and shot clock
- Database constraints (`UNIQUE(pool_id, pick_number)` and `UNIQUE(pool_id, golfer_id)`) prevent race conditions
- Auto-pick selects the highest-ranked available golfer when the clock expires
- Host can force-pick for any player or pause/resume the draft

### 4. Live Tournament

Once the tournament begins:

- Scores sync from DataGolf API every 30 seconds via node-cron
- Standings auto-compute using each team's best N golfer scores
- Win probability updates after each round using a softmax algorithm
- Charts and analytics refresh on the frontend via 4-second polling

### 5. Scoring Algorithm

```
Team Score = Sum of best N golfers' total to-par scores

Where:
- Total to-par = R1 + R2 + R3 + R4 (each round stored as to-par, e.g., -4, +1, E)
- N = pool's "scoring golfers" setting
- Teams with fewer than "cut line" golfers remaining are ineligible
```

### Win Probability Algorithm

Win probability is calculated using a softmax model on score gaps:

```
P(win | player i) = exp(-alpha * gap_i) / sum(exp(-alpha * gap_j))

Where:
- gap_i = player i's cumulative score - leader's score
- alpha increases each round (0.15, 0.27, 0.39, 0.51) for growing confidence
- At tournament start, all players have equal probability
```

---

## Data Sources & Score Pipeline

### Primary: DataGolf API

DataGolf is the primary data source, providing:

| Endpoint | Data | Usage |
|----------|------|-------|
| `preds/in-play` | Live scores, positions, course par, thru holes | Primary score sync (every 30s) |
| `field-updates` | Tournament fields with player data | Fallback scores + field imports |
| `get-schedule` | Tournament schedule for all tours | Auto-seeding upcoming tournaments |
| `get-player-list` | Player names, countries, rankings | Golfer seeding |
| `preds/get-dg-rankings` | DG skill estimates, world rankings | Strokes Gained stats |

### Score Normalization Pipeline

```
Raw DataGolf Response
    ↓
Extract player array (handles 10+ payload shapes)
    ↓
Normalize each player:
    - Map dg_id → internal golfer ID (by name matching)
    - Convert raw strokes to to-par (values >50 → score - course_par)
    - Extract R1-R4, position, status, thru, tee_time
    ↓
Strict tournament name matching (prevents cross-tour contamination)
    ↓
Tour mapping cache (10-minute TTL reduces API calls)
    ↓
Upsert to tournament_scores table
    ↓
Clean up stale cross-tournament rows
```

### Multi-Tour Support

The sync engine tries all 5 tours in sequence:

1. **PGA Tour** (`pga`)
2. **European Tour** (`euro`)
3. **Korn Ferry Tour** (`kft`)
4. **Opposite Field** (`opp`)
5. **Alternative** (`alt`)

Once a tournament's tour is identified, it's cached for 10 minutes to reduce API calls.

### Fallback Providers

| Provider | Priority | Purpose |
|----------|----------|---------|
| DataGolf | Primary | Scores, fields, rankings, schedule |
| TheSportsDB | Fallback | Scores if DataGolf unavailable |
| BallDontLie | Fallback | Scores if enabled via API key |
| SportsDataIO | Fallback | Golfer seeding, scores if enabled |

---

## Charts & Analytics

The app includes 10+ interactive charts built with Recharts:

### Pool Statistics Tab

| Chart | Description |
|-------|-------------|
| **Your Team -- Scoring Breakdown** | Bar chart of each golfer's total to-par score (color-coded: green=under, gold=even, red=over) |
| **Your Team -- Round by Round** | Line chart showing cumulative score progression per golfer |
| **Your Golfers -- Detailed** | Individual cards with R1-R4 breakdown, counting indicator, tournament position |
| **Score Distribution** | Histogram of every score in the field (gold highlights your golfers) |
| **Top 10 Leaderboard** | Horizontal bar chart of tournament leaders (E for even par) |
| **Team Consistency** | Best/worst/average round per golfer comparison |
| **Cumulative Score Trend** | Area chart comparing your team total vs field average over rounds |
| **Field Position Distribution** | Where your golfers rank in the overall field |
| **Team vs Field Average** | How your team performs relative to the field mean |
| **Round-by-Round Team Performance** | Team-aggregate scoring per round |
| **Cut Line Projection** | Which of your golfers are projected to make the cut |
| **Momentum Tracker** | Hottest/coldest golfers based on round-over-round scoring changes |

### Pool Views

| Chart | Description |
|-------|-------------|
| **Pool Standings -- Round by Round** | Line chart of all participants' cumulative best-N scores (only shows played rounds) |
| **Win Probability** | Area chart with softmax-based win % after each round |

### Compare Tab

Side-by-side comparison of two golfers with:
- Total Score, World Rank (always shown)
- Scoring Avg, Drive Dist, GIR % (shown only when data available)
- Round-by-Round Scorecard
- Head-to-Head chart

### Analytics View

| Chart | Description |
|-------|-------------|
| **Cumulative Score -- All Rounds** | Top 6 players' score progression (dynamic, not hardcoded) |
| **Team Breakdowns** | Per-participant team cards with golfer details |
| **Win Probability Tracker** | Full-page win % chart |

---

## Draft System

### Architecture

The draft system uses a hybrid approach:

- **Server** enforces rules: turn order, shot clock, auto-pick, golfer uniqueness
- **Client** provides smooth UI: optimistic updates, 2-second polling, visual feedback
- **Database** guarantees consistency: unique constraints prevent race conditions

### Concurrency Protection

| Protection | Mechanism | Strength |
|------------|-----------|----------|
| Duplicate pick in same slot | `UNIQUE(pool_id, pick_number)` constraint | Database-level |
| Same golfer drafted twice | `UNIQUE(pool_id, golfer_id)` constraint | Database-level |
| Double-click prevention | `pickBusyRef` (synchronous) + `pickBusy` state + 15s safety timeout | Client-level |
| Turn verification | Server recalculates from `picks.length` on each request | Server-level |
| Auto-skip race condition | Constraint violation caught + silent retry on next poll | Database + Server |
| Clock enforcement | Server-side `draftClocks` Map with `picked_at` timestamp recovery | Server-level |

### Draft Flow

```
User clicks golfer
    ↓ pickBusyRef guard (prevent double-click)
POST /api/draft/:poolId/pick
    ↓ Server validates: turn, golfer availability, draft status
INSERT draft_pick (DB constraints enforce uniqueness)
    ↓ On success
Client optimistic update (instant UI feedback)
    ↓ Then
GET /api/draft/:poolId (full state refresh)
    ↓ Sync drafted array, currentPick, timer
If draft complete → auto-transition to live (1.5s delay)
```

### Error Recovery

- **409 Conflict** (simultaneous pick): Auto-refreshes state from server, prompts retry
- **Network timeout**: 15-second safety timer resets `pickBusy` flag
- **Server restart**: Clock state reconstructed from `picked_at` timestamps in database

---

## API Endpoints

### Auth (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/signup` | Create account (validates email format, password complexity, name length) |
| POST | `/login` | Log in (constant-time error messages prevent user enumeration) |
| POST | `/logout` | Log out |
| POST | `/refresh` | Refresh expired session |
| POST | `/forgot-password` | Send password reset email (constant-time response) |
| POST | `/reset-password` | Set new password (requires auth) |
| GET | `/me` | Get current user profile |
| PATCH | `/me` | Update profile (name, avatar) |

### Pools (`/api/pools`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List pools for current user |
| POST | `/` | Create a new pool (double-click guard) |
| GET | `/:id` | Get pool details, members, picks |
| PATCH | `/:id` | Update pool settings (host only, validated inputs) |
| DELETE | `/:id` | Delete pool (host only) |
| PATCH | `/:id/ready` | Toggle ready status |
| GET | `/:id/standings` | Get live standings (authorization required) |
| POST | `/:id/start-draft` | Start the draft (host only, race condition guard) |
| POST | `/:id/ready-all` | Mark all members ready (host only) |
| POST | `/:id/presence/heartbeat` | Lobby presence heartbeat |
| GET | `/:id/presence` | Get active lobby users |
| DELETE | `/:id/presence` | Leave presence |
| GET | `/:id/chat` | Get chat messages |
| POST | `/:id/chat` | Send a chat message |
| POST | `/:id/chat/ping` | Host system ping |
| DELETE | `/:id/members/:userId` | Remove a member (host only, lobby only) |

### Draft (`/api/draft`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:poolId` | Get full draft state (picks, current turn, time remaining, paused) |
| POST | `/:poolId/pick` | Make a draft pick (validates turn, availability, uniqueness) |
| POST | `/:poolId/pause` | Pause the draft (host only, freezes clock) |
| POST | `/:poolId/resume` | Resume the draft (host only, restores clock) |
| POST | `/:poolId/force-pick` | Force-pick for current drafter (host only) |

### Invites (`/api/invite`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:token` | Resolve invite token (public, shows pool preview) |
| POST | `/:token/join` | Join pool via invite (requires auth) |
| POST | `/pools/:id/regenerate` | Regenerate invite token (host only, uses `crypto.randomBytes`) |

### Golfers and Scores

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/golfers?tournament=<id>` | Get tournament field with golfer stats |
| GET | `/api/scores/:tournamentId` | Get live leaderboard (R1-R4, position, tee times) |

### Tournaments (`/api/tournaments`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/future` | List upcoming + active tournaments (auto-seeds if below threshold) |

### Courses (`/api/courses`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q=<query>` | Search courses by name (rate-limited, query length validated) |
| GET | `/:id` | Get course by provider ID |
| GET | `/tournament/:id` | Resolve course for a tournament |

### Public (`/api/public`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/pools/:token/leaderboard` | Read-only pool leaderboard (no auth, strips sensitive fields) |

### Admin (`/api/admin`)

All admin endpoints require the `x-admin-token` header (timing-safe comparison, 403 when unset). Rate-limited to 10 requests/minute.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/seed-golfers` | Seed golfer data from DataGolf |
| POST | `/seed-tournaments` | Seed upcoming tournaments for a year |
| GET | `/tournaments/suggest-map` | Suggest TheSportsDB event ID mapping |
| POST | `/import-field/:tournamentId` | Import field (JSON array or CSV) |
| POST | `/import-field-auto/:tournamentId` | Auto-import field from provider chain |
| POST | `/field-reset/:tournamentId` | Reset tournament field |
| GET | `/datagolf/field-updates-debug` | Debug DataGolf field updates |
| GET | `/datagolf/major-fields-debug` | Debug DataGolf major fields |
| GET | `/analytics` | Server analytics (uptime, sync counts, errors) |
| GET | `/errors` | Recent error log |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check with timestamp |

---

## Data Model

Defined in `schema.sql`. All tables have Row Level Security enabled.

| Table | Description | Key Constraints |
|-------|-------------|-----------------|
| `profiles` | User profiles (auto-created via trigger on Supabase auth signup) | PK: `id` (UUID from auth.users) |
| `tournaments` | Tournament events with name, venue, dates, purse, field size, status | Status: `upcoming`, `active`, `complete` |
| `golfers` | Cached golfer data: name, country, world rank, SG total, stats | PK: `id` (serial) |
| `tournament_scores` | Per-golfer round scores (R1-R4), position, birdies/eagles/bogeys, tee times | UNIQUE: `(tournament_id, golfer_id)` |
| `pools` | Pool configuration and state | Status: `lobby`, `draft`, `live`, `complete` |
| `pool_members` | Pool membership with ready status and join timestamp | Join order determines draft order |
| `draft_picks` | Draft selections with pick order | UNIQUE: `(pool_id, pick_number)`, `(pool_id, golfer_id)` |
| `pool_standings` | (View) Computed standings from best N golfer scores | Uses COALESCE for null-safe arithmetic |

### Tournament Lifecycle

```
upcoming  →  active  →  complete
   (auto on start_date)  (auto after end_date)
```

### Pool Lifecycle

```
lobby  →  draft  →  live  →  complete
  (host starts)  (last pick)  (tournament ends)
```

---

## Security

The application includes hardened security across all layers:

### Authentication & Authorization
- Password complexity enforcement (8+ chars, uppercase, lowercase, digit)
- Constant-time error messages prevent user enumeration on login/signup/forgot-password
- Open redirect prevention on password reset flows
- Email format validation
- Name length caps
- JWT verification on all protected endpoints

### Input Validation
- Cut line range validation (0-12)
- Shot clock range validation (10-300)
- Team size validation
- Golfer ID type coercion and positive integer check
- Query length limits on search endpoints
- `status` field removed from PATCH allowlists (prevents privilege escalation)

### Concurrency & Data Integrity
- Database unique constraints prevent draft race conditions
- Race condition guard on lobby→draft transition
- Timing-safe admin token comparison
- `crypto.randomBytes` for invite tokens (replaces `Math.random`)

### API Security
- CORS origin allowlist
- Dedicated admin rate limit (10/min)
- Stack traces hidden in production error responses
- Sensitive fields stripped from public endpoints (user_id, host.id, invite_token)
- 403 response when ADMIN_TOKEN is unset (blocks all admin access)

### Frontend Resilience
- React ErrorBoundary wraps the entire app (shows "Reload" button instead of white screen)
- `safeRender` helper for try/catch on chart computations
- Null-safe arithmetic throughout standings and chart calculations
- Charts hide automatically when data is unavailable (no empty graphs or zero values)

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
| `DATAGOLF_API_KEY` | Yes | DataGolf API key for scores, fields, and rankings |
| `DATAGOLF_BASE_URL` | No | DataGolf API base URL (default: `https://feeds.datagolf.com`) |
| `SCORE_PROVIDER` | No | Score source override: `BALLDONTLIE`, `THESPORTSDB`, or `SPORTSDATAIO` |
| `THE_SPORTS_DB_KEY` | No | TheSportsDB API key (default: `3` for free tier) |
| `BALLDONTLIE_PGA_KEY` | No | BallDontLie PGA API key |
| `USE_SPORTSDATAIO` | No | Enable SportsDataIO (default: `false`) |
| `MIN_TOURNAMENT_ROWS` | No | Minimum future tournaments before auto-backfill (default: 12) |
| `SEED_COOLDOWN_MS` | No | Cooldown between tournament seed attempts (default: 10 minutes) |

### Client (`client/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (default: `http://localhost:4000`) |
| `VITE_SITE_URL` | Frontend URL (default: `http://localhost:5173`) |

---

## Local Development

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (free tier works)
- A DataGolf API key

### Setup

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

Edit `server/.env` with your Supabase credentials and DataGolf API key.

3. **Set up the database:**

Run the contents of `schema.sql` in the Supabase SQL Editor. This creates all tables, RLS policies, views, indexes, and triggers.

4. **Seed initial data:**

```bash
# Start the server first, then:
curl -X POST http://localhost:4000/api/admin/seed-golfers -H "x-admin-token: YOUR_TOKEN"
curl -X POST http://localhost:4000/api/admin/seed-tournaments -H "x-admin-token: YOUR_TOKEN"
```

5. **Start the dev servers:**

```bash
npm run dev
```

This runs the frontend (http://localhost:5173) and backend (http://localhost:4000) concurrently.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:server` | Backend only (with nodemon) |
| `npm run dev:client` | Frontend only (with Vite HMR) |
| `npm run build` | Build the client for production |
| `npm start` | Start the production server |

---

## Deployment

### Frontend (Vercel)

- **Root directory:** `client`
- **Framework:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variables:** Set `VITE_API_URL` to your Render backend URL

### Backend (Render)

- **Root directory:** `server`
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment variables:** All server env vars (use PUT to set all at once -- PUT replaces the entire set)

### Database (Supabase)

- Run `schema.sql` in the SQL Editor
- Enable Row Level Security on all tables
- Free tier works for development and small pools

### Deploy Trigger

```bash
# Trigger a Render deploy via API
curl -X POST -H "Authorization: Bearer YOUR_RENDER_API_KEY" \
  "https://api.render.com/v1/services/YOUR_SERVICE_ID/deploys"
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step guide covering Supabase setup, Render/Vercel configuration, custom domain DNS, invite link routing, and cost breakdown.

---

## Project Structure

```
.
├── client/                       # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx              # App entry point
│   │   ├── GolfPoolPro_v2.jsx    # Main UI component (~5200 lines, all views)
│   │   └── api.js                # API client (Auth, Pools, Draft, Invites, Golfers, Courses)
│   ├── index.html                # HTML shell
│   ├── .env.example
│   └── package.json
├── server/                       # Express backend
│   ├── index.js                  # Server entry, middleware, admin routes, cron jobs
│   ├── routes/
│   │   ├── auth.js               # Authentication (signup, login, password reset)
│   │   ├── pools.js              # Pool CRUD, chat, presence, member management
│   │   ├── draft.js              # Snake draft (pick, pause, resume, force-pick, auto-skip)
│   │   ├── invites.js            # Invite resolution and joining
│   │   ├── golfers.js            # Golfer field queries with auto-import
│   │   ├── scores.js             # Live tournament scores
│   │   ├── tournaments.js        # Upcoming tournament list with auto-seeding
│   │   ├── courses.js            # Course search and lookup
│   │   └── public.js             # Public leaderboard (no auth required)
│   ├── services/
│   │   ├── scoresSync.js         # Live score sync engine, multi-tour support, score normalization
│   │   └── tournamentSync.js     # Tournament schedule seeding from DataGolf
│   ├── middleware/
│   │   └── auth.js               # JWT verification (requireAuth, optionalAuth)
│   ├── schema.sql                # Database schema (server copy)
│   ├── .env.example
│   └── package.json
├── schema.sql                    # PostgreSQL schema (tables, RLS policies, views, indexes, triggers)
├── DEPLOYMENT.md                 # Full deployment guide
├── package.json                  # Root scripts (dev, build, start)
└── README.md                     # This file
```

---

## License

Private project. All rights reserved.
