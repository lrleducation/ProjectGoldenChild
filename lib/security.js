const crypto = require('node:crypto');

const COOKIE = 'pgc_admin';

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map(x => x.trim()).filter(Boolean).map(pair => {
    const i = pair.indexOf('=');
    return [pair.slice(0, i), decodeURIComponent(pair.slice(i + 1))];
  }));
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.PGC_LOCAL_DEV === '1') return 'local-development-only-session-secret-change-me';
  throw new Error('SESSION_SECRET_MISSING');
}

function createSession(user) {
  const payload = base64url(JSON.stringify({
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + 8 * 60 * 60 * 1000
  }));
  return `${payload}.${sign(payload, sessionSecret())}`;
}

function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload, sessionSecret());
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (!data.exp || data.exp < Date.now()) return null;
  return data;
}

function setSessionCookie(res, token) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${8 * 60 * 60}${secure ? '; Secure' : ''}`);
}

function clearSessionCookie(res) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
}

function getSession(req) {
  const cookies = parseCookies(req);
  try { return verifySession(cookies[COOKIE]); } catch { return null; }
}

function requireAdmin(req, res) {
  const user = getSession(req);
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ message: 'Authentication required.' }));
    return null;
  }
  return user;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, encoded) {
  if (!encoded || !encoded.startsWith('scrypt$')) return false;
  const [, salt, expectedHex] = encoded.split('$');
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function decodeBase32(secret) {
  const clean = String(secret || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) bits += BASE32.indexOf(ch).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret, step = Math.floor(Date.now() / 30000)) {
  const key = decodeBase32(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
  return code;
}

function verifyTotp(secret, code) {
  const entered = String(code || '').replace(/\D/g, '');
  if (!secret) return false;
  for (let drift = -1; drift <= 1; drift += 1) {
    if (totp(secret, Math.floor(Date.now() / 30000) + drift) === entered) return true;
  }
  return false;
}

function adminUsers() {
  if (process.env.PGC_LOCAL_DEV === '1') {
    return [{
      email: 'admin@local.test',
      name: 'Local Admin',
      role: 'director',
      localPassword: 'GoldenChildLocal!2026',
      totpSecret: ''
    }];
  }
  let users = [];
  try { users = JSON.parse(process.env.ADMIN_USERS_JSON || '[]'); } catch { users = []; }
  return Array.isArray(users) ? users : [];
}

function authenticate(email, password, otp) {
  const user = adminUsers().find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
  if (!user) return null;
  const passwordOk = user.localPassword ? password === user.localPassword : verifyPassword(password, user.passwordHash);
  if (!passwordOk) return null;
  if (process.env.PGC_LOCAL_DEV !== '1') {
    if (!user.totpSecret || !verifyTotp(user.totpSecret, otp)) return null;
  }
  return { email: user.email, name: user.name || user.email, role: user.role || 'admin' };
}

function generateTotpSecret(length = 20) {
  const bytes = crypto.randomBytes(length);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += BASE32[parseInt(chunk, 2)];
  }
  return out;
}

module.exports = {
  createSession, setSessionCookie, clearSessionCookie, getSession, requireAdmin,
  hashPassword, verifyPassword, authenticate, generateTotpSecret, verifyTotp
};
