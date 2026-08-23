# ══════════════════════════════════════════════════════════════
# ProxPanel Server Dockerfile — Optimized Fast Multi-Stage Build
# ══════════════════════════════════════════════════════════════

FROM node:22-alpine AS build
RUN apk add --no-cache openssl curl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund --prefer-offline
RUN npx prisma generate

COPY . .
RUN npm run build
RUN npm prune --production --no-audit --no-fund

# ── Production runtime ──
FROM node:22-alpine AS production
RUN apk add --no-cache openssl curl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000 9090
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]
