# Deploying on Dokploy (Hostinger VPS)

The portal runs as two Dokploy services in one project:

| Dokploy service | Type | What it is |
| --- | --- | --- |
| `portal-db` | **Database → PostgreSQL** | the database, with Dokploy's built-in backups |
| `portal` | **Compose** ([`docker-compose.dokploy.yml`](../docker-compose.dokploy.yml)) | the app: one container serving the API and the built React app on port 4000; it applies database migrations every time it starts |

Dokploy builds the app image from your Git repository on the VPS. Its Traefik proxy serves your domain over HTTPS with a free Let's Encrypt certificate. The frontend and backend are one container on one domain, so you don't deploy them separately.

**Uploaded files** are stored in a folder on the VPS disk, `/srv/eithm/uploads`, mounted into the app at `/data/uploads`. The folder sits outside Dokploy's checkout, so redeploying, rebuilding or deleting the service doesn't touch it. The database's data lives in the Docker volume that Dokploy manages for `portal-db`.

> **About "Hostinger volumes":** Hostinger VPS plans come with one NVMe disk and no separate block-storage volumes to attach. Your persistent volume is therefore a folder on that disk, mounted into the container as shown above. To keep uploads on a different disk later, set `DATA_DIR` (step 8) to a folder on it and move `uploads/` across.

---

## 1. VPS and domain

1. In Hostinger hPanel, buy or open a **VPS** with Ubuntu 24.04. Choose **KVM 2 or larger**. The image is built on the server, and the React build alone needs about 2 GB of RAM.
2. The simplest route is to install Dokploy from Hostinger's template: **VPS → OS & Panel → Operating System → Applications → Dokploy**. This reinstalls the VPS. You can also install it on an existing Ubuntu VPS over SSH:
   ```bash
   curl -sSL https://dokploy.com/install.sh | sh
   ```
3. In hPanel go to **VPS → Security → Firewall** (or `ufw` if you use it) and allow TCP **22, 80 and 443**. Allow **3000** too for now; that is the Dokploy dashboard.
4. At your DNS provider (or **Domains → DNS** in hPanel), add an **A record** such as `portal.yourdomain.com` that points to the VPS IP address.

## 2. Dokploy first login

1. Open `http://<VPS-IP>:3000` and create the Dokploy admin account.
2. Recommended: in **Settings → Web Server**, give the dashboard its own domain (for example `dokploy.yourdomain.com`, which needs its own A record) with HTTPS. Then close port 3000 in the firewall.

## 3. Prepare the uploads folder (SSH)

```bash
ssh root@<VPS-IP>
mkdir -p /srv/eithm/uploads /srv/eithm/backups
chown 1000:1000 /srv/eithm/uploads      # the app runs as uid 1000 ("node")
```

You don't strictly need this step: the compose file's `storage-init` service creates the uploads folder and sets its owner on every deploy. Doing it yourself also lets you check that the disk path is right.

## 4. Connect your Git repository

The repository is most likely private. In Dokploy, open **Settings → Git → GitHub → Create GitHub App**, follow the prompts, and install the app on the repository. GitLab, Bitbucket and Gitea work the same way.

Push this repository, including `docker-compose.dokploy.yml`, to the branch you'll deploy (`main`).

## 5. Create the project

**Projects → Create Project**, for example `EITHM`.

## 6. Create the database service

1. Inside the project, **Create Service → Database → PostgreSQL**.
2. Fill in:

   | Field | Value |
   | --- | --- |
   | Name | `portal-db` |
   | Database Name | `portal` |
   | Database User | `portal` |
   | Database Password | leave the generated one, or generate one with `openssl rand -hex 24` |
   | Docker Image | `postgres:17` |

3. Click **Create**, then **Deploy** on the database's page.
4. Leave **External Port** empty, so the database isn't exposed to the internet.
5. On the database's **General** tab, copy the **Internal Connection URL**. It looks like this:
   ```
   postgresql://portal:<password>@eithm-portaldb-abc123:5432/portal
   ```
   You'll need it in step 8.

