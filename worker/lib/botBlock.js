// Known AI / LLM training + scraping crawlers that fetch page content and
// identify themselves with a stable User-Agent token. These are hard-blocked
// with a 403 in worker/index.js, on top of the Disallow entries in
// public/robots.txt -- because a scraper can simply ignore robots.txt, but it
// can't ignore a 403.
//
// Deliberately EXCLUDED so the public landing page stays indexable for SEO:
// regular search engines (Googlebot, Bingbot, DuckDuckBot, Applebot, etc.).
//
// Also excluded on purpose: opt-out-only tokens like Google-Extended and
// Applebot-Extended. Those have no distinct fetching user-agent (the normal
// Googlebot/Applebot does the crawling; the -Extended token only governs AI
// use via robots.txt), so 403-ing them here is impossible and blocking their
// parent crawler would hurt search indexing. They're handled in robots.txt.
//
// facebookexternalhit and Twitterbot are also excluded so link-preview cards
// still render when the portfolio is shared on social media.
const BLOCKED_BOT_PATTERN = new RegExp(
  [
    'GPTBot',
    'ChatGPT-User',
    'OAI-SearchBot',
    'ClaudeBot',
    'Claude-Web',
    'anthropic-ai',
    'CCBot',
    'PerplexityBot',
    'Perplexity-User',
    'Bytespider',
    'Amazonbot',
    'meta-externalagent',
    'Diffbot',
    'ImagesiftBot',
    'Omgili', // also matches Omgilibot
    'DataForSeoBot',
    'cohere-ai',
    'YouBot',
    'Timpibot'
  ].join('|'),
  'i'
);

// True if the request's User-Agent identifies a blocked AI scraper. A missing
// or empty User-Agent is allowed through -- real browsers always send one, and
// blocking blank UAs risks catching legitimate health checks / same-origin
// asset fetches for no real anti-scraping gain (a determined scraper would
// just spoof a browser UA anyway; this list targets the honestly-labeled ones).
export function isBlockedBot(request) {
  const ua = request.headers.get('User-Agent') || '';
  return BLOCKED_BOT_PATTERN.test(ua);
}
