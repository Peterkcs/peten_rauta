/*
 * Chat tab settings.
 *
 * apiUrl empty: the tab uses the rule-based demo engine in demo-engine.js (no AI model).
 * apiUrl set:   the tab sends each customer message to your test environment and shows its answer.
 *
 * Contract for your endpoint:
 *   POST  { "subject": "", "body": "customer message text" }
 *   200   { "output": "CATEGORY: ...\nREASON: ...\nESCALATE_TO: ...\nDRAFT: ...\nSOURCES: ...\nVERIFY: ..." }
 *
 * The endpoint must allow CORS from the site's origin. Never put API keys in this file: the repo
 * is public. Keep the key on a server or proxy that you control.
 */
window.PR_CONFIG = {
  apiUrl: ""
};
