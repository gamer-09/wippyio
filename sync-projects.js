#!/usr/bin/env node
/**
 * sync-projects.js
 *
 * Reads projects.json from storage-packed, strips heavy fields (full file
 * manifests, search indexes, hashes), keeps only what the portfolio site
 * needs, and writes a slim JSON file to data/projects.json.
 *
 * Usage:
 *   node sync-projects.js                          (auto-detects sibling repo)
 *   node sync-projects.js /path/to/storage-packed   (explicit path)
 */

const fs = require('fs');
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
const outFile = path.join(__dirname, 'data', 'projects.json');

if (!fs.existsSync(sourceFile)) {
  console.error(`❌  Source file not found: ${sourceFile}`);
  console.error('   Pass the path to storage-packed as the first argument:');
  console.error('   node sync-projects.js /path/to/storage-packed');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Read, slim, write
// ---------------------------------------------------------------------------

console.log(`📖  Reading ${sourceFile}`);
const raw = fs.readFileSync(sourceFile, 'utf8');
const db = JSON.parse(raw);

if (!Array.isArray(db.projects)) {
  console.error('❌  projects.json does not contain a projects array.');
  process.exit(1);
}

const slimProjects = db.projects.map((p) => {
  const completionStatus = normalizeCompletion(p.completionStatus);
  return {
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
  };
});

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

console.log(`✅  Wrote ${slimProjects.length} projects to ${outFile}`);
console.log(`    ${originalKB} KB → ${slimKB} KB  (${Math.round((1 - slimKB / originalKB) * 100)}% smaller)`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeCompletion(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['completed', 'complete', 'done', 'finished', 'yes', 'true', '1'].includes(v)) return 'completed';
  return 'not-completed';
}
