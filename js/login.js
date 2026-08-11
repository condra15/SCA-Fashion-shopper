/**
 * Kisari Chrome Extension — Login Page Logic
 * ============================================
 * Handles: sign in, sign up, sign out, subscription display,
 * manage subscription, reactivation, and account deletion.
 */

import {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  isSignedIn,
  apiRequest,
  resetPassword,
  API_BASE,
} from "./auth.js";

// ─── DOM Elements ────────────────────────────────────────────────────────────

// Auth form
const $authSection = document.getElementById("auth-section");
const $accountSection = document.getElementById("account-section");
const $emailInput = document.getElementById("email-input");
const $passwordInput = document.getElementById("password-input");
const $signInBtn = document.getElementById("sign-in-btn");
const $signUpBtn = document.getElementById("sign-up-btn");
const $forgotBtn = document.getElementById("forgot-password-btn");
const $authError = document.getElementById("auth-error");
const $authSuccess = document.getElementById("auth-success");
const $accountError = document.getElementById("account-error");

// Account info
const $userEmail = document.getElementById("user-email");
const $accountPlan = document.getElementById("account-plan");
const $usageDisplay = document.getElementById("usage-display");
const $signOutBtn = document.getElementById("sign-out-btn");

// Subscription
const $upgradeSection = document.getElementById("upgrade-section");
const $manageSection = document.getElementById("manage-section");
const $manageSubBtn = document.getElementById("manage-sub-btn");

// Consent
const $consentSection = document.getElementById("consent-section");
const $consentMarketingCheckbox = document.getElementById(
  "consent-marketing-checkbox",
);
const $consentAcceptBtn = document.getElementById("consent-accept-btn");
const $consentSignOutBtn = document.getElementById("consent-signout-btn");
const $consentError = document.getElementById("consent-error");
const $signupConsentCheckbox = document.getElementById(
  "signup-consent-checkbox",
);
const $accountConsentCheckbox = document.getElementById(
  "account-consent-checkbox",
);
const $accountConsentStatus = document.getElementById(
  "account-consent-status",
);

// Delete account
const $deleteBtn = document.getElementById("delete-account-btn");
const $deleteConfirm = document.getElementById("delete-confirm");
const $deleteConfirmBtn = document.getElementById("delete-confirm-btn");
const $deleteCancelBtn = document.getElementById("delete-cancel-btn");

// ─── Init ────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", async () => {
  await renderPage();
});

async function renderPage() {
  const signedIn = await isSignedIn();
  if (!signedIn) {
    showAuthView();
    return;
  }

  // A signup choice made before email confirmation is written on first
  // successful sign-in — see PENDING_CONSENT_KEY below.
  await flushPendingSignupConsent();

  if (await needsConsent()) {
    showConsentView();
    return;
  }

  showAccountView();
}

// ─── Consent ─────────────────────────────────────────────────────────────────
// Accounts predating the consent model have no recorded decision and are
// transactional-only until they make one (SCA-Fashion-Shopper CLAUDE.md
// landmine 7). The gate blocks on accepting the updated Terms and Privacy
// Policy; the marketing checkbox inside it is optional and never blocks,
// because consent conditioned on access is not freely given.

const PENDING_CONSENT_KEY = "pendingSignupConsent";

/**
 * True when this account has no recorded consent decision at all.
 * A recorded decline (granted: false) counts as a decision — we do not
 * re-prompt someone who has already said no.
 */
async function needsConsent() {
  try {
    const res = await apiRequest("/api/me/consent");
    if (!res.ok) return false; // never lock someone out over a failed check
    const data = await res.json();
    return !data.marketing_consent_at;
  } catch (err) {
    console.warn("Consent check failed, continuing:", err);
    return false;
  }
}

async function recordConsent(granted, source) {
  const res = await apiRequest("/api/me/consent", {
    method: "PUT",
    body: JSON.stringify({ granted, source }),
  });
  if (!res.ok) throw new Error("Could not record your choice. Try again.");
  return res.json();
}

/**
 * Signup can complete before the address is confirmed, in which case there
 * is no session yet to write consent against. Stash the choice locally and
 * write it on the first successful sign-in.
 */
