// background.js
// Minimal service worker — ExtPay has been removed.
// Auth is now handled by Supabase via auth.js in the popup.

// Keep the service worker alive for chrome.storage events if needed.
chrome.runtime.onInstalled.addListener(() => {
  console.log("Color Season Finder installed/updated.");
});
