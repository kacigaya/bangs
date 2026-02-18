import type { LucideIcon } from 'lucide-react';
import { Search, Youtube, Globe, Github, Brain, MapPin, MessageCircle, X, Image, ShoppingCart, Languages, BookOpen, Package, HelpCircle } from 'lucide-react';

export interface Bang {
  trigger: string;
  url: string;
  domain: string;
  name: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

export const BANGS: Bang[] = [
  // ── Search engines ──────────────────────────────────────────────────────────
  {
    trigger: 'g',
    url: 'https://www.google.com/search?q={{{s}}}',
    domain: 'www.google.com',
    name: 'Google',
    icon: Search,
    color: 'primary',
    description: 'Recherche universelle sur Google',
  },
  {
    trigger: 'b',
    url: 'https://www.bing.com/search?q={{{s}}}',
    domain: 'www.bing.com',
    name: 'Bing',
    icon: Search,
    color: 'primary',
    description: 'Recherche sur Bing',
  },
  {
    trigger: 'd',
    url: 'https://duckduckgo.com/?q={{{s}}}',
    domain: 'duckduckgo.com',
    name: 'DuckDuckGo',
    icon: Search,
    color: 'secondary',
    description: 'Recherche privée et sécurisée',
  },
  // ── Video / Social ──────────────────────────────────────────────────────────
  {
    trigger: 'y',
    url: 'https://www.youtube.com/results?search_query={{{s}}}',
    domain: 'www.youtube.com',
    name: 'YouTube',
    icon: Youtube,
    color: 'danger',
    description: 'Recherche de vidéos sur YouTube',
  },
  {
    trigger: 'x',
    url: 'https://x.com/search?q={{{s}}}',
    domain: 'x.com',
    name: 'X',
    icon: X,
    color: 'primary',
    description: 'Recherche sur les réseaux sociaux',
  },
  {
    trigger: 'r',
    url: 'https://www.reddit.com/search/?q={{{s}}}',
    domain: 'reddit.com',
    name: 'Reddit',
    icon: MessageCircle,
    color: 'danger',
    description: 'Discussions et communautés',
  },
  // ── Knowledge ───────────────────────────────────────────────────────────────
  {
    trigger: 'w',
    url: 'https://en.wikipedia.org/w/index.php?search={{{s}}}',
    domain: 'wikipedia.org',
    name: 'Wikipedia',
    icon: Globe,
    color: 'secondary',
    description: 'Articles Wikipédia',
  },
  {
    trigger: 'mdn',
    url: 'https://developer.mozilla.org/en-US/search?q={{{s}}}',
    domain: 'developer.mozilla.org',
    name: 'MDN Web Docs',
    icon: BookOpen,
    color: 'primary',
    description: 'Documentation web (HTML, CSS, JS)',
  },
  {
    trigger: 'so',
    url: 'https://stackoverflow.com/search?q={{{s}}}',
    domain: 'stackoverflow.com',
    name: 'Stack Overflow',
    icon: HelpCircle,
    color: 'warning',
    description: 'Questions et réponses pour développeurs',
  },
  // ── Code ────────────────────────────────────────────────────────────────────
  {
    trigger: 'gh',
    url: 'https://github.com/search?q={{{s}}}',
    domain: 'github.com',
    name: 'GitHub',
    icon: Github,
    color: 'default',
    description: 'Code et projets sur GitHub',
  },
  {
    trigger: 'ghr',
    url: 'https://github.com/{{{s}}}',
    domain: 'github.com',
    name: 'GitHub Repository',
    icon: Github,
    color: 'default',
    description: 'Accès direct aux repos GitHub',
  },
  {
    trigger: 'npm',
    url: 'https://www.npmjs.com/search?q={{{s}}}',
    domain: 'www.npmjs.com',
    name: 'npm',
    icon: Package,
    color: 'danger',
    description: 'Packages Node.js sur npm',
  },
  // ── Maps / Tools ─────────────────────────────────────────────────────────────
  {
    trigger: 'm',
    url: 'https://www.google.com/maps/search/?api=1&query={{{s}}}',
    domain: 'maps.google.com',
    name: 'Maps',
    icon: MapPin,
    color: 'success',
    description: 'Localisation et navigation',
  },
  {
    trigger: 't',
    url: 'https://translate.google.com/?q={{{s}}}&op=translate',
    domain: 'translate.google.com',
    name: 'Translate',
    icon: Languages,
    color: 'primary',
    description: 'Google Traduction',
  },
  // ── AI ──────────────────────────────────────────────────────────────────────
  {
    trigger: 'c',
    url: 'https://chatgpt.com/?q={{{s}}}',
    domain: 'chatgpt.com',
    name: 'ChatGPT',
    icon: Brain,
    color: 'warning',
    description: 'Assistant IA de OpenAI',
  },
  // ── Shopping / Images ────────────────────────────────────────────────────────
  {
    trigger: 'a',
    url: 'https://www.amazon.com/s?k={{{s}}}',
    domain: 'www.amazon.com',
    name: 'Amazon',
    icon: ShoppingCart,
    color: 'warning',
    description: 'Shopping sur Amazon',
  },
  {
    trigger: 'i',
    url: 'https://www.google.com/search?tbm=isch&q={{{s}}}&tbs=imgo:1',
    domain: 'google.com',
    name: 'Google Images',
    icon: Image,
    color: 'secondary',
    description: 'Recherche d\'images',
  },
];

const DEFAULT_BANG = BANGS.find((b) => b.trigger === 'g')!;

export function getBangRedirectUrl(query: string): string {
  if (!query.trim()) {
    return 'https://www.google.com';
  }

  const match = query.match(/!(\S+)/i);
  const bangCandidate = match?.[1]?.toLowerCase();

  const selectedBang = BANGS.find((b) => b.trigger === bangCandidate) || DEFAULT_BANG;

  const cleanQuery = query.replace(/!\S+\s*/i, '').trim();

  if (cleanQuery === '' && bangCandidate) {
    return `https://${selectedBang.domain}`;
  }

  if (cleanQuery === '') {
    return 'https://www.google.com';
  }

  const encodedQuery = encodeURIComponent(cleanQuery).replace(/%2F/g, '/');
  return selectedBang.url.replace('{{{s}}}', encodedQuery);
}
