# wippyio

**[Visit wippy →](https://gamer-09.github.io/wippyio/)** — live on GitHub Pages.

**[Visit wippy →](https://wippyio.netlify.app)** — live on Netlify.

A personal project portfolio: every project from the [storage-packed](https://github.com/gamer-09/storage-packed) vault, rendered as a searchable, filterable bento-grid site with live screenshots, a 3D background, and a Supabase-backed build-request system.

## The public site

- **Bento grid** plus **list** and **timeline** views of every project, with completion badges, repo visibility, language tags, size, and "Updated" markers.
- **Search and filters** (all / completed / in-progress) and six sort modes.
- **Project popup** with a Markdown-rendered summary.
- **Likes and comments** per project, stored in Supabase.
- **3D background** (`bg3d.js`, three.js via CDN) that respects `prefers-reduced-motion`.
- Light/dark theme toggle, cursor trail, and scroll-reveal animations.
- Self-hosted fonts (Space Grotesk + JetBrains Mono) via `fonts/` + `fonts.css`.
- OG/Twitter meta tags pointing at `data/screenshots/og-image.png`.

## Build requests

The "Build request" form (`requests.js`) lets visitors ask for a project. It includes scope/AI
out-of-scope detection with a mandatory acknowledgement, a per-platform contact picker (handles come
from `WIPPY_CONFIG.contact` in `supabase-config.js`), and an optional private `.env` upload (100 KB
client cap) to the `request-env` Supabase Storage bucket — or a pasted key. Submissions land in the
Supabase `requests` table. If `supabaseUrl` / `supabaseAnonKey` are unset, the form is disabled.

## Admin panel

`admin.html` is a hidden (`noindex, nofollow`) dashboard with email/password login via **Supabase
Auth** (memory-only session). It shows request stats, search, per-request status updates and
deletion (including the stored `.env`), AI/key badges, signed-URL `.env` downloads, and
copy-to-clipboard for contact/pasted keys. A **Project engagement** panel shows likes and comments
per project (and can delete comments).

## How It Works

1. **Sync locally** — run `node sync-projects.js` to pull project data from your storage-packed vault
   and slim it down; add `--screenshots` to also capture screenshots (Puppeteer + system Chrome).
2. **Commit & push** — push the changes to GitHub (or run `./update.sh`, which syncs, stages
   `data/`, commits, and pushes).
3. **GitHub Pages** — `.github/workflows/deploy.yml` stages a curated `_site/` subset and deploys it
   to GitHub Pages at https://gamer-09.github.io/wippyio/.

## Quick Start

```bash
# Sync projects (data only)
node sync-projects.js

# Sync with screenshots
node sync-projects.js --screenshots

# Point to a specific path
node sync-projects.js /path/to/storage-packed --screenshots
```

Or via the npm scripts: `npm run sync`, `npm run sync:screenshots`, `npm run update` (the last one
syncs, screenshots, commits, and pushes).

## Setup

The site is fully static except for the Supabase-backed request form, likes, and comments. See
[SETUP.md](SETUP.md) for creating the Supabase project, the `requests` / `project_likes` /
`project_comments` tables, the private `request-env` Storage bucket, RLS policies, disabling
sign-ups, and an admin user — plus `supabase/security_hardening.sql` (row caps, forced
`status='new'`, comment-name cap, and per-IP rate limiting for requests and comments).

## Site Structure

```
index.html              ← Main page (bento grid layout)
styles.css              ← Bold colorful theme
app.js                  ← Rendering, search, filters, views, cursor trail, likes/comments
requests.js             ← Build-request form (Supabase)
bg3d.js                 ← Live 3D background (three.js via CDN)
admin.html              ← Hidden admin dashboard
admin.js                ← Admin dashboard logic (Supabase Auth)
admin-bg.js             ← Admin panel animated background
supabase-config.js      ← Supabase URL / anon key / contact handles
supabase/               ← SQL hardening (security_hardening.sql)
fonts.css + fonts/      ← Self-hosted Space Grotesk + JetBrains Mono
og-image.html           ← 1200×630 social-image template
capture-og.js           ← Renders og-image.html → data/screenshots/og-image.png
data/projects.json      ← Slimmed project data (synced from vault)
data/screenshots/       ← Project screenshots and gradient fallbacks
sync-projects.js        ← Local sync script (with Puppeteer screenshot capture)
update.sh               ← sync + commit + push helper
.github/workflows/      ← GitHub Pages deployment (deploys a curated _site subset)
```

## Syncing Updates

Every time you add or update a project in storage-packed:

1. Run `node sync-projects.js --screenshots` in the wippyio directory
2. Git commit and push
3. GitHub Actions deploys the update

The sync script strips heavy fields, sanitizes LLM chatter out of summaries, detects GitHub repos,
checks public/private visibility, and (with `--screenshots`) captures screenshots — reducing the
data size substantially.

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).
