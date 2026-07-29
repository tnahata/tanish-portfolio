# 09 — Gap queue, admin access, `/asked`

← [Index](README.md) · Prev: [08 Abuse controls](08-abuse-controls.md) · Next: [10 UI](10-ui.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| Capture offered to anonymous visitors | Refusals are ungated |
| Server verifies turn ownership and outcome | The client supplies an id, not a claim |
| Notification email is plain text, never HTML | Visitor prose beside a real admin link invites a decoy |
| Reply goes to `users.email` only | No attacker-supplied address exists anywhere in the schema |
| Publish the answer only, never the question text | The question is visitor-supplied content |
| GET renders an interstitial; POST does the exchange | Mail scanners issue GETs and would burn single-use tokens |
| HMAC over a versioned fixed-order string, scope inside the signature | Not "canonical JSON"; scope is not a query parameter |
| Compare length, then `timingSafeEqual` | Otherwise a length mismatch turns a 403 into a 500 oracle |
| Per-purpose HKDF-derived signing keys | One leaked purpose does not compromise the other |
| Cookie scoped to one `gapId` for 30 minutes | A leaked link yields one question, not an admin session |
| No login page, no session table, no auth vendor | A weekly digest covers the queue |
| Publish the refusal rate on `/asked` | The credibility move |

---

1. Agent emits `refused_no_grounding`. The capture affordance is offered to anonymous visitors
   too, since refusals are ungated. See [07 Identity and the gate](07-identity-gate.md).
2. `POST /api/ask/gap` inserts a row. The server verifies the referenced turn belongs to the
   caller's session and has `outcome = 'refused_no_grounding'`; the client supplies an id, not a
   claim.
3. Resend notifies `ADMIN_EMAIL` as **plain text**, never HTML: the question, UTM source, and a
   signed capability link. Visitor prose in an HTML email alongside a real admin link is an
   invitation to inject a decoy. Email is best effort and never blocks the insert; past five per
   day, notifications coalesce into the weekly digest below.
4. Reply delivery goes to `users.email` when the session is identified. Anonymous askers get their
   answer on `/asked` only; there is no attacker-supplied address anywhere in the schema.
5. Publishing requires an explicit second confirmation and publishes **the answer only, never the
   question text**. `/asked` renders escaped plain text, no markdown, no HTML.

Publishing writes a `documents` row with `source = 'asked'` and embeds it inline, so the answer is
retrievable with no deploy. See [02 Ingest](02-ingest.md).

## Admin access

```
GET  /admin/answer/<id>?t=<token>   → static interstitial with a POST button
POST /admin/answer/<id>             → verify, exchange, redirect
```

The GET does nothing but render. Mail scanners (SafeLinks, Gmail proxy) issue GETs on every link,
which would otherwise burn a single-use token and set an admin cookie inside the scanner.

The token is an HMAC over a versioned fixed-order string containing `{jti, gapId, scope, exp}`,
not "canonical JSON", and scope is inside the signature rather than a query parameter. Compare
length first, then `timingSafeEqual`, which throws on length mismatch and would otherwise turn a
403 into a 500 length oracle. Signing keys derive per purpose:
`HKDF(ASK_SIGNING_SECRET, 'ask_sid')` and `HKDF(ASK_SIGNING_SECRET, 'admin-cap-v1')`.

Separate `answer_token_used_at` and `publish_token_used_at` columns, because one shared column
means answering a question permanently blocks publishing it.

The exchanged cookie carries `{gapId, scope, exp: +30m}`, `Path=/admin`, `SameSite=Strict`, so one
leaked link yields access to one question for thirty minutes, not a general admin session.
`/admin/*` sets `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex` and is excluded from
Vercel Analytics, which this site already mounts.

A weekly digest lists every question still `new`. No login page, no session table, no auth vendor.

## `/asked`

Reverse-chronological published answers, each linking to any blog post it grew into.

```
847 asked · 61 refused · 23 queued · 12 answered · 4 became posts
```

Publishing the refusal rate is the credibility move. Empty state renders zeros with a line
explaining the page.

The queue depends on a human answering it. See [13 Risks](13-risks.md).
