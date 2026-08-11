#!/bin/bash
# Wordt uitgevoerd na elke git pull/push op de server.
# Koppel dit aan je git post-receive hook of roep het handmatig aan.

set -e

echo "==> Installing dependencies..."
npm ci --omit=dev

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Running database migrations..."
npx prisma db push --accept-data-loss

echo "==> Building Next.js..."
npm run build

echo "==> Restarting app with PM2..."
pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js

echo "==> Done!"
pm2 status
