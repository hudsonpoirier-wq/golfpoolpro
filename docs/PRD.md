# GolfPoolPro Product Requirements

## Product Vision
GolfPoolPro is a premium, real-time golf pool platform that replaces manual spreadsheets with a controlled, transparent, and analytically rich competition experience.

## Primary Personas
- Pool Administrator: Configures rules, manages access, starts draft, selects tournament.
- Participant: Joins via invite, drafts golfers, tracks performance live.
- Spectator/Analyst: Follows standings and probability shifts in real time.

## Core Requirements

### 1) Admin-Controlled Pool Architecture
- Admin sets:
  - Participant capacity
  - Team roster size
  - Cut line threshold (minimum golfers making cut for eligibility)
  - Shot clock duration per draft pick
- Admin selects one future tournament from a dropdown containing future events.

### 2) Dual-Link Entry Flow
- System generates invitation link for account registration (email/password).
- After participant field is finalized, system generates lobby link for direct pool access.

### 3) Real-Time Draft Engine
- Live draft order board with current pick context.
- Available golfer pool updates immediately after each pick.
- Shot clock enforced per pick; expiration rules configurable in future iterations.

### 4) Live Tournament Analytics Hub
- Integrates live scoring data API.
- Tracks team scoring by round/hole.
- Updates standings immediately when player scores change.
- Shows projected outcomes and individual golfer metrics.

## UX Direction
- Modern, soft color system.
- Rounded shapes and low-contrast borders.
- No harsh visual lines.
- Prioritize clarity under live conditions (draft and scoring updates).

## Non-Functional Requirements
- Low-latency updates (target <2s for score propagation).
- Deterministic rule application for eligibility and scoring.
- Auditable pick history and configuration logs.
- Secure auth and role-based authorization.

## MVP Scope (This Starter)
- Admin settings UI and API
- Future tournament dropdown API
- Dual-link generation
- Draft board and pick actions
- Live updates through SSE
- Live leaderboard module

## Post-MVP Priorities
- Persistent storage (PostgreSQL)
- Full auth flow and invitation lifecycle
- Provider-backed tournament sync (PGA/DP World feeds)
- Advanced analytics: win probability models and hole-level breakdown charts
