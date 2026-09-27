const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TABLE_MAP = Object.freeze({
  referrals: 'pgc_referrals',
  heroes: 'pgc_heroes',
  hero_actions: 'pgc_hero_actions',
  events: 'pgc_events',
  event_gallery: 'pgc_event_gallery',
  go_gold_registrations: 'pgc_go_gold_registrations',
  contacts: 'pgc_contacts',
  audit_log: 'pgc_audit_log',
  communications: 'pgc_communications',
  healthcheck: 'pgc_healthcheck',
  schema_meta: 'pgc_schema_meta'
});

const TABLES = new Set(Object.keys(TABLE_MAP));
const localFile = path.join(process.cwd(), '.data', 'project-golden-child-v2.json');

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

function physicalTable(table) {
  if (!TABLES.has(table)) throw new Error('INVALID_TABLE');
  return TABLE_MAP[table];
}

function supabaseKey() {
  return String(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
}

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '');
}

function configured() {
  return Boolean(supabaseUrl() && supabaseKey());
}

function isLocal() {
  return process.env.PGC_LOCAL_DEV === '1';
}

function headers(extra={}) {
  const key = supabaseKey();
  const base = {
    apikey: key,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  // Supabase's new sb_secret_* key is an API key, not a JWT.
  // Legacy service_role JWTs still require the Bearer header.
  if (key && !key.startsWith('sb_secret_')) {
    base.Authorization = `Bearer ${key}`;
  }
  return { ...base, ...extra };
}

function dbUrl(table, query='') {
  const physical = physicalTable(table);
  return `${supabaseUrl()}/rest/v1/${physical}${query ? `?${query}` : ''}`;
}

function loadLocal() {
  fs.mkdirSync(path.dirname(localFile), { recursive:true });
  if (!fs.existsSync(localFile)) {
    const base = Object.fromEntries([...TABLES].map(t => [t, []]));
    fs.writeFileSync(localFile, JSON.stringify(base, null, 2));
    return base;
  }
  const parsed = JSON.parse(fs.readFileSync(localFile, 'utf8'));
  for (const table of TABLES) if (!Array.isArray(parsed[table])) parsed[table] = [];
  return parsed;
}

function saveLocal(db) {
  fs.writeFileSync(localFile, JSON.stringify(db, null, 2));
}

function ensureAvailable() {
  if (!configured() && !isLocal()) throw new Error('DATABASE_NOT_CONFIGURED');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientStatus(status) {
  return [408,425,429,500,502,503,504].includes(Number(status));
}

async function request(table, {
  method='GET',
  query='',
  body,
  prefer,
  retries=2,
  timeoutMs=10000
}={}) {
  const url = dbUrl(table, query);
  let lastError;

  for (let attempt=0; attempt<=retries; attempt++) {
    let timer;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method,
        headers: headers(prefer ? { Prefer:prefer } : {}),
        signal: controller.signal,
        ...(body !== undefined ? { body:JSON.stringify(body) } : {})
      });

      clearTimeout(timer);
      const raw = await response.text();
      let data = null;
      if (raw) {
        try { data = JSON.parse(raw); }
        catch { data = raw; }
      }

      if (response.ok) return data;

      const code = data && typeof data === 'object' ? String(data.code || '') : '';
      const detail = data && typeof data === 'object'
        ? [data.message, data.details, data.hint].filter(Boolean).join(' | ')
        : String(data || '');

      const err = new DatabaseError(
        `DB_${method}_${physicalTable(table)}_${response.status}`,
        { operation:method, table, status:response.status, code, detail }
      );
      lastError = err;

      if (!isTransientStatus(response.status) || attempt === retries) throw err;
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (err instanceof DatabaseError && !isTransientStatus(err.status)) throw err;
      lastError = err;
      if (attempt === retries) throw err;
    }

    await sleep(300 * (attempt + 1));
  }

  throw lastError || new Error('DATABASE_REQUEST_FAILED');
}

function safeIdentifier(value) {
  return /^[a-zA-Z0-9_]+$/.test(String(value || ''));
}

async function list(table, { filters={}, order='created_at.desc', limit=500 }={}) {
  physicalTable(table);
  ensureAvailable();

  if (configured()) {
    const params = new URLSearchParams();
    params.set('select','*');

    for (const [key,value] of Object.entries(filters)) {
      if (!safeIdentifier(key)) throw new Error('INVALID_FILTER');
      params.set(key, `eq.${value}`);
    }

    if (order) params.set('order',order);
    if (limit) params.set('limit',String(limit));

    return await request(table,{query:params.toString()}) || [];
  }

  let rows = loadLocal()[table] || [];
  rows = rows.filter(row =>
    Object.entries(filters).every(([key,value]) => String(row[key]) === String(value))
  );

  if (order) {
    const [key,dir] = order.split('.');
    rows = [...rows].sort((a,b) =>
      String(a[key] || '').localeCompare(String(b[key] || '')) * (dir === 'asc' ? 1 : -1)
    );
  }

  return rows.slice(0,limit);
}

