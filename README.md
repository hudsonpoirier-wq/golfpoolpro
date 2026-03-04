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

Then fill in real Supabase and SportsDataIO keys in `server/.env`.

3. Start website (frontend + backend):

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

## Notes

- Frontend source entry: `client/src/main.jsx`
- Main UI component: `client/src/GolfPoolPro_v2.jsx`
- Backend API entry: `server/index.js`
- SQL schema: `server/schema.sql`
