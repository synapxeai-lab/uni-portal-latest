# Deploying on Dokploy (Hostinger VPS)

The portal runs as two containers from [`docker-compose.dokploy.yml`](../docker-compose.dokploy.yml):

- **db**: PostgreSQL 17;
- **app**: the production image from the [`Dockerfile`](../Dockerfile). It serves the API and the built React app on port 4000 and applies database migrations every time it starts.

Dokploy builds the image on the VPS from your Git repository. Its Traefik proxy serves your domain over HTTPS with a free Let's Encrypt certificate.

**Uploaded files and the database** are stored in ordinary folders on the VPS disk. They sit outside Dokploy's checkout, so redeploying, rebuilding or deleting the service doesn't touch them:

| Folder on the VPS | Mounted in | Holds |
| --- | --- | --- |
| `/srv/eithm/uploads` | `app:/data/uploads` | every uploaded file (submissions, classwork attachments, avatars...) |
| `/srv/eithm/postgres` | `db:/var/lib/postgresql/data` | the database |
| `/srv/eithm/backups` | (none) | nightly backups from [`deploy/backup.sh`](../deploy/backup.sh) |

> **About "Hostinger volumes":** Hostinger VPS plans come with one NVMe disk and no separate block-storage volumes to attach. Your persistent volume is therefore a folder on that disk, mounted into the container as shown above. To keep the data on a different disk later (for example an extra mounted drive), set `DATA_DIR` (step 6) to a folder on it and move the existing folders across.

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

## 3. Prepare the data folders (SSH)

```bash
ssh root@<VPS-IP>
mkdir -p /srv/eithm/uploads /srv/eithm/postgres /srv/eithm/backups
chown 1000:1000 /srv/eithm/uploads      # the app runs as uid 1000 ("node")
```

You don't strictly need this step: the compose file's `storage-init` service creates the uploads folder and sets its owner on every deploy. Doing it yourself also lets you check that the disk path is right.

## 4. Connect your Git repository

The repository is most likely private. In Dokploy, open **Settings → Git → GitHub → Create GitHub App**, follow the prompts, and install the app on the repository. GitLab, Bitbucket and Gitea work the same way.

## 5. Create the service

1. **Projects → Create Project**, for example `EITHM`.
2. Inside it, **Create Service → Compose**. Name it `portal`.
3. On the **General** tab:
   - **Provider:** GitHub. Pick the repository and branch `main`.
   - **Compose Path:** `./docker-compose.dokploy.yml`
   - **Compose Type:** Docker Compose
   - Click **Save**.

## 6. Environment variables

Generate the secrets on the VPS (or anywhere you have `openssl`):

```bash
openssl rand -hex 24   # -> POSTGRES_PASSWORD
openssl rand -hex 32   # -> JWT_SECRET
```

On the service's **Environment** tab, paste the following and click **Save**:

```env
POSTGRES_PASSWORD=<first value>
JWT_SECRET=<second value>
# Optional - base folder for uploads/ and postgres/ (default /srv/eithm)
# DATA_DIR=/srv/eithm
# Optional - encrypts the admin-viewable password copies (default: JWT_SECRET).
# If you import the legacy University Portal, set this to its old key.
# PASSWORD_ENC_KEY=
```

Keep these values in a password manager. **Don't change them later:**

- `POSTGRES_PASSWORD` is only applied when the database is first created. Changing it afterwards breaks the app's connection.
- Changing `JWT_SECRET` signs everyone out.
- Changing `PASSWORD_ENC_KEY` (or `JWT_SECRET`, if you never set `PASSWORD_ENC_KEY`) makes the admin-viewable passwords unreadable.

Use hex values for `POSTGRES_PASSWORD`. It goes into a connection URL, so characters like `@ / : #` would break it.

## 7. Domain and HTTPS

On the **Domains** tab, click **Add Domain**:

| Field | Value |
| --- | --- |
| Service Name | `app` |
| Host | `portal.yourdomain.com` |
| Path | `/` |
| Container Port | `4000` |
| HTTPS | on |
| Certificate | Let's Encrypt |

HTTPS is required. The session cookie is `Secure` in production, so over plain http the login appears to succeed and then drops you back on the sign-in page.

## 8. Deploy

