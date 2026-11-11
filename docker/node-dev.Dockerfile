# Shared development image for the deps installer, the API server and the
# Vite dev server. Source code is bind-mounted at /app by docker-compose.yml;
# node_modules lives in a named volume so the host never needs Node.js.
FROM node:22-alpine

# OpenSSL is required by the Prisma CLI's schema engine (migrations).
RUN apk add --no-cache openssl

WORKDIR /app
