'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Zap, ArrowRight } from 'lucide-react';
import { BANGS } from '@/lib/bangs';
import {
  initSearchEngine,
  predict,
  mergeWithGoogle,
  type Prediction,
} from '@/lib/search-engine';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BangSuggestion {
  type: 'bang';
  trigger: string;
  name: string;
  description: string;
}

interface TextSuggestion {
  type: 'text';
  text: string;
  source: Prediction['source'];
  score: number;
}

type SuggestionItem = BangSuggestion | TextSuggestion;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Source label shown as a subtle badge */
function sourceLabel(source: Prediction['source']): string {
  switch (source) {
    case 'prefix': return 'prefix';
    case 'trie':   return 'trie';
    case 'ngram':  return 'n-gram';
    case 'fuzzy':  return 'fuzzy';
    case 'google': return 'google';
  }
}

function sourceBadgeClass(source: Prediction['source']): string {
  switch (source) {
    case 'prefix': return 'text-yellow-400/70 bg-yellow-400/10';
    case 'trie':   return 'text-blue-400/70 bg-blue-400/10';
    case 'ngram':  return 'text-purple-400/70 bg-purple-400/10';
    case 'fuzzy':  return 'text-orange-400/70 bg-orange-400/10';
    case 'google': return 'text-green-400/70 bg-green-400/10';
  }
}

/** Bold the part of `text` that matches `query` */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-white">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Init engine once ─────────────────────────────────────────────────────────

let engineReady = false;

