const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TABLES = new Set(['referrals','heroes','hero_actions','events','event_gallery','go_gold_registrations','contacts','audit_log']);
const localFile = path.join(process.cwd(), '.data', 'project-golden-child.json');

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
function isLocal() { return process.env.PGC_LOCAL_DEV === '1'; }
function checkTable(table) { if (!TABLES.has(table)) throw new Error('INVALID_TABLE'); }
function headers(extra={}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', ...extra };
}
function dbUrl(table, query='') {
  return `${process.env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${table}${query ? `?${query}` : ''}`;
}
function loadLocal() {
  fs.mkdirSync(path.dirname(localFile), { recursive: true });
  if (!fs.existsSync(localFile)) {
    const base = Object.fromEntries([...TABLES].map(t => [t, []]));
    fs.writeFileSync(localFile, JSON.stringify(base, null, 2));
    return base;
  }
  return JSON.parse(fs.readFileSync(localFile, 'utf8'));
}
function saveLocal(db) { fs.writeFileSync(localFile, JSON.stringify(db, null, 2)); }
function ensureAvailable() {
  if (!configured() && !isLocal()) throw new Error('DATABASE_NOT_CONFIGURED');
}

async function list(table, { filters={}, order='created_at.desc', limit=500 }={}) {
  checkTable(table); ensureAvailable();
  if (configured()) {
    const params = new URLSearchParams();
    params.set('select','*');
    for (const [k,v] of Object.entries(filters)) params.set(k, `eq.${v}`);
    if (order) params.set('order',order);
    if (limit) params.set('limit',String(limit));
    const r = await fetch(dbUrl(table, params.toString()), { headers: headers() });
    if (!r.ok) throw new Error(`DB_LIST_${table}_${r.status}_${await r.text()}`);
    return r.json();
  }
  let rows = loadLocal()[table] || [];
  rows = rows.filter(row => Object.entries(filters).every(([k,v]) => String(row[k]) === String(v)));
  if (order) {
    const [key,dir] = order.split('.');
    rows = [...rows].sort((a,b) => String(a[key]||'').localeCompare(String(b[key]||'')) * (dir==='asc'?1:-1));
  }
  return rows.slice(0,limit);
}

async function get(table, id) {
  const rows = await list(table, { filters:{id}, limit:1 });
  return rows[0] || null;
}

async function insert(table, row) {
  checkTable(table); ensureAvailable();
  const now = new Date().toISOString();
  const record = { id: row.id || crypto.randomUUID(), created_at: row.created_at || now, updated_at: row.updated_at || now, ...row };
  if (configured()) {
    const r = await fetch(dbUrl(table), { method:'POST', headers:headers({Prefer:'return=representation'}), body:JSON.stringify(record) });
    if (!r.ok) throw new Error(`DB_INSERT_${table}_${r.status}_${await r.text()}`);
    return (await r.json())[0];
  }
  const db = loadLocal(); db[table].push(record); saveLocal(db); return record;
}

async function update(table, id, patch) {
  checkTable(table); ensureAvailable();
  const record = { ...patch, updated_at:new Date().toISOString() };
  if (configured()) {
    const r = await fetch(dbUrl(table, `id=eq.${encodeURIComponent(id)}`), { method:'PATCH', headers:headers({Prefer:'return=representation'}), body:JSON.stringify(record) });
    if (!r.ok) throw new Error(`DB_UPDATE_${table}_${r.status}_${await r.text()}`);
    return (await r.json())[0] || null;
  }
  const db = loadLocal(); const i = db[table].findIndex(x => x.id === id); if (i < 0) return null;
  db[table][i] = { ...db[table][i], ...record }; saveLocal(db); return db[table][i];
}

async function remove(table, id) {
  checkTable(table); ensureAvailable();
  if (configured()) {
    const r = await fetch(dbUrl(table, `id=eq.${encodeURIComponent(id)}`), { method:'DELETE', headers:headers({Prefer:'return=representation'}) });
    if (!r.ok) throw new Error(`DB_DELETE_${table}_${r.status}_${await r.text()}`);
    return true;
  }
  const db = loadLocal(); db[table] = db[table].filter(x => x.id !== id); saveLocal(db); return true;
}

module.exports = { configured, isLocal, list, get, insert, update, remove };
