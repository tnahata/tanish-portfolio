# UX Audit Fixes — Report

Branch: `ux-fixes` (from `origin/main` at `422bf04`)
Preview: https://tanish-portfolio-git-ux-fixes-tanish-nahatas-projects.vercel.app (protected by Vercel deployment auth — accessible to the account owner)
Production baseline measured: https://tanishnahata.com (2026-08-02)

All numbers below were captured with Playwright (`browser_evaluate`) computing `document.documentElement.scrollWidth`, WCAG contrast ratios, and `getBoundingClientRect()` heights directly in a live browser, not estimated.

---

## Finding 1 — Footer horizontal overflow at 390px

**Files:** `components/FooterBar.tsx`, `components/Footer.tsx`

**Change:** The footer nav `<ul>` was `display:flex; gap:2rem` with no wrap. Added `flexWrap: 'wrap'` and a responsive `gap: clamp(0.75rem, 3vw, 2rem)`. `Footer.tsx`'s `<footer>` already had `overflow: 'hidden'` set (pre-existing), which already clips the decorative infinity glyph — no change needed there.

**Before:** `document.documentElement.scrollWidth` = **459px** at 390px viewport on `/` (matches the audit's cited 459px exactly).
**After:** `document.documentElement.scrollWidth` = **390px** on every route: `/`, `/blog`, `/blog/thread-sleep-8000`, `/stack`, `/opinions`, `/projects/esmon`, `/projects/hybrid-fit`, `/projects/noiseless`.

Screenshots: `prod-home-mobile-hero.png` / `prod-footer-mobile.png` (before) vs `preview-home-mobile-hero-localbuild.png` / `preview-footer-mobile-localbuild.png` (after).

---

## Finding 2 — Mobile hero radar chart collides with text

**File:** `app/HomeClient.tsx`

**Change:** Below 768px viewport width, skip the `ctx.fillText(AXES[i].label, ...)` calls entirely and reduce the radar radius from `0.38` to `0.28` of `min(W,H)`.

**Before:** Axis labels (Systems, Full Stack, Soccer, Running, Golf, Tennis, Lifting) rendered on the canvas at `r=1.18` landed inside the bio paragraph and CTA buttons at 390px.
**After:** No labels drawn below 768px; radius shrunk so the chart reads as background decoration behind the text. Verified visually — see `preview-home-mobile-hero-localbuild.png`.

---

## Finding 3 — Footer double-dimming (contrast)

**Files:** `app/globals.css`, `components/FooterBar.tsx`, `components/Footer.tsx`

**Change:** Added `--color-text-dim: #7d87ab` token. Removed `opacity: 0.45` (copyright) and `opacity: 0.55` (nav links, plus the hover handlers that reset it to 0.55) from `FooterBar.tsx`; removed `opacity: 0.6` from the three labels (EMAIL / RESUME / SOCIALS) in `Footer.tsx`. All now use `color: var(--color-text-dim)` directly. Hover still brightens via a color swap only (no opacity).

**Before (production, measured):** copyright/nav text = `#b0b0b0` at `opacity:0.45` → effective blended color `rgb(85,87,101)` against `#0a0e27` → **contrast 2.65:1** (fails WCAG AA 4.5:1).
**After:** `color: rgb(125,135,171)` (`#7d87ab`), no opacity → **contrast 5.362:1** (matches the audit's expected 5.36:1), passes AA.

---

## Finding 8 — Blog body line length

**File:** `app/blog/[slug]/BlogPostView.tsx`

**Change:** Wrapped `<MDXRemote>` in `<div style={{ maxWidth: '70ch' }}>`, matching the hero title's existing `55ch`. Left-aligned (not centered) to stay consistent with the hero title directly above it, which is also left-aligned under the same `max-w-7xl` container — centering just the body would have misaligned it against the title.

**Before:** paragraph width = **1152px** at 1440px viewport (full container width).
**After:** paragraph width = **717.8px** at 1440px viewport. Slightly over the "~700px" estimate in the finding (70ch renders wider than 700px in Space Grotesk at 1rem), but consistent with the explicit "70ch" instruction and the existing 55ch convention.

---

## Finding 9 — Redirect /projects/discovery-agent

**File:** `next.config.ts`

**Change:** Added a `permanent: true` redirect entry `/projects/discovery-agent → /projects/noiseless` (the project was rebranded and its route moved in a prior PR, but no redirect was left behind).

**Before:** `curl -I https://tanishnahata.com/projects/discovery-agent` → `404`.
**After (local + live preview):** `HTTP/1.1 308 Permanent Redirect`, `location: /projects/noiseless`. Verified with `curl -I` locally and by navigating the live preview URL directly (landed on `/projects/noiseless`).

---

## Finding 10 — Touch targets

**Files:** `components/FooterBar.tsx`, `components/Footer.tsx`, `components/Projects.tsx`, `components/Nav.tsx`

Technique varies by element: text-only links get invisible padding + an equal negative margin (enlarges the hit box without moving anything else in the layout). The copy-email button has a visible border, so padding would have visibly enlarged it — instead it gets a `position:relative` + `::before { inset: -12px }` pseudo-element hit area, which is invisible and doesn't change the button's rendered size.

| Element | Before (prod, measured) | After (measured) |
|---|---|---|
| Footer nav links (FooterBar) | 15.5px | 45.2px |
| Project card CTAs ("View Case Study" / "Try It" / "View Project") | 18.4-20.0px | 46.4-48.0px |
| Copy-email button | 23x27px visible / no extended hit area | 23x27px visible (unchanged) / 47x51px effective hit area (`::before` inset) |
| Nav hamburger | 30px | 46px |

All meet the >=44px bar; nothing required the >=40px fallback.

---

## Finding 12 — Hide Opinions nav item

**Files:** `components/Nav.tsx`, `components/FooterBar.tsx`

**Change:** Removed the `Opinions` entry from `Nav.tsx`'s `LINKS` and `FooterBar.tsx`'s `NAV` arrays (commented, not deleted, with a one-line pointer). `app/opinions/page.tsx` is untouched — direct URL still resolves (verified 200, still renders "Coming soon!").

**Before:** "Opinions" visible in both the primary nav and footer nav.
**After:** Not present in primary nav (`Home, Blog, Stack`) or footer nav (`About, Projects, Blog, Stack, Contact`) — confirmed via DOM query on the live preview and in the footer screenshot.

---

## Finding 14a — Playfair scoping

**File:** `app/globals.css`

**Change:** `h1, h2, h3, h4, h5, h6 { font-family: var(--font-display); }` split into `h1, h2 { font-family: var(--font-display); }` and a separate `h3, h4, h5, h6` rule with no font-family override (falls back to body face).

**Elements that changed font: none.** Every h3 in the codebase already declares `fontFamily` inline (case study "Hard Parts" card titles, project card titles, blog card titles, Experience role titles all set `var(--font-display)` explicitly; About's feature labels set `var(--font-body)` explicitly). Inline styles always beat a tag-selector rule in specificity, so the CSS-only elements were never affected by the global rule in the first place. Verified by diffing `getComputedStyle(h).fontFamily` for every heading on `/`, `/projects/esmon`, and the blog post before and after the change — identical in both cases. The change is defensive: it stops any future h3+ added without an explicit font choice from silently defaulting to Playfair.

---

## Finding 14b — Tag consistency

**Files:** `components/Projects.tsx`, `app/projects/hybrid-fit/page.tsx`, `app/projects/noiseless/page.tsx`

**Change:** Replaced HybridFit's green (`rgba(34,197,94,0.65)`) and Noiseless's indigo (`rgba(99,102,241,0.7)`) tag styling, and bumped home's cyan from `0.55` to `0.65` alpha, so all four surfaces (home, ESMON, HybridFit, Noiseless) render tags identically: `color: rgba(0,217,255,0.65)`, `border: 1px solid rgba(0,217,255,0.18)`, `background: rgba(0,217,255,0.04)`. Only the tag chips changed — breadcrumbs, card numbers, subtitles, and kickers are untouched, matching the explicit exception in the brief.

**Before:** three different treatments across four surfaces.
**After:** one treatment (cyan, 0.65 alpha) everywhere, ~5.14:1 contrast per the finding. Verified via `getComputedStyle` on tag `<span>` elements on all four pages.

---

## Hygiene

### Favicon
**File:** `app/icon.tsx` (new)
Next's `icon.tsx` convention — 32x32 PNG, navy background, cyan "N", generated via `next/og`'s `ImageResponse`.
**Before:** `GET /favicon.ico` → 404, logged as a console error on every page load.
**After:** Next auto-injects `<link rel="icon" href="/icon?...">`; `/favicon.ico` is never requested. Confirmed zero favicon-related console errors on the live preview and local build.

### Blog SVG preloads
**File:** `app/blog/[slug]/BlogPostView.tsx`
**Root cause:** Server Components auto-preload every `<img>` rendered during SSR regardless of scroll position — not literally "every route" as the finding phrased it (confirmed via `curl` that the preloads only appeared on `/blog/thread-sleep-8000` itself, the one page that renders those images), but real: all three diagram SVGs in that post were preloaded on initial load even though two are far below the fold.
**Fix:** `loading="lazy"` on the MDX `img` component.
**Before:** `curl https://tanishnahata.com/blog/thread-sleep-8000` shows three `<link rel="preload" as="image">` tags for `architecture-overview.svg`, `before-hardcoded-delay.svg`, `after-redis-coordination.svg`.
**After:** Zero preload tags for those files (verified via the same `curl | grep`).

### Per-page metadata titles
**Files:** `app/projects/esmon/page.tsx`, `app/projects/hybrid-fit/page.tsx`, `app/projects/noiseless/page.tsx`, `app/stack/page.tsx` + new `app/stack/StackPageClient.tsx`, `app/opinions/page.tsx` + new `app/opinions/OpinionsPageClient.tsx`.
`/stack` and `/opinions` were client components, which the App Router does not allow to export `metadata` — split each into a thin server `page.tsx` (metadata only) rendering the existing logic, now in a sibling `*PageClient.tsx`, unchanged.
**Before:** all five routes fell back to the root layout's title, `"Tanish Nahata — Software Engineer"`.
**After:** `"ESMON — Tanish Nahata"`, `"HybridFit — Tanish Nahata"`, `"Noiseless — Tanish Nahata"`, `"Stack — Tanish Nahata"`, `"Opinions — Tanish Nahata"` — confirmed via `document.title` / page snapshot title on local build and live preview.

### Hydration error #418 — root cause and fix
**Files:** `components/LatestWriting.tsx`, `app/blog/BlogList.tsx`, `app/blog/[slug]/BlogPostView.tsx`

**Root cause:** all three files format post dates with `new Date(dateStr).toLocaleDateString('en-US', {...})` and no explicit `timeZone`. Post dates in frontmatter are date-only strings (`"2026-05-21"`), which parse to UTC midnight; `toLocaleDateString` without a pinned `timeZone` then renders in whatever local timezone the *executing* JS engine has. Vercel's server region (`iad1`) runs Node in UTC; a visitor's browser runs in their own local timezone. For any visitor west of UTC, the client can compute a different calendar day than what the server already rendered into the HTML — a genuine text mismatch between SSR and hydration, on any route that shows a post date (`/`, `/blog`, every blog post). This is why it fired "on every page load": `LatestWriting` renders on the home page.

This did **not** reproduce on `localhost` (`next dev` or `next start`) because local SSR and local CSR run on the same machine, in the same timezone, so there was nothing to disagree about — reproduction required testing against the actually-deployed site. It reproduced reliably on `https://tanishnahata.com`.

**Fix:** added `timeZone: 'UTC'` to the `Intl.DateTimeFormat` options in all three call sites, making the formatted output identical regardless of where it executes.

**Before (production):**
```
Error: Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]=
```
on `/` (and reproducible on `/blog`, `/blog/thread-sleep-8000`).

**After:** Reloaded `/` and `/blog/thread-sleep-8000` on the live `ux-fixes` preview deployment (real Vercel infra, `iad1`, same cross-region conditions that reproduced the bug) — **zero console errors or warnings** on either route.

Did not use `suppressHydrationWarning`: the mismatch was a real bug with a real fix, not an intentional client/server difference.

---

## What was NOT changed (explicitly out of scope)

- The indigo `#6366f1 -> #818cf8` swap and cyan-alpha raises on breadcrumbs/dates/tags/card numbers — owner still deciding, per the brief.
- Local secrets/config files were never read (hook-enforced, and not needed for this task).
- The old `/projects/ai-agent -> /projects/discovery-agent` redirect entry was left as-is; it now double-hops through the new `discovery-agent -> noiseless` rule to reach the live page, which the brief only asked to add, not consolidate.
- `FooterBar.tsx`'s `new Date().getFullYear()` copyright year is technically the same class of hydration hazard (static build vs. client compute) as the bug fixed above, but it isn't currently mismatched (site was last built in 2026) and wasn't part of the audit's findings — left alone to avoid unrequested scope expansion.
- `npm test` — no test script exists in this repo (pre-existing; not introduced by this task).

---

## Verification summary

- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- `npm run build`: clean (11 routes, all render)
- `npm test`: no test script in this repo (N/A)
- Local `next start` (production build), Playwright at 1440px and 390px: all acceptance criteria above confirmed on every route
- Live preview (`ux-fixes` branch, Vercel deployment `dpl_5jonMfXdzBAsM6cvkfG7Gnd63XFB`, READY): redirect, hydration console cleanliness, footer contrast/nav content, and tag colors re-verified directly (via the account owner's authenticated Chrome session, since Vercel preview deployments are protected by Vercel Authentication and reject unauthenticated tools like plain `curl` or a fresh Playwright context)
- **One caveat:** the sandboxed browser used for the authenticated preview session is locked to a fixed desktop window size (`resize_window` had no effect — `window.screen.width` stayed 1512 regardless), so the 390px mobile screenshots of the *live preview* could not be captured directly. Mobile screenshots included here (`*-localbuild.png`) are from the local production build (`next start`) of the identical commit that's deployed — same code, verified separately at exact 390px viewport via Playwright, including the `scrollWidth === 390` check that failed on production at 459px.

## Screenshots in this directory

| File | What |
|---|---|
| `prod-home-desktop.png` | Production home, 1440px (hydration error present) |
| `prod-home-mobile-hero.png` | Production home, 390px (scrollWidth 459, radar labels overlapping text) |
| `prod-footer-mobile.png` | Production footer, 390px (overflowing, dim text) |
| `prod-blog-post-desktop.png` | Production blog post, 1440px (full-width body) |
| `prod-esmon-desktop.png` | Production ESMON case study, 1440px |
| `preview-home-desktop.jpg` | Live ux-fixes preview, home, desktop |
| `preview-footer-desktop.jpg` | Live ux-fixes preview, footer, desktop (Opinions gone, brighter text, tags cyan) |
| `preview-blog-post-desktop.jpg` | Live ux-fixes preview, blog post, desktop |
| `preview-esmon-casestudy-desktop.jpg` | Live ux-fixes preview, ESMON, desktop (title bar confirms metadata title) |
| `preview-home-mobile-hero-localbuild.png` | Local build (same commit), home, 390px — no radar labels overlapping |
| `preview-footer-mobile-localbuild.png` | Local build (same commit), footer, 390px — no overflow, brighter text, Opinions gone |
| `preview-blog-post-desktop-localbuild.png` | Local build (same commit), blog post, 1440px — 70ch body |
| `preview-esmon-desktop-localbuild.png` | Local build (same commit), ESMON, 1440px |
