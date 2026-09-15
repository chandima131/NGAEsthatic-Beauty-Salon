import { pbkdf2Sync, randomBytes } from 'node:crypto';

const password = process.env.NEW_ADMIN_PASSWORD;
if (!password || password.length < 8 || password.length > 256) {
  console.error('Set NEW_ADMIN_PASSWORD to a password between 8 and 256 characters.');
  process.exit(1);
}

const iterations = 310_000;
const salt = randomBytes(16);
const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
console.log(['pbkdf2-sha256', iterations, salt.toString('base64url'), digest.toString('base64url')].join('$'));
