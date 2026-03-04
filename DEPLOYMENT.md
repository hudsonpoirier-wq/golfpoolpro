# MyGolfPoolPro — Full Stack Deployment Guide

This guide takes you from zero to a live, production website.
Estimated time: 2–3 hours if you follow each step.

---

## Architecture Overview

```
Browser (React)
    ↕  HTTPS
Vercel (Frontend)           ← mygolfpoolpro.com
    ↕  HTTPS API calls
Render (Express API)        ← api.mygolfpoolpro.com
    ↕  Supabase client
Supabase (Postgres + Auth)  ← your-project.supabase.co
    ↕  cron every 30s
SportsDataIO (Golf scores)  ← external API
```

---

## Step 1 — Supabase (Database + Auth)

### 1.1 Create a project
1. Go to https://supabase.com and sign up (free tier works fine)
2. Click **New Project**
3. Name it `mygolfpoolpro`, pick the region closest to your users
4. Save your database password somewhere safe

### 1.2 Run the schema
1. In your Supabase dashboard, click **SQL Editor**
2. Open the file `/supabase/schema.sql` from this repo
3. Paste the entire file and click **Run**
4. Verify tables were created under **Table Editor**

### 1.3 Enable Email Auth
1. Go to **Authentication > Providers**
2. Make sure **Email** is enabled
3. Under **Email Templates**, customize the invite/reset emails with your branding

### 1.4 Configure redirect URLs
1. Go to **Authentication > URL Configuration**
2. Add these under **Redirect URLs**:
   - `https://mygolfpoolpro.com/verify-email`
   - `https://mygolfpoolpro.com/reset-password`
   - `http://localhost:3000/verify-email` (for local dev)
   - `http://localhost:3000/reset-password` (for local dev)

### 1.5 Get your API keys
1. Go to **Settings > API**
2. Copy and save:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY` (**keep this secret**)

---

## Step 2 — Golf Data API (SportsDataIO)

### 2.1 Sign up
1. Go to https://sportsdata.io/golf and create an account
2. The **free tier** gives you 1,000 API calls/month — enough for testing
3. For a live season you want the **Golf v2** paid plan (~$79/mo)
   which gives you real-time scores and strokes gained data

### 2.2 Get tournament IDs
Once you have your API key, run this to get all 2026 PGA Tour tournament IDs:

```bash
curl "https://api.sportsdata.io/golf/v2/json/Tournaments/2026?key=YOUR_KEY"
```

Update the `tournamentIdMap` in `/server/services/scoresSync.js` with the real IDs.

### 2.3 Seed your golfers table
After deploying the backend, call this endpoint once to populate all golfer data:

```bash
curl -X POST https://api.mygolfpoolpro.com/api/admin/seed-golfers \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN"
```

---

## Step 3 — Backend (Render)

### 3.1 Push code to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/mygolfpoolpro.git
git push -u origin main
```

### 3.2 Deploy to Render
1. Go to https://render.com and sign in with GitHub
2. Click **New > Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `mygolfpoolpro-api`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (fine for MVP, upgrade to $7/mo for always-on)

### 3.3 Add environment variables on Render
Go to your service > **Environment** tab and add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Your Supabase service role key |
| `SITE_URL` | `https://mygolfpoolpro.com` |
| `ALLOWED_ORIGINS` | `https://mygolfpoolpro.com,https://www.mygolfpoolpro.com` |
| `SPORTS_DATA_IO_KEY` | Your SportsDataIO key |

### 3.4 Set your custom domain
1. In Render, go to **Settings > Custom Domains**
2. Add `api.mygolfpoolpro.com`
3. Add the CNAME record to your DNS provider as shown

### 3.5 Verify it works
```bash
curl https://api.mygolfpoolpro.com/api/health
# Should return: {"status":"ok","ts":"2026-..."}
```

---

## Step 4 — Frontend (Vercel)

### 4.1 Deploy to Vercel
1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New Project**
3. Import your GitHub repo
4. Configure:
   - **Framework**: Create React App
   - **Root Directory**: `/` (or wherever your React code is)
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

### 4.2 Add environment variables on Vercel
Go to **Settings > Environment Variables** and add:

| Key | Value |
|-----|-------|
| `REACT_APP_API_URL` | `https://api.mygolfpoolpro.com` |
| `REACT_APP_SITE_URL` | `https://mygolfpoolpro.com` |
| `REACT_APP_SUPABASE_URL` | Your Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Your Supabase anon key |

### 4.3 Configure SPA routing (critical for invite links)
Create a `vercel.json` in your project root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This ensures that `/` is always served your React app,
so `#/join/abc123` hash routes work correctly.

