const { createClient } = require('@supabase/supabase-js');

let client;

function getSupabaseAdmin(){
  const url=String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/,'');
  const key=String(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  if(!url || !key){
    throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');
  }

  if(!client){
    client=createClient(url,key,{
      auth:{
        autoRefreshToken:false,
        persistSession:false,
        detectSessionInUrl:false
      }
    });
  }

  return client;
}

function publicObjectUrl(path){
  const url=String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/,'');
  return `${url}/storage/v1/object/public/event-public/${String(path || '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

module.exports={getSupabaseAdmin,publicObjectUrl};
