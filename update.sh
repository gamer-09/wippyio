#!/usr/bin/env bash
# update.sh — Sync projects from storage-packed and push to GitHub.
#
# Usage:
#   ./update.sh                              (sync data only)
#   ./update.sh --screenshots                (sync + capture screenshots)
#   ./update.sh /path/to/storage-packed --screenshots

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔄 Syncing projects from storage-packed..."
node sync-projects.js "${@:-../storage-packed}"

echo ""
echo "📦 Committing and pushing..."
git add data/projects.json data/screenshots/ 2>/dev/null
git commit -m "Update project portfolio data" --allow-empty 2>/dev/null || echo "No changes to commit."
git push origin main

echo ""
echo "✅ Done! Site will update at https://gamer-09.github.io/wippyio/"
