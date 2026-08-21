#!/usr/bin/env node
/**
 * sync-projects.js
 *
 * Reads projects.json from storage-packed, strips heavy fields, detects GitHub
 * repos, and captures screenshots of web-based projects using system Chrome.
 *
 * Usage:
 *   node sync-projects.js                          (sync data only)
 *   node sync-projects.js --screenshots             (sync + capture screenshots)
 *   node sync-projects.js ../storage-packed         (explicit path)
 *   node sync-projects.js ../storage-packed --screenshots
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const http = require('http');

// ---------------------------------------------------------------------------
// Parse arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const captureScreenshots = args.includes('--screenshots');
const explicitPath = args.find((a) => !a.startsWith('-'));

let sourceDir;
if (explicitPath) {
  sourceDir = path.resolve(explicitPath);
} else {
  sourceDir = path.resolve(__dirname, '..', 'storage-packed');
}

const sourceFile = path.join(sourceDir, 'data', 'projects.json');
const projectsDir = path.join(sourceDir, 'data', 'projects');
const outFile = path.join(__dirname, 'data', 'projects.json');
const screenshotsDir = path.join(__dirname, 'data', 'screenshots');

if (!fs.existsSync(sourceFile)) {
  console.error(`❌  Source file not found: ${sourceFile}`);
  console.error('   node sync-projects.js /path/to/storage-packed [--screenshots]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Gradient fallbacks
// ---------------------------------------------------------------------------

const GRADIENT_PALETTES = [
  ['#ff6b35', '#ff9f1c'],
  ['#9b5de5', '#c084fc'],
  ['#00bbf9', '#38bdf8'],
  ['#00e5a0', '#34d399'],
  ['#ff006e', '#f43f5e'],
  ['#e05520', '#f97316'],
  ['#06b6d4', '#22d3ee'],
  ['#ffc857', '#fbbf24'],
];

const PROJECT_EMOJIS = {
  'web': '🌐', 'api': '⚡', 'server': '🖥️', 'app': '📱',
  'game': '🎮', 'bot': '🤖', 'chat': '💬', 'mail': '📧',
  'security': '🔒', 'camera': '📷', 'music': '🎵', 'video': '🎬',
  'photo': '📸', 'weather': '🌤️', 'timer': '⏱️', 'quiz': '❓',
  'todo': '✅', 'note': '📝', 'search': '🔍', 'share': '🔗',
  'qr': '📱', 'countdown': '🕐', 'calendar': '📅', 'recipe': '🍳',
  'shop': '🛒', 'blog': '✍️', 'portfolio': '💼', 'manga': '📚',
  'phone': '📱', 'organizer': '📂', 'dashboard': '📊', 'finance': '💰',
  'health': '❤️', 'fitness': '💪', 'travel': '✈️', 'movie': '🎬',
  'book': '📚', 'news': '📰', 'ai': '🧠', 'data': '📈', 'test': '🧪',
};

function getProjectEmoji(name, fileTypes) {
  const lower = (name || '').toLowerCase();
  for (const [kw, em] of Object.entries(PROJECT_EMOJIS)) {
    if (lower.includes(kw)) return em;
  }
  if (fileTypes && fileTypes.some((f) => ['html', 'css', 'js'].includes((f.name || '').toLowerCase()))) return '🌐';
  if (fileTypes && fileTypes.some((f) => ['py'].includes((f.name || '').toLowerCase()))) return '🐍';
  return '📁';
}

function getGradientPalette(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return GRADIENT_PALETTES[Math.abs(hash) % GRADIENT_PALETTES.length];
}

// ---------------------------------------------------------------------------
// Find system Chrome
// ---------------------------------------------------------------------------

function findChrome() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  console.log(`📖  Reading ${sourceFile}`);
  const raw = fs.readFileSync(sourceFile, 'utf8');
  const db = JSON.parse(raw);

  if (!Array.isArray(db.projects)) {
    console.error('❌  projects.json does not contain a projects array.');
    process.exit(1);
  }

  if (captureScreenshots) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  let browser = null;
  if (captureScreenshots) {
    const chromePath = findChrome();
    if (!chromePath) {
      console.error('⚠️  Chrome not found. Screenshot capture skipped.');
    } else {
      console.log(`📸  Using Chrome: ${chromePath}`);
      try {
        const puppeteer = require('puppeteer-core');
        browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,800',
          ],
        });
        console.log('📸  Browser launched');
      } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
          console.error('⚠️  puppeteer-core not installed. Run: npm install puppeteer-core');
          console.error('   Using gradient fallbacks for all projects.');
        } else {
          console.error(`⚠️  Could not launch Chrome: ${err.message}`);
        }
      }
    }
  }

  const slimProjects = [];
  let screenshotCount = 0;
  let gradientCount = 0;

  for (const p of db.projects) {
    const completionStatus = normalizeCompletion(p.completionStatus);
    const githubUrl = await detectGitHubUrl(p);

    // Check repo visibility (public/private)
    let repoVisibility = '';
    if (githubUrl) {
      repoVisibility = await checkRepoVisibility(githubUrl);
    }

    // Detect if project was updated after creation
    const isUpdated = detectUpdate(p);

    // Check for existing screenshot first — never overwrite a real .jpg with a gradient SVG
    let screenshotFile = '';
    const existingJpg = path.join(screenshotsDir, `${p.id}.jpg`);
    const existingSvg = path.join(screenshotsDir, `${p.id}.svg`);
    if (fs.existsSync(existingJpg)) {
      screenshotFile = `data/screenshots/${p.id}.jpg`;
    } else if (captureScreenshots && browser) {
      const webEntry = findWebEntry(p.id);
      if (webEntry) {
        screenshotFile = await captureScreenshot(browser, p.id, webEntry);
        if (screenshotFile) screenshotCount++;
      }
    }

    // Only generate a gradient fallback if no real screenshot exists
    if (!screenshotFile) {
      if (fs.existsSync(existingSvg)) {
        screenshotFile = `data/screenshots/${p.id}.svg`;
      } else if (captureScreenshots) {
        screenshotFile = generateGradientCard(p.id, p.name, p.topFileTypes);
        gradientCount++;
      }
    }

    slimProjects.push({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      status: p.status,
      completionStatus,
      completionReason: p.completionReason || '',
      summary: p.summary || '',
      acceptedAt: p.acceptedAt || null,
      fileCount: p.fileCount || 0,
      totalBytes: p.totalBytes || 0,
      totalSizeLabel: p.totalSizeLabel || '0 B',
      topLanguages: (p.topLanguages || []).slice(0, 8),
      topFileTypes: (p.topFileTypes || []).slice(0, 12),
      githubUrl: githubUrl || '',
      repoVisibility,
      isUpdated,
      thumbnail: screenshotFile || '',
    });
  }

  slimProjects.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const outDb = { projects: slimProjects };
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(outDb, null, 2));

  if (browser) await browser.close();

  const originalKB = Math.round(Buffer.byteLength(raw) / 1024);
  const slimKB = Math.round(Buffer.byteLength(JSON.stringify(outDb)) / 1024);
  const withRepo = slimProjects.filter((p) => p.githubUrl).length;
  const withThumb = slimProjects.filter((p) => p.thumbnail).length;

  console.log(`✅  Wrote ${slimProjects.length} projects to ${outFile}`);
  console.log(`    ${originalKB} KB → ${slimKB} KB  (${Math.round((1 - slimKB / originalKB) * 100)}% smaller)`);
  console.log(`    ${withRepo} project(s) with GitHub repos detected`);
  if (captureScreenshots) {
    console.log(`    ${screenshotCount} screenshot(s) captured, ${gradientCount} gradient fallback(s)`);
  }
  console.log(`    ${withThumb} project(s) with thumbnails`);
})();

// ---------------------------------------------------------------------------
// Web entry detection
// ---------------------------------------------------------------------------

function findWebEntry(projectId) {
  const projectRoot = path.join(projectsDir, projectId, 'files');
  if (!fs.existsSync(projectRoot)) return null;

  const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
  let projectDir = projectRoot;
  if (entries.length === 1 && entries[0].isDirectory()) {
    projectDir = path.join(projectRoot, entries[0].name);
  }

  // --- Pass 1: standard candidates in the project root ---
  const candidates = [
    'public/index.html',
    'index.html',
    'public/index.htm',
    'dist/index.html',
    'build/index.html',
    'src/index.html',
    'static/index.html',
  ];

  for (const c of candidates) {
    const full = path.join(projectDir, c);
    if (fs.existsSync(full)) {
      return { dir: projectDir, entry: full, prefix: path.dirname(c) };
    }
  }

  // --- Pass 2: Vite/React projects — try building ---
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts?.build) {
        return { dir: projectDir, entry: null, needsBuild: true };
      }
    } catch {}
  }

  // --- Pass 3: search recursively for HTML files ---
  // Find ALL html files, then pick the best one
  const allHtml = [];
  findAnyHtml(projectDir, allHtml, 0, 4);
  if (allHtml.length > 0) {
    // Score each candidate based on how likely it is the main app entry
    const scored = allHtml.map((p) => {
      const rel = path.relative(projectDir, p).toLowerCase();
      let s = 0;
      // Prefer index.html in app-like directories
      if (/^dist[/\\]index/i.test(rel)) s += 20;
      if (/^build[/\\]index/i.test(rel)) s += 18;
      if (/^public[/\\]index/i.test(rel)) s += 16;
      if (/^client[/\\].*index/i.test(rel)) s += 15;
      if (/^src[/\\]index/i.test(rel)) s += 14;
      if (/^templates[/\\]index/i.test(rel)) s += 13;
      if (/index\.html$/i.test(rel)) s += 10;
      // Penalize extension and non-app files
      if (/extension|plugin|addon/i.test(rel)) s -= 20;
      if (/popup\.html$/i.test(rel)) s -= 15;
      if (/options\.html$/i.test(rel)) s -= 15;
      if (/test|spec|demo/i.test(rel)) s -= 10;
      // Bonus: dir has package.json (likely a runnable app)
      const dirOf = path.dirname(p);
      if (fs.existsSync(path.join(dirOf, 'package.json'))) s += 5;
      if (fs.existsSync(path.join(dirOf, 'app.py'))) s += 5;
      if (fs.existsSync(path.join(dirOf, 'server.js'))) s += 5;
      return { file: p, score: s };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const htmlDir = path.dirname(best.file);
    // Walk up from the HTML dir to find the nearest package.json with dev/start or app.py
    const serverRoot = findServerRoot(htmlDir, projectDir);
    const prefix = path.relative(serverRoot, htmlDir);
    return {
      dir: serverRoot,
      entry: best.file,
      prefix: prefix === '.' ? '' : prefix.replace(/\\/g, '/'),
    };
  }

  return null;
}

// Walk up from a directory to find the nearest dir with a server (package.json dev/start, app.py, server.js)
function findServerRoot(fromDir, stopAt) {
  let dir = fromDir;
  while (dir && dir !== stopAt && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        if (pkg.scripts?.dev || pkg.scripts?.start) return dir;
      } catch {}
    }
    if (fs.existsSync(path.join(dir, 'app.py')) || fs.existsSync(path.join(dir, 'server.py'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // Fallback: use the HTML dir itself
  return fromDir;
}

function findIndexHtml(dir, results, depth, maxDepth) {
  if (depth > maxDepth) return;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isFile() && /^index\.html?$/i.test(e.name)) {
        results.push(full);
      } else if (e.isDirectory() && !['node_modules', '.git', 'vendor', '.venv'].includes(e.name)) {
        findIndexHtml(full, results, depth + 1, maxDepth);
      }
    }
  } catch {}
}

function findAnyHtml(dir, results, depth, maxDepth) {
  if (depth > maxDepth) return;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isFile() && /\.html?$/i.test(e.name)) {
        results.push(full);
      } else if (e.isDirectory() && !['node_modules', '.git', 'vendor', '.venv'].includes(e.name)) {
        findAnyHtml(full, results, depth + 1, maxDepth);
      }
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Screenshot capture
// ---------------------------------------------------------------------------

async function captureScreenshot(browser, projectId, webEntry) {
  const outPath = path.join(screenshotsDir, `${projectId}.jpg`);
  if (fs.existsSync(outPath)) return `data/screenshots/${projectId}.jpg`;

  if (!webEntry.entry) return '';
  const { execSync } = require('child_process');

  // ---- Step 1: Determine what kind of project this is ----
  // Walk up from the HTML dir to find the nearest package.json
  const serverRoot = findServerRoot(path.dirname(webEntry.entry), webEntry.dir);
  const hasPackageJson = fs.existsSync(path.join(serverRoot, 'package.json'));
  const hasAppPy = fs.existsSync(path.join(serverRoot, 'app.py'));
  const hasNodeModules = fs.existsSync(path.join(serverRoot, 'node_modules'));
  const isAlreadyBuilt = /[/\\](dist|build)[/\\]/.test(webEntry.entry);

  let serveDir = null;
  let serverProcess = null;
  let port;

  // ---- Step 2: If already in dist/build, just serve statically ----
  if (isAlreadyBuilt) {
    serveDir = path.dirname(webEntry.entry);
  }

  // ---- Step 3: If Vite/React with node_modules, build then serve dist/ ----
  if (!serveDir && hasPackageJson && hasNodeModules && !isAlreadyBuilt) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(serverRoot, 'package.json'), 'utf8'));
      if (pkg.scripts?.build) {
        console.log(`   🔨  Building ${projectId}...`);
        // Install deps if needed in nested dirs
        const nmDir = path.join(serverRoot, 'node_modules');
        try {
          execSync('npm run build', { cwd: serverRoot, timeout: 120000, stdio: 'pipe' });
        } catch (e) {
          console.log(`   ⚠️  Build failed: ${e.message?.slice(0, 60)}`);
        }
        // Look for dist/index.html or build/index.html
        for (const dp of ['dist/index.html', 'build/index.html']) {
          if (fs.existsSync(path.join(serverRoot, dp))) {
            serveDir = path.join(serverRoot, path.dirname(dp));
            break;
          }
        }
      }
    } catch {}
  }

  // ---- Step 4: If has package.json with dev/start but no node_modules, skip server ----
  // (Can't run without deps — fall through to static serving of the HTML dir)

  // ---- Step 5: Try running Express/Flask server ----
  if (!serveDir && (hasAppPy || (hasPackageJson && hasNodeModules))) {
    const needsServer = await detectNeedsServer({ dir: serverRoot, entry: webEntry.entry });
    if (needsServer) {
      const result = await startProjectServer({ dir: serverRoot, entry: webEntry.entry }, needsServer);
      if (result) {
        serverProcess = result.proc;
        port = result.port;
      }
    }
  }

  // ---- Step 6: Fallback — static serve the HTML directory ----
  if (!port) {
    if (!serveDir) {
      serveDir = path.dirname(webEntry.entry);
    }
    const staticServer = await startSafeServer(serveDir);
    port = staticServer.address().port;
    // Store for cleanup
    if (!serverProcess) serverProcess = null;
    webEntry._staticServer = staticServer;
  }

  // ---- Step 7: Screenshot ----
  // Build the URL: if serving statically, point to the specific HTML file
  let screenshotUrl = `http://127.0.0.1:${port}`;
  if (!serverProcess && serveDir) {
    // Static serving — navigate to the specific HTML file relative to serveDir
    const htmlRel = path.relative(serveDir, webEntry.entry).replace(/\\/g, '/');
    if (htmlRel && !htmlRel.startsWith('..')) {
      screenshotUrl = `http://127.0.0.1:${port}/${htmlRel}`;
    }
  }

  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(screenshotUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 80 });
    console.log(`   📸  Captured: ${projectId}`);
    return `data/screenshots/${projectId}.jpg`;
  } catch (err) {
    console.log(`   ⚠️  Screenshot failed: ${projectId} — ${err.message.slice(0, 60)}`);
    return '';
  } finally {
    await page.close().catch(() => {});
    if (webEntry._staticServer) webEntry._staticServer.close();
    if (serverProcess) {
      try { serverProcess.kill('SIGTERM'); } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ---------------------------------------------------------------------------
// Project server detection & startup
// ---------------------------------------------------------------------------

async function detectNeedsServer(webEntry) {
  // Check dir and parent directories for server files
  const checkDirs = [webEntry.dir];
  // Also check 1-2 levels up (e.g. if HTML is in templates/ or client/dist/)
  let up = webEntry.dir;
  for (let i = 0; i < 3; i++) {
    up = path.dirname(up);
    if (up && up !== path.dirname(up)) checkDirs.push(up);
  }

  for (const dir of checkDirs) {
    // Python Flask/FastAPI apps
    const pyFiles = ['app.py', 'server.py', 'main.py'];
    for (const f of pyFiles) {
      if (fs.existsSync(path.join(dir, f))) {
        const content = fs.readFileSync(path.join(dir, f), 'utf8');
        if (/flask|Flask|from flask/i.test(content) || /uvicorn|fastapi|FastAPI/i.test(content)) {
          return { type: 'python', file: f, cwd: dir };
        }
      }
    }

    // Node.js projects with package.json
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const scripts = pkg.scripts || {};
        // Skip HTTPS servers (self-signed certs cause browser warnings and hangs)
        const serverFile = path.join(dir, 'server.js');
        if (fs.existsSync(serverFile)) {
          const serverCode = fs.readFileSync(serverFile, 'utf8');
          if (/https|selfsigned|certificate|createServer.*https/i.test(serverCode)) {
            return null; // Skip — use static serving instead
          }
        }
        // Prefer dev server (Vite, etc.) over start
        if (scripts.dev) return { type: 'node', cmd: 'npm run dev', cwd: dir };
        if (scripts.start) return { type: 'node', cmd: 'npm start', cwd: dir };
      } catch {}
    }
  }

  return null;
}

async function startProjectServer(webEntry, serverInfo) {
  const { spawn } = require('child_process');
  const net = require('net');
  const dir = webEntry.dir;

  // Find an available port
  const port = await findFreePort();

  let proc;
  const env = { ...process.env, PORT: String(port), FORCE_COLOR: '0' };

  const cwd = serverInfo.cwd || dir;
  if (serverInfo.type === 'python') {
    // Install Flask/dependencies if requirements.txt exists and no venv
    const reqFile = path.join(cwd, 'requirements.txt');
    if (fs.existsSync(reqFile) && !fs.existsSync(path.join(cwd, '.venv'))) {
      try {
        console.log(`   📦  Installing Python deps for ${path.basename(cwd)}...`);
        const { execSync } = require('child_process');
        execSync('pip install -r requirements.txt -q', { cwd, timeout: 60000, stdio: 'pipe' });
      } catch {}
    }
    // Set PORT env for Flask
    env.PORT = String(port);
    env.FLASK_RUN_PORT = String(port);
    proc = spawn('python', [serverInfo.file], {
      cwd, env, stdio: 'pipe', shell: true,
    });
  } else if (serverInfo.type === 'node') {
    const cmd = serverInfo.cmd;
    const isNpm = cmd.startsWith('npm');
    // For Vite, pass --port flag so it uses our port
    const isVite = /vite/i.test(cmd);
    const args = isNpm ? ['run', ...cmd.replace('npm run ', '').split(' ')] : cmd.split(' ');
    if (isVite) args.push('--port', String(port));
    proc = spawn(isNpm ? 'npm' : 'node', args, {
      cwd, env, stdio: 'pipe', shell: true,
    });
  } else {
    return null;
  }

  // Wait for the server to be ready (up to 12s)
  const ready = await waitForPort(port, 12000);
  if (!ready) {
    try { proc.kill('SIGTERM'); } catch {}
    return null;
  }

  return { proc, port };
}

function findFreePort() {
  return new Promise((resolve) => {
    const srv = require('net').createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    function tryConnect() {
      if (Date.now() > deadline) return resolve(false);
      const sock = require('net').createConnection({ port, host: '127.0.0.1' });
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('error', () => { sock.destroy(); setTimeout(tryConnect, 500); });
    }
    tryConnect();
  });
}

// Safe HTTP server — filters out node_modules and .git, auto-closes after 30s
function startSafeServer(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let url;
      try { url = decodeURIComponent(req.url.split('?')[0]); } catch { url = req.url.split('?')[0]; }
      // Block node_modules and .git
      if (url.includes('node_modules') || url.includes('.git')) {
        res.writeHead(403); res.end(); return;
      }
      let filePath = path.join(dir, url);
      if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');
      // Prevent path traversal
      if (!filePath.startsWith(dir)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
      // If it's a directory, serve index.html
      if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
      }
      const ext = path.extname(filePath).toLowerCase();
      const mimes = {
        '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
        '.woff2': 'font/woff2', '.ttf': 'font/ttf',
      };
      res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
    // Auto-close safety net
    setTimeout(() => { try { server.close(); } catch {} }, 30000);
  });
}

// ---------------------------------------------------------------------------
// Gradient card generation
// ---------------------------------------------------------------------------

function generateGradientCard(projectId, name, fileTypes) {
  const palette = getGradientPalette(projectId);
  const emoji = getProjectEmoji(name, fileTypes);
  const initials = name.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette[0]}"/>
      <stop offset="100%" stop-color="${palette[1]}"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3"/>
      <feColorMatrix type="saturate" values="0"/>
      <feBlend in="SourceGraphic" mode="multiply" result="blend"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.08"/></feComponentTransfer>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <rect width="640" height="400" filter="url(#grain)" opacity="0.3"/>
  <circle cx="520" cy="80" r="120" fill="white" opacity="0.06"/>
  <circle cx="100" cy="340" r="80" fill="white" opacity="0.05"/>
  <text x="320" y="180" text-anchor="middle" font-size="64" fill="white" opacity="0.9">${emoji}</text>
  <text x="320" y="240" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="white" opacity="0.95">${escSvg(name.length > 30 ? name.slice(0, 28) + '…' : name)}</text>
  <text x="320" y="275" text-anchor="middle" font-family="monospace" font-size="16" fill="white" opacity="0.5">${escSvg(initials)}</text>
</svg>`;

  const outPath = path.join(screenshotsDir, `${projectId}.svg`);
  fs.writeFileSync(outPath, svg);
  return `data/screenshots/${projectId}.svg`;
}

function escSvg(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// GitHub detection
// ---------------------------------------------------------------------------

async function detectGitHubUrl(project) {
  const projectRoot = path.join(projectsDir, project.id, 'files');
  if (!fs.existsSync(projectRoot)) return '';

  const gitConfigPath = findFile(projectRoot, /^\.git[/\\]config$/i);
  if (gitConfigPath) {
    const url = await extractGitConfigUrl(gitConfigPath);
    if (url) return url;
  }

  const pkgPath = findFile(projectRoot, /^package\.json$/i, /node_modules/);
  if (pkgPath) {
    const url = await extractPackageJsonUrl(pkgPath);
    if (url) return url;
  }

  const mdFiles = findFiles(projectRoot, /\.(md|txt)$/i, /node_modules/).slice(0, 8);
  for (const mdFile of mdFiles) {
    const url = await extractGitHubUrlFromText(mdFile);
    if (url) return url;
  }

  return '';
}

function findFile(root, pattern, exclude) {
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isFile() && pattern.test(entry.name) && (!exclude || !exclude.test(full))) return full;
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        const found = findFile(full, pattern, exclude);
        if (found) return found;
      }
    }
    const gitDir = path.join(root, '.git');
    if (fs.existsSync(gitDir) && pattern.test('.git/config')) {
      const configPath = path.join(gitDir, 'config');
      if (fs.existsSync(configPath)) return configPath;
    }
  } catch {}
  return '';
}

function findFiles(root, pattern, exclude) {
  const results = [];
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isFile() && pattern.test(entry.name) && (!exclude || !exclude.test(full))) results.push(full);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        results.push(...findFiles(full, pattern, exclude));
      }
    }
  } catch {}
  return results;
}

async function extractGitConfigUrl(filePath) {
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    const originBlock = text.match(/\[remote\s+"origin"\]([\s\S]*?)(?:\n\[|$)/i);
    const block = originBlock ? originBlock[1] : text;
    const urlMatch = block.match(/url\s*=\s*(.+)/i);
    if (urlMatch) return parseGitHubUrl(urlMatch[1].trim());
  } catch {}
  return '';
}

async function extractPackageJsonUrl(filePath) {
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    const pkg = JSON.parse(text);
    const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    if (repo) return parseGitHubUrl(repo);
  } catch {}
  return '';
}

async function extractGitHubUrlFromText(filePath) {
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    const match = text.match(/https?:\/\/github\.com\/[^/\\s)]+\/[^/\\s).#]+(?:\.git)?/i);
    if (match) return parseGitHubUrl(match[0]);
  } catch {}
  return '';
}

function parseGitHubUrl(raw) {
  if (!raw) return '';
  const cleaned = raw.replace(/^git\+/, '').replace(/^url\s*=\s*/i, '').trim();
  const https = cleaned.match(/^https?:\/\/(?:[^/@\\s]+@)?github\.com[:/]([^/\\s]+)\/([^/\\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (https) return `https://github.com/${https[1]}/${https[2]}`;
  const ssh = cleaned.match(/^git@github\.com:([^/\\s]+)\/([^/\\s#?]+?)(?:\.git)?$/i);
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`;
  const short = cleaned.match(/^([^/\\s]+)\/([^/\\s#?]+?)(?:\.git)?$/i);
  if (short && !cleaned.includes(' ')) return `https://github.com/${short[1]}/${short[2]}`;
  return '';
}

// ---------------------------------------------------------------------------
// Repo visibility check (public/private)
// ---------------------------------------------------------------------------

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const repoCache = new Map();

async function checkRepoVisibility(githubUrl) {
  // Extract owner/repo from URL
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (!match) return '';
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  const key = `${owner}/${repo}`;
  if (repoCache.has(key)) return repoCache.get(key);

  try {
    const headers = { 'User-Agent': 'wippyio-sync' };
    if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) { repoCache.set(key, ''); return ''; }
    const data = await res.json();
    const vis = data.private ? 'private' : 'public';
    repoCache.set(key, vis);
    return vis;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Update detection
// ---------------------------------------------------------------------------

function detectUpdate(project) {
  if (!project.createdAt || !project.updatedAt) return false;
  const created = new Date(project.createdAt).getTime();
  const updated = new Date(project.updatedAt).getTime();
  // Consider updated if changed by more than 1 hour
  return updated - created > 3600000;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeCompletion(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['completed', 'complete', 'done', 'finished', 'yes', 'true', '1'].includes(v)) return 'completed';
  return 'not-completed';
}
