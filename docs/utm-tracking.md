# UTM Tracking

## Overview

UTM parameters are query string values appended to URLs that identify where a visitor came from. Example:

```
https://tanishnahata.com?utm_source=linkedin&utm_medium=social&utm_campaign=portfolio
```

## Tagged links

Pre-built tagged URLs are exported from `lib/utm.ts` as `UTM_LINKS`. Use these when posting your portfolio URL anywhere:

| Destination | Key |
|---|---|
| LinkedIn bio | `UTM_LINKS.linkedin` |
| Twitter/X bio | `UTM_LINKS.twitter` |
| Resume PDF | `UTM_LINKS.resume` |
| GitHub profile | `UTM_LINKS.github` |
| Email signature | `UTM_LINKS.email` |

To add a new source:

```ts
import { buildUTMLink } from '@/lib/utm';
const link = buildUTMLink('https://tanishnahata.com', 'newsletter', 'email', 'portfolio');
```

## How Vercel Analytics uses UTMs

When a visitor lands on any page with UTM params in the URL, `@vercel/analytics` automatically captures them as part of the pageview. No custom code needed. Source attribution appears in the Vercel Analytics dashboard under **Sources**.

This works on the landing page only — once a visitor navigates to another page, the UTM params are no longer in the URL and VA treats subsequent pageviews as direct.

## sessionStorage persistence

`components/UTMTracker.tsx` mounts silently in the root layout and calls `lib/useUTMPersistence.ts` on every page. On landing, it reads UTM params from the URL and writes them to `sessionStorage` under the key `utm_params`:

```json
{
  "utm_source": "linkedin",
  "utm_medium": "social",
  "utm_campaign": "portfolio"
}
```

If the visitor navigates to another page (and the UTM params are no longer in the URL), the hook does nothing — the stored value is preserved for the duration of the session.

**Currently, nothing reads from sessionStorage.** The data is stored but unused.

## Future use cases for sessionStorage

Once sessionStorage is populated, the original source can be attached to any custom event fired later in the session. Some examples:

**Contact form submission attribution**
If a visitor submits the contact form, read `utm_params` from sessionStorage and include the source in the event payload — so you know whether the lead came from LinkedIn, your resume, etc.

```ts
import { track } from '@vercel/analytics';

const utmParams = JSON.parse(sessionStorage.getItem('utm_params') ?? '{}');
track('contact_form_submitted', { ...utmParams });
```

**Resume/GitHub link click tracking**
Fire a custom event when a visitor clicks an outbound link (GitHub, resume download), tagged with the original source:

```ts
const utmParams = JSON.parse(sessionStorage.getItem('utm_params') ?? '{}');
track('outbound_click', { destination: 'github', ...utmParams });
```

**Project page view attribution**
Track which projects visitors from specific sources are most interested in:

```ts
const utmParams = JSON.parse(sessionStorage.getItem('utm_params') ?? '{}');
track('project_viewed', { project: 'esmon', ...utmParams });
```

## Environment variable

The base URL used to build tagged links is controlled by `NEXT_PUBLIC_BASE_URL`:

| Environment | Value |
|---|---|
| Production | `https://tanishnahata.com` |
| Preview | `https://${VERCEL_URL}` (set in Vercel dashboard) |
| Local | Set in `.env.local` |

See `.env.example` for the required variable.
