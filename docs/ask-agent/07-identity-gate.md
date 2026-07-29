# 07 — Identity, the gate, environments, privacy

← [Index](README.md) · Prev: [06 Personality](06-personality.md) · Next: [08 Abuse controls](08-abuse-controls.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| The gate is on generation, not on message count | Cost, abuse risk, and attribution value all live on the generation path |
| Refusals unlimited and anonymous | Refusal is the differentiated behavior; hiding it hides the product |
| First generated answer free, second requires Google sign-in | Preserves per-user limits, cost attribution, analytics |
| Free generation counted per IP prefix: /32 IPv4, /56 IPv6 | Hashing a full IPv6 address gives 2^64 free generations per subscription |
| IP salt derives as `HMAC(seed, utcDate)` | Rotation and window boundaries coincide instead of resetting mid-window |
| Signed `ask_sid` cookie | It now authorizes a free generation |
| Standard Google button, not One Tap | One Tap is mid-migration to FedCM and degrades without third-party cookies |
| Nonce plus Origin check on identify | Otherwise any token for this public client replays, and login-CSRF binds sessions |
| Guard on `VERCEL_ENV` and `Host`, never `NODE_ENV` | `NODE_ENV` is `production` on previews; old deployments keep public immutable URLs |
| Deletion by email request, no self-serve endpoint | A self-serve delete is a free reset of every per-user limit and spend counter |
| Gate smoke-tested by hand, not Playwright | Google blocks automated browsers |

---

**The gate is on generation, not on message count.**

Refusals cost one embedding call, roughly a thousandth of a cent, and never invoke Sonnet.
Generation is where cost, abuse risk, and attribution value all live. So:

- **Refusals are unlimited and anonymous.** A visitor can watch the agent decline, see the trace,
  and use the capture affordance without signing in. Refusal is the differentiated behavior; hiding
  it behind auth would hide the product.
- **The first generated answer is free. The second requires Google sign-in.**

This preserves everything identity was for (per-user rate limits, cost attribution, analytics)
because everything expensive is on the generation path.

`ask_sid` is a **signed** httpOnly SameSite=Lax cookie holding a session UUID. Signed because it
now authorizes a free generation.

**The free generation is counted per IP prefix, not per cookie**, as the `ip:<prefix_hash>:gen`
bucket in `rate_counters`, where `prefix_hash` covers the **/32 for IPv4 and /56 for IPv6**. Hashing
a full IPv6 address gives an attacker 2^64 free generations from one subscription. The salt derives
as `HMAC(seed, utcDate)` and every counter keyed on it uses the same `utcDate`, so rotation and
window boundaries coincide instead of silently resetting mid-window.

The counter is a single `insert … on conflict do update … returning count`: `count = 1` is the free
grant. Atomic in one statement, so two simultaneous first requests cannot both be free. See
[08 Abuse controls](08-abuse-controls.md).

Because the salt rotates daily, this grants **one free generation per IP prefix per day**, not one
ever. A permanent counter would need a stable hash of a visitor's address, which is exactly what the
rotating salt exists to prevent. Sustained use is bounded by the per-user limits, not by this.

## Mechanics

Standard Sign in with Google button, not One Tap (mid-migration to FedCM, degrades where
third-party cookies are blocked).

```
server  → nonce = random; insert into login_nonces (nonce, session_id, expires_at)
client  → Google button returns an ID token carrying that nonce
        → POST /api/ask/identify { credential }        (Origin checked)
server  → verifyIdToken(credential, { audience: GOOGLE_CLIENT_ID })
        → assert iss ∈ {accounts.google.com, https://accounts.google.com}
        → assert email_verified === true
        → delete from login_nonces
           where nonce = $1 and session_id = $2 and expires_at > now()
           returning 1                                 -- no row means replay: reject
        → reject if sessions.user_id already set to a different user
        → upsert users by `sub`; never trust client-decoded claims
        → set sessions.user_id, replay the held question
```

Without the nonce, any ID token minted for this public client ID replays. Without the Origin
check, login-CSRF binds a victim's session to an attacker's account.

`delete … returning` is the single-use guarantee. One statement, so a replayed token racing the
original cannot both find the nonce present. Expiry is enforced in the predicate rather than by a
TTL, so a nonce past 300 seconds is dead whether or not anything has swept the table yet.

Scopes are `openid`, `email`, `profile`, all non-sensitive, so **no Google app review is
required**. The ID token flow needs only the client ID, no secret.

A **separate OAuth client for development** with `localhost:3000` as an origin. Never add
localhost to the production client.

**The pending question is held and replayed** after sign-in. UI treatment in [10 UI](10-ui.md).

## Environments

`/api/ask` returns 503 unless `VERCEL_ENV === 'production'` **and** the request `Host` matches the
apex domain. Never branch on `NODE_ENV`, which is `production` on previews too. The `Host` check
matters because every historical production deployment keeps a public immutable URL that
Deployment Protection does not cover.

Evals call `askOnce()` in process and never touch the route, so the guard costs nothing in
testing. Deployment Protection is enabled on all non-production deployments.

The gate itself cannot be driven by Playwright, since Google blocks automated browsers. Phase 5
tests the panel with the identify step stubbed, and the gate is smoke-tested by hand once on
production.

## Privacy and retention

- **Retention:** a daily job nulls `turns.question`, `turns.answer`, and `gap_questions.question`
  older than 90 days, keeping the metric columns. The same job deletes operational rows outright,
  since none of them record anything: `login_nonces` past `expires_at`, `rate_counters` and
  `spend_reservations` older than 48 hours. The job accepts an injectable clock so the behavior is
  testable without backdated rows.
- **Deletion:** by email request, stated on `/privacy`. No endpoint. A self-serve delete would
  also be a free reset for every per-user limit and spend counter, since a fresh `users.id`
  restarts them.
- **IP salt rotates daily**, since a static salt over IPv4 space is brute-forceable in seconds.
- **`/privacy` names every subprocessor**: Anthropic, Voyage, Vercel, Neon, Resend, Google. Linked
  from the gate.
