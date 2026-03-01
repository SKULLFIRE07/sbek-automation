FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/templates ./dist/templates
COPY seo/ ./seo/
COPY creatives/ ./creatives/

# Include seed script and source for dashboard seed/reset button
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm install tsx --save-optional --no-save 2>/dev/null || true

RUN mkdir -p /app/reports

EXPOSE 3000

CMD ["node", "dist/index.js"]
