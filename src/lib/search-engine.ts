// ─────────────────────────────────────────────────────────────────────────────
// search-engine.ts
// Multi-algorithm search prediction engine
//
// Algorithms (layered, results merged & ranked):
//   1. Trie            — O(m) prefix lookup
//   2. Damerau-Levenshtein fuzzy — edit-distance with transpositions
//   3. N-Gram index    — Jaccard similarity over character trigrams
// ─────────────────────────────────────────────────────────────────────────────

// ─── 1. TRIE ────────────────────────────────────────────────────────────────

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd = false;
  word = '';
}

export class Trie {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    const lower = word.toLowerCase();
    for (const ch of lower) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch)!;
    }
    node.isEnd = true;
    node.word = word;
  }

  /** Return all words whose lowercase form starts with `prefix`. */
  search(prefix: string, limit = 8): string[] {
    let node = this.root;
    const lower = prefix.toLowerCase();
    for (const ch of lower) {
      if (!node.children.has(ch)) return [];
      node = node.children.get(ch)!;
    }
    const results: string[] = [];
    this._collect(node, results, limit);
    return results;
  }

  private _collect(node: TrieNode, results: string[], limit: number): void {
    if (results.length >= limit) return;
    if (node.isEnd) results.push(node.word);
    for (const child of node.children.values()) {
      if (results.length >= limit) return;
      this._collect(child, results, limit);
    }
  }
}

// ─── 2. DAMERAU-LEVENSHTEIN (with transpositions) ───────────────────────────

/**
 * Optimal string alignment distance (restricted edit distance).
 * Counts: insertions, deletions, substitutions, transpositions.
 * O(n*m) time, O(n) space (two-row DP).
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  const m = al.length;
  const n = bl.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // We only need the previous two rows
  let prevPrev = new Array<number>(n + 1).fill(0);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = al[i - 1] === bl[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost  // substitution
      );
      // transposition
      if (i > 1 && j > 1 && al[i - 1] === bl[j - 2] && al[i - 2] === bl[j - 1]) {
        curr[j] = Math.min(curr[j], prevPrev[j - 2] + cost);
      }
    }
    prevPrev = prev.slice();
    prev = curr.slice();
  }
  return curr[n];
}

export interface FuzzyMatch {
  word: string;
  distance: number;
  /** Normalised score in [0, 1] — higher is better */
  score: number;
}

/**
 * Fuzzy-match `query` against every word in `corpus`.
 * Only returns matches whose edit distance ≤ `maxDist`
 * (defaults to adaptive: floor(queryLen / 3), min 1).
 */
export function fuzzyMatch(
  query: string,
  corpus: string[],
  maxDist?: number
): FuzzyMatch[] {
  const q = query.toLowerCase();
  const threshold = maxDist ?? Math.max(1, Math.floor(q.length / 3));
  const results: FuzzyMatch[] = [];

  for (const word of corpus) {
    const w = word.toLowerCase();
    // Fast pre-filter: length difference alone can exceed threshold
    if (Math.abs(w.length - q.length) > threshold) continue;
    const dist = damerauLevenshtein(q, w);
    if (dist <= threshold) {
      const maxLen = Math.max(q.length, w.length);
      results.push({ word, distance: dist, score: 1 - dist / maxLen });
    }
  }

  return results.sort((a, b) => a.distance - b.distance || b.score - a.score);
}

// ─── 3. N-GRAM INDEX (character trigrams + Jaccard similarity) ───────────────

type NGramIndex = Map<string, Set<string>>;

function getNGrams(word: string, n = 3): string[] {
  const w = `$${word.toLowerCase()}$`; // boundary markers
  const grams: string[] = [];
  for (let i = 0; i <= w.length - n; i++) {
    grams.push(w.slice(i, i + n));
  }
  return grams;
}

export function buildNGramIndex(corpus: string[], n = 3): NGramIndex {
  const index: NGramIndex = new Map();
  for (const word of corpus) {
    for (const gram of getNGrams(word, n)) {
      if (!index.has(gram)) index.set(gram, new Set());
      index.get(gram)!.add(word);
    }
  }
  return index;
}

export interface NGramMatch {
  word: string;
  /** Jaccard similarity in [0, 1] */
  score: number;
}