async function flushPendingSignupConsent() {
  const { [PENDING_CONSENT_KEY]: pending } =
    await chrome.storage.local.get(PENDING_CONSENT_KEY);
  if (pending === undefined) return;

  try {
    await recordConsent(!!pending, "extension:signup_checkbox");
    await chrome.storage.local.remove(PENDING_CONSENT_KEY);
  } catch (err) {
    // Leave it stashed and retry next load rather than losing the choice
    console.warn("Could not flush pending signup consent:", err);
  }
}

function showConsentView() {
  $authSection.style.display = "none";
  $accountSection.style.display = "none";
  $consentSection.style.display = "block";
}

$consentAcceptBtn?.addEventListener("click", async () => {
  $consentError.style.display = "none";
  $consentAcceptBtn.disabled = true;
  $consentAcceptBtn.textContent = "Saving…";

  try {
    // One record either way. Accepting the terms is what unblocks; the
    // marketing answer is carried alongside it, granted or refused.
    await recordConsent(
      $consentMarketingCheckbox.checked,
      "extension:reconsent_prompt",
    );
    $consentSection.style.display = "none";
    showAccountView();
  } catch (err) {
    $consentError.textContent =
      err.message || "Could not save your choice. Try again.";
    $consentError.style.display = "block";
  } finally {
    $consentAcceptBtn.disabled = false;
    $consentAcceptBtn.textContent = "Accept & Continue";
  }
});

$consentSignOutBtn?.addEventListener("click", async () => {
  await signOut();
  $consentSection.style.display = "none";
  showAuthView();
});

/**
 * Reflect the stored preference in the account view. Called on every account
 * load so the checkbox always shows what the server actually holds, not what
 * this browser last did — the same account may have been changed elsewhere.
 */
async function loadConsentPreference() {
  if (!$accountConsentCheckbox) return;
  try {
    const res = await apiRequest("/api/me/consent");
    if (!res.ok) return;
    const data = await res.json();
    $accountConsentCheckbox.checked = !!data.marketing_consent;
    $accountConsentStatus.textContent = data.marketing_consent_at
      ? data.marketing_consent
        ? "Subscribed"
        : "Not subscribed"
      : "";
  } catch (err) {
    console.warn("Could not load email preference:", err);
  }
}

$accountConsentCheckbox?.addEventListener("change", async () => {
  const granted = $accountConsentCheckbox.checked;
  $accountConsentCheckbox.disabled = true;
  $accountConsentStatus.textContent = "Saving…";

  try {
    // Every toggle writes its own record — grants and withdrawals alike —
    // so the audit trail shows what changed and when, not just the latest state.
    await recordConsent(granted, "extension:account_settings");
    $accountConsentStatus.textContent = granted
      ? "Subscribed"
      : "Unsubscribed";
  } catch (err) {
    // Revert the control so it never shows a state the server did not accept
    $accountConsentCheckbox.checked = !granted;
    $accountConsentStatus.textContent = "Could not save — try again";
  } finally {
    $accountConsentCheckbox.disabled = false;
  }
});

// ─── Auth View ───────────────────────────────────────────────────────────────

function showAuthView() {
  $authSection.style.display = "block";
  $accountSection.style.display = "none";
  clearMessages();
}

function showAccountView() {
  $authSection.style.display = "none";
  $accountSection.style.display = "block";
  $deleteConfirm.style.display = "none";
  loadAccountInfo();
}

// ─── Sign In (with deleted account check) ────────────────────────────────────

$signInBtn.addEventListener("click", async () => {
  const email = $emailInput.value.trim();
  const password = $passwordInput.value;

  if (!email || !password) {
    showError("Please enter both email and password.");
    return;
  }

  setLoading(true);
  clearMessages();

  try {
    await signIn(email, password);

    // Check if this account was previously deleted (blocks password-reset loophole)
    try {
      const checkRes = await apiRequest("/api/ext/check-deleted");
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.deleted) {
          await signOut();
          showError(
            "This account was deleted. Please use Create Account to re-register.",
          );
          return;
        }
      }
    } catch (e) {
      // If the check fails, allow sign-in — don't block on a network hiccup
      console.warn("Could not verify deleted status:", e);
    }

    showAccountView();
  } catch (err) {
    showError(err.message || "Sign in failed. Check your credentials.");
  } finally {
    setLoading(false);
  }
});

