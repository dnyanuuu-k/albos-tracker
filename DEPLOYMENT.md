# ETMS - Deployment & Running Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Running the Application](#running-the-application)
4. [Database Management](#database-management)
5. [Environment Variables](#environment-variables)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.17.0 or higher (recommended v20.x)
- **Bun**: v1.0.0 or higher (recommended for faster builds)
- **Git**: For version control
- **SQLite**: Comes bundled with Prisma (no separate installation needed)

### Installing Bun (Optional but Recommended)

```bash
# On macOS/Linux
curl -fsSL https://bun.sh/install | bash

# On Windows
# Download installer from https://bun.sh

# Verify installation
bun --version
```

---

## Local Development Setup

### 1. Clone or Navigate to Project Directory

```bash
cd /home/z/my-project
```

### 2. Install Dependencies

Using Bun (recommended):
```bash
bun install
```

Using npm:
```bash
npm install
```

Using yarn:
```bash
yarn install
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="file:./db/custom.db"

# JWT Secret (generate a secure random string)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Application
NODE_ENV="development"
```

**Generate a secure JWT secret:**
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Bun
bun -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

### 4. Set Up Database

Initialize the database with Prisma:

```bash
# Push schema to database (creates tables)
bun run db:push

# Seed database with initial data
bun run prisma/seed.ts
```

**Note:** The seed script will create:
- A default organization: "Demo Organization" (slug: `demo-org`)
- An admin user is created by the seed script (email/password printed by the seed output).
- A default department: "Engineering"

### 5. Verify Installation

Run the linter to check for code issues:
```bash
bun run lint
```

---

## Running the Application

### Development Mode

The development server is **automatically started** in the background. You don't need to run it manually.

**Development Server Details:**
- **URL:** http://localhost:3000
- **Port:** 3000 (fixed, cannot be changed)
- **Hot Reload:** Enabled (auto-restarts on file changes)
- **Logs:** Check `/home/z/my-project/dev.log` for real-time logs

**View Recent Logs:**
```bash
tail -f /home/z/my-project/dev.log
```

### Manual Development Server (if needed)

If you need to restart the dev server:

```bash
# Start development server
bun run dev

# With auto-reload (hot)
bun --hot run dev
```

**Important:** Do NOT run `bun run build` in development mode as it's for production only.

### Accessing the Application

1. Open your browser and navigate to the Preview Panel on the right side
2. Or click "Open in New Tab" above the Preview Panel
3. You'll see the login page

After login, you'll be redirected to the dashboard.

---

## Database Management

### View Database Schema

```bash
# Open Prisma Studio (GUI for database)
bunx prisma studio
```

This will open a web-based GUI at http://localhost:5555 where you can:
- View all tables and records
- Add, edit, and delete data
- Run queries
- Inspect relationships

### Reset Database

⚠️ **Warning:** This will delete all data!

```bash
# Delete database file
rm /home/z/my-project/db/custom.db

# Re-create and seed
bun run db:push
bun run prisma/seed.ts
```

### Update Database Schema

1. Modify `prisma/schema.prisma`
2. Push changes to database:
   ```bash
   bun run db:push
   ```

### Backup Database

```bash
# Copy database file
cp /home/z/my-project/db/custom.db /path/to/backup/custom-$(date +%Y%m%d).db
```

### Restore Database

```bash
# Stop the application first
# Then restore from backup
cp /path/to/backup/custom-YYYYMMDD.db /home/z/my-project/db/custom.db

# Restart application
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | SQLite database connection string | `file:./db/custom.db` | Yes |
| `JWT_SECRET` | Secret key for JWT token signing | `hex-string-32-chars` | Yes |
| `NODE_ENV` | Environment mode | `development` \| `production` | Yes |

### Optional Variables (Future Use)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Public API URL | `/api` |
| `EMAIL_SERVER_HOST` | SMTP server host | - |
| `EMAIL_SERVER_PORT` | SMTP server port | 587 |
| `EMAIL_USER` | SMTP username | - |
| `EMAIL_PASSWORD` | SMTP password | - |
| `REDIS_URL` | Redis connection string | - |
| `S3_BUCKET` | AWS S3 bucket name | - |
| `S3_REGION` | AWS S3 region | - |
| `S3_ACCESS_KEY` | AWS access key | - |
| `S3_SECRET_KEY` | AWS secret key | - |

---

## Production Deployment

### Build for Production

```bash
# Create production build
bun run build

# Output: .next directory
```

### Start Production Server

```bash
# Start production server
bun run start
```

**Production Server Details:**
- **URL:** http://localhost:3000
- **Port:** 3000
- **Performance:** Optimized, no hot reload

### Deployment Platforms

#### 1. Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# For production
vercel --prod
```

**Vercel Configuration (`vercel.json`):**
```json
{
  "buildCommand": "bun run build",
  "outputDirectory": ".next",
  "devCommand": "bun run dev",
  "installCommand": "bun install"
}
```

#### 2. Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

**Note:** For Railway, use PostgreSQL instead of SQLite for production.

#### 3. Docker

Create `Dockerfile`:
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["bun", "server.js"]
```

Build and run:
```bash
# Build image
docker build -t etms .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="file:./db/custom.db" \
  -e JWT_SECRET="your-production-secret" \
  -v $(pwd)/db:/app/db \
  etms
```

#### 4. Traditional VPS (Ubuntu/Debian)

```bash
# Install Node.js and Bun
curl -fsSL https://bun.sh/install | bash

# Clone project
git clone <your-repo-url> /var/www/etms
cd /var/www/etms

# Install dependencies
bun install

# Build
bun run build

# Setup PM2 (process manager)
npm i -g pm2

# Start with PM2
pm2 start bun --name "etms" -- start

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Production Checklist

Before deploying to production:

- [ ] Change `NODE_ENV` to `production`
- [ ] Generate and set a strong `JWT_SECRET`
- [ ] Enable HTTPS/SSL
- [ ] Set up database backups
- [ ] Configure error tracking (Sentry)
- [ ] Set up logging (Winston, Pino)
- [ ] Configure email service (SendGrid, AWS SES)
- [ ] Set up monitoring (Datadog, New Relic)
- [ ] Configure CDN for static assets
- [ ] Enable gzip compression
- [ ] Set up rate limiting
- [ ] Configure CORS if needed
- [ ] Run security audit: `bun audit`

---

## Troubleshooting

### Common Issues

#### 1. Port 3000 Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use this on Linux
fuser -k 3000/tcp
```

#### 2. Database Locked Error

```bash
# Check if any processes are accessing the database
lsof /home/z/my-project/db/custom.db

# Kill the process and restart
kill -9 <PID>
bun run dev
```

#### 3. Prisma Client Not Generated

```bash
# Regenerate Prisma Client
bunx prisma generate
```

#### 4. Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules bun.lockb
bun install
```

#### 5. TypeScript Errors

```bash
# Restart TypeScript server
# In VS Code: Command Palette > TypeScript: Restart TS Server

# Or check types
bunx tsc --noEmit
```

#### 6. Authentication Not Working

- Check JWT_SECRET is set in `.env`
- Verify cookies are being set (check browser DevTools > Application > Cookies)
- Check dev.log for authentication errors
- Ensure user status is `ACTIVE` in database

#### 7. Build Failures

```bash
# Clear Next.js cache
rm -rf .next

# Try building again
bun run build
```

### Getting Help

1. Check the dev logs: `tail -f /home/z/my-project/dev.log`
2. Review the error messages in the browser console
3. Check the network tab for failed API requests
4. Verify database state with Prisma Studio: `bunx prisma studio`

---

## Development Workflow

### Recommended Workflow

1. **Start Dev Server:** Already running in background
2. **Make Changes:** Edit files in `/src` directory
3. **Auto-Reload:** Changes are detected and server restarts automatically
4. **Check Logs:** `tail -f /home/z/my-project/dev.log`
5. **Test:** Visit http://localhost:3000 or use Preview Panel

### Code Quality

```bash
# Run linter
bun run lint

# Run type checker
bunx tsc --noEmit

# Format code (if Prettier is configured)
bunx prettier --write .
```

### Git Workflow

```bash
# Stage changes
git add .

# Commit
git commit -m "feat: add new feature"

# Push
git push origin main
```

---

## Security Best Practices

### For Development

1. Never commit `.env` file
2. Use different secrets for development and production
3. Keep dependencies updated: `bun update`
4. Run security audit: `bun audit`

### For Production

1. Use environment variables for all sensitive data
2. Enable HTTPS with SSL/TLS certificates
3. Implement rate limiting on API endpoints
4. Use strong password policies
5. Enable CORS only for trusted domains
6. Regularly update dependencies
7. Set up WAF (Web Application Firewall)
8. Enable database encryption at rest
9. Implement proper logging and monitoring
10. Regular security audits

---

## Performance Optimization

### For Development

1. Use Bun for faster builds and installs
2. Enable Next.js Image optimization
3. Use code splitting for large components
4. Minimize bundle size with tree shaking

### For Production

1. Enable CDN for static assets
2. Use gzip/brotli compression
3. Implement caching strategies
4. Use database connection pooling
5. Enable Redis for session storage
6. Optimize images and assets
7. Use lazy loading for routes
8. Implement service worker for PWA

---

## Support & Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com
- **Bun Docs:** https://bun.sh/docs

---

## Quick Reference

### Essential Commands

```bash
# Install dependencies
bun install

# Development (auto-running)
# No need to run manually

# Database
bun run db:push          # Push schema changes
bunx prisma studio       # Open database GUI
bun run prisma/seed.ts   # Seed database

# Code Quality
bun run lint             # Check code quality
bunx tsc --noEmit        # Type check

# Production
bun run build            # Build for production
bun run start            # Start production server
```

### File Locations

- **Main App:** `/home/z/my-project/src/app/`
- **Components:** `/home/z/my-project/src/components/`
- **Libraries:** `/home/z/my-project/src/lib/`
- **Database Schema:** `/home/z/my-project/prisma/schema.prisma`
- **Database File:** `/home/z/my-project/db/custom.db`
- **Dev Logs:** `/home/z/my-project/dev.log`
- **Environment:** `/home/z/my-project/.env`

---

**Last Updated:** March 23, 2026
**Version:** 1.0.0
