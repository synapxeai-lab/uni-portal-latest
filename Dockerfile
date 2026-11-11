# Production image: one container serving the Express API and the built
# React app (same origin, so the session cookie needs no CORS setup).
#
#   docker build -t portal .
#   docker compose -f docker-compose.prod.yml up --build
#
# On start it applies pending Prisma migrations, then serves on $PORT.

# ---- Build: install everything, generate Prisma, bundle server + client ----
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
COPY client client
# prisma generate only needs a syntactically valid URL - nothing connects.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build --workspace server \
 && npm run build --workspace client

# ---- Runtime: production dependencies + build output only ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    PORT=4000 \
    SERVE_CLIENT_DIR=/app/client/dist \
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
COPY --from=build /app/client/dist client/dist

# Uploaded files - mount a persistent volume here.
RUN mkdir -p /data/uploads && chown -R node:node /data
VOLUME /data
USER node

EXPOSE 4000
WORKDIR /app/server
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
