# wishlist-api

A tiny Fastify + Postgres backend for the family wishlist. It implements exactly
the six endpoints the frontend calls (`src/queries/index.ts`), in camelCase JSON:

| Method   | Path          | Notes                                                                                                                    |
| -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/health`     | `{ ok: true }` — health check                                                                                            |
| `GET`    | `/members`    | all members, ordered by name                                                                                             |
| `GET`    | `/wishes`     | all wishes, ordered by `createdAt`                                                                                       |
| `POST`   | `/wishes`     | server generates the `id`; returns the row                                                                               |
| `PATCH`  | `/wishes/:id` | updates only `title,url,notes,price,priority,reservedBy,reservedAt`; ignores `id`/`memberId` in the body; 404 if missing |
| `DELETE` | `/wishes/:id` | 204; 404 if missing                                                                                                      |

Members are created by the seed script (`SEED_MEMBERS`), never via the API.

## Environment

See `.env.example`. Key vars: `DATABASE_URL`, `PORT` (3000), `CORS_ORIGIN`
(comma-separated allow-list or `*`), `SEED_MEMBERS`, `SEED_DEMO`, optional
`API_TOKEN` (shared bearer token — must match the frontend's `VITE_API_TOKEN`).

## Local development

```sh
cd api
docker compose up --build        # Postgres + API on :3000, seeded with demo data
curl localhost:3000/members
```

Or against your own Postgres:

```sh
cd api
npm install
export DATABASE_URL=postgres://…
npm run migrate && npm run seed
npm run dev
```

## Tests

```sh
cd api
npm install
npm test          # node:test + pg-mem, no database needed
```

## Deploy on Coolify

1. **New Resource → PostgreSQL.** Once it's running, copy its connection URL
   (Coolify shows an internal `postgres://…` string).
2. **New Resource → Application**, from this repository.
   - **Base Directory:** `api`
   - **Build Pack:** Dockerfile (`api/Dockerfile`)
   - **Port:** `3000`, **Health-check path:** `/health`
   - **Environment variables:**
     - `DATABASE_URL` = the URL from step 1
     - `PORT` = `3000`
     - `CORS_ORIGIN` = your frontend origin, e.g. `https://wishlist.example.com`
       (or `*` while testing)
     - `SEED_MEMBERS` = `Alice,Bob,Carol` (your family)
     - `SEED_DEMO` = `true` for a first look, then remove it
     - `API_TOKEN` = a random string if you want the shared-token guard
   - Assign a domain and enable HTTPS.
3. **Deploy.** The container runs `migrate` + `seed` (both idempotent) before
   starting, so redeploys are safe.
4. Check `https://<api-domain>/health` and `https://<api-domain>/members`.

Alternatively, import `api/docker-compose.yml` as a Coolify **Docker Compose**
resource to run Postgres + API together, and set `CORS_ORIGIN` / `API_TOKEN`.

## Point the frontend at it

In the repo root, edit `.env.external`:

```
VITE_API_URL=https://<api-domain>     # no trailing slash
VITE_READONLY=false
VITE_FAMILY_PASSWORD=<your family passphrase>
VITE_API_TOKEN=<same as API_TOKEN, or empty>
```

Then `npm run build:external` and deploy `dist/` to any static host
(Netlify, Vercel, Coolify static, …). The GitHub Pages build stays the separate
read-only demo.
