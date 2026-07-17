#!/usr/bin/env node
/**
 * Ellis Web Bell — script.js builder
 *
 * script.js is a GENERATED file: the concatenation, in MANIFEST order, of the
 * files in src/js/. Those files are the source of truth.
 *
 *   node build-js.mjs           build ../script.js from ../src/js/
 *   node build-js.mjs --check   verify ../script.js matches the build output
 *                               (catches direct edits to script.js that would
 *                               be clobbered by the next build)
 *
 * The build is a pure concatenation — no transformation — so the output is
 * always exactly reviewable against the sources. After building, the result
 * is syntax-checked as an ES module before it replaces script.js; a chunk
 * with a syntax error aborts the build and leaves the old script.js intact.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const srcDir = join(root, 'src', 'js');
const outFile = join(root, 'script.js');

// Concatenation order. New chunks: add the file to src/js/ AND list it here.
const MANIFEST = [
  '00-header.js',
  '01-firebase-imports.js',
  '02-dom-elements.js',
  '03-memory-management.js',
  '04-app-state-and-bells.js',
  '05-preferences-cloud-sync.js',
  '06-warning-effects.js',
  '07-kiosk-mode.js',
  '08-theme-and-display.js',
  '09-picture-in-picture.js',
  '10-clock-engine.js',
  '11-quick-bell-broadcast.js',
  '12-quick-bell-queue.js',
  '13-schedule-resolution-and-ringing.js',
  '14-render-schedule-list.js',
  '15-firebase-init.js',
  '16-schedule-management.js',
  '17-share-codes.js',
  '18-bell-crud-and-modals.js',
  '19-visual-cues-and-files.js',
  '20-schedule-calendar.js',
  '21-emergency-shift.js',
  '22-audit-log.js',
  '23-clock-drift.js',
  '24-notifications.js',
  '25-status-view.js',
  '99-init-and-listeners.js',
];

for (const name of MANIFEST) {
  if (!existsSync(join(srcDir, name))) {
    console.error(`MISSING CHUNK: src/js/${name} — is the manifest out of date?`);
    process.exit(1);
  }
}

const built = MANIFEST.map((name) => readFileSync(join(srcDir, name), 'utf8')).join('');

// Syntax-check the assembled module before touching script.js
try {
  execFileSync('node', ['--input-type=module', '--check'], { input: built });
} catch (err) {
  console.error('BUILD ABORTED: assembled script.js does not parse. script.js left unchanged.');
  console.error(String(err.stderr || err.message).split('\n').slice(-6).join('\n'));
  process.exit(1);
}

if (process.argv.includes('--check')) {
  const current = readFileSync(outFile, 'utf8');
  if (current === built) {
    console.log('OK: script.js matches the src/js/ build.');
  } else {
    console.error('DRIFT DETECTED: script.js differs from the src/js/ build.');
    console.error('Someone edited script.js directly, or forgot to commit src/js/ changes.');
    console.error('Port any direct edits into the matching src/js/ chunk, then rebuild.');
    process.exit(1);
  }
} else {
  writeFileSync(outFile, built);
  console.log(`Built script.js (${built.length.toLocaleString()} chars from ${MANIFEST.length} chunks).`);
}
