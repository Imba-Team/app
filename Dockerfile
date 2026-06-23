ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM node:${NODE_VERSION} AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm run build

FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod
RUN pnpm prisma generate

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9090

ARG SERVICE_NAME=monolith
ENV SERVICE_NAME=${SERVICE_NAME}

RUN addgroup -S mimir && adduser -S mimir -G mimir

COPY --from=prod-deps --chown=mimir:mimir /app/node_modules ./node_modules
COPY --from=build --chown=mimir:mimir /app/dist ./dist
COPY --from=build --chown=mimir:mimir /app/prisma ./prisma
COPY --chown=mimir:mimir package.json ./

USER mimir
EXPOSE 9090
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:9090/health || exit 1

CMD ["node", "dist/main.js"]
