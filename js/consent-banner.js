/**
 * Kisari Chrome Extension — Analyze-page consent banner
 * =====================================================
 *
 * The second consent capture point for accounts that predate the consent
 * model (CLAUDE.md landmine 7). The first — the terms gate in
 * pages/login.html — only ever reaches someone who opens the Account view,
 * so anyone who just uses the eyedropper and never visits their account
 * stays transactional-only forever. This banner is what reaches them, on
 * the surface they actually open.
 *
 * Server decides whether it shows: GET /api/me/consent returns
 * `show_reconsent_banner`, true when the account has no marketing consent
 * and has not been shown a prompt in the last 30 days. The client does not
 * re-derive that rule — one place owns it, and it is the API.
 *
 * Three ways this ends, and only one of them is a consent decision:
 *   opt in   → PUT /api/me/consent {granted: true}   — recorded
 *   dismiss  → nothing written                       — NOT a refusal
 *   ignore   → nothing written                       — NOT a refusal
 *
 * Dismissing must never be recorded as granted:false. The account-view gate
 * records a decision either way because it blocks and demands one; this
 * banner does not block, so closing it is someone declining to answer, not
 * someone answering no. Writing a refusal there would be inferring a
 * decision from silence — the same inference decisions.md forbids in the
 * granting direction. What keeps a dismissed banner from reappearing is the
 * prompt-seen stamp and its 30-day window, not a fabricated decision.
 */

import { isSignedIn, apiRequest } from "./auth.js";

// Fifth recorded source (kisari-docs/api_contract.md). Distinct from
// extension:reconsent_prompt on purpose: if both wrote the same string, no
// later query could tell which surface actually recovered an account.
const CONSENT_SOURCE = "extension:analyze_page_banner";

// "Settled for this browser session" — set on dismissal, on a successful
// opt-in, and when the server says this account is not due a banner.
// Survives popup close, dies with the browser session.
//
// Two jobs. It is the backstop for a prompt-seen stamp that did not land
// (offline, 500), without which a dismissed banner would return on the very
// next popup open. And it keeps the popup from re-asking the server on
// every single open: the popup is this extension's hottest path, most
// accounts will answer `false` forever, and one GET per session is enough
// to learn that. Eligibility only ever turns ON after 30 days or after a
// withdrawal, so a stale `false` inside one session cannot hide a banner
// that should have appeared — and someone who just unsubscribed in the
// Account view should not be re-asked seconds later anyway.
const SESSION_SETTLED_KEY = "consentBannerSettled";

// One banner and one impression per mount. A module instance lives exactly
// as long as one popup, so module scope IS mount scope here — but both
// guards are explicit because both failures are silent: a second stamp
// restarts a 30-day window, and a second render stacks a duplicate banner
// into a popup with no vertical room for one.
let promptSeenReported = false;
let mounted = false;

async function reportPromptSeen() {
  if (promptSeenReported) return;
  promptSeenReported = true;
  try {
    await apiRequest("/api/me/consent/prompt-seen", { method: "POST" });
  } catch (err) {
    // Pacing metadata, not consent. A failed stamp means the banner may be
    // offered again sooner than intended — harmless, and not worth surfacing.
    console.warn("Could not record consent prompt impression:", err);
  }
}

async function isSettledThisSession() {
  try {
    const stored = await chrome.storage.session.get(SESSION_SETTLED_KEY);
    return !!stored?.[SESSION_SETTLED_KEY];
  } catch (err) {
    return false;
  }
}

async function markSettledThisSession() {
  try {
    await chrome.storage.session.set({ [SESSION_SETTLED_KEY]: true });
  } catch (err) {
    console.warn("Could not persist consent banner state:", err);
  }
}

function render(root) {
  const banner = document.createElement("div");
  banner.className = "consent-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Email preferences");

  const body = document.createElement("div");
  body.className = "consent-banner-body";

  const label = document.createElement("label");
  label.className = "consent-banner-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "consent-banner-checkbox";
  checkbox.id = "consent-banner-checkbox";

  const text = document.createElement("span");
  text.className = "consent-banner-text";
  text.textContent = "Email me seasonal colour guides and styling tips.";

  const sub = document.createElement("span");
  sub.className = "consent-banner-sub";
  sub.textContent = " A couple a month. Unsubscribe any time.";
  text.appendChild(sub);

  label.append(checkbox, text);

  const error = document.createElement("p");
  error.className = "consent-banner-error";
  error.style.display = "none";
  error.setAttribute("role", "alert");

  body.append(label, error);

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "consent-banner-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.textContent = "×";

  banner.append(body, dismiss);
  root.appendChild(banner);

  const close = async () => {
    await markSettledThisSession();
    banner.remove();
  };

  dismiss.addEventListener("click", close);

  checkbox.addEventListener("change", async () => {
    // Only a grant is ever written. Unticking before the write lands is not
    // a withdrawal — there is nothing recorded yet to withdraw.
    if (!checkbox.checked) return;

    checkbox.disabled = true;
    error.style.display = "none";

    try {
      const res = await apiRequest("/api/me/consent", {
        method: "PUT",
        body: JSON.stringify({ granted: true, source: CONSENT_SOURCE }),
      });
      if (!res.ok) throw new Error("Server returned " + res.status);

      // Hide for the rest of the session on the write's own success — no
      // confirming GET. The server state is already what we just set it to,
      // and a second round trip could only fail and confuse the result.
      await markSettledThisSession();
      text.textContent = "Subscribed. Change this any time under Account.";
      label.classList.add("is-done");
      checkbox.remove();
      setTimeout(() => banner.remove(), 2200);
    } catch (err) {
      checkbox.checked = false;
      checkbox.disabled = false;
      error.textContent = "Could not save that. Try again.";
      error.style.display = "block";
    }
  });
}

/**
 * Mount the banner if this account is due one. Safe to call unconditionally:
 * every exit is silent, because a consent prompt failing is never a reason
 * to degrade the analyze page it sits on.
 */
export async function initConsentBanner() {
  const root = document.getElementById("consent-banner-root");
  if (!root || mounted) return;

  try {
    if (await isSettledThisSession()) return;
    if (!(await isSignedIn())) return;

    const res = await apiRequest("/api/me/consent");
    if (!res.ok) return;

    const data = await res.json();
    if (!data.show_reconsent_banner) {
      // Settled for this session — don't ask the server again on every open.
      await markSettledThisSession();
      return;
    }

    mounted = true;
    render(root);
    reportPromptSeen();
  } catch (err) {
    console.warn("Consent banner check failed, continuing:", err);
  }
}
