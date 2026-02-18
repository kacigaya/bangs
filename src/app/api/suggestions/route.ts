import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/suggestions?q=<query>
 *
 * Server-side proxy for Google Autocomplete suggestions.
 * Proxying is necessary because browsers block direct calls to
 * suggestqueries.google.com due to CORS restrictions.
 *
 * Uses `client=firefox` which returns a clean JSON array (no JSONP wrapper):
 *   ["query", ["suggestion1", "suggestion2", ...]]
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const googleUrl = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(q)}`;

    const response = await fetch(googleUrl, {
      headers: {
        // Mimic a real browser request
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      // Abort after 2 seconds to keep the UI snappy
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      return NextResponse.json([], { status: 200 });
    }

    // Response shape: ["query", ["suggestion1", "suggestion2", ...], ...]
    const data = await response.json() as [string, string[]];
    const suggestions: string[] = Array.isArray(data[1]) ? data[1].slice(0, 8) : [];

    return NextResponse.json(suggestions, {
      status: 200,
      headers: {
        // Cache suggestions for 60 seconds — avoids hammering Google on every keystroke
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
      },
    });
  } catch {
    // Network error, timeout, or parse failure — return empty list gracefully
    return NextResponse.json([], { status: 200 });
  }
}
