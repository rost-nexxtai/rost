# Rost backend (Go)

The Go API behind the web app in `frontend/`, for the product described in [Architecture.md](../Architecture.md).

## Run with Docker (from the repo root)

```bash
cp .env.example .env
docker compose up -d --build
curl localhost:8080/readyz
```

This starts Postgres 16 (`db`, port 5432), the API (`backend`, port 8080) and the web app (`frontend`, port 3000). The API waits for the database to be healthy, then applies `internal/store/migrations/*.sql` (once each), seeds the demo persona and, the first time only, the content (`internal/content/seed`). Locally, `docker-compose.override.yml` publishes the ports and turns the demo tools on; in production (Dokploy, see the root README) they stay off unless `ALLOW_DEMO_TOKEN=true`.

To get an admin account, add these to the root `.env` before `docker compose up` (it's gitignored):

```bash
ADMIN_EMAIL=you@rost.ro
ADMIN_PASSWORD=at-least-12-characters
```

## Run locally

```bash
docker compose up -d db
cd backend
DATABASE_URL='postgres://rost:rost@localhost:5432/rost?sslmode=disable' ALLOW_DEMO_TOKEN=true \
  ADMIN_EMAIL=you@rost.ro ADMIN_PASSWORD='at-least-12-characters' go run ./cmd/api
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres connection string |
| `HTTP_ADDR` | `:8080` | Listen address |
| `SHUTDOWN_TIMEOUT` | `10s` | Time in-flight requests get on SIGTERM |
| `ALLOW_DEMO_TOKEN` | off | `true` turns on the stage helpers: demo partner token, app clock, demo reset, logging in as a demo persona. Keep it off in production |
| `PARTNER_DEMO_SECRET` | dev secret when demo tools are on | Secret the demo partner bank signs tokens with. Real partners get their own variable, named in `partners.json` |
| `POSTBACK_SECRET` | empty | When set, referral postbacks must send it in `x-postback-secret`. Set it in production |
| `ANTHROPIC_API_KEY`, `PAYSLIP_MODEL` | empty | Optional payslip photo reading. Without them `/api/payslip/read` answers 501 |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | empty | Both or neither. Create the first admin on start when that email has no account yet. Changing them later does nothing; add more admins with `POST /api/admin/admins` |
| `TRUST_PROXY` | off (on in `docker-compose.yml`) | `true` when the API is only reachable through a proxy that writes the client's address into `X-Forwarded-For` (Dokploy's Traefik does). Rate limits then key on the right-most public address in it instead of the proxy's. Leave it off when clients can reach the API directly, or they can pick their own address |
| `RATE_LIMITS` | on | `off` turns off the per-client limits on creating users, quizzes, profile imports and login emails (60 a minute, enough for a classroom behind one address), reading payslip photos (5 per 10 minutes) and tracking and referral clicks (60 a minute). Over a limit the API answers 429 with `Retry-After` |
| `COOKIE_SECURE` | off | `true` marks the session cookie `Secure`. Turn it on when the app is served over HTTPS |
| `LEGACY_UID_COOKIE` | on | Swaps the old `rost_uid` cookie (the raw user id) for a session on the next visit, only for users that existed before sessions (`users.legacy_uid`, set by migration 006) and only for 10 minutes after a user's first swap (`legacy_swapped_at`), so parallel requests or a lost answer land on the same account. `POST /api/me/import` works only while this is on. Set `false` after one release, with the profile import and the matching parts of `frontend/src/proxy.ts` |
| `APP_URL` | `http://localhost:3000` | Where users open the app; login links in emails point here. Required with `SMTP_HOST` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | empty, port `587` | Sending login emails (STARTTLS, or TLS on 465). `MAIL_FROM` is required with `SMTP_HOST`. Without `SMTP_HOST` emails are only logged: with demo tools on the log shows the link, otherwise only that a mail would have gone |

## Endpoints

App routes are under `/api`; shapes are in `frontend/src/contract.ts`. The session is the `rost_session` cookie: 32 random bytes, HttpOnly, SameSite=Lax. The server keeps only its SHA-256 hash, with an expiry of 90 days that moves (at most once a day) while it's used. Pages call the API from the Next server, where a renewed cookie never reaches the browser, so the web app's proxy sets the cookie again (at most once a day) itself. User ids never go to the browser except in `GET /api/me`.

A request body must be sent as `Content-Type: application/json` (415 otherwise; an empty body for a lesson's optional answers needs none). Other sites can't send that type without CORS, which the API never allows, so this stops forms and `text/plain` posts from another site even in browsers without `Sec-Fetch-Site`. Only the referral postback, which partners' servers call with the secret, takes any type.

Every response carries an `X-Request-ID` (a sane incoming one is kept), which is also on its log lines, plus `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`. A panic answers 500 and is logged with its stack. A `POST`, `PUT`, `PATCH` or `DELETE` that the browser marks `Sec-Fetch-Site: cross-site` is refused with 403, except the referral postback; requests without the header (servers, the Next.js server) pass.

| Route | Purpose |
| --- | --- |
| `GET /healthz`, `GET /readyz` | Liveness; readiness (Postgres answers a ping) |
| `POST /api/users` | Create a user (onboarding) or `{demo:"maria"}` (demo personas, demo tools only); starts a session |
| `DELETE /api/users` | Sign out: end this session. The account stays |
| `DELETE /api/me` | Profil → Resetează: erase the account and its data, end the session. Referrals and tracking events stay without the user id. A demo persona goes back to its seed instead |
| `GET /api/me`, `GET /api/me/export` | The current user; everything kept about them, as a JSON download |
| `POST /api/me/import` | The profile an old browser kept in the `rost_profile` cookie (the web app's proxy sends it once): quiz answers, level, money lines, finished lessons (kept as passed, marked `imported`) and the last 14 learned days. Only for a user without a quiz; never overwrites one (409). 400 for a cookie the old app couldn't have written. Without a session it makes the user, like `POST /api/quiz` |
| `POST /api/auth/email`, `GET /api/auth/verify?token=` | Email login, API only: mail a one-time link (15 minutes, a few per address an hour, 30 a day per client address, 500 a day for the whole server, always 202) and set a `rost_login` nonce cookie. The link works only in the browser that asked: it signs in to the email's account, or ties a new email to the signed-in account that asked (when it has none), or makes a new account with it, then redirects to `/acasa`. In another browser (a mail scanner, a forwarded link) it changes nothing and stays usable |
| `POST /api/events` | Fire an event: `salary_received`, `inflation_published`, `shock_scenario`, `raise`, `catch_up`, … |
| `POST /api/calendar` | Run today's computed triggers for the current user |
| `GET /api/today` | Everything the Today/Momente screen needs |
| `GET/POST /api/moments/{runId}` | Load a moment with its view; post a guess, an action or a dismiss |
| `GET/POST /api/followups` | Due 7-day checks; confirm or skip |
| `GET /api/options` | Neutral ranking of savings options |
| `GET /api/providers`, `GET /api/providers/{assetId}` | Real banks and brokers per asset, ranked: savings by rate after tax, brokers by the cost of a 1,000 lei order. Each has its official site, the month checked and the source. No partners among them |
| `POST /api/referrals/clicks`, `GET /api/referrals/{clickId}` | Record a referral click; read it back for the mock bank |
| `POST /api/referrals/postback` | Partner reports `opened` or `funded` |
| `GET /api/partner/demo-token`, `GET /api/embed?token=` | Demo partner token; the partner view's data |
| `GET /api/metrics` | Aggregates only |
| `POST /api/payslip/read` | Optional payslip photo reader (multipart field `image`); the image is not stored |
| `GET /api/demo` | `{enabled}`: whether the demo tools are on, so the landing page offers Maria only then |
| `GET/POST /api/clock`, `POST /api/demo/reset` | Demo tools: move the app clock; reset the demo personas |
| `GET /api/quiz`, `POST /api/quiz` | Quiz questions (without answers); score the quiz on the server and store the profile. Creates the user when there is no session |
| `GET /api/library`, `GET /api/library/{id}` | Published library moments, with steps |
| `POST /api/library/{id}/complete` | The user finished a library moment (optional `answers`: `picked`, `value` or `buckets` per graded step); returns the profile, `passed` and `levelUp`. Only a passed attempt (2 of 3 graded right) counts toward the level; the best attempt is kept |
| `GET /api/momente`, `GET /api/stiri` | The Momente and Știri screens. 404 `no profile` before the quiz |
| `POST /api/track` | Usage events for statistics (names in `app.ClientEvents`) |

`GET /api/me` also returns `profile` (level, risk profile, finished moments) once the user took the quiz.

### Admin

Admin routes are under `/api/admin` and need the `rost_admin` cookie from the login. It is HttpOnly, SameSite=Strict and scoped to `/api/admin`; sessions last 12 hours and end on logout.

| Route | Purpose |
| --- | --- |
| `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me` | Sign in (5 failures per email lock it for 15 minutes), sign out, who am I |
| `GET/POST /api/admin/admins` | List admins; add one (`{email, password}`, password 12+ characters) |
| `GET/POST /api/admin/content/{kind}` | `kind` is `moments` or `news`. List all, drafts included; create `{status, position?, doc}` |
| `GET/PUT/DELETE /api/admin/content/{kind}/{id}` | Read, replace (publish = `status: "published"`), delete |
| `GET /api/admin/stats?days=30` | Usage statistics for the last 1–365 days. Aggregates only |
| `GET /api/admin/providers`, `PUT /api/admin/providers/{key}` | Every bank and broker, and marking one as a partner (`{"partner": true}`). Keys are `bank:<Romanian name>` and `broker:<id>`. `/api/providers` then sets `isPartner` on those rows; the order is computed first and never changes |

Content is validated before it's stored: the shapes are `LibraryMoment` and `NewsItem` in `frontend/src/data/types.ts`. Unknown fields are rejected, a moment is at most 5 minutes, and links must be app paths (`/...`) or `https://`. A written lesson follows the same rules as `components/lesson/lessons.test.ts`: at most 7 steps, the last one `finish`, at least 2 graded steps (`choice`, `predict`, `sort`) and 2 takeaways, and a predict slider that doesn't start next to the answer. A moment with no steps is listed as "în curând". Ids can't change, because finished moments and links point to them.

Answers sent with a completion are graded like in the app: a choice by index, a predict when it's close (within a step or a tenth of the scale), a sort when every item is in the right bucket.

### Levels

The quiz has 4 questions in two tiers: the basics, then L1 concepts. A tier passes only when both its questions are right, tiers pass in order, and the level is the number of tiers passed (`learning.PlaceLevel`; onboarding skips the harder pair when the basics fail, `learning.AskTier`). The reasoning is in [docs/level-assessment.md](../docs/level-assessment.md). A lesson counts only when passed: at least 2 of 3 graded screens right (`learning.Passed`). The risk profile follows the level (L0 prudent, L1 echilibrat, L2 dinamic) with the horizon, buffer and debt caps; age adds nothing. The frontend mirrors these in `src/data/mock/scoring.ts`, and both test suites run the cases in `internal/learning/testdata/placement.json`.

A user's level is the highest of: the quiz level, the level their passed core moments earn, and the highest level they reached before. Only core moments that have steps count, so a lesson that isn't written yet doesn't block anyone. Publishing a new core lesson never moves anyone down.

### Tracking

The app sends what the user does (`page_view`, `moment_open`, `asset_view`, …) to `POST /api/track`; the API writes `user_created`, `quiz_completed`, `library_completed` and `level_up` itself when it sees them happen. Props are flat values only, and query strings are dropped from paths, so tokens and free-form data don't end up in the table. Statistics show aggregates, never a single user.

## Layout

```
cmd/api/              entry point: config, database, migrations, HTTP server, graceful shutdown
internal/config/      settings from the environment
internal/database/    pgx connection pool
internal/domain/      runtime records (users, events, runs, actions, referrals) and content, profile, tracking, admin types
internal/rules/       pure money rules for 2026: payslip, inflation, ranking of offers and brokers, dates
internal/reference/   versioned reference data in data/: moments, inflation, offers (real banks and state bonds), brokers, partners (demo only), scenarios, demo persona
internal/moments/     the engine that decides which moment an event opens
internal/views/       the numbers a moment shows one user
internal/app/         services (events, moments, follow-ups, referrals, quiz, library, tracking, admin), calendar, metrics, stats
internal/auth/        admin passwords (PBKDF2-SHA256), session tokens, login rate limit
internal/mail/        login emails over SMTP, or to the log
internal/content/     validation for admin-edited content; the first content seed in seed/
internal/learning/    pure rules: quiz level, risk profile, level from moments, Momente and Știri order
internal/partner/     HS256 token a bank signs to open the partner view
internal/store/       Store interface, Postgres implementation, migrations
internal/server/      routes and handlers
```

## Checks

```bash
go vet ./... && go test ./...
# Postgres store test against a real database:
ROST_TEST_DATABASE_URL='postgres://rost:rost@localhost:5432/rost?sslmode=disable' go test ./internal/store/
```

Known limits:

- The personal tax deduction is not applied yet (`rules.PersonalDeductionImplemented = false`), so tax shown for lower salaries is slightly high.
- Statistics are computed in Go from the rows of the period, which is fine for a hackathon's volume. Move them to SQL aggregates before real traffic.
- The login rate limits are kept in memory, per instance.
- Migrations only go forward. In particular there is no going back to code from before migration 006: users that older code creates after 006 ran aren't marked `legacy_uid`, so their `rost_uid` cookie never becomes a session.
- Writes of a user's row replace the whole row, so two tabs saving different fields at the same moment can lose one of them.
