FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS tooling
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

FROM tooling AS builder
RUN npm run build

FROM node:22-bookworm-slim AS initializer
WORKDIR /app
ENV NODE_ENV=production
ARG APP_VERSION=local
LABEL org.opencontainers.image.title="WAAAT POS database initializer" \
      org.opencontainers.image.description="Local WAAAT POS migrations and menu import" \
      org.opencontainers.image.source="https://github.com/sundar-k565/event-billing" \
      org.opencontainers.image.version=$APP_VERSION
COPY scripts/docker-init-package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY scripts/local-init.ts scripts/database.ts ./scripts/
COPY database/local ./database/local
COPY supabase/migrations ./supabase/migrations
COPY data/MENU_SEED.json ./data/MENU_SEED.json
COPY src/lib/seed.ts src/lib/validation.ts src/lib/date.ts src/lib/password.ts src/lib/money.ts ./src/lib/
CMD ["node", "--import", "tsx", "scripts/local-init.ts"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
ARG APP_VERSION=local
LABEL org.opencontainers.image.title="WAAAT POS" \
      org.opencontainers.image.description="Local PostgreSQL point-of-sale application" \
      org.opencontainers.image.source="https://github.com/sundar-k565/event-billing" \
      org.opencontainers.image.version=$APP_VERSION

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
