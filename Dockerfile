# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Install backend dependencies
# better-sqlite3 is a native module — needs python3/make/g++ to compile
FROM node:20-alpine AS backend-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Stage 3: Production image (no build tools, smaller attack surface)
FROM node:20-alpine
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend-build /app/backend/public ./public

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
