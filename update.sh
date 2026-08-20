#!/usr/bin/env bash
# update.sh — Sync projects from storage-packed and push to GitHub.
#
# Usage:
#   ./update.sh                              (auto-detects sibling storage-packed)
#   ./update.sh /path/to/storage-packed      (explicit path)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔄 Syncing projects from storage-packed..."
node sync-projects.js "${1:-../storage-packed}"

echo ""
echo "📦 Committing and pushing..."
git add data/projects.json
git commit -m "Update project portfolio data" --allow-empty 2>/dev/null || echo "No changes to commit."
git push origin main

echo ""
echo "✅ Done! Site will update at https://gamer-09.github.io/portfolio-hub/"