## 7. Create the app service

1. In the same project, **Create Service → Compose**. Name it `portal` and leave **Compose Type** as **Docker Compose**.
2. On the **General** tab:
   - **Provider:** GitHub. Pick the repository and branch `main`.
   - **Compose Path:** `./docker-compose.dokploy.yml`
   - Click **Save**.

## 8. Environment variables (app service)

Generate the JWT secret:

```bash
openssl rand -hex 32
```

On the `portal` service's **Environment** tab, paste the following and click **Save**:

```env
DATABASE_URL=<Internal Connection URL from step 6>?schema=public
JWT_SECRET=<the openssl value>
# Optional - base folder for uploads/ on the VPS (default /srv/eithm)
# DATA_DIR=/srv/eithm
# Optional - encrypts the admin-viewable password copies (default: JWT_SECRET).
# If you import the legacy University Portal, set this to its old key.
# PASSWORD_ENC_KEY=
```

For example:

```env
DATABASE_URL=postgresql://portal:9f3c...@eithm-portaldb-abc123:5432/portal?schema=public
```

Keep `JWT_SECRET` in a password manager. **Don't change it later:**

- Changing `JWT_SECRET` signs everyone out.
- Changing `PASSWORD_ENC_KEY` (or `JWT_SECRET`, if you never set `PASSWORD_ENC_KEY`) makes the admin-viewable passwords unreadable.

If the database password contains any of `@ / : # ? %`, URL-encode it in `DATABASE_URL` (for example `@` becomes `%40`). A hex password avoids this.

## 9. Domain and HTTPS

On the `portal` service's **Domains** tab, click **Add Domain**:

| Field | Value |
| --- | --- |
| Service Name | `app` |
| Host | `portal.yourdomain.com` |
| Path | `/` |
| Container Port | `4000` |
| HTTPS | on |
| Certificate | Let's Encrypt |

HTTPS is required. The session cookie is `Secure` in production, so over plain http the login appears to succeed and then drops you back on the sign-in page.

## 10. Deploy

Make sure `portal-db` is running, then click **Deploy** on `portal` and follow the **Deployments** log. The first build takes several minutes. When it finishes:

- **Logs** (container `app`) shows the Prisma migrations creating the tables, then `API listening on http://localhost:4000`;
- `https://portal.yourdomain.com/api/health` returns `{"ok":true}`;
- the certificate can take a minute after the first deploy. Until then the browser shows a certificate warning.

## 11. Create the first admin

Create your own admin account (or load the demo data, below). Open the `portal` service's **Docker** tab, choose the `app` container, then **Terminal** with shell `sh`, and run:

```sh
ADMIN_EMAIL='admin@eithm.edu.pk' ADMIN_PASSWORD='a-strong-password' ADMIN_NAME='Portal Administrator' node dist/create-admin.js
```

You can do the same over SSH:

```bash
docker exec -it \
  -e ADMIN_EMAIL='admin@eithm.edu.pk' -e ADMIN_PASSWORD='a-strong-password' \
  $(docker ps -qf label=com.docker.compose.service=app) node dist/create-admin.js
```

Then sign in at `https://portal.yourdomain.com`. Running the command again with the same email resets that account's password and unlocks it. Use this if you're ever locked out.

To load the demo data instead (admin `admin@eithm.edu.pk` / `Admin@12345`, plus teachers, students, courses, classrooms, attendance and marks; see `server/prisma/seed/accounts.ts`), run this in the same terminal. It only adds missing records and is safe to re-run:

```sh
node dist/seed.js
```

## 12. Automatic deploys (optional)

On the `portal` **General** tab, turn on **Autodeploy**. Every push to `main` then rebuilds and redeploys the app. Migrations run automatically on start, and the uploads and the database stay where they are.

---

## Backups

### Database: Dokploy

1. **Settings → S3 Destinations → Add**. Use any S3-compatible bucket: Cloudflare R2, Backblaze B2, AWS S3, or MinIO.
2. Open `portal-db`, go to its **Backups** tab and click **Create Backup**.
3. Choose the destination, database `portal`, and a schedule such as `0 2 * * *` (daily at 02:00). Turn it on.
4. Click **Test** or run it once manually to check that it works.

