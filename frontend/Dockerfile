# Install dependencies from the lockfile.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build. The /api rewrite and the security headers in next.config.mjs are fixed at build time,
# so BACKEND_URL, EMBED_FRAME_ANCESTORS and HSTS must be known here.
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG BACKEND_URL=http://backend:8080
ARG EMBED_FRAME_ANCESTORS=
ARG HSTS=false
ENV BACKEND_URL=$BACKEND_URL EMBED_FRAME_ANCESTORS=$EMBED_FRAME_ANCESTORS HSTS=$HSTS NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runtime: Next's standalone server only, as the non-root node user.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
# The landing page, rendered by the server. busybox wget comes with the alpine base.
HEALTHCHECK --interval=10s --timeout=4s --start-period=20s --retries=3 CMD wget -q -O /dev/null "http://127.0.0.1:$PORT/" || exit 1
CMD ["node", "server.js"]
