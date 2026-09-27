import { verifySession } from './security.mjs';
import { isProduction } from './config.mjs';

export function json(res, status, body, extraHeaders={}) {
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  Object.entries(extraHeaders).forEach(([k,v])=>res.setHeader(k,v));
  res.end(JSON.stringify(body));
}

export function parseCookies(req) {
  const header = req.headers?.cookie || '';
  return Object.fromEntries(header.split(';').map(v=>v.trim()).filter(Boolean).map(v=>{
    const i=v.indexOf('='); return i<0 ? [v,''] : [v.slice(0,i),decodeURIComponent(v.slice(i+1))];
  }));
}

export function setSessionCookie(res, token) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `pgc_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`);
}

export function clearSessionCookie(res) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `pgc_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

export function requireAdmin(req, res, roles=[]) {
  const session = verifySession(parseCookies(req).pgc_admin);
  if (!session) { json(res,401,{ok:false,error:'Authentication required'}); return null; }
  if (roles.length && !roles.includes(session.role)) { json(res,403,{ok:false,error:'Insufficient permission'}); return null; }
  return session;
}

export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

export async function verifyTurnstile(token, ip, secret) {
  if (!secret) return true;
  const body = new URLSearchParams({ secret, response: String(token || '') });
  if (ip) body.set('remoteip',ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body});
    const data = await r.json();
    return Boolean(data.success);
  } catch { return false; }
}
