# Project Hub — Portfolio

A personal website that displays all projects from the [storage-packed](https://github.com/gamer-09/storage-packed) vault.

## How It Works

1. **Sync locally** — Run `node sync-projects.js` to pull project data from your storage-packed vault and slim it down for the web.
2. **Commit & push** — Push the changes to GitHub.
3. **GitHub Pages** — The site auto-deploys via GitHub Actions.

## Quick Start

```bash
# Sync projects from your local storage-packed vault
node sync-projects.js

# Or point it to a specific path
node sync-projects.js /path/to/storage-packed
```

## Site Structure

```
index.html          ← Main page
styles.css          ← Dark futuristic theme
app.js              ← Client-side rendering, search, filters
data/projects.json  ← Slimmed project data (synced from vault)
sync-projects.js    ← Local sync script
.github/workflows/  ← GitHub Pages deployment
```

## Syncing Updates

Every time you add or update a project in storage-packed:

1. Run `node sync-projects.js` in the portfolio-hub directory
2. Git commit and push
3. GitHub Actions deploys the update

The sync script strips heavy fields (full file manifests, search indexes, hashes) and keeps only what the portfolio needs — reducing the data by ~90%+.
