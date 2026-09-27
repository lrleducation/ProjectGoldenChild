const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function safeExt(mime) {
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[mime] || null;
}

async function uploadPublicImage({ base64, mimeType, prefix='events' }) {
  const ext = safeExt(mimeType);
  if (!ext) throw new Error('UNSUPPORTED_IMAGE_TYPE');
  const data = Buffer.from(String(base64 || '').replace(/^data:[^;]+;base64,/,''), 'base64');
  if (!data.length || data.length > 3 * 1024 * 1024) throw new Error('IMAGE_SIZE');
  const name = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const endpoint = `${url.replace(/\/$/,'')}/storage/v1/object/event-public/${name}`;
    const r = await fetch(endpoint, { method:'POST', headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':mimeType, 'x-upsert':'false' }, body:data });
    if (!r.ok) throw new Error(`STORAGE_${r.status}_${await r.text()}`);
    return `${url.replace(/\/$/,'')}/storage/v1/object/public/event-public/${name}`;
  }
  if (process.env.PGC_LOCAL_DEV === '1') {
    const dir = path.join(process.cwd(),'public','uploads',prefix);
    fs.mkdirSync(dir,{recursive:true});
    const file = path.join(process.cwd(),'public','uploads',name);
    fs.writeFileSync(file,data);
    return `/uploads/${name}`;
  }
  throw new Error('STORAGE_NOT_CONFIGURED');
}
module.exports = { uploadPublicImage };
