const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TABLES = new Set(['referrals','heroes','hero_actions','events','event_gallery','go_gold_registrations','contacts','audit_log']);
const localFile = path.join(process.cwd(), '.data', 'project-golden-child.json');

class DatabaseError extends Error {
  constructor(message, { operation='', table='', status=0, code='', detail='' }={}) {
    super(message);
    this.name = 'DatabaseError';
    this.operation = operation;
    this.table = table;
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function supabaseKey() {
  return String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function supabaseUrl() {
  let value = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  value = value.replace(/\/rest\/v1$/i, '');
  return value;
}

function configured() {
  return Boolean(supabaseUrl() && supabaseKey());
}

function isLocal() { return process.env.PGC_LOCAL_DEV === '1'; }
function checkTable(table) { if (!TABLES.has(table)) throw new Error('INVALID_TABLE'); }

function headers(extra={}) {
  const key = supabaseKey();
  const base = { apikey:key, 'Content-Type':'application/json' };
  // Legacy service_role keys are JWTs. New sb_secret_* keys must be sent as apikey only.
  if (key && !key.startsWith('sb_secret_')) base.Authorization = `Bearer ${key}`;
  return { ...base, ...extra };
}

function dbUrl(table, query='') {
  return `${supabaseUrl()}/rest/v1/${table}${query ? `?${query}` : ''}`;
}

function loadLocal() {
  fs.mkdirSync(path.dirname(localFile), { recursive:true });
  if (!fs.existsSync(localFile)) {
    const base = Object.fromEntries([...TABLES].map(t => [t, []]));
    fs.writeFileSync(localFile, JSON.stringify(base, null, 2));
    return base;
  }
  return JSON.parse(fs.readFileSync(localFile, 'utf8'));
}
function saveLocal(db) { fs.writeFileSync(localFile, JSON.stringify(db, null, 2)); }
function ensureAvailable() { if (!configured() && !isLocal()) throw new Error('DATABASE_NOT_CONFIGURED'); }

function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
function isTransientStatus(status){ return status===408 || status===425 || status===429 || status===500 || status===502 || status===503 || status===504; }

async function request(table, { method='GET', query='', body, prefer, retries=2 }={}) {
  const url = dbUrl(table, query);
  let lastError;
  for (let attempt=0; attempt<=retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(()=>controller.abort(), 9000);
      const h = headers(prefer ? { Prefer:prefer } : {});
      const response = await fetch(url, {
        method,
        headers:h,
        signal:controller.signal,
        ...(body !== undefined ? { body:JSON.stringify(body) } : {})
      });
      clearTimeout(timer);
      const raw = await response.text();
      let data = null;
      if (raw) { try { data = JSON.parse(raw); } catch { data = raw; } }
      if (response.ok) return data;

      const code = data && typeof data === 'object' ? String(data.code || '') : '';
      const detail = data && typeof data === 'object'
        ? [data.message, data.details, data.hint].filter(Boolean).join(' | ')
        : String(data || '');
      const err = new DatabaseError(`DB_${method}_${table}_${response.status}`, {
        operation:method, table, status:response.status, code, detail
      });
      lastError = err;
      if (!isTransientStatus(response.status) || attempt===retries) throw err;
    } catch (err) {
      if (err instanceof DatabaseError && !isTransientStatus(err.status)) throw err;
      lastError = err;
      if (attempt===retries) throw err;
    }
    await sleep(250 * (attempt + 1));
  }
  throw lastError || new Error('DATABASE_REQUEST_FAILED');
}

async function list(table, { filters={}, order='created_at.desc', limit=500 }={}) {
  checkTable(table); ensureAvailable();
  if (configured()) {
    const params = new URLSearchParams();
    params.set('select','*');
    for (const [k,v] of Object.entries(filters)) params.set(k, `eq.${v}`);
    if (order) params.set('order',order);
    if (limit) params.set('limit',String(limit));
    return await request(table,{query:params.toString()}) || [];
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
  const rows = await list(table,{filters:{id},limit:1});
  return rows[0] || null;
}

async function insert(table, row) {
  checkTable(table); ensureAvailable();
  const now = new Date().toISOString();
  const record = { id:row.id || crypto.randomUUID(), created_at:row.created_at || now, updated_at:row.updated_at || now, ...row };
  if (configured()) {
    const data = await request(table,{method:'POST',body:record,prefer:'return=representation'});
    return Array.isArray(data) ? data[0] : data;
  }
  const db=loadLocal(); db[table].push(record); saveLocal(db); return record;
}

async function update(table,id,patch) {
  checkTable(table); ensureAvailable();
  const record={...patch,updated_at:new Date().toISOString()};
  if (configured()) {
    const data = await request(table,{method:'PATCH',query:`id=eq.${encodeURIComponent(id)}`,body:record,prefer:'return=representation'});
    return Array.isArray(data) ? data[0] || null : null;
  }
  const db=loadLocal(); const i=db[table].findIndex(x=>x.id===id); if(i<0)return null;
  db[table][i]={...db[table][i],...record}; saveLocal(db); return db[table][i];
}

async function remove(table,id) {
  checkTable(table); ensureAvailable();
  if (configured()) { await request(table,{method:'DELETE',query:`id=eq.${encodeURIComponent(id)}`,prefer:'return=representation'}); return true; }
  const db=loadLocal(); db[table]=db[table].filter(x=>x.id!==id); saveLocal(db); return true;
}

async function probe(table, columns=['id']) {
  checkTable(table); ensureAvailable();
  if (!configured()) return { ok:true, mode:'local', columns };
  try {
    const safeColumns = columns.filter(c => /^[a-z0-9_]+$/i.test(String(c)));
    const params = new URLSearchParams();
    params.set('select', safeColumns.join(',') || 'id');
    params.set('limit', '1');
    await request(table,{query:params.toString(),retries:0});
    return { ok:true, columns:safeColumns };
  } catch (err) {
    return {
      ok:false,
      status:err.status||0,
      code:err.code||'',
      detail:err.detail||err.message,
      columns
    };
  }
}

function publicFailure(err, fallback='We could not securely save this submission just now. Please try again later.') {
  if (!err) return fallback;
  if (err.message==='DATABASE_NOT_CONFIGURED') return 'The secure registration service is not connected yet. Please try again later.';
  if (err instanceof DatabaseError) {
    if (err.code==='42501' || err.status===401 || err.status===403) return 'The secure registration service is temporarily unavailable. Please try again shortly.';
    if (err.code==='PGRST204' || err.code==='PGRST205') return 'The secure registration service is being updated. Please try again shortly.';
    if (isTransientStatus(err.status)) return 'The secure registration service is temporarily busy. Please try again in a moment.';
  }
  return fallback;
}

module.exports={ configured,isLocal,list,get,insert,update,remove,probe,publicFailure,DatabaseError };
