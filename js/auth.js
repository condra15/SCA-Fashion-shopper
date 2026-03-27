/**
 * Kisari Chrome Extension — Auth Module (Supabase)
 * ================================================
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const SUPABASE_URL = "https://yutcsdqltdrexpmwmnio.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DRtjWIbfpvy9Zdn0j4YmvQ_7E9y1R0x";

// Your Render API (for color endpoints and account management)
const API_BASE = "https://cleo-api-toq2.onrender.com";

// ─── Token Storage ───────────────────────────────────────────────────────────

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

async function signOut() {
  const session = await getStoredSession();
  if (session?.access_token) {
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

async function getAccessToken() {
  const session = await getStoredSession();
  if (!session) {
    return null;
  }

  const FIVE_MINUTES = 5 * 60 * 1000;
  if (session.expires_at && Date.now() + FIVE_MINUTES >= session.expires_at) {
    try {
      return await refreshToken();
    } catch (e) {
      return null;
    }
  }

  return session.access_token;
}

async function getCurrentUser() {
  const session = await getStoredSession();
  return session?.user || null;
}

async function isSignedIn() {
  const token = await getAccessToken();
  return token !== null;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

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
    await clearSession();
    throw new Error("Session expired. Please sign in again.");
  }

  return res;
}

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

export {
  signUp,
  signIn,
  signOut,
  getAccessToken,
  getCurrentUser,
  isSignedIn,
  apiRequest,
  analyzeColor,
  resetPassword,
  API_BASE,
};
