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

// Server-side singleton — initialised once per cold start
let engineReady = false;
function ensureEngine() {
  if (!engineReady) {
    const bangCorpus = BANGS.flatMap(b => [b.name.toLowerCase(), b.trigger]);
    initSearchEngine(bangCorpus);
    engineReady = true;
  }
}

/** Detect the user's preferred language from the Accept-Language header */
function getLang(request: NextRequest): string {
  const al = request.headers.get('accept-language') ?? '';
  const primary = al.split(',')[0]?.split(';')[0]?.trim() ?? 'en';
  return primary || 'en';
}

/** Fetch Google Suggest with a timeout; returns [] on any failure */
async function fetchGoogleSuggest(query: string, lang: string): Promise<string[]> {
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
    return Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
  } catch {
    return [];
  }
}

/** Normalise a string for deduplication: lowercase, collapse whitespace */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

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

    // 1a. Matching bang shortcuts (always first)
    const bangMatches = BANGS.filter(
      b => b.trigger.startsWith(bangPrefix) || b.name.toLowerCase().startsWith(bangPrefix)
    ).slice(0, 5);

    for (const b of bangMatches) {
      if (textAfterBang) {
        // "!y lofi" → show "!y lofi" itself as first suggestion
        addSuggestion(`!${b.trigger} ${textAfterBang}`);
      } else {
        // "!y" with no text → show "!y — YouTube"
        addSuggestion(`!${b.trigger} — ${b.name}`);
      }
    }

    // 1b. If there's a text portion, fetch Google suggestions and prefix with bang
    if (textAfterBang && bangMatches.length > 0) {
      const exact = bangMatches[0];
      const googleSuggestions = await fetchGoogleSuggest(textAfterBang, lang);
      for (const gs of googleSuggestions) {
        addSuggestion(`!${exact.trigger} ${gs}`);
      }
    }

  } else {
    // ── Plain text query ─────────────────────────────────────────────────────
    // Google Suggest is the primary source; local engine fills gaps

    // Fetch Google and local in parallel
    const [googleSuggestions, localPredictions] = await Promise.all([
      fetchGoogleSuggest(q, lang),
      Promise.resolve(predict(q, 8)),
    ]);

    // Google results first — strongest signal for real-world queries
    for (const gs of googleSuggestions) {
      addSuggestion(gs);
    }

    // Local engine results (Trie + fuzzy + N-Gram) as supplementary
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
