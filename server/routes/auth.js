// server/routes/auth.js
// Uses Supabase Auth — we proxy it so the frontend never holds the service key

const router = require("express").Router();
const { createClient } = require("@supabase/supabase-js");
const { requireAuth } = require("../middleware/auth");

const supabaseAuth = () => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function pickStatusFromSupabaseMessage(message, fallback = 400) {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("rate limit")) return 429;
  if (msg.includes("invalid login") || msg.includes("invalid")) return 401;
  return fallback;
}

// ─── POST /api/auth/signup ────────────────────────────────────
// Body: { name, email, password }
router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password)
      return res.status(400).json({ error: "Name, email and password are required." });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))
      return res.status(400).json({ error: "Password must contain uppercase, lowercase, and a number." });

    const cleanEmail = email.trim().toLowerCase();
    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
      return res.status(400).json({ error: "Invalid email format." });
    const cleanName = name.trim().slice(0, 100); // Limit name length
    const admin = req.app.locals.supabase; // service-role client
    const sb = supabaseAuth(); // anon client for session creation

    // Create + auto-confirm so users can log in immediately (no email verification gate).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { name: cleanName },
    });
    if (createErr) {
      const msg = String(createErr.message || "").toLowerCase();
      if (msg.includes("rate limit")) {
        return res.status(429).json({ error: "Too many attempts. Please try again later." });
      }
      // SECURITY: Don't forward raw Supabase error (e.g. "User already registered")
      // as it enables user enumeration. Log it server-side for debugging.
      console.error("[signup] Supabase createUser error (suppressed):", createErr.message);
      return res.status(400).json({ error: "Signup failed. Please try again or use a different email." });
    }

    // Return a live session right away.
    const { data: signInData, error: signInErr } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (signInErr) {
      return res.status(201).json({
        user: { id: created.user.id, email: created.user.email, name: cleanName },
        session: null,
        message: "Account created. Please log in.",
      });
    }

    // Profile row is created by trigger, but query as best-effort for name/avatar.
    const { data: profile } = await admin
      .from("profiles")
      .select("name, avatar")
      .eq("id", created.user.id)
      .maybeSingle();

    res.status(201).json({
      user: {
        id: created.user.id,
        email: created.user.email,
        name: profile?.name || cleanName,
        avatar: profile?.avatar || null,
      },
      session: signInData.session,
      message: "Account created.",
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
      if (msg.includes("rate limit")) {
        return res.status(429).json({ error: "Too many attempts. Please try again later." });
      }
      // SECURITY: Always return the same generic message to prevent user enumeration
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Fetch profile
    const { data: profile } = await req.app.locals.supabase
      .from("profiles")
      .select("name, avatar")
      .eq("id", data.user.id)
      .maybeSingle();

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
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing token." });
    await sb.auth.admin.signOut(token);
    res.json({ message: "Logged out." });
  } catch (e) { next(e); }
});

// ─── POST /api/auth/refresh ───────────────────────────────────
// Body: { refreshToken }
router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = String(req.body?.refreshToken || "").trim();
    if (!refreshToken) return res.status(400).json({ error: "refreshToken is required." });

    const sb = supabaseAuth();
    const { data, error } = await sb.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session || !data?.user) {
      const status = pickStatusFromSupabaseMessage(error?.message, 401);
      return res.status(status).json({ error: error?.message || "Could not refresh session." });
    }

    const { data: profile } = await req.app.locals.supabase
      .from("profiles")
      .select("name, avatar")
      .eq("id", data.user.id)
      .maybeSingle();

    return res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile?.name || data.user.user_metadata?.name || data.user.email?.split("@")[0] || "User",
        avatar: profile?.avatar || null,
      },
      session: data.session,
    });
  } catch (e) { next(e); }
});

// ─── POST /api/auth/forgot-password ──────────────────────────
// Body: { email }
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const sb = supabaseAuth();
    // SECURITY: Never allow user-controlled redirectTo — always use the server's
    // configured SITE_URL to prevent open-redirect / phishing via reset emails.
    const redirectTo = `${process.env.SITE_URL}/reset-password`;
    // Always return 200 — don't reveal if email exists
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    // SECURITY: Always return 200 with the same message regardless of whether the
    // email exists or an error occurred. This prevents user enumeration attacks.
    // Only surface rate-limit errors so the client can back off.
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("rate limit")) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
      // Log the error server-side but don't expose it to the client
      console.error("[forgot-password] Supabase error (suppressed from client):", error.message);
    }
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
    if (!password || password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))
      return res.status(400).json({ error: "Password must contain uppercase, lowercase, and a number." });

    const admin = req.app.locals.supabase;
    const { error } = await admin.auth.admin.updateUserById(req.user.id, { password });
    if (error) return res.status(400).json({ error: error.message || "Could not update password." });

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
      .maybeSingle();
    if (error) {
      console.error("[/me] profile query error:", error.message);
      return res.status(500).json({ error: "Could not load profile." });
    }
    if (!profile) {
      return res.json({
        user: {
          id: req.user.id,
          name: req.user.email?.split("@")[0] || "User",
          avatar: null,
          email: req.user.email || "",
          created_at: null,
        },
      });
    }
    return res.json({ user: profile });
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
    if (error) {
      console.error("[PATCH /me] update error:", error.message);
      return res.status(400).json({ error: "Could not update profile." });
    }
    res.json({ user: data });
  } catch (e) { next(e); }
});

module.exports = router;
