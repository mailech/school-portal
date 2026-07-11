// Production launcher for a single-host (e.g. Render free tier) deployment.
//
// The API is an HTTP server; the worker is a headless process that runs the
// daily sweep, sends queued email, and detects inbound replies. On a single
// free web service we run BOTH in one place: the API listens on $PORT (so the
// host's health checks pass and a keep-alive ping keeps the whole thing warm),
// while the worker runs alongside it so automation keeps firing.
//
// Each app is spawned as its own Node process (matching how they run in dev),
// sharing the same environment. If either child exits, we tear the other down
// so the platform restarts a clean, complete instance.

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  { name: 'api', cwd: resolve(root, 'apps/api'), entry: 'dist/main.js' },
  { name: 'worker', cwd: resolve(root, 'apps/worker'), entry: 'dist/main.js' },
];

const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
  }
  // Give children a moment to close gracefully, then exit.
  setTimeout(() => process.exit(code), 3000).unref();
}

for (const target of targets) {
  const child = spawn(process.execPath, [target.entry], {
    cwd: target.cwd,
    stdio: 'inherit',
    env: process.env,
  });
  children.push(child);

  child.on('exit', (code, signal) => {
    console.error(
      `[start-prod] "${target.name}" exited (code=${code}, signal=${signal}); shutting down siblings.`,
    );
    shutdown(code ?? 1);
  });

  child.on('error', (err) => {
    console.error(`[start-prod] "${target.name}" failed to start:`, err);
    shutdown(1);
  });
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
