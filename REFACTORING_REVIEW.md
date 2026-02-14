# Codebase Refactoring Review

## 1. Duplicate & Unused Dependencies

### Problem: `framer-motion` and `motion` are both installed
`motion` (v12) is the **renamed successor** to `framer-motion`. Having both in `package.json` is redundant — they're the same library under different names.

```json
// package.json — BEFORE
"framer-motion": "^12.19.1",
"motion": "^12.19.1",
```

**Fix:** Remove `framer-motion`. The codebase already imports from `motion/react` (the correct modern import path).

### Problem: `ogl` is installed but never used
The `ogl` 3D graphics library (`^1.0.11`) is listed as a dependency but is not imported anywhere in the codebase.

**Fix:** Remove it from `package.json`.

---

## 2. Insecure HTTP URL

### `src/lib/bangs.ts:97`
The Google Images bang uses plain `http://` instead of `https://`:

```ts
// BEFORE
u: 'http://google.com/search?tbm=isch&q={{{s}}}&tbs=imgo:1',

// AFTER
u: 'https://www.google.com/search?tbm=isch&q={{{s}}}&tbs=imgo:1',
```

---

## 3. Cryptic Property Names in `BANGS` Array

### `src/lib/bangs.ts`
The bang objects use single-letter property names (`t`, `u`, `d`, `s`) that are hard to understand without context:

```ts
// BEFORE — What does 't', 'u', 'd', 's' mean?
{ t: 'g', u: 'https://...', d: 'www.google.com', s: 'Google', ... }

// AFTER — Self-documenting
{ trigger: 'g', url: 'https://...', domain: 'www.google.com', name: 'Google', ... }
```

A proper TypeScript interface should be defined:

```ts
export interface Bang {
  trigger: string;
  url: string;
  domain: string;
  name: string;
  icon: LucideIcon;
  color: string;
  description: string;
}
```

---

## 4. Bloated Sparkles Configuration (~400 lines of defaults)

### `src/components/ui/sparkles.tsx`
The particle options object contains ~370 lines of configuration, most of which are **just restating the library's defaults** (e.g., `enable: false`, `value: 0`, empty objects). Only ~30 lines are actually meaningful.

**Fix:** Only specify the options that differ from defaults. The tsParticles library applies sensible defaults for everything not specified.

---

## 5. Console.log Statements Left in Production Code

### `src/app/search/page.tsx:10-14`
Debug logging is left in the redirect handler:

```ts
console.log('Search query:', q);
console.log('Redirect URL:', redirectUrl);
```

**Fix:** Remove these entirely.

---

## 6. Duplicate CSS Classes

### `src/app/page.tsx:461`
The footer has conflicting `mt-8 mt-10`:

```tsx
<footer className="... mt-8 mt-10 mb-10 ..."
```

Only `mt-10` will apply (last wins in Tailwind). The `mt-8` is dead code.

---

## 7. Accessibility Issue: Non-interactive Element with Click Handler

### `src/app/page.tsx:461`
The `<footer>` uses `onClick` to navigate but has no keyboard support, no role, and no focus handling:

```tsx
// BEFORE
<footer className="..." onClick={() => window.open("https://github.com/gayakaci20/bangs", "_blank")}>

// AFTER — Use an actual <a> tag
<footer className="...">
  <a href="https://github.com/gayakaci20/bangs" target="_blank" rel="noopener noreferrer">
    ...
  </a>
</footer>
```

---

## 8. Unnecessary `typeof window` Check Inside `useEffect`

### `src/app/page.tsx:106`
```ts
useEffect(() => {
  if (typeof window !== 'undefined') { // <-- unnecessary
    setCurrentUrl(`${window.location.origin}/search?q=%s`);
```

`useEffect` only runs client-side. The `typeof window` guard is redundant.

---

## 9. Fragile Index-Based Translation Mapping

### `src/app/page.tsx:129-143`
English translations use numeric index keys that are tightly coupled to array position:

```ts
const descEn: Record<number, string> = {
  0: 'Universal search on Google',
  1: 'Video search on YouTube',
  // ... if BANGS order changes, all indices break
};
const getDesc = (index: number) => (locale === 'fr' ? BANGS[index].description : descEn[index]);
```

**Fix:** Use the bang trigger as the key instead of array index:

```ts
const descEn: Record<string, string> = {
  g: 'Universal search on Google',
  y: 'Video search on YouTube',
  // ...
};
const getDesc = (bang: Bang) => locale === 'fr' ? bang.description : descEn[bang.trigger];
```

---

## 10. Tailwind Config Uses Outdated CommonJS Syntax

### `tailwind.config.js`
The project uses Tailwind CSS v4 with `@tailwindcss/postcss`, but the config file uses CommonJS (`require`, `module.exports`) while the rest of the project uses ESM:

```js
// BEFORE
const {heroui} = require("@heroui/react");
module.exports = { ... };
```

**Fix:** Convert to ESM to match the rest of the project.

---

## 11. Search Page Should Use Next.js APIs

### `src/app/search/page.tsx`
The search redirect page is entirely client-side (`'use client'` + `useEffect` + `window.location`). A server-side middleware or route handler would be faster since it avoids downloading JS, hydrating, and then redirecting.

**Recommendation:** Consider using Next.js middleware (`middleware.ts`) to handle `/search?q=...` redirects at the edge, eliminating the need for the client-side page entirely.

---

## 12. GlowingEffect Props Repeated Identically 6 Times

### `src/app/page.tsx`
The same `<GlowingEffect>` configuration appears verbatim 6 times:

```tsx
<GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
```

**Fix:** Extract a preconfigured wrapper or define default props.

---

## Summary of Changes Made

| Change | File(s) | Impact |
|--------|---------|--------|
| Remove `framer-motion` duplicate dep | `package.json` | Smaller bundle |
| Remove unused `ogl` dep | `package.json` | Smaller bundle |
| Fix HTTP → HTTPS | `src/lib/bangs.ts` | Security |
| Add `Bang` TypeScript interface | `src/lib/bangs.ts` | Readability |
| Rename cryptic properties | `src/lib/bangs.ts`, `src/app/page.tsx` | Readability |
| Simplify sparkles config | `src/components/ui/sparkles.tsx` | Maintainability |
| Remove `console.log` | `src/app/search/page.tsx` | Production hygiene |
| Fix duplicate CSS class | `src/app/page.tsx` | Correctness |
| Fix footer accessibility | `src/app/page.tsx` | Accessibility |
| Remove unnecessary window check | `src/app/page.tsx` | Code cleanliness |
| Refactor translation mapping | `src/app/page.tsx` | Robustness |
| Modernize tailwind config | `tailwind.config.js` | Consistency |
