#!/usr/bin/env node
/**
 * sync-projects.js
 *
 * Reads projects.json from storage-packed, strips heavy fields (full file
 * manifests, search indexes, hashes), detects GitHub repo URLs from stored
 * project files, and writes a slim JSON file to data/projects.json.
 *
 * Usage:
 *   node sync-projects.js                          (auto-detects sibling repo)
 *   node sync-projects.js /path/to/storage-packed   (explicit path)
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

// ---------------------------------------------------------------------------
// Resolve the source projects.json
// ---------------------------------------------------------------------------

const explicitPath = process.argv[2];
let sourceDir;

if (explicitPath) {
  sourceDir = path.resolve(explicitPath);
} else {
  // Default: assume storage-packed is a sibling directory of portfolio-hub
  sourceDir = path.resolve(__dirname, '..', 'storage-packed');
}

const sourceFile = path.join(sourceDir, 'data', 'projects.json');
const projectsDir = path.join(sourceDir, 'data', 'projects');
const outFile = path.join(__dirname, 'data', 'projects.json');

if (!fs.existsSync(sourceFile)) {
  console.error(`❌  Source file not found: ${sourceFile}`);
  console.error('   Pass the path to storage-packed as the first argument:');
  console.error('   node sync-projects.js /path/to/storage-packed');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Read, detect GitHub, slim, write
// ---------------------------------------------------------------------------

(async () => {
  console.log(`📖  Reading ${sourceFile}`);
  const raw = fs.readFileSync(sourceFile, 'utf8');
  const db = JSON.parse(raw);

  if (!Array.isArray(db.projects)) {
    console.error('❌  projects.json does not contain a projects array.');
    process.exit(1);
  }

  const slimProjects = [];

  for (const p of db.projects) {
    const completionStatus = normalizeCompletion(p.completionStatus);
    const githubUrl = await detectGitHubUrl(p);

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
    });
  }

  // Sort newest first
  slimProjects.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const outDb = { projects: slimProjects };

  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(outDb, null, 2));

  const originalKB = Math.round(Buffer.byteLength(raw) / 1024);
  const slimKB = Math.round(Buffer.byteLength(JSON.stringify(outDb)) / 1024);
  const withRepo = slimProjects.filter((p) => p.githubUrl).length;

  console.log(`✅  Wrote ${slimProjects.length} projects to ${outFile}`);
  console.log(`    ${originalKB} KB → ${slimKB} KB  (${Math.round((1 - slimKB / originalKB) * 100)}% smaller)`);
  console.log(`    ${withRepo} project(s) with GitHub repos detected`);
})();

// ---------------------------------------------------------------------------
// GitHub detection — reads .git/config, package.json, README from disk
// ---------------------------------------------------------------------------

async function detectGitHubUrl(project) {
  const projectRoot = path.join(projectsDir, project.id, 'files');
  if (!fs.existsSync(projectRoot)) return '';

  // 1. Try .git/config
  const gitConfigPath = findFile(projectRoot, /^\.git[/\\]config$/i);
  if (gitConfigPath) {
    const url = await extractGitConfigUrl(gitConfigPath);
    if (url) return url;
  }

  // 2. Try package.json (skip node_modules)
  const pkgPath = findFile(projectRoot, /^package\.json$/i, /node_modules/);
  if (pkgPath) {
    const url = await extractPackageJsonUrl(pkgPath);
    if (url) return url;
  }

  // 3. Try README / LICENSE / markdown files
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
      if (entry.isFile() && pattern.test(entry.name) && (!exclude || !exclude.test(full))) {
        return full;
      }
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        const found = findFile(full, pattern, exclude);
        if (found) return found;
      }
    }
    // Also check .git subdirectory
    const gitDir = path.join(root, '.git');
    if (fs.existsSync(gitDir) && pattern.test('.git/config')) {
      const configPath = path.join(gitDir, 'config');
      if (fs.existsSync(configPath)) return configPath;
    }
  } catch {
    // Permission error or missing dir
  }
  return '';
}

function findFiles(root, pattern, exclude) {
  const results = [];
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isFile() && pattern.test(entry.name) && (!exclude || !exclude.test(full))) {
        results.push(full);
      }
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        results.push(...findFiles(full, pattern, exclude));
      }
    }
  } catch {
    // Skip
  }
  return results;
}

async function extractGitConfigUrl(filePath) {
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    // Look for [remote "origin"] block, then url = ...
    const originBlock = text.match(/\[remote\s+"origin"\]([\s\S]*?)(?:\n\[|$)/i);
    const block = originBlock ? originBlock[1] : text;
    const urlMatch = block.match(/url\s*=\s*(.+)/i);
    if (urlMatch) {
      return parseGitHubUrl(urlMatch[1].trim());
    }
  } catch {
    // Skip
  }
  return '';
}

async function extractPackageJsonUrl(filePath) {
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    const pkg = JSON.parse(text);
    const repo = typeof pkg.repository === 'string'
      ? pkg.repository
      : pkg.repository?.url;
    if (repo) return parseGitHubUrl(repo);
  } catch {
    // Skip
  }
  return '';
}

async function extractGitHubUrlFromText(filePath) {
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    const match = text.match(/https?:\/\/github\.com\/[^/\\s)]+\/[^/\\s).#]+(?:\.git)?/i);
    if (match) return parseGitHubUrl(match[0]);
  } catch {
    // Skip
  }
  return '';
}

function parseGitHubUrl(raw) {
  if (!raw) return '';
  const cleaned = raw.replace(/^git\+/, '').replace(/^url\s*=\s*/i, '').trim();

  // HTTPS
  const https = cleaned.match(/^https?:\/\/(?:[^/@\\s]+@)?github\.com[:/]([^/\\s]+)\/([^/\\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (https) return `https://github.com/${https[1]}/${https[2]}`;

  // SSH
  const ssh = cleaned.match(/^git@github\.com:([^/\\s]+)\/([^/\\s#?]+?)(?:\.git)?$/i);
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`;

  // Short form (owner/repo)
  const short = cleaned.match(/^([^/\\s]+)\/([^/\\s#?]+?)(?:\.git)?$/i);
  if (short && !cleaned.includes(' ')) return `https://github.com/${short[1]}/${short[2]}`;

  return '';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeCompletion(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['completed', 'complete', 'done', 'finished', 'yes', 'true', '1'].includes(v)) return 'completed';
  return 'not-completed';
}
