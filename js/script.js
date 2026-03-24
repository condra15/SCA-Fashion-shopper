/**
 * Cleo Chrome Extension — Main Script
 * Supabase Auth + Hybrid Weekly Counter + New Compact UI
 */

import { isSignedIn, analyzeColor, apiRequest } from "./auth.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FREE_WEEKLY = 25;

// Season order must match SVG segment order (seg-0 through seg-11)
const SEASONS_ORDER = [
  "Bright Spring",
  "True Spring",
  "Light Spring",
  "Light Summer",
  "True Summer",
  "Soft Summer",
  "Soft Autumn",
  "True Autumn",
  "Dark Autumn",
  "Dark Winter",
  "True Winter",
  "Bright Winter",
];

// Default season colors for the wheel (used to restore after result)
const SEASON_COLORS = {
  "Bright Spring": "#FF6F61",
  "True Spring": "#FFB830",
  "Light Spring": "#FFDAB3",
  "Light Summer": "#A8C8E8",
  "True Summer": "#C4A0B0",
  "Soft Summer": "#B0A8C0",
  "Soft Autumn": "#C4B08C",
  "True Autumn": "#C07040",
  "Dark Autumn": "#7A6030",
  "Dark Winter": "#3C3060",
  "True Winter": "#4060A8",
  "Bright Winter": "#D03070",
};

// Segments with dark fills need white text by default
const DARK_SEGMENTS = [
  "True Autumn",
  "Dark Autumn",
  "Dark Winter",
  "True Winter",
  "Bright Winter",
];

// ─── State ───────────────────────────────────────────────────────────────────

let accessLevel = "none";
let freeCounter = 0;

// ─── DOM References ──────────────────────────────────────────────────────────

const seasonSelect = document.getElementById("seasonSelect");
const dropperBtn = document.getElementById("dropperBtn");
const resultBox = document.getElementById("result-box");
const resultHex = document.getElementById("result-hex");
const resultRating = document.getElementById("result-rating");
const resultSeason = document.getElementById("result-season");
const resultEmpty = document.getElementById("result-empty");
const counterDisplay = document.getElementById("counter");

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Load saved season
  const { savedSeason } = await chrome.storage.local.get("savedSeason");
  if (savedSeason && seasonSelect) {
    seasonSelect.value = savedSeason;
  }

  if (seasonSelect) {
    seasonSelect.addEventListener("change", () => {
      chrome.storage.local.set({ savedSeason: seasonSelect.value });
    });
  }

  // Apply default dark-label classes
  DARK_SEGMENTS.forEach((season) => {
    const idx = SEASONS_ORDER.indexOf(season);
    const lbl = document.getElementById(`lbl-${idx}`);
    if (lbl) lbl.classList.add("on-dark");
  });

  await checkAccessLevel();
  updateCounterDisplay();

  if (dropperBtn) {
    dropperBtn.addEventListener("click", initDropper);
  }

  // Restore last result if available
  const { lastResult } = await chrome.storage.local.get("lastResult");
  if (lastResult) {
    showResult(lastResult.hex, lastResult.result);
  }
});

// ─── Access Level ────────────────────────────────────────────────────────────

async function checkAccessLevel() {
  const signedIn = await isSignedIn();
  if (!signedIn) {
    accessLevel = "none";
    return;
  }

  try {
    // Use account-status (extension-specific) instead of trial-status (iOS)
    const res = await apiRequest("/api/ext/account-status");
    if (!res.ok) throw new Error("Server returned " + res.status);
    const status = await res.json();

    const plan = status.subscription_plan || "free";

    if (plan === "monthly" || plan === "yearly" || plan === "lifetime") {
      accessLevel = "paid";
    } else {
      accessLevel = "free";
      // Use the server-provided remaining count directly
      freeCounter = status.weekly_remaining ?? MAX_FREE_WEEKLY;
      // Cache it locally
      await chrome.storage.local.set({
        freeCounterCache: {
          remaining: freeCounter,
          resets_at: status.resets_at,
          fetchedAt: Date.now(),
        },
      });
    }
  } catch (err) {
    console.error("Failed to check access level:", err);
    accessLevel = "free";
    await loadFreeCounterFromLocal();
  }
}

