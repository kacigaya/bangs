import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /opensearch.xml
 *
 * Serves the OpenSearch description document.
 * This tells the browser:
 *   - How to build a search URL  → /search?q={searchTerms}
 *   - Where to fetch suggestions → /api/suggest?q={searchTerms}
 *
 * The browser auto-discovers this file via the <link rel="search"> tag
 * in the page <head>. Once discovered, it queries /api/suggest on every
 * keystroke in the address bar to show autocomplete suggestions.
 *
 * Spec: https://developer.mozilla.org/en-US/docs/Web/OpenSearch
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"
                       xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>Bangs!</ShortName>
  <Description>Lightning-fast search with !bang shortcuts</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${origin}/favicon.ico</Image>

  <!-- Search URL — same as the existing /search route -->
  <Url type="text/html"
       method="get"
       template="${origin}/search?q={searchTerms}"/>

  <!-- Suggestions URL — OpenSearch JSON format -->
  <Url type="application/x-suggestions+json"
       method="get"
       template="${origin}/api/suggest?q={searchTerms}"/>

  <!-- Firefox-specific: open results in the current tab -->
  <moz:SearchForm>${origin}</moz:SearchForm>
</OpenSearchDescription>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/opensearchdescription+xml',
      // Cache for 24 hours — the file rarely changes
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
