import crypto from 'node:crypto';
import { sessionSecret, isProduction, getAdminUsers } from './config.mjs';

const b64u = input => Buffer.from(input).toString('base64url');
const unb64u = input => Buffer.from(input, 'base64url').toString('utf8');

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, user) {
  if (!user) return false;
  if (!isProduction && user.plainPassword) {
    const attempted = Buffer.from(String(password));
    const expected = Buffer.from(String(user.plainPassword));
    return attempted.length === expected.length && crypto.timingSafeEqual(attempted, expected);
  }
  if (!user.salt || !user.passwordHash) return false;
  const attempted = crypto.scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.passwordHash, 'hex');
  return attempted.length === stored.length && crypto.timingSafeEqual(attempted, stored);
}

export function signSession(payload, maxAgeSeconds = 60 * 60 * 8) {
  if (!sessionSecret) throw new Error('SESSION_SECRET is not configured');
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds }));
  const sig = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token) {
  if (!token || !sessionSecret) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(unb64u(body));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(value || '').toUpperCase().replace(/=+$/,'').replace(/\s+/g,'');
  let bits = '';
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) return Buffer.alloc(0);
    bits += idx.toString(2).padStart(5,'0');
  }
  const bytes = [];
  for (let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
  return Buffer.from(bytes);
}

function totpCode(secret, counter) {
  const key = decodeBase32(secret);
  if (!key.length) return '';
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset+1] & 0xff) << 16) | ((hmac[offset+2] & 0xff) << 8) | (hmac[offset+3] & 0xff);
  return String(code % 1_000_000).padStart(6,'0');
}

export function verifyTotp(secret, supplied) {
  if (!secret) return !isProduction;
  const value = String(supplied || '').replace(/\s/g,'');
  if (!/^\d{6}$/.test(value)) return false;
  const nowCounter = Math.floor(Date.now() / 1000 / 30);
  return [-1,0,1].some(delta => {
    const expected = totpCode(secret, nowCounter + delta);
    return expected.length === value.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(value));
  });
}

export function findAdmin(email) {
  const normalised = String(email || '').trim().toLowerCase();
  return getAdminUsers().find(u => String(u.email || '').toLowerCase() === normalised) || null;
}

export function randomId(prefix='id') {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function hashIp(ip) {
  const salt = sessionSecret || 'local';
  return crypto.createHash('sha256').update(`${salt}:${ip || 'unknown'}`).digest('hex').slice(0,32);
}
