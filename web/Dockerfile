# syntax=docker/dockerfile:1
FROM node:22-slim AS deps
RUN corepack enable
WORKDIR /app
# pnpm-workspace.yaml carries build-script approvals; without it pnpm install
# exits non-zero on ignored native builds (sharp, unrs-resolver).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
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