async function get(table, id) {
  const rows = await list(table,{filters:{id},limit:1});
  return rows[0] || null;
}

/**
 * Idempotent insert.
 * The ID is generated before the first request. Supabase receives
 * "resolution=ignore-duplicates", so an ambiguous retry cannot create
 * a second record. If the first request succeeded but its response was
 * lost, we fetch the existing record by ID and return it.
 */
async function insert(table, row) {
  physicalTable(table);
  ensureAvailable();

  const now = new Date().toISOString();
  const record = {
    id: row.id || crypto.randomUUID(),
    created_at: row.created_at || now,
    updated_at: row.updated_at || now,
    ...row
  };

  if (configured()) {
    const params = new URLSearchParams({ on_conflict:'id' });
    const data = await request(table,{
      method:'POST',
      query:params.toString(),
      body:record,
      prefer:'resolution=ignore-duplicates,return=representation',
      retries:2
    });

    if (Array.isArray(data) && data[0]) return data[0];

    const existing = await get(table, record.id);
    if (existing) return existing;

    throw new DatabaseError('DB_INSERT_NO_RECORD',{
      operation:'POST', table, status:500, detail:'Insert returned no record and no existing ID was found.'
    });
  }

  const db = loadLocal();
  const existing = db[table].find(x => x.id === record.id);
  if (existing) return existing;
  db[table].push(record);
  saveLocal(db);
  return record;
}

async function update(table, id, patch) {
  physicalTable(table);
  ensureAvailable();

  const record = {
    ...patch,
    updated_at:new Date().toISOString()
  };

  if (configured()) {
    const data = await request(table,{
      method:'PATCH',
      query:`id=eq.${encodeURIComponent(id)}`,
      body:record,
      prefer:'return=representation'
    });
    return Array.isArray(data) ? data[0] || null : null;
  }

  const db = loadLocal();
  const index = db[table].findIndex(x => x.id === id);
  if (index < 0) return null;
  db[table][index] = { ...db[table][index], ...record };
  saveLocal(db);
  return db[table][index];
}

async function remove(table, id) {
  physicalTable(table);
  ensureAvailable();

  if (configured()) {
    await request(table,{
      method:'DELETE',
      query:`id=eq.${encodeURIComponent(id)}`,
      prefer:'return=minimal'
    });
    return true;
  }

  const db = loadLocal();
  db[table] = db[table].filter(x => x.id !== id);
  saveLocal(db);
  return true;
}

async function probe(table, columns=['id']) {
  physicalTable(table);
  ensureAvailable();

  if (!configured()) return { ok:true, mode:'local', columns };

  try {
    const safeColumns = columns.filter(safeIdentifier);
    const params = new URLSearchParams();
    params.set('select', safeColumns.join(',') || 'id');
    params.set('limit','1');

    await request(table,{query:params.toString(),retries:0});

    return {
      ok:true,
      physicalTable:physicalTable(table),
      columns:safeColumns
    };
  } catch (err) {
    return {
      ok:false,
      physicalTable:physicalTable(table),
      status:err.status || 0,
      code:err.code || '',
      detail:err.detail || err.message,
      columns
    };
  }
}

async function writeProbe() {
  ensureAvailable();

  const id = `health-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  try {
    await insert('healthcheck',{
      id,
      checked_at:now,
      source:'vercel-admin-diagnostics'
    });
    const saved = await get('healthcheck',id);
    if (!saved) throw new Error('HEALTHCHECK_NOT_READABLE');
    await remove('healthcheck',id);
    return { ok:true };
  } catch (err) {
    try { await remove('healthcheck',id); } catch {}
    return {
      ok:false,
      status:err.status || 0,
      code:err.code || '',
      detail:err.detail || err.message
    };
  }
}

async function schemaVersion() {
  if (isLocal()) return '2.0.0';
  try {
    const rows = await list('schema_meta',{order:'version.desc',limit:1});
    return rows[0]?.version || null;
  } catch {
    return null;
  }
}

function publicFailure(err, fallback='We could not securely save this submission just now. Please try again later.') {
  if (!err) return fallback;

  if (err.message === 'DATABASE_NOT_CONFIGURED') {
    return 'The secure registration service is not connected yet. Please try again later.';
  }

  if (err instanceof DatabaseError) {
    if (err.code === '42501' || err.status === 401 || err.status === 403) {
      return 'The secure registration service is temporarily unavailable. Please try again shortly.';
    }

    if (err.code === 'PGRST204' || err.code === 'PGRST205') {
      return 'The secure registration service is being updated. Please try again shortly.';
    }

    if (isTransientStatus(err.status)) {
      return 'The secure registration service is temporarily busy. Please try again in a moment.';
    }
  }

  return fallback;
}

module.exports = {
  TABLE_MAP,
  configured,
  isLocal,
  list,
  get,
  insert,
  update,
  remove,
  probe,
  writeProbe,
  schemaVersion,
  publicFailure,
  DatabaseError
};
