import { PrismaClient } from './generated/client';

export type AppPrismaClient = PrismaClient;

export declare function createPrismaClient(options?: { logQueries?: boolean }): PrismaClient;
