# Backend image: the Express API only (no React app). Used when the frontend
# and backend are deployed as separate services - see
# docs/deploy-dokploy-separate.md. Build from the REPOSITORY ROOT:
#
#   docker build -f server/Dockerfile -t portal-api .
#
# On start it applies pending Prisma migrations, then serves on $PORT (4000).

# ---- Build: install workspaces, generate Prisma, bundle the server ----
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund

COPY shared shared
COPY server server
# prisma generate only needs a syntactically valid URL - nothing connects.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build --workspace server

# ---- Runtime: production dependencies + build output only ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    PORT=4000 \
    STORAGE_ROOT=/data/uploads
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server --no-audit --no-fund && npm cache clean --force

COPY server/prisma server/prisma
COPY server/prisma.config.ts server/
COPY --from=build /app/server/dist server/dist

# Uploaded files - mount a persistent volume / bind mount here.
RUN mkdir -p /data/uploads && chown -R node:node /data
VOLUME /data
USER node

EXPOSE 4000
WORKDIR /app/server
# Migrations run before the server listens, so allow a generous start period.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
