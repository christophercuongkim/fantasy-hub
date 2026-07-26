# syntax=docker/dockerfile:1
# Build context is the REPO ROOT (matches docker-compose and Dokploy's default),
# so all COPY paths are prefixed with web/.
FROM node:22-slim AS deps
RUN corepack enable
WORKDIR /app
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
RUN pnpm build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
# Next.js standalone output: self-contained server + only the needed node_modules.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 4000
CMD ["node", "server.js"]