// ─── Sign Up (with reactivation support) ─────────────────────────────────────

$signUpBtn.addEventListener("click", async () => {
  const email = $emailInput.value.trim();
  const password = $passwordInput.value;

  if (!email || !password) {
    showError("Please enter both email and password.");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters.");
    return;
  }

  setLoading(true);
  clearMessages();

  try {
    // Try reactivation first (for previously deleted accounts)
    const reactivateRes = await fetch(
      `${API_BASE}/api/ext/reactivate-account`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
    );

    if (reactivateRes.ok) {
      // Account reactivated — now sign them in with the new password
      await signIn(email, password);
      showAccountView();
      return;
    }

    // Not a deleted account — do normal sign up
    const wantsMarketing = !!$signupConsentCheckbox?.checked;
    const data = await signUp(email, password);

    if (!data.access_token) {
      // No session yet (email confirmation pending) — stash the choice and
      // write it on first sign-in, so an unconfirmed signup never produces
      // a consent record against an unverified address.
      await chrome.storage.local.set({
        [PENDING_CONSENT_KEY]: wantsMarketing,
      });
      showSuccess("Check your email to confirm your account, then sign in.");
    } else {
      try {
        await recordConsent(wantsMarketing, "extension:signup_checkbox");
      } catch (err) {
        // Don't fail the signup over the consent write; retry on next load
        await chrome.storage.local.set({
          [PENDING_CONSENT_KEY]: wantsMarketing,
        });
      }
      showAccountView();
    }
  } catch (err) {
    showError(err.message || "Sign up failed. Try a different email.");
  } finally {
    setLoading(false);
  }
});

// ─── Forgot Password ────────────────────────────────────────────────────────

$forgotBtn.addEventListener("click", async () => {
  const email = $emailInput.value.trim();

  if (!email) {
    showError("Enter your email first, then click Forgot Password.");
    return;
  }

  setLoading(true);
  clearMessages();

  try {
    await resetPassword(email);
    showSuccess("Password reset email sent. Check your inbox.");
  } catch (err) {
    showError(err.message || "Could not send reset email.");
  } finally {
    setLoading(false);
  }
});

// ─── Sign Out ────────────────────────────────────────────────────────────────

$signOutBtn.addEventListener("click", async () => {
  await signOut();
  showAuthView();
});

// ─── Subscribe / Manage ──────────────────────────────────────────────────────

// Per-tier upgrade buttons — each plan card has its own [data-plan] button
document.querySelectorAll("[data-plan]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const plan = btn.getAttribute("data-plan");
    await openCheckout(plan);
  });
});

$manageSubBtn.addEventListener("click", async () => {
  try {
    const res = await apiRequest("/api/ext/manage-subscription", {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
        return;
      }
    }
    const err = await res.json().catch(() => ({}));
    // Special handling for inconsistent state — show the support email more prominently
    if (err.code === "INCONSISTENT_STATE") {
      showError(
        "We can't manage your subscription from here. Please email contact@essumancreations.com and we'll fix it.",
      );
    } else {
      showError(err.error || "Could not open subscription management.");
    }
  } catch (err) {
    console.error("Could not open portal:", err);
    showError("Could not reach server. Try again later.");
  }
});

async function openCheckout(plan) {
  // Disable all per-tier upgrade buttons while we open checkout
  const tierButtons = document.querySelectorAll("[data-plan]");
  tierButtons.forEach((btn) => {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Opening...";
  });

  try {
    const res = await apiRequest("/api/ext/create-checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        // Flag that we're expecting a plan update (for checkout polling)
        await chrome.storage.local.set({ pendingCheckout: Date.now() });
        window.open(data.url, "_blank");
        return;
      }
    }

    const err = await res.json().catch(() => ({}));
    showError(err.error || "Could not start checkout. Try again.");
  } catch (err) {
    console.error("Checkout error:", err);
    showError("Could not reach payment server. Try again later.");
  } finally {
    tierButtons.forEach((btn) => {
      btn.disabled = false;
      if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
      }
    });
  }
}

