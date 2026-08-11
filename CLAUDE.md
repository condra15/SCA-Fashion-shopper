# CLAUDE.md — Chrome Extension (Color Season Matcher)

## 1. What This Is

Kisari's Chrome extension — "Color Season Matcher: Style & Shopping Assistant" (manifest v3, currently v2.1.x), live and Featured on the Chrome Web Store. Users eyedrop any on-screen color to get its hex code and its compatibility with their color season. It is the platform's live consumer product and its primary social proof; strategically it is a funnel into the iOS app more than a revenue line.

Kisari overall: "ultimate shopping assistant" using body specs — color season first, Kibbe later. See `../kisari-docs/decisions.md`.

## 2. Architecture Map

- **Popup:** `index.html` at repo root, fixed at **360×420px** (`style/popup-size.css` sizes the `html` element — Chrome popups size from html, not body). Core logic in `js/script.js`.
- **Separate pages pattern:** full-page flows open as extension pages (existing precedent: `pages/login.html` for auth). New multi-step UI goes on its own page, not crammed into the popup.
- **Background:** `background.js` service worker.
- **Permissions:** `storage`, `scripting`, `activeTab`. Color picking uses the **EyeDropper API** (Chrome 95+; does not work on chrome:// pages or the Web Store).
- **Auth:** Supabase email/password → JWT (ES256) → `Authorization: Bearer` to cleo-api. Password reset flows through essumancreations.com/reset-password.html.
- **Backend endpoints used:** `/api/ext/daily-status`, `/api/ext/account-status`, analysis endpoints — see `../kisari-docs/api_contract.md`.
- **Billing:** Stripe (Monthly/Yearly/Lifetime plans) — NOT StoreKit, NOT the removed iOS credit system.
- **State:** user's season lives in `chrome.storage.local` (`savedSeason`) set via the `seasonSelect` dropdown. The Shopify theme quiz uses `localStorage` with a different key — these are separate systems.
- **Season data:** `SEASONS_ORDER` array + `SEASON_COLORS` mapping in `js/script.js` drive the season wheel SVG, dropdown, and results. Naming is "Dark Autumn"/"Dark Winter" — this is the platform-wide correct naming.

## 3. Commands

No build step — vanilla HTML/JS/CSS loaded unpacked.

```
Load:    chrome://extensions → Developer mode → Load unpacked → repo root
Reload:  chrome://extensions → refresh icon after changes
Publish: zip the repo (excluding .git) → Chrome Web Store Developer Dashboard
```

⚠ Chrome Web Store search indexes the extension NAME and developer account name, not description text — keyword changes to the description do not affect discoverability.

## 4. Working Principles

Same as cleo-api's CLAUDE.md Section 4. Repo-specific additions:

- **New UI work uses React** (Chris is deliberately practicing React); existing vanilla JS surfaces stay vanilla until a rewrite is explicitly scheduled. A new page (e.g., the quiz page) is "new UI work."
- Verify EyeDropper API behavior against current MDN/Chrome docs, not memory.

## 5. Landmines

0. **PROTECTED LOGIC — never modify the color season formula OR the matching.py algorithm.** Both are Chris's original work, same protection tier (`../kisari-docs/decisions.md` — Protected Logic, two sections). Implement the spec; never change it. Divergence from spec = [STOP], not a fix-in-place.

1. **Season naming is "Dark", never "Deep".** `SEASONS_ORDER`/`SEASON_COLORS` are authoritative for the platform.
2. **The server-side `MAX_FREE_DAILY = 5` counter (`/api/ext/daily-status`) is the extension's own free-tier mechanism.** It is unrelated to the removed iOS daily cap. Do not remove or conflate.
3. **`ext_subscription_plan = None` means deleted/lapsed; `"free"` means active free tier.** Webhook guards in cleo-api depend on this — never write `"free"` on deletion.
4. **Popup is hard-capped at 360×420.** Multi-step flows belong on separate extension pages (login page pattern).
5. **Planned quiz page:** the full 6-question quiz from `../kisari-docs/decisions.md` (not the 3-question photo+quiz shortlist — the extension has no camera input; the eyedropper reads screen colors, not the user's coloring). Two open decisions before building it: which storage key the quiz result writes to (same `savedSeason` or reconciled separately), and whether confidence/relative-margin get stored extension-side. See `../kisari-docs/SUGGESTIONS.md`.
6. **Overlapping Stripe plans bug** (user can hold Monthly + Lifetime simultaneously) is documented and deliberately deferred — "fix on first refund request." Do not proactively rework billing.
7. **Existing accounts (~60 as of 2026-08-09; 52 at the 2026-07-22 inventory — the base grows, so re-count rather than quoting this number) have no marketing-consent basis.** They registered under a policy that never mentioned email. Global opt-in means none may receive marketing mail until they affirmatively consent via a one-time prompt — never enrol them by inference from account existence.
8. **This extension is Featured on the Chrome Web Store — a policy strike costs more here than on an ordinary listing.** Any future addition of affiliate links requires Chrome Web Store disclosure on top of FTC and Amazon requirements. Treat monetization changes to this surface with more caution than the same change would need elsewhere.

## 6. Pointers

Shared docs: `../kisari-docs/` (decisions.md, api_contract.md, known_issues.md, SUGGESTIONS.md, claude-code-kickoffs.md — copy-paste session-starter prompts). If missing, reopen the workspace at the parent directory. Flag conflicts as [STOP] in SUGGESTIONS.md and stop.

- `../kisari-docs/human-actions.md` — what's Chris's to do at each phase (accounts, payments, external submissions, judgment calls) versus what a session can do on its own
