// Side-effect module: MUST be imported before any module that reads config.
// Loads the repo-root .env (single source of truth), then a local .env if any.
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config();
