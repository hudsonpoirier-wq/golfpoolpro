// server/routes/auth.js
// Uses Supabase Auth — we proxy it so the frontend never holds the service key

const router = require("express").Router();
const { createClient } = require("@supabase/supabase-js");
const { requireAuth } = require("../middleware/auth");

const supabaseAuth = () => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── POST /api/auth/signup ────────────────────────────────────
// Body: { name, email, password }
router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password)
      return res.status(400).json({ error: "Name, email and password are required." });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const sb = supabaseAuth();
    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: `${process.env.SITE_URL}/verify-email`,
      },
    });
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      const status = msg.includes("rate limit") ? 429 : 400;
      return res.status(status).json({ error: error.message || "Signup failed." });
    }

    res.status(201).json({
      user: { id: data.user.id, email: data.user.email, name: name.trim() },
      session: data.session,
      message: "Account created! Check your email to verify your address.",
    });
  } catch (e) { next(e); }
});

// ─── POST /api/auth/login ─────────────────────────────────────
// Body: { email, password }
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const sb = supabaseAuth();
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      const status = msg.includes("rate limit") ? 429 : 401;
      return res.status(status).json({ error: error.message || "Invalid email or password." });
    }

    // Fetch profile
    const { data: profile } = await req.app.locals.supabase
      .from("profiles")
      .select("name, avatar")
      .eq("id", data.user.id)
      .single();

    res.json({
      user: { id: data.user.id, email: data.user.email, ...profile },
      session: data.session,  // contains access_token + refresh_token
    });
  } catch (e) { next(e); }
});

// ─── POST /api/auth/logout ────────────────────────────────────
router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const sb = supabaseAuth();
    const token = req.headers.authorization.slice(7);
    await sb.auth.admin.signOut(token);
    res.json({ message: "Logged out." });
  } catch (e) { next(e); }
});

// ─── POST /api/auth/forgot-password ──────────────────────────
// Body: { email }
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const sb = supabaseAuth();
    // Always return 200 — don't reveal if email exists
    await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${process.env.SITE_URL}/reset-password`,
    });
    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (e) {
    const msg = String(e?.message || "").toLowerCase();
    if (msg.includes("rate limit")) {
      return res.status(429).json({ error: e.message || "Rate limit exceeded." });
    }
    next(e);
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────
// Body: { password }  (called after user clicks reset link — token in Auth header)
router.post("/reset-password", requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const sb = supabaseAuth();
    const { error } = await sb.auth.updateUser({ password });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Password updated successfully." });
  } catch (e) { next(e); }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { data: profile, error } = await req.app.locals.supabase
      .from("profiles")
      .select("id, name, avatar, email, created_at")
      .eq("id", req.user.id)
      .single();
    if (error || !profile) return res.status(404).json({ error: "Profile not found." });
    res.json({ user: profile });
  } catch (e) { next(e); }
});

// ─── PATCH /api/auth/me ───────────────────────────────────────
// Body: { name?, avatar? }
router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const { name, avatar } = req.body;
    const updates = {};
    if (name?.trim()) updates.name = name.trim();
    if (avatar?.trim()) updates.avatar = avatar.trim().toUpperCase().slice(0, 2);

    const { data, error } = await req.app.locals.supabase
      .from("profiles")
      .update(updates)
      .eq("id", req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ user: data });
  } catch (e) { next(e); }
});

module.exports = router;
