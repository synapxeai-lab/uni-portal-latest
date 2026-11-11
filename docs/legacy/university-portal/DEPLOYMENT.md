# Deployment — Frontend, Backend and Database on Dokploy (Hostinger VPS)

```
university-portal/
├── apps/
│   ├── backend/            → Dokploy  (Build Type: Dockerfile, Build Path: apps/backend)
│   │   ├── Dockerfile      Node 22 image; runs the schema sync, then starts Express
│   │   └── .env.example    Dokploy variables reference
│   └── frontend/           → Dokploy  (Build Type: Dockerfile, Build Path: apps/frontend)
│       ├── Dockerfile      Vite build, served by nginx
│       ├── nginx/          SPA fallback, caching headers, /api proxy to the backend
│       └── .env.example    Build-time variable reference
└── scripts/reset-db.ps1    Wipe + reseed a database from your machine
```

The browser only talks to the frontend's domain. nginx in the frontend container
proxies `/api/*` to the backend over the Dokploy network, so there are no
cross-origin calls in production.

---

## 0. Before you start

- A Hostinger VPS with **Dokploy** installed (Hostinger's "Ubuntu + Dokploy" template,
  or `curl -sSL https://dokploy.com/install.sh | sh` on a fresh Ubuntu VPS).
  The panel is at `http://<vps-ip>:3000`.
- A domain or subdomain for the portal, e.g. `portal.your-domain.com`, with an
  **A record** pointing to the VPS IP. Optionally a second one for direct API access
  (e.g. `api.your-domain.com`).
- The repo pushed to GitHub, and GitHub connected in Dokploy:
  **Settings → Git → GitHub → Create GitHub App**.

---

## 1. Create the project and the database

1. Dokploy → **Projects → Create Project** → `university-portal`.
2. Inside the project: **Create Service → Database → PostgreSQL**
   - Name: `university-portal-db`
   - Database name: `attendance_db`, user: `portal`, set a strong password
   - Docker image: `postgres:16`
3. Click **Deploy** on the database.
4. Copy the **Internal Connection URL** from the database page. It looks like
   `postgresql://portal:<password>@university-portal-db-xxxx:5432/attendance_db`.
   The API uses this URL. It only works inside the Dokploy network.

> To seed or migrate data from your own machine, set an **External Port**
> (e.g. `5433`) on the database page and use the **External Connection URL**.
> Remove the external port afterwards. It exposes Postgres to the internet.

---

## 2. Create the backend application

1. In the same project: **Create Service → Application** → `university-portal-api`.
   The frontend's nginx reaches the API by this name, so keep it, or change
   `API_UPSTREAM` on the frontend to match (see step 3).
2. **General → Provider: GitHub**: pick the repo and branch `main`.
3. **Build Type: Dockerfile**
   - Dockerfile Path: `Dockerfile`
   - Docker Context Path / Build Path: `apps/backend`
4. **Environment** (see `apps/backend/.env.example`):

   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=<Internal Connection URL from step 1>
   JWT_SECRET=<long random string>
   JWT_EXPIRES_IN=7d
   JWT_REMEMBER_EXPIRES_IN=30d
   PASSWORD_ENC_KEY=<long random string>
   FRONTEND_URL=https://portal.your-domain.com
   ```

   To generate a random string: `openssl rand -hex 32`.
5. Optional, **Domains → Add Domain** for direct API access:
   - Host: `api.your-domain.com`, Path: `/`, Container Port: `5000`
   - HTTPS: on, Certificate: **Let's Encrypt**
6. Click **Deploy**. The container:
   - builds with `npm install` (the `postinstall` step runs `prisma generate`)
   - on start, runs `deploy:sync-users`, then `node index.js` (the schema is synced by hand, see below)
   - reports health from `GET /health`
7. **Auto-deploy:** the GitHub provider redeploys on every push to `main` by default.
   You can turn this off under **General → Autodeploy**.

---

## 3. Create the frontend application

1. In the same project: **Create Service → Application** → `university-portal-web`.
2. **General → Provider: GitHub**: same repo, branch `main`.
3. **Build Type: Dockerfile**
   - Dockerfile Path: `Dockerfile`
   - Docker Context Path / Build Path: `apps/frontend`
4. **Environment** (optional):
   - `API_UPSTREAM` — backend host and port for the nginx proxy. Defaults to
     `university-portal-api:5000`. If Dokploy gave the API service a suffixed
     app name (e.g. `university-portal-api-ab12cd`), use that name here.
   - `VITE_API_URL` build argument — leave unset; it defaults to `/api`.
5. **Domains → Add Domain**
   - Host: `portal.your-domain.com`, Path: `/`, Container Port: `80`
   - HTTPS: on, Certificate: **Let's Encrypt**
6. Click **Deploy**, then open `https://portal.your-domain.com` and check that the
   login page loads and signing in works.

