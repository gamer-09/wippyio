# wippyio

A personal website that displays all projects from the [storage-packed](https://github.com/gamer-09/storage-packed) vault.

## How It Works

1. **Sync locally** — Run `node sync-projects.js` to pull project data from your storage-packed vault, slim it down, and capture screenshots.
2. **Commit & push** — Push the changes to GitHub.
3. **GitHub Pages** — The site auto-deploys via GitHub Actions at https://gamer-09.github.io/wippyio/

## Quick Start

```bash
# Sync projects (data only)
node sync-projects.js

# Sync with screenshots
node sync-projects.js --screenshots

# Point to a specific path
node sync-projects.js /path/to/storage-packed --screenshots
```

## Site Structure

```
index.html              ← Main page (bento grid layout)
styles.css              ← Bold colorful theme
app.js                  ← Client-side rendering, search, filters, cursor trail
data/projects.json      ← Slimmed project data (synced from vault)
data/screenshots/       ← Project screenshots and gradient fallbacks
sync-projects.js        ← Local sync script (with Puppeteer screenshot capture)
.github/workflows/      ← GitHub Pages deployment
```

## Syncing Updates

Every time you add or update a project in storage-packed:

1. Run `node sync-projects.js --screenshots` in the wippyio directory
2. Git commit and push
3. GitHub Actions deploys the update

The sync script strips heavy fields, detects GitHub repos, checks public/private visibility, and captures screenshots — reducing the data by ~99%.
