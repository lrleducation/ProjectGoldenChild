import fs from 'node:fs';
import path from 'node:path';
import { supabaseUrl, supabaseServiceRoleKey, isProduction, storageBucket } from './config.mjs';
import { randomId } from './security.mjs';

const useSupabase = Boolean(supabaseUrl && supabaseServiceRoleKey);
let localDb;

async function getLocalDb(){
  if(localDb) return localDb;
  const { DatabaseSync } = await import('node:sqlite');
  const dir = path.resolve(process.cwd(), '.data');
  fs.mkdirSync(dir,{recursive:true});
  localDb = new DatabaseSync(path.join(dir,'project-golden-child.db'));
  localDb.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY, route TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
      child_name TEXT, preferred_name TEXT, date_of_birth TEXT, postcode_prefix TEXT, life_status TEXT,
      cancer_type TEXT, diagnosis_date_text TEXT, journey_notes TEXT, interests TEXT,
      submitter_name TEXT NOT NULL, submitter_relationship TEXT, submitter_email TEXT NOT NULL, submitter_phone TEXT,
      family_contact_name TEXT, family_contact_email TEXT, family_contact_phone TEXT, family_aware INTEGER DEFAULT 0,
      referral_reason TEXT, consents TEXT NOT NULL DEFAULT '{}', privacy_accepted INTEGER NOT NULL DEFAULT 0,
      source_ip_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS heroes (
      id TEXT PRIMARY KEY, referral_id TEXT UNIQUE, child_name TEXT NOT NULL, preferred_name TEXT, date_of_birth TEXT,
      postcode_prefix TEXT, life_status TEXT, cancer_type TEXT, diagnosis_date_text TEXT, interests TEXT,
      family_contact_name TEXT, family_contact_email TEXT, family_contact_phone TEXT, consents TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hero_actions (
      id TEXT PRIMARY KEY, hero_id TEXT NOT NULL, action_type TEXT NOT NULL, title TEXT NOT NULL, due_date TEXT,
      status TEXT NOT NULL DEFAULT 'planned', notes TEXT, value_provided REAL DEFAULT 0, completed_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(hero_id) REFERENCES heroes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS hero_actions_hero_idx ON hero_actions(hero_id);
    CREATE INDEX IF NOT EXISTS hero_actions_due_idx ON hero_actions(status,due_date);
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, summary TEXT, body TEXT, start_at TEXT, end_at TEXT,
      location TEXT, category TEXT, status TEXT NOT NULL DEFAULT 'draft', hero_image_url TEXT, max_places INTEGER, booking_url TEXT,
      attendance_children INTEGER DEFAULT 0, attendance_family INTEGER DEFAULT 0, value_provided REAL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT
    );
    CREATE TABLE IF NOT EXISTS event_media (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL, url TEXT NOT NULL, alt_text TEXT, sort_order INTEGER DEFAULT 0, public_approved INTEGER DEFAULT 1, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS go_gold_pledges (
      id TEXT PRIMARY KEY, organisation_name TEXT NOT NULL, organisation_type TEXT, contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL, postcode TEXT, notes TEXT, updates INTEGER DEFAULT 0, status TEXT DEFAULT 'interested',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT, message TEXT NOT NULL, status TEXT DEFAULT 'new', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, actor_email TEXT, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, detail TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return localDb;
}

async function supabase(table, {method='GET', query='', body, prefer='return=representation'}={}){
  const url = `${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const r = await fetch(url,{
    method,
    headers:{
      apikey:supabaseServiceRoleKey,
      Authorization:`Bearer ${supabaseServiceRoleKey}`,
      'Content-Type':'application/json',
      Prefer:prefer
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if(!r.ok){
    const text=await r.text();
    throw new Error(`Database request failed (${r.status}): ${text.slice(0,500)}`);
  }
  if(r.status===204) return null;
  const text=await r.text();
  return text ? JSON.parse(text) : null;
}

const fromSqliteReferral = row => row ? ({...row, family_aware:Boolean(row.family_aware), privacy_accepted:Boolean(row.privacy_accepted), consents:JSON.parse(row.consents||'{}')}) : row;
const fromSqliteHero = row => row ? ({...row,consents:JSON.parse(row.consents||'{}')}) : row;

export async function createReferral(data, sourceIpHash=''){
  const now=new Date().toISOString();
  const record={id:randomId('ref'),status:'new',...data,source_ip_hash:sourceIpHash,created_at:now,updated_at:now};
  if(useSupabase){
    const rows=await supabase('referrals',{method:'POST',body:record});
    return rows?.[0] || record;
  }
  if(isProduction) throw new Error('Production database is not configured');
  const db=await getLocalDb();
  db.prepare(`INSERT INTO referrals (id,route,status,child_name,preferred_name,date_of_birth,postcode_prefix,life_status,cancer_type,diagnosis_date_text,journey_notes,interests,submitter_name,submitter_relationship,submitter_email,submitter_phone,family_contact_name,family_contact_email,family_contact_phone,family_aware,referral_reason,consents,privacy_accepted,source_ip_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    record.id,record.route,record.status,record.child_name||'',record.preferred_name||'',record.date_of_birth||'',record.postcode_prefix||'',record.life_status||'',record.cancer_type||'',record.diagnosis_date_text||'',record.journey_notes||'',record.interests||'',record.submitter_name||'',record.submitter_relationship||'',record.submitter_email||'',record.submitter_phone||'',record.family_contact_name||'',record.family_contact_email||'',record.family_contact_phone||'',record.family_aware?1:0,record.referral_reason||'',JSON.stringify(record.consents||{}),record.privacy_accepted?1:0,record.source_ip_hash||'',now,now
  );
  return record;
}

export async function listReferrals(){
  if(useSupabase) return await supabase('referrals',{query:'select=*&order=created_at.desc'});
  const db=await getLocalDb();
  return db.prepare(`SELECT * FROM referrals ORDER BY created_at DESC`).all().map(fromSqliteReferral);
}

export async function getReferral(id){
  if(useSupabase){
    const rows=await supabase('referrals',{query:`select=*&id=eq.${encodeURIComponent(id)}&limit=1`});
    return rows?.[0]||null;
  }
  const db=await getLocalDb();
  return fromSqliteReferral(db.prepare(`SELECT * FROM referrals WHERE id=?`).get(id));
}

export async function updateReferral(id, patch){
  const allowed=['status'];
  const clean=Object.fromEntries(Object.entries(patch).filter(([k])=>allowed.includes(k)));
  clean.updated_at=new Date().toISOString();
  if(useSupabase){
    const rows=await supabase('referrals',{method:'PATCH',query:`id=eq.${encodeURIComponent(id)}`,body:clean});
    return rows?.[0]||null;
  }
  const db=await getLocalDb();
  if(clean.status) db.prepare(`UPDATE referrals SET status=?, updated_at=? WHERE id=?`).run(clean.status,clean.updated_at,id);
  return getReferral(id);
}

export async function promoteReferralToHero(id){
  const referral=await getReferral(id);
  if(!referral) throw new Error('Referral not found');
  if(referral.route!=='parent' || !referral.consents?.heroes) throw new Error('Only consented parent/carer registrations can be promoted directly');
  const now=new Date().toISOString();
  const hero={
    id:randomId('hero'), referral_id:id, child_name:referral.child_name, preferred_name:referral.preferred_name,
    date_of_birth:referral.date_of_birth, postcode_prefix:referral.postcode_prefix, life_status:referral.life_status,
    cancer_type:referral.cancer_type, diagnosis_date_text:referral.diagnosis_date_text, interests:referral.interests,
    family_contact_name:referral.family_contact_name, family_contact_email:referral.family_contact_email, family_contact_phone:referral.family_contact_phone,
    consents:referral.consents||{}, status: referral.life_status==='The child has died' ? 'remembered' : 'active', created_at:now, updated_at:now
  };
  if(useSupabase){
    const rows=await supabase('heroes',{method:'POST',body:hero,prefer:'resolution=ignore-duplicates,return=representation'});
    await updateReferral(id,{status:'approved'});
    return rows?.[0] || hero;
  }
  const db=await getLocalDb();
  const existing=db.prepare(`SELECT * FROM heroes WHERE referral_id=?`).get(id);
  if(existing) return fromSqliteHero(existing);
  db.prepare(`INSERT INTO heroes (id,referral_id,child_name,preferred_name,date_of_birth,postcode_prefix,life_status,cancer_type,diagnosis_date_text,interests,family_contact_name,family_contact_email,family_contact_phone,consents,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(hero.id,id,hero.child_name,hero.preferred_name||'',hero.date_of_birth||'',hero.postcode_prefix||'',hero.life_status||'',hero.cancer_type||'',hero.diagnosis_date_text||'',hero.interests||'',hero.family_contact_name||'',hero.family_contact_email||'',hero.family_contact_phone||'',JSON.stringify(hero.consents),hero.status,now,now);
  await updateReferral(id,{status:'approved'});
  return hero;
}

export async function listHeroes(){
  if(useSupabase) return await supabase('heroes',{query:'select=*&order=created_at.desc'});
  const db=await getLocalDb();
  return db.prepare(`SELECT * FROM heroes ORDER BY created_at DESC`).all().map(fromSqliteHero);
}

export async function updateHeroStatus(id,status){
  const allowed=new Set(['active','remembered','paused','archived']);
  if(!allowed.has(status)) throw new Error('Invalid Hero status');
  const updated_at=new Date().toISOString();
  if(useSupabase){
    const rows=await supabase('heroes',{method:'PATCH',query:`id=eq.${encodeURIComponent(id)}`,body:{status,updated_at}});
    return rows?.[0]||null;
  }
  const db=await getLocalDb();
  db.prepare(`UPDATE heroes SET status=?, updated_at=? WHERE id=?`).run(status,updated_at,id);
  return fromSqliteHero(db.prepare(`SELECT * FROM heroes WHERE id=?`).get(id));
}

export async function listHeroActions(heroId=''){
  if(useSupabase){
    const q=heroId?`select=*&hero_id=eq.${encodeURIComponent(heroId)}&order=due_date.asc.nullslast,created_at.desc`:'select=*&order=due_date.asc.nullslast,created_at.desc';
    return await supabase('hero_actions',{query:q});
  }
  const db=await getLocalDb();
  return heroId?db.prepare(`SELECT * FROM hero_actions WHERE hero_id=? ORDER BY CASE WHEN due_date IS NULL OR due_date='' THEN 1 ELSE 0 END,due_date,created_at DESC`).all(heroId):db.prepare(`SELECT * FROM hero_actions ORDER BY CASE WHEN due_date IS NULL OR due_date='' THEN 1 ELSE 0 END,due_date,created_at DESC`).all();
}

export async function createHeroAction(data){
  const now=new Date().toISOString();
  const record={id:randomId('act'),hero_id:data.hero_id,action_type:data.action_type,title:data.title,due_date:data.due_date||null,status:'planned',notes:data.notes||'',value_provided:Number(data.value_provided||0),completed_at:null,created_at:now,updated_at:now};
  if(useSupabase){const rows=await supabase('hero_actions',{method:'POST',body:record});return rows?.[0]||record;}
  const db=await getLocalDb();
  db.prepare(`INSERT INTO hero_actions (id,hero_id,action_type,title,due_date,status,notes,value_provided,completed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(record.id,record.hero_id,record.action_type,record.title,record.due_date,record.status,record.notes,record.value_provided,null,now,now);
  return record;
}

export async function updateHeroAction(id,patch){
  const allowedStatus=new Set(['planned','completed','cancelled']);
  const status=allowedStatus.has(patch.status)?patch.status:null;
  if(!status) throw new Error('Invalid action status');
  const now=new Date().toISOString();
  const body={status,updated_at:now,completed_at:status==='completed'?now:null};
  if(useSupabase){const rows=await supabase('hero_actions',{method:'PATCH',query:`id=eq.${encodeURIComponent(id)}`,body});return rows?.[0]||null;}
  const db=await getLocalDb();
  db.prepare(`UPDATE hero_actions SET status=?, completed_at=?, updated_at=? WHERE id=?`).run(body.status,body.completed_at,body.updated_at,id);
  return db.prepare(`SELECT * FROM hero_actions WHERE id=?`).get(id);
}

export async function listEventMedia(eventId, publicOnly=false){
  if(useSupabase){
    let q=`select=*&event_id=eq.${encodeURIComponent(eventId)}&order=sort_order.asc,created_at.asc`;
    if(publicOnly) q+='&public_approved=eq.true';
    return await supabase('event_media',{query:q});
  }
  const db=await getLocalDb();
  const rows=publicOnly?db.prepare(`SELECT * FROM event_media WHERE event_id=? AND public_approved=1 ORDER BY sort_order,created_at`).all(eventId):db.prepare(`SELECT * FROM event_media WHERE event_id=? ORDER BY sort_order,created_at`).all(eventId);
  return rows.map(r=>({...r,public_approved:Boolean(r.public_approved)}));
}

export async function addEventMedia(data){
  const record={id:randomId('media'),event_id:data.event_id,url:data.url,alt_text:data.alt_text||'',sort_order:Number(data.sort_order||0),public_approved:data.public_approved!==false,created_at:new Date().toISOString()};
  if(useSupabase){const rows=await supabase('event_media',{method:'POST',body:record});return rows?.[0]||record;}
  const db=await getLocalDb();db.prepare(`INSERT INTO event_media (id,event_id,url,alt_text,sort_order,public_approved,created_at) VALUES (?,?,?,?,?,?,?)`).run(record.id,record.event_id,record.url,record.alt_text,record.sort_order,record.public_approved?1:0,record.created_at);return record;
}

export async function deleteEventMedia(id){
  if(useSupabase){await supabase('event_media',{method:'DELETE',query:`id=eq.${encodeURIComponent(id)}`,prefer:'return=minimal'});return;}
  const db=await getLocalDb();db.prepare(`DELETE FROM event_media WHERE id=?`).run(id);
}

export async function listPublicEvents(scope='all'){
  const now=new Date().toISOString();
  let events;
  if(useSupabase){
    let q='select=*&status=in.(published,completed)&order=start_at.asc.nullslast';
    if(scope==='upcoming') q+=`&or=(start_at.gte.${encodeURIComponent(now)},start_at.is.null)`;
    if(scope==='past') q+=`&start_at=lt.${encodeURIComponent(now)}`;
    events=await supabase('events',{query:q});
  } else {
    const db=await getLocalDb();
    let sql=`SELECT * FROM events WHERE status IN ('published','completed')`;const params=[];
    if(scope==='upcoming'){sql+=` AND (start_at>=? OR start_at IS NULL)`;params.push(now)}
    if(scope==='past'){sql+=` AND start_at<?`;params.push(now)}
    sql+=scope==='past'?' ORDER BY start_at DESC':' ORDER BY start_at ASC';events=db.prepare(sql).all(...params);
  }
  return await Promise.all(events.map(async e=>({...e,media:await listEventMedia(e.id,true)})));
}

export async function listAdminEvents(){
  if(useSupabase) return await supabase('events',{query:'select=*&order=start_at.desc.nullslast'});
  const db=await getLocalDb();
  return db.prepare(`SELECT * FROM events ORDER BY COALESCE(start_at,created_at) DESC`).all();
}

export async function saveEvent(data,id=''){
  const now=new Date().toISOString();
  if(id){
    const patch={...data,updated_at:now};
    if(data.status==='published') patch.published_at=now;
    if(useSupabase){
      const rows=await supabase('events',{method:'PATCH',query:`id=eq.${encodeURIComponent(id)}`,body:patch});
      return rows?.[0]||null;
    }
    const db=await getLocalDb();
    const fields=Object.keys(patch).filter(k=>['title','slug','summary','body','start_at','end_at','location','category','status','hero_image_url','max_places','booking_url','attendance_children','attendance_family','value_provided','updated_at','published_at'].includes(k));
    const sql=`UPDATE events SET ${fields.map(k=>`${k}=?`).join(',')} WHERE id=?`;
    db.prepare(sql).run(...fields.map(k=>patch[k]??null),id);
    return db.prepare(`SELECT * FROM events WHERE id=?`).get(id);
  }
  const record={id:randomId('evt'),...data,created_at:now,updated_at:now,published_at:data.status==='published'?now:null};
  if(useSupabase){
    const rows=await supabase('events',{method:'POST',body:record}); return rows?.[0]||record;
  }
  const db=await getLocalDb();
  db.prepare(`INSERT INTO events (id,title,slug,summary,body,start_at,end_at,location,category,status,hero_image_url,max_places,booking_url,attendance_children,attendance_family,value_provided,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(record.id,record.title,record.slug,record.summary||'',record.body||'',record.start_at||null,record.end_at||null,record.location||'',record.category||'',record.status,record.hero_image_url||'',record.max_places,record.booking_url||'',record.attendance_children||0,record.attendance_family||0,record.value_provided||0,now,now,record.published_at);
  return record;
}

export async function createGoGoldPledge(data){
  const record={id:randomId('gold'),...data,status:'interested',created_at:new Date().toISOString()};
  if(useSupabase){const rows=await supabase('go_gold_pledges',{method:'POST',body:record});return rows?.[0]||record;}
  const db=await getLocalDb();
  db.prepare(`INSERT INTO go_gold_pledges (id,organisation_name,organisation_type,contact_name,contact_email,postcode,notes,updates,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(record.id,record.organisation_name,record.organisation_type,record.contact_name,record.contact_email,record.postcode||'',record.notes||'',record.updates?1:0,record.status,record.created_at);
  return record;
}

export async function getSummary(){
  if(useSupabase){
    const [refs,heroes,events,gold,actions]=await Promise.all([
      supabase('referrals',{query:'select=id,status'}), supabase('heroes',{query:'select=id,status'}), supabase('events',{query:'select=id,status,start_at'}), supabase('go_gold_pledges',{query:'select=id,status'}), supabase('hero_actions',{query:'select=id,status,due_date'})
    ]);
    const now=Date.now();
    return {heroes:heroes.length,newReferrals:refs.filter(r=>r.status==='new').length,upcomingEvents:events.filter(e=>e.status==='published' && e.start_at && new Date(e.start_at).getTime()>=now).length,goGold:gold.length,openActions:actions.filter(a=>a.status==='planned').length};
  }
  const db=await getLocalDb();
  const scalar=(sql,...p)=>Number(db.prepare(sql).get(...p).c||0);
  return {heroes:scalar(`SELECT COUNT(*) c FROM heroes`),newReferrals:scalar(`SELECT COUNT(*) c FROM referrals WHERE status='new'`),upcomingEvents:scalar(`SELECT COUNT(*) c FROM events WHERE status='published' AND start_at>=?`,new Date().toISOString()),goGold:scalar(`SELECT COUNT(*) c FROM go_gold_pledges`),openActions:scalar(`SELECT COUNT(*) c FROM hero_actions WHERE status='planned'`)};
}

export async function listGoGoldPledges(){
  if(useSupabase) return await supabase('go_gold_pledges',{query:'select=*&order=created_at.desc'});
  const db=await getLocalDb();
  return db.prepare(`SELECT * FROM go_gold_pledges ORDER BY created_at DESC`).all().map(r=>({...r,updates:Boolean(r.updates)}));
}

export async function listContactMessages(){
  if(useSupabase) return await supabase('contact_messages',{query:'select=*&order=created_at.desc'});
  const db=await getLocalDb();
  return db.prepare(`SELECT * FROM contact_messages ORDER BY created_at DESC`).all();
}

export async function createContactMessage(data){
  const record={id:randomId('msg'),...data,status:'new',created_at:new Date().toISOString()};
  if(useSupabase){const rows=await supabase('contact_messages',{method:'POST',body:record});return rows?.[0]||record;}
  if(isProduction) throw new Error('Production database is not configured');
  const db=await getLocalDb();
  db.prepare(`INSERT INTO contact_messages (id,name,email,subject,message,status,created_at) VALUES (?,?,?,?,?,?,?)`).run(record.id,record.name,record.email,record.subject||'',record.message,record.status,record.created_at);
  return record;
}

export async function audit(actorEmail,action,entityType='',entityId='',detail={}){
  const record={id:randomId('audit'),actor_email:actorEmail||'',action,entity_type:entityType,entity_id:entityId,detail,created_at:new Date().toISOString()};
  if(useSupabase){await supabase('audit_log',{method:'POST',body:record,prefer:'return=minimal'});return;}
  const db=await getLocalDb();
  db.prepare(`INSERT INTO audit_log (id,actor_email,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?)`).run(record.id,record.actor_email,action,entityType,entityId,JSON.stringify(detail||{}),record.created_at);
}

export async function uploadPublicEventImage({bytes,filename,contentType}){
  const safe=(filename||'image.jpg').replace(/[^a-zA-Z0-9._-]/g,'-');
  const objectPath=`events/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`;
  if(useSupabase){
    const url=`${supabaseUrl}/storage/v1/object/${encodeURIComponent(storageBucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
    const r=await fetch(url,{method:'POST',headers:{apikey:supabaseServiceRoleKey,Authorization:`Bearer ${supabaseServiceRoleKey}`,'Content-Type':contentType||'application/octet-stream','x-upsert':'false'},body:bytes});
    if(!r.ok) throw new Error(`Image upload failed: ${r.status} ${await r.text()}`);
    return `${supabaseUrl}/storage/v1/object/public/${storageBucket}/${objectPath}`;
  }
  if(isProduction) throw new Error('Production storage is not configured');
  const dir=path.resolve(process.cwd(),'.data','uploads','events'); fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,path.basename(objectPath)),bytes);
  return `/uploads/events/${path.basename(objectPath)}`;
}
