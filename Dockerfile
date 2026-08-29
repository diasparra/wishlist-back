FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

# Migrations + seed are idempotent, so this is safe on every (re)deploy.
CMD ["sh", "-c", "node scripts/migrate.js && node scripts/seed.js && node src/server.js"]
