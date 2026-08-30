# TODO (user requests — keep updated)

## In progress
- [x] **E2E on the live site in Chrome at a mobile viewport** — welcome ✅, join/create team ✅, how-to-play ✅, clues ✅, clue detail ✅, snap + upload ✅, submitted ✅, scoreboard ✅, profile ✅, map ✅, HQ login/overview/photo review ✅, approve → live "+150" toast + scoreboard ✅ (2026-08-29)
- [ ] **Match the Figma 1:1** — fonts, icons, colors, spacing, and the clue cards ("cards for clues and shit"):
  - [ ] Pull exact fonts/colors from Figma design context (welcome, choose-team, clues, clue-details)
  - [ ] Export art: welcome background (George + Bronx Zoo gate), monkey-head avatars for the 6 team colors, zoo map image, textures
  - [ ] Welcome: full-bleed illustration, "ZAID TURNS 29 / SCAVENGER HUNT!" stacked title, red LET'S GO button
  - [ ] Choose team: title + "Pick a team name and color.", single Team name field, 2×3 grid of colored monkey tiles, green NEXT
  - [ ] How to play: card with 4 icon rows (magnifier, camera, star, trophy)
  - [ ] Clues: green plank header, stacked clue cards (CLUE #n eyebrow, typewriter text, animal sketch/icon at right), locked state
  - [ ] Clue detail: "CLUE n OF 10" plank, paper note card with paperclip, "I THINK I KNOW!" button
  - [ ] Snap / Nice shot / Scoreboard / Team profile / Map to match their frames
  - [ ] Bottom nav icons matching the SF-Symbols glyphs used in Figma (search, map, trophy, person)

- [x] **Admin at `/admin`** (keep `/hq` redirecting) with password **zaid29** (secret set remotely ✅ + .dev.vars ✅)
- [x] Fonts/colors/icons from Figma: Ranchers + Libre Franklin + Victor Mono, exact hex palette, SF-symbol-style icons, art exported (gate, Georges, monkey head, map, textures)
- [ ] Iterate on http://localhost:8788 (user's wrangler dev) — rebuild with `npm run build:web`, reload
- [x] Welcome: George sized by screen height + moved down on short screens; cream wash under title; heavier drop shadows (2026-08-30)
- [x] No "Your name" on join — random player names, host renames in HQ → team detail (2026-08-30)
- [ ] **Follow `admin-instructions.md`** for HQ: cream bg, green nav, paper cards, illustrated section headers, large score numbers, chunky controls, small animal accents; photo review as large cards with big green APPROVE / secondary REJECT and "+150 POINTS" score animation; score control with [-50][-10][+10][+50][+100] + custom + reason + AWARD POINTS; playful restrained animations (points bounce, confetti on submit, cards slide in, stamps on completed clues, locked clues wiggle, mascot waves); player viewport 390×844, admin desktop/tablet multi-column.

## Waiting on user
- [x] CI API token got **D1: Edit** (2026-08-30) — run 33292163943 migrated + deployed green. Pushes to `main` now deploy on their own.

## Standing rules
- Commit + push frequently; tests land with the code.
- Figma Starter plan: ~20 MCP calls/month — batch calls.

## Done
- [x] GitHub Actions auto-deploy on push to main (Node 24 runtimes)
- [x] Build plan in docs/PLAN.md with D1 / R2 / Durable Objects architecture
- [x] Worker backend (D1 schema, Hono API, GameRoom DO) + 70 tests
- [x] Player app + Game Master HQ (React/Vite) + 17 web tests
- [x] R2 enabled + bucket created; remote D1 migrated + seeded; first live deploy at https://zoo-hunt.justintorre75.workers.dev
