export { Octomirror } from './octomirror.js';

import * as fs from 'fs';
import { Octomirror } from './octomirror.js';
import { exit } from 'process';
import logger from './logger.js';

const DOTCOM_PAT = process.env.DOTCOM_PAT;
const GHES_PAT = process.env.GHES_PAT;
const GHES_URL = process.env.GHES_URL;
const GHES_OWNER = process.env.GHES_OWNER;
const APP_ID = Number(process.env.APP_ID);
const CLIENT_ID = process.env.CLIENT_ID;
const PRIVATE_KEY_FILE = process.env.PRIVATE_KEY_FILE;
const ENTERPRISE_SLUG = process.env.ENTERPRISE_SLUG;
const APP_SLUG = process.env.APP_SLUG;

if (!DOTCOM_PAT || !GHES_PAT || !GHES_URL || !GHES_OWNER || !APP_ID || !PRIVATE_KEY_FILE || !CLIENT_ID || !ENTERPRISE_SLUG || !APP_SLUG) {  
  logger.error('Missing required environment variables');
  throw new Error('Missing required environment variables');
}

// Get the operating mode from the commdand line argument
const PRIVATE_KEY = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8');

const octomirror = new Octomirror(GHES_PAT, GHES_URL, GHES_OWNER, DOTCOM_PAT, ENTERPRISE_SLUG, APP_SLUG, APP_ID, CLIENT_ID, PRIVATE_KEY);
// Wait 5 seconds for the broker to be ready
const mode = process.argv[2];
setTimeout(() => {
  logger.info('Octomirror should be ready');
  if(mode === 'init') {
    logger.info('Starting Octomirror with init mode');
    octomirror.initMirror()
  } else if (mode === 'sync') {
    if( process.argv.length < 4) {
      logger.error('Missing required argument: date to sync from');
      exit(1);
    }
    // convert the sync from to a date
    const syncFrom = new Date(process.argv[3] + ' UTC');
    logger.info(`Starting Octomirror with sync mode from ${syncFrom}`);
    octomirror.syncMirror(syncFrom);
  } else if (mode === 'reset') {
    logger.info('Starting Octomirror with reset mode');
    octomirror.resetMirror()
  } else {
    logger.error('Invalid mode. Use "init" to seed the mirror or "sync" to update it');
    exit(1);
  }
}, 3000);