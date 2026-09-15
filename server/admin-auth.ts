export type AdminAuthEnvironment = {
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SESSION_SECRET?: string;
};

const sessionCookieName = 'ng_admin_session';
const sessionLifetimeSeconds = 12 * 60 * 60;
const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function configured(env: AdminAuthEnvironment) {
  return Boolean(env.ADMIN_PASSWORD_HASH && env.ADMIN_SESSION_SECRET && env.ADMIN_SESSION_SECRET.length >= 32);
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function verifyAdminPassword(password: string, encodedHash: string | undefined) {
  if (!encodedHash || !password || password.length > 256) return false;
  const [algorithm, iterationsValue, saltValue, digestValue, extra] = encodedHash.split('$');
  const iterations = Number(iterationsValue);
  const salt = base64UrlDecode(saltValue ?? '');
  const expected = base64UrlDecode(digestValue ?? '');
  if (algorithm !== 'pbkdf2-sha256' || extra !== undefined || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000 || !salt || salt.length < 16 || !expected || expected.length < 32) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, expected.length * 8));
  return constantTimeEqual(derived, expected);
}

function cookieValue(request: Request) {
  const cookies = request.headers.get('cookie') ?? '';
  for (const part of cookies.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === sessionCookieName) return value.join('=');
  }
  return '';
}

export async function verifyAdminSession(request: Request, env: AdminAuthEnvironment): Promise<'authenticated' | 'missing' | 'unconfigured'> {
  if (!configured(env)) return 'unconfigured';
  const token = cookieValue(request);
  const [version, expiresValue, signatureValue, extra] = token.split('.');
  const expires = Number(expiresValue);
  const now = Math.floor(Date.now() / 1000);
  if (version !== 'v1' || extra !== undefined || !Number.isInteger(expires) || expires <= now || expires > now + sessionLifetimeSeconds || !signatureValue) return 'missing';
  const actual = base64UrlDecode(signatureValue);
  if (!actual) return 'missing';
  const expected = await hmac(version + '.' + expiresValue, env.ADMIN_SESSION_SECRET!);
  return constantTimeEqual(actual, expected) ? 'authenticated' : 'missing';
}

export async function createAdminSessionCookie(request: Request, env: AdminAuthEnvironment) {
  if (!configured(env)) throw new Error('admin_not_configured');
  const expires = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
  const payload = 'v1.' + expires;
  const signature = base64UrlEncode(await hmac(payload, env.ADMIN_SESSION_SECRET!));
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return sessionCookieName + '=' + payload + '.' + signature + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + sessionLifetimeSeconds + secure;
}

export function clearAdminSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return sessionCookieName + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + secure;
}

export function isAdminAuthConfigured(env: AdminAuthEnvironment) {
  return configured(env);
}
