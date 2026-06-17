# ══════════════════════════════════════════════════════════════
# ProxPanel Server Dockerfile
# ══════════════════════════════════════════════════════════════
# Development:  docker build --target development -t proxpanel-server:dev .
# Production:   docker build -t proxpanel-server:latest .
# ══════════════════════════════════════════════════════════════

FROM node:22-alpine AS base
RUN apk add --no-cache openssl curl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma

# ── Development target ──
FROM base AS development
RUN npm ci
RUN npx prisma generate
COPY . .
EXPOSE 3000 9090
CMD ["npm", "run", "dev"]

# ── Production build stage ──
FROM base AS build
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build

# ── Production runtime ──
FROM node:22-alpine AS production
RUN apk add --no-cache openssl curl
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3000 9090
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["npm", "start"]