`FRONTEND_URL` on the backend must exactly match the portal origin. Use commas to list
several origins.

---

## 4. Seed a fresh database

After the first backend deploy, once `npm run deploy:schema` has created the schema:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\reset-db.ps1 -SeedOnly
```

Paste the Dokploy **External Connection URL** and the `PASSWORD_ENC_KEY` you set in Dokploy.

---

## Backups

Dokploy → database → **Backups**: add an S3-compatible destination (Settings → S3
Destinations; Cloudflare R2, Backblaze B2, etc.) and schedule daily backups. Without
this, the only copy of the data is the VPS disk.

## Later updates

- `git push` to `main`: Dokploy rebuilds both the API and the frontend.
- Schema changes in `prisma/schema.prisma` are **not** applied automatically. After a
  deploy that changes the schema (and after the first deploy, to create the tables), open
  Dokploy → backend → **Docker Terminal** and run:

  ```sh
  npm run deploy:schema
  ```

  It runs `db/programmes.js` (data fixes the schema change needs) and then
  `prisma db push`. Until it has run, pages that use the new tables or columns fail.
  If a change would drop data, `db push` stops with a warning and changes nothing; only
  add `--accept-data-loss` once you know what would be dropped and have a backup.

## Deploy downtime and the maintenance screen

By default Dokploy stops the old API container before the new one has finished its
startup scripts, so the API is unreachable for about a minute per push.
While that happens the frontend shows an **Under maintenance** screen over the app
(`apps/frontend/src/components/MaintenanceScreen.jsx`). It polls `/health` every 5 s and
goes away by itself; users stay signed in, and failed data is refetched. Tabs left open
on an old frontend build reload once when they hit a missing chunk.

To remove most of that window, have Dokploy start the new container before stopping the
old one: **Application → Advanced → Swarm Settings**:

- **Health Check** (so the old container stays up until the new one is healthy):

  ```json
  {
    "Test": ["CMD", "node", "-e", "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],
    "Interval": 10000000000,
    "Timeout": 5000000000,
    "StartPeriod": 90000000000,
    "Retries": 3
  }
  ```

- **Update Config**:

  ```json
  { "Parallelism": 1, "Delay": 10000000000, "FailureAction": "rollback", "Order": "start-first" }
  ```

With this setting, the old container keeps serving while the new one starts.

## Troubleshooting

| Symptom | Fix |
|---|---|
| API calls return 502 / Bad Gateway | `API_UPSTREAM` on the frontend must match the backend's Dokploy app name and port `5000` |
| Browser console says "Not allowed by CORS" | `FRONTEND_URL` on the backend must exactly match the portal origin |
| Domain shows 404 / Bad Gateway | Frontend domain → Container Port `80`; API domain → `5000`; check the app logs |
| Let's Encrypt certificate not issued | A record must point to the VPS; ports 80/443 open in Hostinger's firewall |
| `Can't reach database server` | Use the **Internal** URL in the app; DB and app must be deployed in Dokploy |
| Prisma error about OpenSSL / libssl | Rebuild; the Dockerfile installs `openssl` |
| Login fails with `secretOrPrivateKey must have a value` | `JWT_SECRET` isn't set on Dokploy |
