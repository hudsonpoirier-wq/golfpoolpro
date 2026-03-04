// server/middleware/auth.js
// Verifies the Supabase JWT on protected routes

const { createClient } = require("@supabase/supabase-js");

const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * requireAuth — attaches req.user = { id, email } or returns 401
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header." });
  }
  const token = header.slice(7);
  const { data, error } = await supabasePublic.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
  req.user = { id: data.user.id, email: data.user.email };
  next();
}

/**
 * optionalAuth — attaches req.user if token is present, otherwise continues
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return next();
  const token = header.slice(7);
  const { data } = await supabasePublic.auth.getUser(token);
  if (data?.user) req.user = { id: data.user.id, email: data.user.email };
  next();
}

module.exports = { requireAuth, optionalAuth };