### Uploads: cron script

```bash
# from your computer, in the project folder
scp deploy/backup.sh root@<VPS-IP>:/srv/eithm/backup.sh

# on the VPS
chmod +x /srv/eithm/backup.sh
/srv/eithm/backup.sh                     # test it once
crontab -e                               # add the line below
```

```cron
30 2 * * * /srv/eithm/backup.sh >> /srv/eithm/backups/backup.log 2>&1
```

Each run writes `uploads_<date>.tar.gz` to `/srv/eithm/backups` and deletes archives older than 14 days (`KEEP_DAYS`). These archives are on the same disk, so also copy them off the server regularly, for example with `rsync` to your computer or the same S3 bucket. Hostinger's VPS snapshots and weekly backups (hPanel → VPS → Backups) are a good extra layer.

### Restoring

- **Database:** on the `portal-db` **Backups** tab, use **Restore** on the backup you want. Stop the `portal` service first.
- **Uploads:**
  ```bash
  tar -xzf /srv/eithm/backups/uploads_<date>.tar.gz -C /srv/eithm
  chown -R 1000:1000 /srv/eithm/uploads
  ```

## Working with the database

- **SQL shell:** in `portal-db`, open the **Docker** tab, then **Terminal**, and run `psql -U portal -d portal`.
- **pgAdmin or DBeaver from your PC:** the safest option is an SSH tunnel. Find the database container's IP on the VPS with
  ```bash
  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' <portal-db container>
  ```
  then run `ssh -L 5433:<that-ip>:5432 root@<VPS-IP>` and connect to `localhost:5433`. You could instead set an **External Port** on `portal-db`, but that exposes the database to the internet, so only do it with a strong password and a firewall rule limited to your IP.

## Moving existing data in (optional)

To move the data from your local stack, for example after running the legacy import (README, "Bringing over the legacy data"), to the server:

```bash
# On your computer, with the local stack running:
docker exec portal-postgres pg_dump -U portal -d portal_dev -Fc > portal.dump
scp portal.dump root@<VPS-IP>:/srv/eithm/backups/
scp -r server/storage/uploads/. root@<VPS-IP>:/srv/eithm/uploads/
```

Then on the VPS, with the `portal` service stopped in Dokploy:

```bash
DB=$(docker ps --format '{{.Names}}' | grep portaldb | head -n1)   # the portal-db container
docker exec -i "$DB" pg_restore -U portal -d portal --clean --if-exists --no-owner \
  < /srv/eithm/backups/portal.dump
chown -R 1000:1000 /srv/eithm/uploads
```

Start the `portal` service again. If the legacy University Portal passwords should stay viewable, set `PASSWORD_ENC_KEY` (step 8) to the key you used for the import **before** users start changing passwords.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| App keeps restarting with `Can't reach database server` / `P1001` | Check that `portal-db` is running and that `DATABASE_URL` uses its **internal** host (step 6), not `localhost`. |
| `P1000` authentication failed | The password in `DATABASE_URL` is wrong, or it has special characters that aren't URL-encoded. |
| Sign-in "works" but returns to the login page | The domain isn't on HTTPS (step 9), or you opened it through `http://`. |
| `404 page not found` / `Bad Gateway` on the domain | The domain must point to service **`app`** and port **`4000`**. Check that the app container is healthy in **Logs**. |
| Uploads fail with `EACCES` in the logs | `chown -R 1000:1000 /srv/eithm/uploads` |
| Build is killed / `JavaScript heap out of memory` | The VPS is short of RAM. Add swap (`fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`, then add it to `/etc/fstab`) or move to a bigger plan. |
| App restarts with `JWT_SECRET must be at least 32 characters` | Set `JWT_SECRET` in the Environment tab (step 8) and redeploy. |

Files up to 25 MB can be uploaded (`shared/src/files/validation.ts`). Traefik adds no lower limit.