export function ngramSearch(
  query: string,
  index: NGramIndex,
  n = 3,
  limit = 8
): NGramMatch[] {
  const queryGrams = new Set(getNGrams(query, n));
  const candidateCount = new Map<string, number>(); // word → shared grams

  for (const gram of queryGrams) {
    const words = index.get(gram);
    if (!words) continue;
    for (const w of words) {
      candidateCount.set(w, (candidateCount.get(w) ?? 0) + 1);
    }
  }

  const results: NGramMatch[] = [];
  for (const [word, shared] of candidateCount) {
    const wordGrams = new Set(getNGrams(word, n));
    const union = queryGrams.size + wordGrams.size - shared;
    const jaccard = union > 0 ? shared / union : 0;
    if (jaccard > 0.1) {
      results.push({ word, score: jaccard });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── 4. CORPUS ────────────────────────────────────────────────────────────────

/** Common search terms — baked in, no external download needed. */
export const COMMON_QUERIES: string[] = [
  // Tech
  'javascript', 'typescript', 'python', 'react', 'nextjs', 'nodejs', 'github',
  'docker', 'kubernetes', 'linux', 'ubuntu', 'windows', 'macos', 'terminal',
  'git', 'github actions', 'github copilot', 'vscode', 'tailwindcss', 'css',
  'html', 'rust', 'golang', 'java', 'kotlin', 'swift', 'flutter', 'firebase',
  'supabase', 'postgresql', 'mongodb', 'redis', 'graphql', 'rest api', 'websocket',
  'vercel', 'netlify', 'aws', 'cloudflare', 'openai', 'chatgpt', 'claude',
  'llm', 'machine learning', 'deep learning', 'neural network', 'pytorch',
  // Popular queries
  'weather', 'news', 'translate', 'calculator', 'maps', 'directions',
  'youtube', 'netflix', 'spotify', 'twitter', 'instagram', 'reddit',
  'wikipedia', 'how to', 'what is', 'definition of', 'meaning of',
  'tutorial', 'documentation', 'install', 'download', 'update', 'fix',
  // French
  'météo', 'actualités', 'traduction', 'recette', 'définition', 'comment',
  'qu est ce que', 'tutoriel', 'télécharger', 'installer',
];

// ─── 5. UNIFIED PREDICTION ENGINE ────────────────────────────────────────────

export interface Prediction {
  text: string;
  /** source of the prediction */
  source: 'prefix' | 'trie' | 'ngram' | 'fuzzy' | 'google';
  /** final merged score in [0, 1] */
  score: number;
}

// Module-level singletons — built once, reused on every keystroke
let _trie: Trie | null = null;
let _ngramIndex: NGramIndex | null = null;
let _corpus: string[] | null = null;

export function initSearchEngine(extraCorpus: string[] = []): void {
  _corpus = [...COMMON_QUERIES, ...extraCorpus];
  _trie = new Trie();
  for (const w of _corpus) _trie.insert(w);
  _ngramIndex = buildNGramIndex(_corpus);
}

/**
 * Main prediction function.
 * Runs Trie prefix + fuzzy + N-Gram locally, then merges & deduplicates.
 * Google suggestions are fetched separately (async) and merged in the UI.
 */
export function predict(query: string, limit = 8): Prediction[] {
  if (!query.trim() || !_trie || !_ngramIndex || !_corpus) return [];

  const q = query.toLowerCase();
  const seen = new Set<string>();
  const scored = new Map<string, number>();

  // Weight constants
  const W_PREFIX = 1.0;
  const W_TRIE   = 0.8;
  const W_NGRAM  = 0.55;
  const W_FUZZY  = 0.4;

  // Layer 1: exact prefix (starts-with in corpus)
  const prefixMatches = _corpus.filter(w => w.toLowerCase().startsWith(q));
  for (const w of prefixMatches) {
    seen.add(w.toLowerCase());
    // Score: prefix length ratio (longer match = better)
    scored.set(w, W_PREFIX * (q.length / w.length));
  }

  // Layer 2: Trie prefix
  const trieMatches = _trie.search(q, 10);
  for (const w of trieMatches) {
    const key = w.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      scored.set(w, W_TRIE * (q.length / w.length));
    }
  }

  // Layer 3: N-Gram (catches partial / middle-word matches)
  if (q.length >= 2) {
    const ngrams = ngramSearch(q, _ngramIndex, 3, 10);
    for (const { word, score } of ngrams) {
      const key = word.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        scored.set(word, W_NGRAM * score);
      } else {
        // Boost existing entry
        scored.set(word, (scored.get(word) ?? 0) + W_NGRAM * score * 0.3);
      }
    }
  }

  // Layer 4: Damerau-Levenshtein fuzzy (only for queries ≥ 3 chars, avoids noise)
  if (q.length >= 3) {
    const fuzzy = fuzzyMatch(q, _corpus, Math.max(1, Math.floor(q.length / 3)));
    for (const { word, score } of fuzzy) {
      const key = word.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        scored.set(word, W_FUZZY * score);
      } else {
        // Boost
        scored.set(word, (scored.get(word) ?? 0) + W_FUZZY * score * 0.2);
      }
    }
  }

  // Build result list, determine dominant source
  const results: Prediction[] = [];
  for (const [word, score] of scored) {
    const key = word.toLowerCase();
    let source: Prediction['source'];
    if (key.startsWith(q)) source = 'prefix';
    else if (_trie.search(q, 1).map(w => w.toLowerCase()).includes(key)) source = 'trie';
    else if (damerauLevenshtein(q, key) <= Math.max(1, Math.floor(q.length / 3))) source = 'fuzzy';
    else source = 'ngram';

    results.push({ text: word, source, score });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Merge local predictions with Google suggestions.
 * Google suggestions are given a high base score (0.9) since they are
 * real-world signals, but local exact prefix hits always outrank them.
 */
export function mergeWithGoogle(
  local: Prediction[],
  googleSuggestions: string[],
  limit = 8
): Prediction[] {
  const seen = new Set(local.map(p => p.text.toLowerCase()));
  const merged = [...local];

  for (const suggestion of googleSuggestions) {
    const key = suggestion.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({ text: suggestion, source: 'google', score: 0.9 });
    } else {
      // Boost existing entry
      const existing = merged.find(p => p.text.toLowerCase() === key);
      if (existing) existing.score = Math.min(1, existing.score + 0.15);
    }
  }

  return merged
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