// ─── Delete Account ──────────────────────────────────────────────────────────

$deleteBtn.addEventListener("click", () => {
  $deleteConfirm.style.display = "block";
  $deleteConfirm.scrollIntoView({ behavior: "smooth" });
});

$deleteCancelBtn.addEventListener("click", () => {
  $deleteConfirm.style.display = "none";
});

$deleteConfirmBtn.addEventListener("click", async () => {
  $deleteConfirmBtn.disabled = true;
  $deleteConfirmBtn.textContent = "Deleting...";

  try {
    const res = await apiRequest("/api/ext/delete-account", {
      method: "DELETE",
    });

    if (res.ok) {
      await signOut();
      showAuthView();
      showSuccess("Your account has been deleted.");
    } else {
      const data = await res.json();
      showError(data.error || "Could not delete account. Try again.");
      $deleteConfirm.style.display = "none";
    }
  } catch (err) {
    showError("Could not reach server. Try again later.");
    $deleteConfirm.style.display = "none";
  } finally {
    $deleteConfirmBtn.disabled = false;
    $deleteConfirmBtn.textContent = "Yes, Delete My Account";
  }
});

// ─── Load Account Info ───────────────────────────────────────────────────────

async function loadAccountInfo() {
  const user = await getCurrentUser();
  if (user) {
    $userEmail.textContent = user.email || "Unknown";
  }

  loadConsentPreference();

  try {
    const res = await apiRequest("/api/ext/account-status");
    if (!res.ok) throw new Error("Failed to load");

    const status = await res.json();

    // Plan display
    const plan = status.subscription_plan || "free";
    switch (plan) {
      case "monthly":
        $accountPlan.textContent = "Monthly ($0.99/mo)";
        $upgradeSection.style.display = "none";
        $manageSection.style.display = "block";
        break;
      case "yearly":
        $accountPlan.textContent = "Yearly ($9.99/yr)";
        $upgradeSection.style.display = "none";
        $manageSection.style.display = "block";
        break;
      case "lifetime":
        $accountPlan.textContent = "Lifetime ✦";
        $upgradeSection.style.display = "none";
        $manageSection.style.display = "none";
        break;
      default:
        $accountPlan.textContent = "Free (5/day)";
        $upgradeSection.style.display = "block";
        $manageSection.style.display = "none";
    }

    // Usage display
    if (plan === "free") {
      const remaining = status.daily_remaining ?? 5;
      const max = status.daily_max ?? 5;
      $usageDisplay.textContent = `${remaining} of ${max} lookups today`;
    } else {
      $usageDisplay.textContent = "Unlimited";
    }
  } catch (err) {
    $accountPlan.textContent = "Could not load";
    $usageDisplay.textContent = "—";
    $upgradeSection.style.display = "none";
    $manageSection.style.display = "none";
  }
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

// Pick the error element that belongs to the currently-visible section.
// Auth section uses #auth-error; account section uses #account-error.
function activeErrorElement() {
  if ($accountSection.style.display !== "none") {
    return $accountError;
  }
  return $authError;
}

function showError(msg) {
  const $err = activeErrorElement();
  $err.textContent = msg;
  $err.style.display = "block";
  // Always hide auth-success (only the auth view uses it).
  $authSuccess.style.display = "none";
}

function showSuccess(msg) {
  const $successText = document.getElementById("auth-success-text");
  if ($successText) $successText.textContent = msg;
  $authSuccess.style.display = "flex";
  // Hide whichever error element might be showing.
  $authError.style.display = "none";
  $accountError.style.display = "none";
}

function clearMessages() {
  $authError.style.display = "none";
  $authSuccess.style.display = "none";
  $accountError.style.display = "none";
  $authError.textContent = "";
  $accountError.textContent = "";
}

function setLoading(loading) {
  $signInBtn.disabled = loading;
  $signUpBtn.disabled = loading;
  $forgotBtn.disabled = loading;
  $emailInput.disabled = loading;
  $passwordInput.disabled = loading;

  $signInBtn.textContent = loading ? "..." : "Sign In";
  $signUpBtn.textContent = loading ? "..." : "Create Account";
}