function ensureEngine() {
  if (!engineReady) {
    // Seed the corpus with bang names and triggers
    const bangCorpus = BANGS.flatMap(b => [b.name.toLowerCase(), b.trigger]);
    initSearchEngine(bangCorpus);
    engineReady = true;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SearchBarProps {
  placeholder?: string;
  locale?: 'fr' | 'en';
}

export function SearchBar({ placeholder, locale = 'en' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(query, 280);

  const defaultPlaceholder = locale === 'fr'
    ? 'Essayez !y lofi music ou recherchez quelque chose…'
    : 'Try !y lofi music or search anything…';

  // Init engine on first render
  useEffect(() => { ensureEngine(); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Build suggestions whenever debounced query changes
  const buildSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    ensureEngine();

    const items: SuggestionItem[] = [];

    // ── Bang suggestions ──────────────────────────────────────────────────
    const isBangQuery = q.startsWith('!');
    if (isBangQuery) {
      const bangPrefix = q.slice(1).toLowerCase();
      const bangMatches = BANGS.filter(b =>
        b.trigger.startsWith(bangPrefix) ||
        b.name.toLowerCase().startsWith(bangPrefix)
      ).slice(0, 5);

      for (const b of bangMatches) {
        items.push({
          type: 'bang',
          trigger: b.trigger,
          name: b.name,
          description: b.description,
        });
      }
    }

    // ── Extract the text part of the query (strip leading !bang prefix) ──
    const textQuery = isBangQuery
      ? q.replace(/^!\S+\s*/, '').trim()  // text after the bang
      : q;

    const queryForSuggest = textQuery || (isBangQuery ? '' : q);

    if (queryForSuggest.length >= 1) {
      // Layer 1–4: local prediction engine
      const localPredictions = predict(queryForSuggest, 6);

      // Async Layer 5: Google Suggest proxy
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setIsLoading(true);

      let googleSuggestions: string[] = [];
      try {
        const res = await fetch(
          `/api/suggestions?q=${encodeURIComponent(queryForSuggest)}`,
          { signal: abortRef.current.signal }
        );
        if (res.ok) {
          googleSuggestions = await res.json() as string[];
        }
      } catch {
        // Aborted or network error — use local results only
      } finally {
        setIsLoading(false);
      }

      const merged = mergeWithGoogle(localPredictions, googleSuggestions, 7);

      for (const p of merged) {
        items.push({
          type: 'text',
          text: p.text,
          source: p.source,
          score: p.score,
        });
      }
    }

    setSuggestions(items);
    setOpen(items.length > 0);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    buildSuggestions(debouncedQuery);
  }, [debouncedQuery, buildSuggestions]);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      } else {
        // Submit current query
        submitQuery(query);
      }
    }
  }

  function selectSuggestion(item: SuggestionItem) {
    if (item.type === 'bang') {
      // Insert bang prefix so the user can keep typing
      const newVal = `!${item.trigger} `;
      setQuery(newVal);
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      // Fill input and submit
      setQuery(item.text);
      setOpen(false);
      submitQuery(item.text);
    }
  }

  function submitQuery(q: string) {
    if (!q.trim()) return;
    window.location.href = `/search?q=${encodeURIComponent(q)}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectSuggestion(suggestions[activeIndex]);
    } else {
      submitQuery(query);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="relative flex items-center">
          {/* Search icon */}
          <Search className="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none z-10" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
            placeholder={placeholder ?? defaultPlaceholder}
            className="w-full pl-12 pr-12 py-4 text-sm text-white placeholder-gray-500
                       bg-gray-900/80 border border-gray-700 rounded-2xl
                       focus:outline-none focus:border-yellow-500/60 focus:ring-2 focus:ring-yellow-500/20
                       backdrop-blur-sm transition-all duration-200"
            aria-label="Search"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          />

          {/* Submit arrow */}
          <button
            type="submit"
            className="absolute right-3 p-1.5 rounded-lg text-gray-400 hover:text-yellow-400
                       hover:bg-yellow-400/10 transition-colors duration-150"
            aria-label="Search"
          >
            {isLoading
              ? <div className="w-4 h-4 border-2 border-gray-600 border-t-yellow-400 rounded-full animate-spin" />
              : <ArrowRight className="w-4 h-4" />
            }
          </button>
        </div>
      </form>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 z-50
                     bg-gray-900/95 border border-gray-700 rounded-2xl
                     backdrop-blur-sm shadow-2xl shadow-black/40
                     overflow-hidden"
        >
          {/* Bang section */}
          {suggestions.some(s => s.type === 'bang') && (
            <>
              <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-xs font-medium text-yellow-400/80 uppercase tracking-wider">
                  Bangs
                </span>
              </div>
              {suggestions
                .filter((s): s is BangSuggestion => s.type === 'bang')
                .map((item, i) => {
                  const globalIdx = suggestions.indexOf(item);
                  return (
                    <div
                      key={`bang-${item.trigger}`}
                      id={`suggestion-${globalIdx}`}
                      role="option"
                      aria-selected={globalIdx === activeIndex}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onMouseDown={e => { e.preventDefault(); selectSuggestion(item); }}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-100
                        ${globalIdx === activeIndex
                          ? 'bg-yellow-500/10 border-l-2 border-yellow-400'
                          : 'border-l-2 border-transparent hover:bg-gray-800/60'
                        }`}
                    >
                      {/* Badge */}
                      <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold text-yellow-400 bg-yellow-400/15 rounded-md border border-yellow-400/20">
                        !{item.trigger}
                      </span>
                      <span className="text-sm font-medium text-gray-200">{item.name}</span>
                      <span className="text-xs text-gray-500 truncate ml-auto">{item.description}</span>
                    </div>
                  );
                })}
            </>
          )}

          {/* Divider between bangs and text */}
          {suggestions.some(s => s.type === 'bang') && suggestions.some(s => s.type === 'text') && (
            <div className="mx-4 my-1 border-t border-gray-700/60" />
          )}

          {/* Text suggestion section */}
          {suggestions.some(s => s.type === 'text') && (
            <>
              <div className="px-4 pt-2 pb-1 flex items-center gap-2">
                <Search className="w-3 h-3 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Suggestions
                </span>
              </div>
              {suggestions
                .filter((s): s is TextSuggestion => s.type === 'text')
                .map(item => {
                  const globalIdx = suggestions.indexOf(item);
                  const rawQuery = query.startsWith('!')
                    ? query.replace(/^!\S+\s*/, '').trim()
                    : query;
                  return (
                    <div
                      key={`text-${item.text}`}
                      id={`suggestion-${globalIdx}`}
                      role="option"
                      aria-selected={globalIdx === activeIndex}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onMouseDown={e => { e.preventDefault(); selectSuggestion(item); }}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-100
                        ${globalIdx === activeIndex
                          ? 'bg-yellow-500/10 border-l-2 border-yellow-400'
                          : 'border-l-2 border-transparent hover:bg-gray-800/60'
                        }`}
                    >
                      <Search className="flex-shrink-0 w-3.5 h-3.5 text-gray-600" />
                      <span className="text-sm text-gray-300 flex-1 truncate">
                        {highlightMatch(item.text, rawQuery)}
                      </span>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded uppercase tracking-wide ${sourceBadgeClass(item.source)}`}>
                        {sourceLabel(item.source)}
                      </span>
                    </div>
                  );
                })}
            </>
          )}

          <div className="pb-2" />
        </div>
      )}
    </div>
  );
}
