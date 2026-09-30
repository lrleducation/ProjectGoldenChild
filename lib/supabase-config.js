function rawSupabaseUrl(){
  return String(process.env.SUPABASE_URL || '').trim();
}

function normaliseSupabaseUrl(value){
  const raw=String(value || '').trim();
  if(!raw) return '';

  let parsed;
  try{
    parsed=new URL(raw);
  }catch{
    // Fall back to conservative string normalisation.
    return raw
      .replace(/\/+$/,'')
      .replace(/\/(?:rest|storage|auth|realtime|functions)\/v1(?:\/.*)?$/i,'');
  }

  // SUPABASE_URL is sometimes copied as the REST/Data API endpoint
  // (for example https://project.supabase.co/rest/v1). Database code
  // historically tolerated that, but Storage did not. Always reduce the
  // environment value to the project origin before adding service paths.
  parsed.pathname=parsed.pathname
    .replace(/\/+$/,'')
    .replace(/\/(?:rest|storage|auth|realtime|functions)\/v1(?:\/.*)?$/i,'');

  parsed.search='';
  parsed.hash='';

  return parsed.toString().replace(/\/+$/,'');
}

function supabaseUrl(){
  return normaliseSupabaseUrl(rawSupabaseUrl());
}

function supabaseKey(){
  return String(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
}

function urlWasNormalised(){
  const raw=rawSupabaseUrl().replace(/\/+$/,'');
  const normalised=supabaseUrl();
  return Boolean(raw && normalised && raw !== normalised);
}

function storageBaseUrl(){
  const base=supabaseUrl();
  return base ? `${base}/storage/v1` : '';
}

function restBaseUrl(){
  const base=supabaseUrl();
  return base ? `${base}/rest/v1` : '';
}

module.exports={
  rawSupabaseUrl,
  normaliseSupabaseUrl,
  supabaseUrl,
  supabaseKey,
  urlWasNormalised,
  storageBaseUrl,
  restBaseUrl
};
