'use strict';
const { PrismaClient } = require('./generated/client');

let singleton = null;

/**
 * Returns a process-wide singleton PrismaClient. Used by scripts, the seed,
 * and the worker. The API uses a Nest PrismaService that extends PrismaClient.
 * @param {{ logQueries?: boolean }} [options]
 */
function createPrismaClient(options) {
  const opts = options || {};
  if (singleton) return singleton;
  singleton = new PrismaClient({
    log: opts.logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
  return singleton;
}

module.exports = { createPrismaClient };
