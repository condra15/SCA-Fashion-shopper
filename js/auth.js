/**
 * Cleo Chrome Extension — Auth Module (Supabase)
 * ================================================
 *
 * Uses Supabase Auth for email/password authentication.
 * This means the Chrome extension shares the same user system as the iOS app.
 * Trial status, credits, and color season all sync across both platforms.
 *
 * SETUP:
 *   Replace SUPABASE_URL and SUPABASE_ANON_KEY below with your values from:
 *   Supabase Dashboard → Settings → API
 *
 * The anon key is safe to include in client-side code — Row Level Security
 * on Supabase prevents unauthorized access. This is the same key used in
 * the iOS app's SupabaseClient init.
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const SUPABASE_URL = "https://yutcsdqltdrexpmwmnio.supabase.co"; // ← Replace
const SUPABASE_ANON_KEY = "sb_publishable_DRtjWIbfpvy9Zdn0j4YmvQ_7E9y1R0x"; // ← Replace

// Your Render API (for color endpoints and trial status)
const API_BASE = "https://cleo-api-toq2.onrender.com";

// ─── Token Storage ───────────────────────────────────────────────────────────
// Store auth tokens in chrome.storage.local so they persist across popup opens.
// Unlike the old ExtPay system, these tokens are tied to a real email account —
// reinstalling the extension doesn't create a new identity.

async function getStoredSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["supabase_session"], (result) => {
      resolve(result.supabase_session || null);
    });
  });
}

async function storeSession(session) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ supabase_session: session }, resolve);
  });
}

async function clearSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["supabase_session"], resolve);
  });
}

// ─── Supabase Auth (REST API — no SDK needed) ───────────────────────────────
// We use Supabase's REST auth endpoints directly instead of the JS SDK
// because the SDK's auto-refresh and storage assume a normal browser
// environment, which doesn't work cleanly in Chrome extension popups.

/**
 * Sign up with email and password.
 * Creates a Supabase auth account + triggers the profiles table auto-create.
 */
async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description || data.msg || "Sign up failed");
  }

  // If email confirmation is required, data.access_token may be null
  if (data.access_token) {
    await storeSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      user: data.user,
    });
  }

  return data;
}

/**
 * Sign in with email and password.
 */
async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    // Could be a deleted account trying to sign in with old password
    // The password was randomized on delete, so they'll get "Invalid login credentials"
    throw new Error(data.error_description || data.msg || "Sign in failed");
  }

  await storeSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    user: data.user,
  });

  return data;
}

/**
 * Sign out — clears local session.
 */
async function signOut() {
  const session = await getStoredSession();
  if (session?.access_token) {
    // Best-effort server-side logout
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });
    } catch (e) {
      // Ignore — local clear is what matters
    }
  }
  await clearSession();
}

/**
 * Refresh the access token using the refresh token.
 * Supabase access tokens expire after 1 hour by default.
 */
async function refreshToken() {
  const session = await getStoredSession();
  if (!session?.refresh_token) {
    throw new Error("No refresh token available");
  }

  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    // Refresh token expired or revoked — user must sign in again
    await clearSession();
    throw new Error("Session expired. Please sign in again.");
  }

  await storeSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    user: data.user,
  });

  return data.access_token;
}

/**
 * Get a valid access token, refreshing if needed.
 * This is what script.js and other modules call before making API requests.
 */
async function getAccessToken() {
  const session = await getStoredSession();
  if (!session) {
    return null; // Not signed in
  }

  // Refresh if token expires in less than 5 minutes
  const FIVE_MINUTES = 5 * 60 * 1000;
  if (session.expires_at && Date.now() + FIVE_MINUTES >= session.expires_at) {
    try {
      return await refreshToken();
    } catch (e) {
      return null; // Session expired
    }
  }

  return session.access_token;
}

/**
 * Get the current user's info from the stored session.
 */
async function getCurrentUser() {
  const session = await getStoredSession();
  return session?.user || null;
}

/**
 * Check if user is currently signed in (has a valid session).
 */
async function isSignedIn() {
  const token = await getAccessToken();
  return token !== null;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────
// Authenticated requests to your Render API using the Supabase JWT.

/**
 * Make an authenticated request to the Cleo API.
 * Automatically attaches the Supabase JWT as a Bearer token.
 */
async function apiRequest(path, options = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not signed in");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Token rejected by server — clear local session
    await clearSession();
    throw new Error("Session expired. Please sign in again.");
  }

  return res;
}

/**
 * Get trial status from the server.
 * Used to determine if user gets free daily uses or needs to pay.
 */
async function getTrialStatus() {
  const res = await apiRequest("/api/ext/trial-status");
  if (!res.ok) {
    throw new Error("Failed to get trial status");
  }
  return res.json();
}

/**
 * Call a color analysis endpoint with authentication.
 * Used by script.js for the eyedropper feature.
 */
async function analyzeColor(hex, userSeason) {
  const res = await apiRequest("/api/seasonal-color-hex", {
    method: "POST",
    body: JSON.stringify({ hex, userSeason }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Color analysis failed");
  }

  return res.json();
}

// ─── Password Reset ──────────────────────────────────────────────────────────

/**
 * Request a password reset email.
 * Supabase sends the email automatically — no custom email setup needed.
 */
async function resetPassword(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error_description || "Password reset failed");
  }

  return true;
}

// ─── Exports ─────────────────────────────────────────────────────────────────
// These are imported by other extension scripts.

export {
  signUp,
  signIn,
  signOut,
  getAccessToken,
  getCurrentUser,
  isSignedIn,
  apiRequest,
  getTrialStatus,
  analyzeColor,
  resetPassword,
  API_BASE,
};
