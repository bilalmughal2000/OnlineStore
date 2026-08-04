# Container image for the API (apps/api).
#
# Why this file exists: Railway's default builder (Railpack) refuses to build a
# project whose lockfile contains a HIGH-severity advisory. This is an npm
# workspace monorepo with ONE shared lockfile, so a storefront dependency —
# Next.js, which the API never imports — blocks an API-only deploy. Providing a
# Dockerfile switches Railway to the Docker builder and makes the build explicit
# instead of auto-detected.
#
# Used by Railway/Render/Fly. The cPanel and VPS flows do not use it — see
# deploy/README.md.

FROM node:20-slim

WORKDIR /app

# Prisma's query engine needs OpenSSL; node:20-slim doesn't ship it.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Manifests first so `npm ci` is cached and only re-runs when deps change.
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/database/package.json packages/database/
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/admin/package.json apps/admin/

# NODE_ENV is deliberately NOT set yet: devDependencies (typescript, prisma)
# are required to build, and `npm ci` skips them under NODE_ENV=production.
RUN npm ci

# Source. .dockerignore keeps node_modules, .next and dist out of the context.
COPY . .

# Compiles shared-types → generates the Prisma client → compiles the API.
RUN npm run build:api

# Runtime only — set after the build for the reason above.
ENV NODE_ENV=production

# The API listens on process.env.PORT, which the platform provides (apps/api/src/env.ts).
CMD ["node", "apps/api/dist/index.js"]
