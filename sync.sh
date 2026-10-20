#!/usr/bin/env bash
set -e

echo "🔄 Pulling latest commits from git..."
git pull

echo "📦 Installing updated dependencies..."
if command -v bun >/dev/null 2>&1; then
  echo "Using Bun package manager..."
  bun install
elif command -v npm >/dev/null 2>&1; then
  echo "Using npm package manager..."
  npm install
elif command -v pnpm >/dev/null 2>&1; then
  echo "Using pnpm package manager..."
  pnpm install
elif command -v yarn >/dev/null 2>&1; then
  echo "Using yarn package manager..."
  yarn install
else
  echo "⚠️ Warning: Neither bun nor npm found on this system." >&2
  exit 1
fi

echo ""
echo "✅ Repository synchronized and dependencies updated successfully!"
echo "⚠️  REMINDER: Please restart the service (e.g., 'npm run dev', 'npm start', or 'sprite-studio restart') for changes to take effect."
