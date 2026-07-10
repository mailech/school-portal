'use strict';
// Committed barrel over the Prisma-generated client + helpers.
// Consumers import from '@app/db' and never from '@prisma/client' directly.
const generated = require('./generated/client');
const { createPrismaClient } = require('./factory');

module.exports = Object.assign({}, generated, { createPrismaClient });