### 4.4 Set your custom domain
1. In Vercel, go to **Settings > Domains**
2. Add `mygolfpoolpro.com` and `www.mygolfpoolpro.com`
3. Update your DNS:
   - `@` → A record → `76.76.21.21` (Vercel's IP)
   - `www` → CNAME → `cname.vercel-dns.com`

---

## Step 5 — Domain (Namecheap / GoDaddy / Cloudflare)

If you don't own `mygolfpoolpro.com` yet:

1. Buy it at https://namecheap.com (~$12/year for .com)
2. Set nameservers to Cloudflare for free DNS + SSL + DDoS protection:
   - Sign up at https://cloudflare.com (free plan)
   - Add your domain, copy the nameservers
   - Update nameservers at Namecheap
3. In Cloudflare, add these DNS records:
   ```
   A     @          76.76.21.21        (Vercel — frontend)
   CNAME www        cname.vercel-dns.com
   CNAME api        your-render-url.onrender.com  (backend)
   ```

---

## Step 6 — Wire up the React frontend

Once you have your backend URL, update the frontend to use the real API client.

### 6.1 Install the API client
Copy `/src/api.js` from this repo into your React `src/` folder.

### 6.2 Replace mock auth in your component

**Login:**
```jsx
import { Auth, session } from "./api";

const handleLogin = async () => {
  try {
    const { user } = await Auth.login({ email: authEmail, password: authPass });
    setCurrentUser(user.id);
    if (invitePool) {
      await Invites.join(invitePool.invite_token);
      setView("pool");
    } else setView("home");
  } catch (err) {
    setAuthError(err.message);
  }
};
```

**Signup:**
```jsx
const handleSignup = async () => {
  try {
    const { user } = await Auth.signup({ name: authName, email: authEmail, password: authPass });
    setCurrentUser(user.id);
    if (invitePool) await Invites.join(invitePool.invite_token);
    setView(invitePool ? "pool" : "home");
  } catch (err) {
    setAuthError(err.message);
  }
};
```

**Detect invite link on mount:**
```jsx
useEffect(() => {
  const route = detectHashRoute();
  if (route?.type === "invite") {
    Invites.resolve(route.token).then(({ pool }) => {
      openInvite(pool);
    }).catch(() => {
      notify("This invite link is invalid or expired.", "error");
    });
    clearHash();
  }
}, []);
```

**Load pools:**
```jsx
useEffect(() => {
  if (!currentUser) return;
  Pools.list().then(({ pools }) => setPools(pools));
}, [currentUser]);
```

**Copy invite link:**
```jsx
const inviteUrl = Invites.buildUrl(activePool);
navigator.clipboard.writeText(inviteUrl);
```

### 6.3 Persist session across page refreshes
```jsx
// On app mount, restore session
useEffect(() => {
  const savedUser = session.get();
  const savedToken = token.get();
  if (savedUser && savedToken) {
    // Verify token is still valid
    Auth.me().then(({ user }) => setCurrentUser(user.id))
             .catch(() => token.clear());
  }
}, []);
```

---

## Step 7 — How invite links work end-to-end

Here's the exact flow when someone clicks an invite link:

```
1. Host copies link:  https://mygolfpoolpro.com/#/join/a1b2c3
                      (a1b2c3 is pool.invite_token from Supabase)

2. Recipient opens link → React app loads

3. App mount:  detectHashRoute() → { type: "invite", token: "a1b2c3" }

4. App calls:  GET /api/invite/a1b2c3
               → Returns pool preview (name, tournament, host, spots left)

5. App shows:  Auth screen with "You've been invited to [Pool Name]"

6. User logs in or creates account

7. On success: POST /api/invite/a1b2c3/join
               → Adds user to pool_members table
               → Returns { poolId: "p..." }

8. App navigates: setActivePool(pool) → setView("pool")

9. User is now in the pool lobby ✅
```

---

## Step 8 — Per-user stats (already built in the UI)

The stats panel already reads `currentUser` to show personalized views.
Once you wire up the real API:

- Each user sees **their own team** in the Overview tab
- `getPoolTeam(userId)` looks up `draft_picks` filtered by `user_id`
- Pool standings come from the `pool_standings` view which computes each user's score

For real personalization at scale, add a `user_preferences` table:

```sql
create table public.user_preferences (
  user_id     uuid primary key references public.profiles(id),
  fav_golfers int[],           -- golfer IDs they want to track
  notif_email boolean default true,
  notif_picks boolean default true,
  updated_at  timestamptz default now()
);
```

---

## Cost Summary

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Vercel | Hobby (free) | $0 |
| Render | Free (spins down after inactivity) | $0 |
| Render | Starter (always-on) | $7 |
| Supabase | Free tier (500MB, 50k auth users) | $0 |
| Supabase | Pro (8GB, unlimited auth) | $25 |
| SportsDataIO | Free (1k calls/mo) | $0 |
| SportsDataIO | Golf v2 (real-time) | $79 |
| Domain (.com) | Namecheap | ~$1/mo |
| Cloudflare | Free | $0 |
| **Total MVP** | | **~$1/mo** |
| **Total Live Season** | | **~$112/mo** |

---

## Quick Reference — API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |
| POST | `/api/auth/forgot-password` | Send reset email |
| GET  | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/me` | Update profile |
| GET  | `/api/pools` | My pools |
| POST | `/api/pools` | Create pool |
| GET  | `/api/pools/:id` | Pool details |
| PATCH | `/api/pools/:id` | Update pool |
| DELETE | `/api/pools/:id` | Delete pool |
| PATCH | `/api/pools/:id/ready` | Set ready status |
| GET  | `/api/invite/:token` | Resolve invite |
| POST | `/api/invite/:token/join` | Join via invite |
| GET  | `/api/draft/:poolId` | Draft state |
| POST | `/api/draft/:poolId/pick` | Make a pick |
| GET  | `/api/scores/:tournamentId` | Live scores |
| GET  | `/api/golfers` | Tournament field |

---

## Need Help?

- **Supabase docs**: https://supabase.com/docs
- **Render deploy docs**: https://render.com/docs/deploy-node-express-app
- **Vercel docs**: https://vercel.com/docs/frameworks/create-react-app
- **SportsDataIO Golf API**: https://sportsdata.io/developers/api-documentation/golf
