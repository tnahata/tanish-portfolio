# Tanish's Personal Portfolio Website

## Project Overview
A personal website showcasing my work as a software engineer, including my projects (ESMON, HybridFit), technical skills, interests in AI agents and agentic workflows, running/fitness background, and interest in logic puzzles. The site should reflect who I am: thoughtful, rigorous, ambitious to become a 100x engineer in the AI era, and someone who approaches complex problems systematically.

## Personal Brand & Design Aesthetic
**Tone**: Bold, intentional, technical but not cold. Minimalist-but-refined rather than maximalist. Avoid generic AI aesthetics.
**Core Values in Design**:
- **Authenticity**: Reflect my actual personality (analytical, passionate about systems, athletic)
- **Clarity**: Information architecture should be clean and scannable for recruiters
- **Distinctiveness**: One unforgettable visual or interaction element that signals I think differently
- **Performance**: Fast, responsive, accessible (a100x engineer cares about fundamentals)

**Design Direction**: 
Think "engineer's workspace meets editorial design." Dominant dark background (near-black or deep blue), sharp accent color (I'll go with electric blue or cyan—connects to my HybridFit theme), distinctive typography pairing (modern serif display + clean sans-serif body), subtle motion and micro-interactions that feel intentional rather than gratuitous.

### Visual Identity
- **Primary Color**: `#0a0e27` (deep navy)
- **Accent Color**: `#00d9ff` (electric cyan) — connects to HybridFit, signals tech/AI
- **Secondary Accent**: `#6366f1` (indigo) — for hierarchy, emphasis
- **Background**: `#0a0e27` or `#0f1419` (near-black with slight blue tint)
- **Text**: `#f5f5f5` (off-white, not pure white for eye comfort)
- **Typography**:
  - Display: **Playfair Display** or **Abril Fatface** (editorial, distinctive, conveys "designed with intention")
  - Body: **Space Grotesk** or **JetBrains Mono** (clean, technical, readable)
  - Code: **JetBrains Mono** (monospace, aligns with developer identity)

### Motion & Interaction
- Page load: subtle staggered reveals (h1, then sections fade in with slight delay)
- Hover states: cyan accent underlines, smooth transitions on links/buttons
- Scroll triggers: smooth section entrances as you scroll (use Intersection Observer or CSS scroll-triggered animations)
- One "hero" interaction: something memorable on the home section (e.g., a subtle parallax effect, or animated project cards that reveal on scroll)

## Technical Stack
- **Framework**: Next.js (React) with TypeScript
- **Styling**: Tailwind CSS + custom CSS for distinctive effects
- **Deployment**: Vercel (zero-config, aligns with Next.js)
- **Code Style**: TypeScript, modular components, performance-first

### File Structure (Preferred)
```
tanish-portfolio/
├── app/
│   ├── layout.tsx (global layout, nav)
│   ├── page.tsx (home/hero)
│   ├── projects/
│   │   ├── page.tsx (projects list)
│   │   └── [slug]/page.tsx (individual project details)
│   └── about/page.tsx (about, skills, interests)
├── components/
│   ├── Navigation.tsx
│   ├── Hero.tsx
│   ├── ProjectCard.tsx
│   ├── SkillGroup.tsx
│   └── Footer.tsx
├── public/
│   └── images/ (project screenshots, etc.)
├── styles/
│   └── globals.css (custom CSS, animations, theme vars)
├── CLAUDE.md (this file)
└── README.md
```

## Content Strategy
**Sections to include**:
1. **Hero**: Name, title ("Software Engineer | AI Enthusiast"), one-liner about me, CTA (e.g., "Explore my work" or "Get in touch")
2. **About**: 2-3 paragraphs on who I am, my engineering philosophy, what I care about (systems thinking, AI agents, fitness, logic puzzles)
3. **Projects**: 
   - **ESMON** (JavaFX, UI/UX redesign, design systems)
   - **HybridFit** (Next.js, full-stack, NextAuth, Zod validation, performance, Vercel deployment)
   - **Others**: Personal AI agent projects, leetcode insights, any learning projects
4. **Skills**: Organized by category (Languages, Frameworks, Concepts, Tools)
5. **Interests**: Running (half-marathon training), logic puzzles, AI/agentic systems, clean code
6. **Contact/Socials**: GitHub, LinkedIn, Twitter (if applicable), email

## Design Principles (Craft Quality)
- **Typography is primary**: Invest in font choices and hierarchy. Use the display font sparingly for maximum impact.
- **Color discipline**: 3-4 colors max. Let the accent color (cyan) sing through restraint.
- **Whitespace/Negative Space**: Generous padding and margins. Don't cramp the layout.
- **Micro-interactions**: Smooth, purposeful. Hover states, focus states (accessibility), scroll reveals—all coordinated.
- **Responsive**: Mobile-first. The site should look intentional on every screen size.
- **Performance**: Lazy-load images, minimize JS, optimize fonts (system fonts as fallback).
- **Accessibility**: WCAG AA minimum. Semantic HTML, alt text, sufficient color contrast, keyboard navigation.
