# Zoo Hunt — Build Plan

Source design: [ZOO-APP (Figma)](https://www.figma.com/design/8uT3GOVmZTelPqv0OcBbk9/ZOO-APP?node-id=0-1) — reference renders in `docs/design/`.

## What we're building

A team scavenger hunt for a Bronx Zoo birthday ("Zaid turns 29"). Two surfaces, one Worker:

1. **Player app** (mobile web / PWA, `/`) — join a team with a game code, read clues, find the animal, snap a photo, earn points, watch the live scoreboard.
2. **Game Master HQ** (admin dashboard, `/hq`) — create the game, manage teams and clues, release clues, review photos (approve / reject / bonus), adjust scores, post bonus challenges, end the game.

### Player screens (from Figma frames)
| Frame | Screen | Notes |
|---|---|---|
| `01-welcome` | Welcome | Title art, "LET'S GO!", "How to play" link |
| `02-choose-team` | Choose team | Pick/create team name + color (6 preset colors: yellow, green, blue, red, purple, orange), monkey avatar |
| `03-how-to-play` | How to play | 4 static steps (solve clues, snap a photo, earn points, win a prize) |
| `04-clues` | Clues list | Numbered list; status per clue: ✅ complete / 📷 pending review / 🔒 locked; points shown |
| `08-clue-details` | Clue detail | "CLUE 2 OF 10", typewriter note-card, animal sketch, "I THINK I KNOW!" → camera |
| `09-snap-pic` | Snap your find | Camera capture, preview, submit |
| `10-submission` | Nice shot! | Polaroid of photo, "submitted for review" or "+150 points" if auto-approved, "on to the next clue" |
| `05-map` | Zoo map | Illustrated map with numbered clue pins + "you are here" |
| `06-scoreboard` | Scoreboard | Ranked teams, colored rows, live |
| `07-team-profile` | Team profile | Avatar, editable name, total points, clues found, photos submitted |
| bottom nav | MAP · CLUES · SCORES · PROFILE | |

### Admin (Game Master HQ) panels
- **Overview**: live status, game code, stats (teams / players / clues completed / photos pending), live leaderboard, recent activity, quick actions (release next clue, photo review, bonus challenge, end game).
- **Teams**: table (players, points, clues found, photos), add team, team detail (members, recent submissions, adjust score ±10/25/50/100/150/custom with reason, remove points).
- **Photo review**: queue of pending submissions with photo, clue, team, player, time → Approve / Reject / +Bonus; "mark all reviewed".
- **Clues**: table (title, points, status COMPLETE / AVAILABLE / LOCKED, photo count), add/edit clue, release next / release all / lock all / schedule.
- **Score control**: pick team, ± presets, required reason, append-only score change log.
- **Create new game**: name, game code (regenerate), date, start/end time, default points per clue, photo approval mode (Manual / Auto).
- **Bonus challenge**: title, description, point value, active/inactive, art card.
- **Activity** feed, **Settings**, **End game**.

## Architecture (Cloudflare)

```
 Player PWA (React) ─┐                                   ┌─ D1  (zoo_hunt)      relational state
 Admin HQ   (React) ─┼─► Worker  (Hono router, /api/*) ─┼─ R2  (zoo-hunt-photos) photo originals
        ▲            │        │                          ├─ DO  GameRoom          per-game WebSocket hub + alarms
        └── WebSocket┘        └─ static assets (web/dist) └─ Workers AI (optional) auto photo verification
```

| Primitive | Used for | Why this one |
|---|---|---|
| **Workers + static assets** | Serves the SPA and the API from one deploy (`run_worker_first: ["/api/*", "/ws/*"]`, SPA fallback). | Already scaffolded; zero extra infra. |
| **D1** | Games, teams, players, clues, submissions, score ledger, bonus challenges, activity. | Relational queries (leaderboard, per-team clue status) are the core of the app. |
| **R2** | Photo storage. Upload via Worker (`PUT` body → `R2.put`), served back through `/api/photos/:key` with cache headers. | Cheap, no egress, free tier is plenty for one event. |
| **Durable Object `GameRoom`** (SQLite-backed, WebSocket Hibernation) | One instance per game. Fans out events (`leaderboard`, `clue_released`, `submission_reviewed`, `bonus_posted`, `game_ended`) to every connected player + admin. `alarm()` fires scheduled clue releases. | Real-time scoreboard is the fun part of a live event; DO alarms replace a cron. |
| **Workers AI** (phase 3, optional) | `@cf/llava-1.5-7b-hf` (or current vision model) asked "Is there a {animal} in this photo?" to power **Auto** approval mode; result stored as `ai_verdict`, host can still override. | The admin design has a Manual/Auto approval dropdown. |
| **Secrets** | `ADMIN_PASSWORD`, `SESSION_SECRET` (HMAC for tokens). | |

Not used (deliberately): KV (D1 covers config), Queues (`ctx.waitUntil` is enough for one event's photo volume), Cloudflare Images (client-side canvas downscale to ≤1600px before upload keeps R2 small and avoids a paid product).

## Data model (D1, `migrations/0001_init.sql`)

```sql
games          (id TEXT PK, code TEXT UNIQUE, name, status 'draft'|'live'|'ended',
                starts_at, ends_at, default_points INT, approval_mode 'manual'|'auto',
                created_at)
teams          (id PK, game_id FK, name, color, avatar, created_at)   -- UNIQUE(game_id, name)
players        (id PK, game_id FK, team_id FK, name, is_leader INT, token_hash, last_seen_at, created_at)
clues          (id PK, game_id FK, sort_order INT, title, body, animal, points INT,
                status 'locked'|'available', release_at, map_x REAL, map_y REAL)
submissions    (id PK, game_id FK, team_id FK, clue_id FK, player_id FK, r2_key,
                status 'pending'|'approved'|'rejected', points_awarded INT,
                ai_verdict TEXT, reviewed_by, reviewed_at, created_at)
                -- partial UNIQUE(team_id, clue_id) WHERE status <> 'rejected'
score_events   (id PK, game_id FK, team_id FK, delta INT, reason,
                source 'submission'|'adjust'|'bonus'|'hint', ref_id, created_by, created_at)
bonus_challenges (id PK, game_id FK, title, description, points INT, status 'active'|'inactive', r2_key)
activity       (id PK, game_id FK, type, message, created_at)
```

Rules:
- **Team score = `SUM(score_events.delta)`**. Every approve/adjust/bonus inserts a ledger row; nothing mutates a stored total. This gives the admin "score change log" for free and makes the scoreboard a single query.
- Per-team clue status is derived: `approved` submission → COMPLETE, `pending` → PENDING, else clue.status (`available` / `locked`).
- Clue `status` is game-wide (host releases clues for everyone); `release_at` + DO alarm handles SCHEDULE.

## API (Hono, `src/api/`)

Auth: player token = HMAC-signed `{playerId, gameId}` stored in `localStorage`, sent as `Authorization: Bearer`. Admin = `ADMIN_PASSWORD` → signed cookie. Middleware `requirePlayer` / `requireAdmin`.

**Player**
- `POST /api/join` `{code, teamName?, teamId?, color?, playerName}` → creates team if new, player, returns token + bootstrap state
- `GET  /api/me` → game, team, players, clues (with per-team status), leaderboard, active bonus
- `PATCH /api/team` `{name}` (leader only)
- `POST /api/submissions` multipart `{clueId, photo}` → R2 put, insert pending (or auto-approve path), broadcast
- `GET  /api/leaderboard`
- `GET  /api/photos/:key` (public-read, cached)
- `GET  /ws/:gameId` → upgrades to the `GameRoom` DO

**Admin** (`/api/admin/...`)
- `POST login`, `POST logout`
- `games`: `POST`, `GET :id`, `PATCH :id` (status live/ended, settings), `POST :id/regenerate-code`
- `teams`: `GET`, `POST`, `PATCH :id`, `DELETE :id`, `GET :id` (detail incl. members, submissions, ledger)
- `clues`: `GET`, `POST`, `PATCH :id`, `DELETE :id`, `POST release-next`, `POST release-all`, `POST lock-all`, `POST :id/schedule {releaseAt}`
- `submissions`: `GET ?status=pending`, `POST :id/approve {bonus?}`, `POST :id/reject`, `POST mark-all-reviewed`
- `scores`: `POST adjust {teamId, delta, reason}`, `GET log`
- `bonus`: `GET`, `POST`, `PATCH :id`
- `activity`: `GET`

Every mutating admin route ends with `await room(gameId).broadcast(event)`.

## Frontend (`web/`, Vite + React + TypeScript + React Router)

- Single SPA, two route trees: `/` (player) and `/hq` (admin). Shared `api.ts` client + `useGameSocket()` hook that refetches `/api/me` on any WS event.
- **Design tokens** (from the renders): cream `#F4E6C3`, paper `#FBF3DC`, forest green `#2E6B3E`, dark green `#1E4A2B`, tomato red `#C9432E`, sun yellow `#F2C84B`, sky blue `#3D8BC9`, purple `#8B5DB0`, orange `#E8863A`, ink `#2B2118`. Display font: condensed sans (Anton / Bebas Neue via Google Fonts), body: Nunito; clue cards: Special Elite (typewriter). Paper-grain texture overlay as a CSS background (the Figma "Textures" layers).
- Camera: `<input type="file" accept="image/*" capture="environment">`, canvas downscale, then `fetch` multipart. Works on iOS Safari without any native wrapper.
- Map: illustrated map PNG (export from Figma `image 6`) with absolutely positioned pins from `clues.map_x/map_y` (0–1). "You are here" via `navigator.geolocation` mapped with a 2-point calibration (optional; ship without it first).
- PWA: `manifest.webmanifest` + icons so players can add to home screen; no service worker needed.
- Assets (monkey art, textures, map, bonus card) exported from Figma into `web/public/art/`.

## Repo layout after this work
```
migrations/0001_init.sql
src/index.ts            Worker entry: Hono app + asset fallback
src/api/{player,admin}.ts, src/auth.ts, src/db.ts (typed query helpers), src/room.ts (GameRoom DO)
web/                    Vite app (src/player/*, src/hq/*, src/shared/*)
wrangler.jsonc          d1_databases, r2_buckets, durable_objects + migrations, assets → web/dist, run_worker_first
```

`wrangler.jsonc` additions:
```jsonc
"assets": { "directory": "./web/dist", "not_found_handling": "single-page-application", "run_worker_first": ["/api/*", "/ws/*"] },
"d1_databases": [{ "binding": "DB", "database_name": "zoo-hunt", "database_id": "<from wrangler d1 create>", "migrations_dir": "migrations" }],
"r2_buckets":   [{ "binding": "PHOTOS", "bucket_name": "zoo-hunt-photos" }],
"durable_objects": { "bindings": [{ "name": "GAME_ROOM", "class_name": "GameRoom" }] },
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["GameRoom"] }]
```

CI (`.github/workflows/deploy.yml`): add `npm run build` (Vite) before tests, and `npx wrangler d1 migrations apply zoo-hunt --remote` before `wrangler deploy`. The API token needs D1 + R2 + Workers scopes (the "Edit Cloudflare Workers" template covers Workers; add D1:Edit and R2:Edit or re-create the token).

## Phases

**Phase 0 — Foundation** (½ day)
- `wrangler d1 create zoo-hunt`, `wrangler r2 bucket create zoo-hunt-photos`, secrets.
- Vite React app in `web/`, Hono on the Worker, bindings, `0001_init.sql`, typed `Env`, seed script with the 10 clues from the design (Splash Happy, Striped & Proud, Lunch in the Trees, Big Ears, Cool Swimmer, Small but Bold, Black & White, …) and 6 demo teams.
- CI updated; deploy proves D1 + R2 + DO bindings work in prod.

**Phase 1 — Core loop** (2–3 days)
- Player: welcome → how to play → join/create team → clues list → clue detail → snap → submit → scoreboard → profile (rename).
- Admin: login, create game, teams table, clues table + release next/all/lock, photo review approve/reject/+bonus, score adjust with reason + log, end game.
- Everything polls `/api/me` every 10s (works before real-time lands).

**Phase 2 — Live** (1–2 days)
- `GameRoom` DO with WebSocket Hibernation; replace polling; toast on "clue released" / "photo approved (+150)".
- Scheduled release via DO alarm; bonus challenge CRUD + player banner; activity feed; overview stats; zoo map with pins.

**Phase 3 — Polish / optional**
- Workers AI auto-approval mode; PWA manifest + icons; Cloudflare Access in front of `/hq` instead of a password; rate limiting on `/api/join` and uploads; export photos zip at end of game.

## Testing (ships with each phase, not after)

Runner: Vitest with `@cloudflare/vitest-plugin` (already configured in `vitest.config.mts`) so tests run inside workerd against **real local D1 / R2 / DO bindings** — no mocks of Cloudflare APIs. Migrations applied in `test/setup.ts` via `env.DB.exec` per test file; each test wraps in a fresh game id so cases don't collide.

| Layer | What gets tested | Where |
|---|---|---|
| **DB / ledger** | `SUM(score_events)` equals leaderboard; per-team clue status derivation (locked/available/pending/complete); partial-unique submission per team+clue (a rejected photo can be re-submitted, a pending one can't be duplicated). | `test/db.spec.ts` |
| **Auth** | Token sign/verify round-trip, tampered token rejected, expired game rejected; admin cookie required on every `/api/admin/*` route (table-driven over the router). | `test/auth.spec.ts` |
| **Player API** | `POST /join` creates team + player, joins existing team by id, rejects bad code / duplicate team name; `GET /me` shape; `POST /submissions` writes to R2 and inserts `pending` (manual mode) or `approved` + ledger row (auto mode); leader-only `PATCH /team`. | `test/player-api.spec.ts` |
| **Admin API** | approve → ledger delta = clue points (+bonus), reject → no delta, adjust requires reason and logs it, release-next promotes exactly one `locked` clue in `sort_order`, lock-all / release-all, end game flips status and blocks further submissions. | `test/admin-api.spec.ts` |
| **GameRoom DO** | Two WebSocket clients + one broadcast → both receive it; alarm at `release_at` releases the clue and broadcasts `clue_released`. | `test/room.spec.ts` |
| **Frontend** | Vitest + Testing Library on the pure bits: clue-status badge mapping, leaderboard ordering/ties, score formatting, join-form validation. No E2E framework for v1; the Verification checklist below is the manual E2E. | `web/src/**/*.test.tsx` |

CI runs `npm run test:ci` (worker) and `npm --prefix web run test:ci` before deploy; a red test blocks the deploy.

## Working agreement
- **Commit and push frequently** — one commit per meaningful step (migration, a route group, a screen), pushed to `main` as it lands. CI deploys each push, so the live URL always tracks the latest green commit.
- Tests land in the same commit as the code they cover.

## Assumptions (flag if wrong)
1. No user accounts — a game code gets you in, a signed token identifies the player. Fine for a private party.
2. React + Vite for the SPA. Swap for Preact/Svelte if you prefer; nothing else changes.
3. Admin auth is a single shared host password (Worker secret). Cloudflare Access is the upgrade path.
4. Clue release is game-wide, not per team (matches the "release next clue" admin control).
5. One event (this birthday), but the schema is multi-game so the Create-New-Game panel is real, not decorative.

## Verification
- `npm run dev` → `wrangler dev` with local D1/R2/DO; seed via `wrangler d1 execute zoo-hunt --local --file=seed.sql`.
- Two browsers: one at `/hq` (approve a photo), one at `/` on a phone via LAN (`wrangler dev --ip 0.0.0.0`) — score updates without reload.
- Vitest (`@cloudflare/vitest-plugin`) unit tests for: join flow, submission uniqueness per team/clue, ledger sum = leaderboard, admin auth middleware, DO broadcast.
- Push to `main` → CI migrates + deploys; smoke `curl https://zoo-hunt.<subdomain>.workers.dev/api/leaderboard`.
