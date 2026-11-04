#!/bin/bash
set -e

cd ~/domains/statistieken.klompjes.com/public_html

echo "Installing dependencies..."
~/.nvm/versions/node/v20.20.2/bin/npm install --production=false

echo "Pushing database schema..."
~/.nvm/versions/node/v20.20.2/bin/npx prisma db push

echo "Building..."
~/.nvm/versions/node/v20.20.2/bin/npm run build

echo "Restarting server..."
~/.nvm/versions/node/v20.20.2/bin/pm2 restart next

echo "Done!"
