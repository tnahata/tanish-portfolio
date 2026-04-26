# Tanish's Portfolio — CLAUDE.md

## What this is

Personal portfolio for Tanish Nahata, a software engineer focused on AI agents and full-stack systems. The site is the primary landing page linked from LinkedIn, GitHub, resume, and email.

## Dev setup

```bash
npm install
npm run dev       # localhost:3000
npm run build     # production build
npx tsc --noEmit  # type check
```

## Tech stack

- **Framework**: Next.js 14 (App Router), TypeScript
- **Styling**: Tailwind CSS + custom CSS in `styles/globals.css`
- **Analytics**: Vercel Analytics (`@vercel/analytics`)
- **Deployment**: Vercel — preview on every branch push, production on `main`

## File structure

```
app/
  layout.tsx               — root layout, mounts Analytics + UTMTracker
  page.tsx                 — home/hero
  projects/
    esmon/page.tsx         — ESMON case study
    hybrid-fit/page.tsx    — HybridFit case study
    discovery-agent/page.tsx — Discovery Agent case study
  api/og/route.tsx         — OG image generation
components/
  UTMTracker.tsx           — silent client component, persists UTM params to sessionStorage
lib/
  useUTMPersistence.ts     — hook: reads UTM params from URL, writes to sessionStorage
  utm.ts                   — buildUTMLink() + UTM_LINKS constants for all sources
docs/
  utm-tracking.md          — UTM tracking documentation and future use cases
styles/
  globals.css              — custom CSS, animations, CSS variables
public/
  images/                  — static assets
```

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | Base URL for building UTM-tagged links |

- **Production**: `https://tanishnahata.com`
- **Preview**: `https://${VERCEL_URL}` (set in Vercel dashboard — Vercel substitutes the deployment URL)
- **Local**: set in `.env.local` (gitignored, see `.env.example`)

## Branching and PRs

- `main` is production — merges deploy automatically to Vercel
- Feature work goes on named branches, PR to `main`
- Branch naming: `kebab-case` describing the change (e.g. `utm-tracking`, `add-project-x`)

## UTM tracking

Tagged links for all sharing destinations live in `lib/utm.ts` as `UTM_LINKS`. Use these when posting the portfolio URL anywhere (LinkedIn bio, resume, GitHub profile, email signature).

Vercel Analytics captures UTM params automatically from the landing page URL. `UTMTracker` additionally persists them to `sessionStorage` for future custom event attribution. See `docs/utm-tracking.md` for full details.

## Design system

**Colors**
- Background: `#0a0e27` (deep navy)
- Accent: `#00d9ff` (electric cyan)
- Secondary accent: `#6366f1` (indigo)
- Text: `#f5f5f5` (off-white)

**Typography**
- Display: Playfair Display (used sparingly for maximum impact)
- Body: Space Grotesk
- Code: JetBrains Mono

**Motion**
- Staggered page load reveals
- Scroll-triggered section entrances
- Smooth hover transitions on links and buttons

**Principles**: generous whitespace, 3-4 color max, mobile-first, WCAG AA accessibility minimum.

## Project case study pages

Located at `/projects/[slug]`. Structure for every case study:

1. Sticky nav — back link to `/#projects`
2. Hero — title, subtitle, status badge, schematic SVG (not a screenshot)
3. `01 — Overview` — two-column: sticky heading left, 2–3 paragraphs right
4. `02 — The Hard Parts` — three engineering challenge cards
5. `03 — Outcomes` — four metric callouts
6. `04 — Stack` — technology tags
7. CTA footer — primary action link

**Writing rules for case studies**
- No proprietary details: abstract to the category ("binary format", not a specific spec name)
- No code-level references: no method names, internal class names, or API routes
- Focus on decisions and tradeoffs, not feature lists
- Tone: confident, first-person, direct — no filler phrases ("leveraged", "robust", "seamless")
- No em-dashes — use periods, colons, semicolons, or parentheses instead

## Projects

**ESMON** — Analytics desktop app for Indian Railways. Parses raw binary journey data into filterable reports, time-series charts, and PDF exports. Stack: Java 21, JavaFX, Spring Boot, SQLite, Apache PDFBox, Maven, jpackage.

**HybridFit** — Training platform for hybrid athletes. Multi-plan enrollment, flexible scheduling, granular workout logging. Response caching and DB projections cut query load by over 99%. Stack: Next.js, TypeScript, NextAuth, MongoDB, Zod, Vercel.

**Discovery Agent** — AI agent project. See case study page for details.
