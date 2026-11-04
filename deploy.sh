#!/bin/bash
set -e

source ~/.nvm/nvm.sh

cd ~/domains/statistieken.klompjes.com/public_html

echo "Installing dependencies..."
~/.nvm/versions/node/v20.20.2/bin/npm install --production=false

echo "Pushing database schema..."
~/.nvm/versions/node/v20.20.2/bin/npx prisma db push

echo "Building..."
~/.nvm/versions/node/v20.20.2/bin/npm run build

echo "Restarting server..."
fuser -k 3000/tcp 2>/dev/null || true
sleep 2
nohup node node_modules/.bin/next start >> ~/nextjs.log 2>&1 &

echo "Done!"
