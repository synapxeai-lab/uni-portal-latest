# Deploying on Dokploy: frontend and backend as separate services

This guide runs the portal as **three Dokploy services** in one project:

| Dokploy service | Type | Built from | Serves |
| --- | --- | --- | --- |
| `portal-db` | Database → PostgreSQL | – | the database (internal only) |
| `portal-api` | Application (Dockerfile) | [`server/Dockerfile`](../server/Dockerfile) | `https://portal.yourdomain.com/api/*`, container port **4000** |
| `portal-web` | Application (Dockerfile) | [`client/Dockerfile`](../client/Dockerfile) + [`client/nginx.conf`](../client/nginx.conf) | `https://portal.yourdomain.com/*`, container port **80** |

The two services share **one domain**, and Dokploy's Traefik proxy splits requests by path:

```
                    ┌── /api/...  ──> portal-api  (Express, :4000) ──> portal-db
portal.domain.com ──┤
                    └── /...      ──> portal-web  (nginx, :80, static React build)
```

The client calls the API at the relative path `/api`, and sign-in uses an httpOnly `SameSite=Lax` cookie. With one domain, the browser treats both services as the same site, so you don't need CORS, cookie changes or code changes. Each service builds, deploys, restarts and scales on its own.

> This replaces the single-container setup in [deploy-dokploy.md](deploy-dokploy.md). Use one setup or the other on a domain, not both. If you already deployed the single `portal` Compose service, see "Switching from the single-container setup" at the end of this guide.

---

## 1. VPS, DNS and Dokploy

You already have the domain's **A record** pointing to the KVM 4 VPS's IP address. Check that it resolves:

```bash
nslookup portal.yourdomain.com     # must show the VPS IP
```

If Dokploy isn't installed yet, use **hPanel → VPS → OS & Panel → Operating System → Applications → Dokploy**, or install it over SSH:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Open **TCP 22, 80, 443** (and **3000** for the dashboard until you give it a domain) in **hPanel → VPS → Security → Firewall**. Then open `http://<VPS-IP>:3000` and create the admin account.

## 2. Prepare the uploads folder (SSH)

The backend stores uploaded files in a folder on the VPS disk. It runs as uid 1000 (`node`), so that user must own the folder:

```bash
ssh root@<VPS-IP>
mkdir -p /srv/eithm/uploads /srv/eithm/backups
chown 1000:1000 /srv/eithm/uploads
```

## 3. Connect Git and push

1. In Dokploy go to **Settings → Git → GitHub → Create GitHub App** and install it on the repository.
2. Push this repository to `main`, including `server/Dockerfile`, `client/Dockerfile` and `client/nginx.conf`.

## 4. Project and database

1. **Projects → Create Project**, for example `EITHM`.
2. **Create Service → Database → PostgreSQL**:

   | Field | Value |
   | --- | --- |
   | Name | `portal-db` |
   | Database Name | `portal` |
   | Database User | `portal` |
   | Database Password | generated, or `openssl rand -hex 24` (hex avoids URL-encoding issues) |
   | Docker Image | `postgres:17` |

3. Click **Create**, then **Deploy**. Leave **External Port** empty.
4. Copy the **Internal Connection URL** from the **General** tab, for example `postgresql://portal:<pw>@eithm-portaldb-abc123:5432/portal`.

## 5. Backend service: `portal-api`

**Create Service → Application**, name `portal-api`.

**General tab → Provider**

| Field | Value |
| --- | --- |
| Provider | GitHub, your repository, branch `main` |
| Build Path | `/` |

**General tab → Build Type**

| Field | Value |
| --- | --- |
| Build Type | **Dockerfile** |
| Docker File | `server/Dockerfile` |
| Docker Context Path | `.` (the repository root, because the build needs `shared/` and the root `package-lock.json`) |

Click **Save**.

**Environment tab.** Generate the secret with `openssl rand -hex 32`, then enter:

```env
DATABASE_URL=<Internal Connection URL from step 4>?schema=public
JWT_SECRET=<the openssl value>
# Optional - defaults to JWT_SECRET. Set to the old key if you import legacy data.
# PASSWORD_ENC_KEY=
```

`NODE_ENV=production`, `PORT=4000` and `STORAGE_ROOT=/data/uploads` are already set in the image. Don't set `COOKIE_SECURE`, because the site runs on HTTPS. Never change `JWT_SECRET` or `PASSWORD_ENC_KEY` after go-live: changing either one signs everyone out and makes the admin-viewable password copies unreadable.

**Advanced tab → Volumes / Mounts → Add Volume**

| Field | Value |
| --- | --- |
| Mount Type | **Bind Mount** |
| Host Path | `/srv/eithm/uploads` |
| Mount Path | `/data/uploads` |

**Domains tab → Add Domain**

| Field | Value |
| --- | --- |
| Host | `portal.yourdomain.com` |
| Path | `/api` |
| **Strip Path** | **off** (the API expects the `/api` prefix) |
| Container Port | `4000` |
| HTTPS | on, Let's Encrypt |

Click **Deploy** and follow the **Deployments** log. When it finishes, **Logs** shows the Prisma migrations, then `API listening on http://localhost:4000`. Check it in a browser: `https://portal.yourdomain.com/api/health` returns `{"ok":true}`. The certificate can take a minute after the first deploy.

