const { URL } = require('node:url');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req, maxBytes = 1024 * 1024) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > maxBytes) throw new Error('REQUEST_TOO_LARGE');
    return req.body ? JSON.parse(req.body) : {};
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function method(req, allowed) {
  if (!allowed.includes(req.method)) return false;
  return true;
}

function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function cleanText(value, max = 5000) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u0000/g, '').trim().slice(0, max);
}

function bool(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

function isEmail(value) {
  const v = cleanText(value, 200);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function query(req) {
  try {
    return Object.fromEntries(new URL(req.url, baseUrl(req)).searchParams.entries());
  } catch {
    return {};
  }
}

module.exports = { json, readBody, method, getIp, cleanText, bool, isEmail, baseUrl, query };
