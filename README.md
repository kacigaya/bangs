# <img src="public/favicon.png" width="32" height="32" style="vertical-align:middle"> Bangs! – Lightning-fast Search Shortcuts

Bangs! is a Lightning-fast search shortcut service inspired by DuckDuckGo's "!bangs".
Type commands like `!i cat`, `!y lo-fi mix` or `!m paris café` to jump straight to the right search engine – **instantly**.

> **Live Demo**: [https://bangs-beta.vercel.app](https://bangs-beta.vercel.app)  
> **Inspiration**: This project is heavily inspired by [unduck](https://github.com/t3dotgg/unduck) by Theo Browne

---

## Browser Setup - Complete Tutorial

### Chrome / Edge / Brave

1. **Open settings**: `chrome://settings/searchEngines` (or `edge://settings/searchEngines`)
2. **Click "Add"** in the "Search engines" section
3. **Fill in the fields**:
   - **Name**: `Bangs!`
   - **Keyword**: `!` (or `bang`)
   - **URL**: `https://bangs-beta.vercel.app/search?q=%s`
4. **Click "Add"**

### Firefox

1. **Right-click** on the address bar → **"Add a Keyword for this Search"**
2. Or go to **Settings** → **Search** → **Search Shortcuts**
3. **Add manually**:
   - **Name**: `Bangs!`
   - **Keyword**: `!`
   - **URL**: `https://bangs-beta.vercel.app/search?q=%s`

### Safari

1. **Safari** → **Preferences** → **Search**
2. **Manage Websites** → **Add**
3. **URL**: `https://bangs-beta.vercel.app/search?q=%s`
4. **Title**: `Bangs!`

### How to use

Once configured, type in your address bar:
- `! !i cat` → Google search for "cat images"
- `! !y lofi music` → YouTube search for "lofi music" 
- `! !gh nextjs` → GitHub search for "nextjs"
- `! !m restaurant paris` → Google Maps for "restaurant paris"

---

## Features

- **Instant redirects** – No loading screens, everything happens client-side
- **Search history** – Automatically track and re-use recent searches from localStorage
- **Smart suggestions** – Address bar suggestions via OpenSearch with smart bang ranking
- **17 bangs** – Comprehensive shortcuts to all major search engines and tools
- **Customizable bangs** – Easily add, remove or tweak shortcuts in `src/lib/bangs.ts`
- **Beautiful dark UI** – Tailwind CSS, HeroUI components & orange gradient branding
- **Interactive glow & particles** – `tsParticles` sparkles and mouse-follow glow effects
- **Minimal redirect page** – `/search` shows only a subtle sparkle animation while redirecting
- **Fully typed** – Next.js 16 with TypeScript & App Router

| Bang | Engine | Example |
|------|--------|---------|
| `!g` | Google | `!g nextjs tutorials` |
| `!b` | Bing | `!b python docs` |
| `!d` | DuckDuckGo | `!d privacy` |
| `!y` | YouTube | `!y synthwave mix` |
| `!x` | X (Twitter) | `!x web development` |
| `!r` | Reddit | `!r react news` |
| `!w` | Wikipedia | `!w Alan Turing` |
| `!mdn` | MDN Web Docs | `!mdn javascript` |
| `!so` | Stack Overflow | `!so javascript async` |
| `!gh` | GitHub code search | `!gh nextjs middleware` |
| `!ghr` | GitHub repo | `!ghr vercel/next.js` |
| `!npm` | npm | `!npm typescript` |
| `!m` | Google Maps | `!m coffee near me` |
| `!t` | Google Translate | `!t hello spanish` |
| `!c` | ChatGPT | `!c explain quantum computing` |
| `!a` | Amazon | `!a wireless headphones` |
| `!i` | Google Images | `!i Batman` |

---

## Quick Start (Development)

```bash
# 1. Clone
git clone https://github.com/gayakaci20/bangs.git
cd bangs

# 2. Install dependencies
bun install

# 3. Run in dev mode
bun run dev
# → http://localhost:3000
```

Build for production:
```bash
bun run build && bun start
```

---

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS** & **HeroUI**
- **Lucide React** icons
- **tsParticles** (sparkles) + **Framer Motion**
- **Bun** package manager & runtime

---

## Project Structure

```
src/
  app/
    page.tsx          → Showcase landing page
    search/page.tsx   → Redirect handler
  components/
    ui/               → Glowing & particles effects
  lib/
    bangs.ts          → Bang definitions & redirect logic
```

---

## Contributing

1. Fork this repo
2. Create a branch `feat/my-awesome-bang`
3. Add / edit entries in `src/lib/bangs.ts`
4. `bun test` & `bun run lint`
5. Open a Pull Request
