export { Octomirror } from './octomirror.js';
/*
import * as fs from 'fs';
import { Octomirror } from './octomirror.js';

const PAT = process.env.PAT;
const GHES_URL = process.env.GHES_URL;
const APP_ID = Number(process.env.APP_ID);
const CLIENT_ID = process.env.CLIENT_ID;
const PRIVATE_KEY_FILE = process.env.PRIVATE_KEY_FILE;
const ENTERPRISE_SLUG = process.env.ENTERPRISE_SLUG;
const APP_SLUG = process.env.APP_SLUG;

if (!PAT || !GHES_URL || !APP_ID || !PRIVATE_KEY_FILE || !CLIENT_ID || !ENTERPRISE_SLUG || !APP_SLUG) {  
  throw new Error('Missing required environment variables');
}

const PRIVATE_KEY = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8');

const octomirror = new Octomirror(GHES_URL, PAT, ENTERPRISE_SLUG, APP_SLUG, APP_ID, CLIENT_ID, PRIVATE_KEY);
// Wait 5 seconds for the broker to be ready
setTimeout(() => {
  console.log('Octomirror should be ready');
  octomirror.installApp('Bearer testtoken', 'github-ssh-authority');
  octomirror.getInstallationToken('Bearer testtoken', 'github-ssh-authority').then(token => {
    console.log(token);
  })
}, 3000);
*/