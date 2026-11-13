# Frontend image: the built React app served by nginx. Used when the frontend
# and backend are deployed as separate services - see
# docs/deploy-dokploy-separate.md. Build from the REPOSITORY ROOT (the client
# imports the @portal/shared workspace):
#
#   docker build -f client/Dockerfile -t portal-web .
#
# The app calls the API at the relative path /api, so serve both on the same
# domain and route /api to the backend at the proxy (Traefik in Dokploy).

# ---- Build: install workspaces, type-check and bundle the client ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund

COPY shared shared
COPY client client
RUN npm run build --workspace client

# ---- Runtime: static files only ----
FROM nginx:1.27-alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