// ─── Hybrid Weekly Counter ───────────────────────────────────────────────────

async function loadFreeCounterFromServer() {
  try {
    const res = await apiRequest("/api/ext/weekly-status");
    if (!res.ok) throw new Error("Server returned " + res.status);
    const data = await res.json();
    freeCounter = data.remaining;
    await chrome.storage.local.set({
      freeCounterCache: {
        remaining: freeCounter,
        resets_at: data.resets_at,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error("Could not load weekly status from server:", err);
    await loadFreeCounterFromLocal();
  }
}

async function loadFreeCounterFromLocal() {
  const { freeCounterCache } =
    await chrome.storage.local.get("freeCounterCache");
  if (freeCounterCache && freeCounterCache.resets_at) {
    const resetsAt = new Date(freeCounterCache.resets_at).getTime();
    if (Date.now() < resetsAt) {
      freeCounter = freeCounterCache.remaining;
    } else {
      freeCounter = MAX_FREE_WEEKLY;
    }
  } else {
    freeCounter = MAX_FREE_WEEKLY;
  }
}

async function useFreeClick() {
  if (freeCounter <= 0) return false;
  freeCounter--;

  // Update local cache immediately
  const cache = (await chrome.storage.local.get("freeCounterCache"))
    ?.freeCounterCache;
  await chrome.storage.local.set({
    freeCounterCache: {
      remaining: freeCounter,
      resets_at: cache?.resets_at,
      fetchedAt: Date.now(),
    },
  });
  updateCounterDisplay();

  // Update server in background — fire and forget, don't await
  apiRequest("/api/ext/weekly-use", { method: "POST" }).catch((err) =>
    console.error("Failed to record weekly use:", err),
  );

  return true;
}

function updateCounterDisplay() {
  if (!counterDisplay) return;
  if (accessLevel === "paid" || accessLevel === "trial") {
    counterDisplay.textContent = "Unlimited";
  } else if (accessLevel === "free") {
    counterDisplay.textContent = `${freeCounter} / ${MAX_FREE_WEEKLY} this week`;
  } else {
    counterDisplay.textContent = "Sign in to use";
  }
}

function canAnalyze() {
  if (accessLevel === "paid" || accessLevel === "trial") return true;
  if (accessLevel === "free" && freeCounter > 0) return true;
  return false;
}

// ─── Dropper ─────────────────────────────────────────────────────────────────

async function initDropper() {
  if (accessLevel === "none") {
    showMessage("Please sign in to use color analysis.");
    return;
  }
  if (!canAnalyze()) {
    showMessage("No uses left this week. Upgrade for unlimited!");
    return;
  }

  const userSeason = seasonSelect?.value;
  if (!userSeason) {
    showMessage("Select your color season first.");
    return;
  }

  try {
    const eyeDropper = new EyeDropper();
    const result = await eyeDropper.open();
    const hex = result.sRGBHex;

    showLoading();

    const data = await analyzeColor(hex, userSeason);

    if (accessLevel === "free") {
      await useFreeClick();
    }

    showResult(hex, data.result);

    // Save for persistence across popup reopens
    await chrome.storage.local.set({
      lastResult: { hex, result: data.result },
    });
  } catch (err) {
    if (err.message === "The user canceled the selection.") return;
    if (err.message?.includes("sign in")) {
      showMessage("Session expired. Please sign in again.");
    } else {
      showMessage("Could not analyze color. Try again.");
    }
    console.error("Dropper error:", err);
  }
}

// ─── UI: Result Display ──────────────────────────────────────────────────────

function showResult(hex, result) {
  if (!resultBox) return;

  const season = result.colorSeason || "Unknown";
  const compatibility = result.compatibility || "";

  // Determine text color based on luminance
  const textColor = isLightColor(hex) ? "#000" : "#fff";
  const subtleColor = isLightColor(hex)
    ? "rgba(0,0,0,0.4)"
    : "rgba(255,255,255,0.6)";

  // Fill result box with picked color
  resultBox.style.backgroundColor = hex;
  resultBox.classList.remove("loading");
  resultBox.classList.add("has-result");

  resultHex.textContent = hex.toUpperCase();
  resultHex.style.color = subtleColor;

  resultRating.textContent = compatibility || season;
  resultRating.style.color = textColor;

  if (compatibility) {
    resultSeason.textContent = `✦ ${season}`;
    resultSeason.style.color = subtleColor;
  } else {
    resultSeason.textContent = "";
  }

  // Update wheel
  updateWheel(season, hex);
}

function showLoading() {
  if (!resultBox) return;
  resultBox.classList.add("loading");
  resultBox.classList.remove("has-result");
  resultBox.style.backgroundColor = "";
  resultRating.textContent = "";
  resultSeason.textContent = "";
  resultHex.textContent = "";
}

function showMessage(text) {
  if (!resultBox) return;
  resultBox.classList.remove("loading", "has-result");
  resultBox.style.backgroundColor = "";
  resultRating.style.display = "none";
  resultSeason.textContent = "";
  resultHex.textContent = "";
  resultEmpty.textContent = text;
  resultEmpty.style.display = "block";

  // Reset after showing message so it acts as empty state
  setTimeout(() => {
    resultRating.style.display = "";
    resultEmpty.textContent = "Pick a color to analyze";
  }, 3000);
}

// ─── UI: Wheel Update ────────────────────────────────────────────────────────

function updateWheel(season, hex) {
  const seasonIdx = SEASONS_ORDER.indexOf(season);

  SEASONS_ORDER.forEach((s, i) => {
    const seg = document.getElementById(`seg-${i}`);
    const lbl = document.getElementById(`lbl-${i}`);

    if (i === seasonIdx) {
      // Active segment: fill with picked color
      seg.setAttribute("fill", hex);
      seg.setAttribute("opacity", "1");
      seg.setAttribute("stroke", "#2c1f2e");
      seg.setAttribute("stroke-width", "1.5");

      // Label color: black or white based on picked color
      lbl.setAttribute("fill", isLightColor(hex) ? "#2c1f2e" : "#fff");
      lbl.classList.remove("faded");
      lbl.classList.add("active");
    } else {
      // Inactive: restore default color, fade
      seg.setAttribute("fill", SEASON_COLORS[s]);
      seg.setAttribute("opacity", "0.4");
      seg.removeAttribute("stroke");
      seg.removeAttribute("stroke-width");

      lbl.setAttribute("fill", "#b8a8be");
      lbl.classList.add("faded");
      lbl.classList.remove("active");
    }
  });

  // Center circle: fill with picked color
  const center = document.getElementById("wheel-center");
  const line1 = document.getElementById("center-line1");
  const line2 = document.getElementById("center-line2");

  center.setAttribute("fill", hex);
  center.setAttribute(
    "stroke",
    isLightColor(hex) ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.8)",
  );
  center.setAttribute("stroke-width", isLightColor(hex) ? "1.5" : "2");

  const centerTextColor = isLightColor(hex) ? "#2c1f2e" : "#fff";
  line1.setAttribute("fill", centerTextColor);
  line2.setAttribute("fill", centerTextColor);

  // Split season name into two lines
  const parts = season.split(" ");
  line1.textContent = parts[0] || "";
  line2.textContent = parts[1] || "";
}

// ─── Utility: Light/Dark Color Detection ─────────────────────────────────────

function isLightColor(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Perceived luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}
