# GolfPoolPro Architecture (Starter + Production Path)

## Starter Runtime
- Backend: Node.js HTTP server (`server.js`)
- Frontend: Vanilla JS/CSS (`public/`)
- Real-time transport: Server-Sent Events (`/api/stream`)
- State: In-memory objects

## Core Domains
- Pool Config
- Tournament Catalog (future events)
- Invitation/Lobby Access Links
- Draft State and Pick Log
- Team and Leaderboard Analytics

## API Design (Current)
- Config:
  - `GET /api/admin/config`
  - `POST /api/admin/config`
- Tournaments:
  - `GET /api/tournaments/future`
- Access:
  - `GET /api/pool/links`
  - `POST /api/pool/links`
- Draft:
  - `POST /api/draft/start`
  - `GET /api/draft/state`
  - `POST /api/draft/pick`
- Scoring:
  - `GET /api/leaderboard`
  - `GET /api/stream`

## Recommended Production Architecture
- Frontend: React/Next.js app with websocket client
- Backend API: Node/Nest/Fastify service
- Real-time: WebSocket gateway + Redis pub/sub
- Data: PostgreSQL (transactional state), Redis (hot state/cache)
- Background workers: tournament ingestion and scoring recompute jobs

## Suggested Data Model
- `users` (auth + role)
- `pools` (admin config + tournament binding)
- `pool_members`
- `teams`
- `team_golfers`
- `draft_picks`
- `tournaments`
- `tournament_players`
- `hole_scores`
- `team_snapshots`

## Real-Time Update Flow
1. Tournament API publishes score changes.
2. Ingestion worker normalizes and writes updates.
3. Scoring engine recalculates team totals and eligibility.
4. New leaderboard snapshot broadcast to pool channels.
5. Frontend updates tables/charts and projections.

## Operational Requirements
- Observability: event lag, scoring job duration, stream fanout health.
- Reliability: idempotent ingestion and replay-safe processing.
- Security: signed invite tokens, expiring lobby links, RBAC checks.
