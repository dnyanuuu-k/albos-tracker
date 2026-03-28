FROM oven/bun:1 AS build
WORKDIR /app

# Install dependencies
COPY package.json ./
COPY package-lock.json* ./
RUN bun install

# Build Next.js (standalone output)
COPY . .
RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production

# Runtime artifacts
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Background jobs will import helpers from `src/` (email templates, DB access, etc.)
COPY --from=build /app/src ./src

# Prisma migration/runtime tools need the schema + migrations at startup
COPY --from=build /app/prisma ./prisma

# Ensure `prisma` CLI exists for `prisma migrate deploy`
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

# Apply DB migrations on startup, then start the server.
# This keeps the web container “hands-off” after initial deploy.
CMD ["sh", "-c", "bunx prisma generate && bunx prisma migrate deploy && bun server.js"]

