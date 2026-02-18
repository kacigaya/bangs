import { NextRequest, NextResponse } from 'next/server';
import { initSearchEngine, predict, mergeWithGoogle } from '@/lib/search-engine';
import { BANGS } from '@/lib/bangs';

/**
 * GET /api/suggest?q=<query>
 *
 * OpenSearch Suggestions endpoint — called directly by the browser's
 * address bar to populate autocomplete suggestions.
 *
 * Response format (OpenSearch JSON):
 *   ["query", ["suggestion1", "suggestion2", ...]]
 *
 * Pipeline:
 *   1. Bang-prefix queries (e.g. "!y lo") → bang matches + Google suggestions
 *      prefixed with the bang ("!y lofi music", "!y lo-fi beats", …)
 *   2. Plain text queries → Google Suggest (primary) merged with local engine
 *      (Trie + Levenshtein + N-Gram) for offline/fallback coverage
 *
 * Spec: https://developer.mozilla.org/en-US/docs/Web/OpenSearch#providing_search_suggestions
 */

// ─── TTL Cache ───────────────────────────────────────────────────────────────
// Simple in-memory cache to avoid hammering Google Suggest on every keystroke.
// Key: "query:lang"  |  TTL: 60s  |  Max entries: 500 (evict oldest on overflow)

interface CacheEntry {
  results: string[];
  expiresAt: number;
}

const suggestCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;

function cacheGet(key: string): string[] | null {
  const entry = suggestCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    suggestCache.delete(key);
    return null;
  }
  return entry.results;
}

function cacheSet(key: string, results: string[]): void {
  if (suggestCache.size >= CACHE_MAX) {
    // Evict the oldest entry (first inserted key in insertion-order Map)
    suggestCache.delete(suggestCache.keys().next().value!);
  }
  suggestCache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Engine singleton ────────────────────────────────────────────────────────

let engineReady = false;
function ensureEngine() {
  if (!engineReady) {
    const bangCorpus = BANGS.flatMap(b => [b.name.toLowerCase(), b.trigger]);
    initSearchEngine(bangCorpus);
    engineReady = true;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Detect the user's preferred language from the Accept-Language header */
function getLang(request: NextRequest): string {
  const al = request.headers.get('accept-language') ?? '';
  const primary = al.split(',')[0]?.split(';')[0]?.trim() ?? 'en';
  return primary || 'en';
}

/** Fetch Google Suggest with a timeout and TTL cache; returns [] on any failure */
async function fetchGoogleSuggest(query: string, lang: string): Promise<string[]> {
  const cacheKey = `${query}:${lang}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${encodeURIComponent(lang)}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = await res.json() as [string, string[]];
    const results = Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
    cacheSet(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

/** Normalise a string for deduplication: lowercase, collapse whitespace */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Match bangs against a prefix with two tiers:
 *   Tier 1 — trigger starts with prefix  (e.g. "!g" → !g, !gh, !ghr)
 *   Tier 2 — name starts with prefix     (e.g. "!g" → !i via "Google Images")
 * Tier 1 results always appear before Tier 2. Both tiers are capped so name
 * matches never push out trigger matches.
 */
function matchBangs(prefix: string, maxTier1 = 5, maxTier2 = 2) {
  const p = prefix.toLowerCase();
  const tier1 = BANGS.filter(b => b.trigger.startsWith(p)).slice(0, maxTier1);
  const tier1Triggers = new Set(tier1.map(b => b.trigger));
  const tier2 = BANGS
    .filter(b => !tier1Triggers.has(b.trigger) && b.name.toLowerCase().startsWith(p))
    .slice(0, maxTier2);
  return [...tier1, ...tier2];
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (!q) {
    return NextResponse.json(['', []], {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  ensureEngine();

  const lang = getLang(request);
  const suggestions: string[] = [];
  const seen = new Set<string>();

  const addSuggestion = (s: string) => {
    const key = norm(s);
    if (key && !seen.has(key)) {
      seen.add(key);
      suggestions.push(s);
    }
  };

  const isBangQuery = q.startsWith('!');

  if (isBangQuery) {
    // ── Bang query handling ──────────────────────────────────────────────────
    // e.g. "!y", "!y lofi", "!gh next"
    const parts = q.slice(1).split(/\s+/);
    const bangPrefix = parts[0]?.toLowerCase() ?? '';
    const textAfterBang = parts.slice(1).join(' ').trim();

    // Ranked bang matches: trigger-prefix first, then name-prefix
    const bangMatches = matchBangs(bangPrefix);

    for (const b of bangMatches) {
      if (textAfterBang) {
        addSuggestion(`!${b.trigger} ${textAfterBang}`);
      } else {
        addSuggestion(`!${b.trigger} — ${b.name}`);
      }
    }

    // If there's a text portion, fetch Google suggestions and prefix with the
    // best trigger match (first tier-1 hit, i.e. exact trigger prefix match)
    if (textAfterBang && bangMatches.length > 0) {
      const best = bangMatches[0];
      const googleSuggestions = await fetchGoogleSuggest(textAfterBang, lang);
      for (const gs of googleSuggestions) {
        addSuggestion(`!${best.trigger} ${gs}`);
      }
    }

  } else {
    // ── Plain text query ─────────────────────────────────────────────────────
    // Google Suggest is the primary source; local engine fills gaps

    const [googleSuggestions, localPredictions] = await Promise.all([
      fetchGoogleSuggest(q, lang),
      Promise.resolve(predict(q, 8)),
    ]);

    for (const gs of googleSuggestions) {
      addSuggestion(gs);
    }

    const merged = mergeWithGoogle(localPredictions, [], 8);
    for (const p of merged) {
      addSuggestion(p.text);
    }
  }

  // OpenSearch JSON format: ["originalQuery", ["s1", "s2", ...]]
  return NextResponse.json([q, suggestions.slice(0, 8)], {
    status: 200,
    headers: {
      'Content-Type': 'application/x-suggestions+json',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