## 6. Frontend service: `portal-web`

**Create Service → Application**, name `portal-web`.

**General tab**

| Field | Value |
| --- | --- |
| Provider | GitHub, same repository, branch `main` |
| Build Path | `/` |
| Build Type | **Dockerfile** |
| Docker File | `client/Dockerfile` |
| Docker Context Path | `.` |

It needs no environment variables or volumes.

**Domains tab → Add Domain**

| Field | Value |
| --- | --- |
| Host | `portal.yourdomain.com` (the same host as the API) |
| Path | `/` |
| Container Port | `80` |
| HTTPS | on, Let's Encrypt |

Click **Deploy**. Traefik gives the more specific `/api` rule priority over `/`, so API calls reach `portal-api` and everything else reaches `portal-web`.

Check the routing:

- `https://portal.yourdomain.com/` shows the sign-in page.
- `https://portal.yourdomain.com/api/health` returns `{"ok":true}`. If you get `{"error":"API route not configured at the proxy"}` instead, nginx received the API call: the `/api` domain on `portal-api` is missing, has **Strip Path** on, or has the wrong port.

## 7. Create the first admin

On **`portal-api`**, open the **Docker** tab (or **Terminal**), pick the container, choose shell `sh`, and run:

```sh
ADMIN_EMAIL='admin@eithm.edu.pk' ADMIN_PASSWORD='a-strong-password' ADMIN_NAME='Portal Administrator' node dist/create-admin.js
```

You can also run it over SSH:

```bash
docker exec -it \
  -e ADMIN_EMAIL='admin@eithm.edu.pk' -e ADMIN_PASSWORD='a-strong-password' -e ADMIN_NAME='Portal Administrator' \
  $(docker ps -qf name=portal-api | head -n1) node dist/create-admin.js
```

Sign in at `https://portal.yourdomain.com`. Running the command again with the same email resets that account's password.

To load the demo data instead (admin `admin@eithm.edu.pk` / `Admin@12345`, plus teachers, students, courses, classrooms, attendance and marks; see `server/prisma/seed/accounts.ts`), run this in the same terminal. It only adds missing records and is safe to re-run:

```sh
node dist/seed.js
```

## 8. Automatic deploys (optional)

Turn on **Autodeploy** on both services. Then set **Watch Paths** (General tab) so that a push rebuilds only the service it affects:

| Service | Watch Paths |
| --- | --- |
| `portal-api` | `server/**`, `shared/**`, `package-lock.json` |
| `portal-web` | `client/**`, `shared/**`, `package-lock.json` |

A change in `shared/` rebuilds both services, because both bundle it.

## Deploy order and updates

- **First deploy:** `portal-db`, then `portal-api`, then `portal-web`.
- **API change** (including a new Prisma migration): redeploy `portal-api` only. Migrations run when the container starts.
- **UI change:** redeploy `portal-web` only. The new `index.html` is never cached and the hashed assets are new files, so users get the update on their next page load.
- **Change that affects both** (for example a new endpoint plus the page that uses it): deploy `portal-api` first, then `portal-web`.

## Backups

These work the same way as in the single-container guide ([deploy-dokploy.md → Backups](deploy-dokploy.md#backups)):

- **Database:** add an S3 destination, then open `portal-db` → **Backups** and schedule a daily backup.
- **Uploads:** use `deploy/backup.sh` from cron. It archives `/srv/eithm/uploads`.

## Switching from the single-container setup

If the `portal` Compose service from [deploy-dokploy.md](deploy-dokploy.md) is already running on this domain:

1. Keep `portal-db`. The new services reuse its data, and the uploads in `/srv/eithm/uploads` stay where they are.
2. On the old `portal` service, **delete its domain**, then **Stop** the service. Two services must not claim the same domain at path `/`.
3. Create `portal-api` and `portal-web` (steps 5–6) with the same `DATABASE_URL`, `JWT_SECRET` and `PASSWORD_ENC_KEY`. Existing sessions and passwords keep working.
4. Once everything works, delete the old `portal` service.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/api/...` returns `{"error":"API route not configured at the proxy"}` | The `portal-api` domain is missing, or has **Strip Path** on or the wrong port. Use path `/api` and port 4000. |
| Every `/api/...` call returns 404 (`Cannot GET /health`) | **Strip Path** is on, so the API receives `/health` instead of `/api/health`. Turn it off. |
| Sign-in appears to work, then you're back on the login page | You're on `http://` or the certificate isn't issued yet. Both domains must have HTTPS on. |
| Bad Gateway on `/` | `portal-web` isn't healthy, or the domain port isn't 80. |
| Bad Gateway on `/api` | `portal-api` is still running migrations (wait up to 60 s), or the domain port isn't 4000. Check its **Logs**. |
| `P1001 Can't reach database server` | `portal-db` isn't running, or `DATABASE_URL` doesn't use its **internal** host. |
| `P1000` authentication failed | The password in `DATABASE_URL` is wrong, or has special characters that aren't URL-encoded. |
| Uploads fail with `EACCES` | `chown -R 1000:1000 /srv/eithm/uploads` |
| Build killed / heap out of memory | Deploy the services one at a time, or add swap: `fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`. |
