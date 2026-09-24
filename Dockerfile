# Stage 1: Build the frontend assets
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Edge Runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Install native dependencies required for SQLite (Python & build-base)
RUN apk add --no-cache python3 make g++ sqlite

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code and pre-built frontend distribution
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Expose POS port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

VOLUME ["/app/server/data"]

CMD ["node", "server/index.js"]