Click **Deploy** and follow the **Deployments** log. The first build takes several minutes. When it finishes:

- **Logs** (service `app`) shows the Prisma migrations, then `API listening on http://localhost:4000`;
- `https://portal.yourdomain.com/api/health` returns `{"ok":true}`;
- the certificate can take a minute after the first deploy. Until then the browser shows a certificate warning.

## 9. Create the first admin

The demo seed isn't part of production. Create your own admin account instead, either in the app container's terminal in Dokploy (**Docker** tab of the service → `app` container → **Terminal**, shell `sh`) or over SSH:

```bash
# over SSH: find the app container
docker ps --filter label=com.docker.compose.service=app --format '{{.Names}}'

docker exec -it \
  -e ADMIN_EMAIL='admin@eithm.edu.pk' \
  -e ADMIN_PASSWORD='a-strong-password' \
  -e ADMIN_NAME='Portal Administrator' \
  <app-container> node dist/create-admin.js
```

In the Dokploy terminal you're already inside the container. Run:

```sh
ADMIN_EMAIL='admin@eithm.edu.pk' ADMIN_PASSWORD='a-strong-password' node dist/create-admin.js
```

Then sign in at `https://portal.yourdomain.com`. Running the command again with the same email resets that account's password and unlocks it. Use this if you're ever locked out.

## 10. Automatic deploys (optional)

On the **General** tab, turn on **Autodeploy**. Every push to `main` then rebuilds and redeploys the app. Migrations run automatically on start, and uploads and the database stay where they are.

---

## Backups

Copy the backup script to the VPS once and schedule it nightly:

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

Each run writes `db_<date>.dump` and `uploads_<date>.tar.gz` to `/srv/eithm/backups` and deletes backups older than 14 days (`KEEP_DAYS`). These copies are on the same disk, so also copy them off the server regularly, for example with `scp`/`rsync` to your computer or a cloud bucket. Hostinger's VPS snapshots and weekly backups (hPanel → VPS → Backups) are a good extra layer.

### Restoring

```bash
DB=$(docker ps --filter label=com.docker.compose.service=db --format '{{.Names}}' | head -n1)
# Stop the "app" service in Dokploy first (keep "db" running), then:
docker exec -i "$DB" pg_restore -U portal -d portal --clean --if-exists --no-owner \
  < /srv/eithm/backups/db_<date>.dump
tar -xzf /srv/eithm/backups/uploads_<date>.tar.gz -C /srv/eithm
chown -R 1000:1000 /srv/eithm/uploads
# Start/redeploy in Dokploy.
```

## Moving existing data in (optional)

To move the data from your local stack, for example after running the legacy import (README, "Bringing over the legacy data"), to the server:

```bash
# On your computer, with the local stack running:
docker exec portal-postgres pg_dump -U portal -d portal_dev -Fc > portal.dump
scp portal.dump root@<VPS-IP>:/srv/eithm/backups/
scp -r server/storage/uploads/. root@<VPS-IP>:/srv/eithm/uploads/
```

Then, on the VPS, restore it as described in **Restoring** above, using `portal.dump` and skipping the `tar` line. Finish with `chown -R 1000:1000 /srv/eithm/uploads`. If the legacy University Portal passwords should stay viewable, set `PASSWORD_ENC_KEY` (step 6) to the key you used for the import **before** users start changing passwords.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Sign-in "works" but returns to the login page | The domain isn't on HTTPS (step 7), or you opened it through `http://`. |
| `404 page not found` / `Bad Gateway` on the domain | The domain must point to service **`app`** and port **`4000`**. Check that the app container is healthy in **Logs**. |
| Uploads fail with `EACCES` in the logs | `chown -R 1000:1000 /srv/eithm/uploads` |
| Build is killed / `JavaScript heap out of memory` | The VPS is short of RAM. Add swap (`fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`, then add it to `/etc/fstab`) or move to a bigger plan. |
| App restarts with `JWT_SECRET must be at least 32 characters` | Set `JWT_SECRET` in the Environment tab (step 6) and redeploy. |
| App can't connect to the database after changing `POSTGRES_PASSWORD` | Change it back. The database keeps the password it was created with. |

Files up to 25 MB can be uploaded (`shared/src/files/validation.ts`). Traefik adds no lower limit.
