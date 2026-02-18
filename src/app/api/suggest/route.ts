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
 *   1. If query starts with "!", filter BANGS by prefix → prepend "!trigger name" entries
 *   2. Run local engine (Trie + Levenshtein + N-Gram) on the text part
 *   3. Fetch Google Suggest and merge with weighted scoring
 *   4. Return top 8 as OpenSearch JSON
 *
 * Spec: https://developer.mozilla.org/en-US/docs/Web/OpenSearch#providing_search_suggestions
 */

// Init the engine once per cold start (server-side singleton)
let engineReady = false;
function ensureEngine() {
  if (!engineReady) {
    const bangCorpus = BANGS.flatMap(b => [b.name.toLowerCase(), b.trigger]);
    initSearchEngine(bangCorpus);
    engineReady = true;
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (!q) {
    return NextResponse.json([q, []], {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  ensureEngine();

  const suggestions: string[] = [];
  const seen = new Set<string>();

  // ── 1. Bang suggestions ────────────────────────────────────────────────────
  if (q.startsWith('!')) {
    const prefix = q.slice(1).toLowerCase();
    const bangMatches = BANGS
      .filter(b => b.trigger.startsWith(prefix) || b.name.toLowerCase().startsWith(prefix))
      .slice(0, 4);

    for (const b of bangMatches) {
      const entry = `!${b.trigger} — ${b.name}`;
      if (!seen.has(entry)) {
        seen.add(entry);
        suggestions.push(entry);
      }
    }
  }

  // ── 2. Text part of the query ──────────────────────────────────────────────
  const textQuery = q.startsWith('!')
    ? q.replace(/^!\S+\s*/, '').trim()
    : q;

  if (textQuery.length >= 1) {
    // Local engine (Trie + Levenshtein + N-Gram)
    const localPredictions = predict(textQuery, 6);

    // Google Suggest (best-effort, 2s timeout)
    let googleSuggestions: string[] = [];
    try {
      const googleUrl = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(textQuery)}`;
      const res = await fetch(googleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json() as [string, string[]];
        googleSuggestions = Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
      }
    } catch {
      // Network error or timeout — fall through to local results only
    }

    const merged = mergeWithGoogle(localPredictions, googleSuggestions, 7);

    for (const p of merged) {
      const text = q.startsWith('!') && q.includes(' ')
        ? `${q.split(' ')[0]} ${p.text}`  // keep the bang prefix: "!y lofi music"
        : p.text;
      if (!seen.has(text)) {
        seen.add(text);
        suggestions.push(text);
      }
    }
  }

  // OpenSearch JSON format: ["originalQuery", ["s1", "s2", ...]]
  return NextResponse.json([q, suggestions.slice(0, 8)], {
    status: 200,
    headers: {
      'Content-Type': 'application/x-suggestions+json',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
      // Required for Firefox to accept suggestions from a different path
      'Access-Control-Allow-Origin': '*',
    },
  });
}
