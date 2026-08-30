# zoo-hunt

Cloudflare Worker (TypeScript) with static assets in `public/`.

## Develop

```sh
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm run test:ci    # vitest run (single pass; `npm test` is watch mode)
```

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`: install → typecheck → tests → `wrangler deploy`.
It can also be triggered manually from the Actions tab.

Required GitHub Actions secrets (repo → Settings → Secrets and variables → Actions):

| Secret                  | Where to get it                                                                 |
| ----------------------- | ------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | dash.cloudflare.com → My Profile → API Tokens → Create → "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | dash.cloudflare.com → Workers & Pages → Account ID in the right sidebar         |

Manual deploy from a machine with a logged-in `wrangler`: `npm run deploy`.
