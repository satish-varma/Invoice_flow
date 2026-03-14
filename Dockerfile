FROM node:20-slim AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Set build-time variables if needed
ENV NEXT_PRIVATE_STANDALONE=true
RUN npm run build

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Optional: Ensure traces are ignored or handled if they cause issues
# RUN rm -rf .next/standalone/.next/server/app/**/*.js.nft.json || true

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
