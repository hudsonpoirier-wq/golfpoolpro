// src/api.js
// ============================================================
// Central API client for MyGolfPoolPro
// All calls to the backend go through this file.
// Swap API_BASE to your deployed URL before publishing.
// ============================================================

const env = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env;
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env;
  }
  return {};
})();

const API_BASE =
  env.VITE_API_URL ||
  env.REACT_APP_API_URL ||
  "https://api.mygolfpoolpro.com";

// ─── Auth token management ────────────────────────────────────
const tokenKey = "mgpp_token";
const sessionKey = "mgpp_user";

export const token = {
  get: () => localStorage.getItem(tokenKey),
  set: (t) => localStorage.setItem(tokenKey, t),
  clear: () => { localStorage.removeItem(tokenKey); localStorage.removeItem(sessionKey); },
};

export const session = {
  get: () => { try { return JSON.parse(localStorage.getItem(sessionKey)); } catch { return null; } },
  set: (u) => localStorage.setItem(sessionKey, JSON.stringify(u)),
};

// ─── Base fetch wrapper ───────────────────────────────────────
async function api(method, path, body = null, authed = true) {
  const headers = { "Content-Type": "application/json" };
  if (authed) {
    const t = token.get();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${API_BASE}${path}`, opts);
  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const err = new Error(data.error || `Request failed (${resp.status})`);
    err.status = resp.status;
    throw err;
  }
  return data;
}

const get  = (path, authed = true) => api("GET", path, null, authed);
const post = (path, body, authed = true) => api("POST", path, body, authed);
const patch = (path, body) => api("PATCH", path, body);
const del  = (path) => api("DELETE", path);


// ════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════

export const Auth = {
  /** Sign up a new account */
  signup: async ({ name, email, password }) => {
    const data = await post("/api/auth/signup", { name, email, password }, false);
    if (data.session?.access_token) {
      token.set(data.session.access_token);
      session.set(data.user);
    }
    return data;
  },

  /** Log in */
  login: async ({ email, password }) => {
    const data = await post("/api/auth/login", { email, password }, false);
    if (data.session?.access_token) {
      token.set(data.session.access_token);
      session.set(data.user);
    }
    return data;
  },

  /** Log out */
  logout: async () => {
    try { await post("/api/auth/logout"); } catch {}
    token.clear();
  },

  /** Send password reset email */
  forgotPassword: (email) =>
    post("/api/auth/forgot-password", { email }, false),

  /** Reset password (called after user clicks email link — token already set) */
  resetPassword: (password) =>
    post("/api/auth/reset-password", { password }),

  /** Get current user profile */
  me: () => get("/api/auth/me"),

  /** Update profile */
  updateProfile: (updates) => patch("/api/auth/me", updates),

  /** Update password from settings panel */
  updatePassword: (newPassword) =>
    post("/api/auth/reset-password", { password: newPassword }),
};


// ════════════════════════════════════════════════════════════
// POOLS
// ════════════════════════════════════════════════════════════

export const Pools = {
  /** Get all pools the current user is in */
  list: () => get("/api/pools"),

  /** Get full pool details, members, picks, standings */
  get: (poolId) => get(`/api/pools/${poolId}`),

  /** Create a new pool */
  create: (poolData) => post("/api/pools", poolData),

  /** Update pool settings (host only) */
  update: (poolId, updates) => patch(`/api/pools/${poolId}`, updates),

  /** Delete pool (host only) */
  delete: (poolId) => del(`/api/pools/${poolId}`),

  /** Toggle ready status */
  setReady: (poolId, is_ready) => patch(`/api/pools/${poolId}/ready`, { is_ready }),

  /** Get live standings */
  standings: (poolId) => get(`/api/pools/${poolId}/standings`),
};


// ════════════════════════════════════════════════════════════
// INVITES
// ════════════════════════════════════════════════════════════

export const Invites = {
  /**
   * Resolve an invite token → pool preview
   * Called when user lands on invite link (no auth required)
   */
  resolve: (token) => get(`/api/invite/${token}`, false),

  /** Join a pool using an invite token (requires auth) */
  join: (token) => post(`/api/invite/${token}/join`, {}),

  /**
   * Build the shareable invite URL for a pool
   * This is what you put in Copy Link buttons
   */
  buildUrl: (pool) => {
    const base =
      env.VITE_SITE_URL ||
      env.REACT_APP_SITE_URL ||
      "https://mygolfpoolpro.com";
    return `${base}/#/join/${pool.invite_token}`;
  },

  /** Regenerate invite token (invalidates old links) */
  regenerate: (poolId) => post(`/api/invite/pools/${poolId}/regenerate`),
};


// ════════════════════════════════════════════════════════════
// GOLFERS & SCORES
// ════════════════════════════════════════════════════════════

export const Golfers = {
  /** Get full field for a tournament */
  list: (tournamentId) => get(`/api/golfers?tournament=${tournamentId}`, false),

  /** Get live leaderboard scores for a tournament */
  scores: (tournamentId) => get(`/api/scores/${tournamentId}`, false),
};


// ════════════════════════════════════════════════════════════
// DRAFT
// ════════════════════════════════════════════════════════════

export const Draft = {
  /** Get current draft state */
  state: (poolId) => get(`/api/draft/${poolId}`),

  /** Make a draft pick */
  pick: (poolId, golferId) => post(`/api/draft/${poolId}/pick`, { golferId }),
};


// ════════════════════════════════════════════════════════════
// HASH ROUTING — invite link detection
// ════════════════════════════════════════════════════════════

/**
 * Call this on app mount to detect invite links.
 * Returns { type: "invite", token: "abc123" } or null.
 *
 * Usage in your React component:
 *   useEffect(() => {
 *     const route = detectHashRoute();
 *     if (route?.type === "invite") handleInvite(route.token);
 *   }, []);
 */
export function detectHashRoute() {
  const hash = window.location.hash;
  const m = hash.match(/^#\/join\/([a-z0-9]+)$/i);
  if (m) return { type: "invite", token: m[1] };
  return null;
}

/** Clear the hash after handling (keeps browser history clean) */
export function clearHash() {
  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
