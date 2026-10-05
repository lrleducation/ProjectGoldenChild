const {
  supabaseUrl,
  supabaseKey,
  storageBaseUrl,
  urlWasNormalised
}=require('./supabase-config');

class StorageHttpError extends Error {
  constructor(message,{status=0,detail='',operation='',keyType=''}={}){
    super(message);
    this.name='StorageHttpError';
    this.status=Number(status)||0;
    this.detail=String(detail||'');
    this.operation=operation;
    this.keyType=keyType;
  }
}

function availableKeys(){
  const primary=supabaseKey();
  const legacy=String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return [...new Set([primary,legacy].filter(Boolean))];
}

function keyType(key){
  if(String(key).startsWith('sb_secret_')) return 'secret';
  if(String(key).split('.').length===3) return 'legacy-service-role';
  return 'server-key';
}

function authHeadersFor(key,extra={}){
  const headers={
    apikey:key,
    Accept:'application/json',
    ...extra
  };

  // New sb_secret_* keys are API keys, not JWTs.
  // Sending them as "Bearer <key>" is deliberately avoided.
  if(!String(key).startsWith('sb_secret_')){
    headers.Authorization=`Bearer ${key}`;
  }

  return headers;
}

function base(){
  const url=storageBaseUrl();
  if(!url) throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');
  return url;
}

async function parseResponse(response){
  const raw=await response.text();
  if(!raw) return {raw:'',data:null};

  try{
    return {raw,data:JSON.parse(raw)};
  }catch{
    return {raw,data:raw};
  }
}

function errorDetail(parsed){
  if(parsed?.data && typeof parsed.data==='object'){
    return [
      parsed.data.message,
      parsed.data.error,
      parsed.data.statusCode,
      parsed.data.error_description
    ].filter(Boolean).join(' | ');
  }
  return String(parsed?.raw || parsed?.data || '');
}

/**
 * Raw Supabase Storage request.
 *
 * Important: this intentionally does NOT use supabase-js. The PGC database
 * already uses the new sb_secret_* key successfully via the apikey header.
 * Storage is now handled the same way, removing SDK/version ambiguity.
 *
 * If a legacy service-role key is also present, a 401/403 from the preferred
 * key automatically retries once with the legacy key.
 */
async function request(path,{
  method='GET',
  body,
  headers={},
  retryLegacy=true
}={}){
  const keys=availableKeys();
  if(!keys.length) throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');

  let lastError;

  for(let index=0; index<keys.length; index++){
    const key=keys[index];
    const type=keyType(key);

    const response=await fetch(`${base()}${path}`,{
      method,
      headers:authHeadersFor(key,headers),
      ...(body!==undefined ? {body} : {})
    });

    const parsed=await parseResponse(response);

    if(response.ok){
      return {
        data:parsed.data,
        status:response.status,
        keyType:type
      };
    }

    const detail=errorDetail(parsed);
    lastError=new StorageHttpError(
      `Storage ${method} ${path} failed (${response.status})`,
      {
        status:response.status,
        detail,
        operation:`${method} ${path}`,
        keyType:type
      }
    );

    const mayTryNext=
      retryLegacy &&
      [401,403].includes(response.status) &&
      index < keys.length-1;

    if(!mayTryNext) throw lastError;
  }

  throw lastError || new StorageHttpError('Storage request failed');
}

function encodeObjectPath(value){
  return String(value || '')
    .split('/')
    .filter(part=>part.length)
    .map(encodeURIComponent)
    .join('/');
}

async function getBucket(bucket='event-public'){
  const result=await request(`/bucket/${encodeURIComponent(bucket)}`);
  return {
    bucket:result.data,
    keyType:result.keyType,
    status:result.status
  };
}

async function createSignedUploadUrl(bucket,objectPath){
  const encodedBucket=encodeURIComponent(bucket);
  const encodedPath=encodeObjectPath(objectPath);

  const result=await request(
    `/object/upload/sign/${encodedBucket}/${encodedPath}`,
    {
      method:'POST',
      body:'{}',
      headers:{'Content-Type':'application/json'}
    }
  );

  const data=result.data && typeof result.data==='object' ? result.data : {};
  const returned=data.url || data.signedURL || data.signedUrl || '';

  if(!returned){
    throw new StorageHttpError(
      'Storage did not return a signed upload URL.',
      {
        status:result.status,
        detail:JSON.stringify(data).slice(0,500),
        operation:'create signed upload URL',
        keyType:result.keyType
      }
    );
  }

  let signedUrl;
  if(/^https?:\/\//i.test(returned)){
    signedUrl=returned;
  }else if(returned.startsWith('/')){
    signedUrl=`${base()}${returned}`;
  }else{
    signedUrl=`${base()}/${returned}`;
  }

  let token='';
  try{
    token=new URL(signedUrl).searchParams.get('token') || '';
  }catch{}

  return {
    signedUrl,
    token,
    path:objectPath,
    keyType:result.keyType
  };
}

function publicObjectUrl(bucket,objectPath){
  return `${base()}/object/public/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`;
}

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function verifyPublicObject(bucket,objectPath,{attempts=6}={}){
  const url=publicObjectUrl(bucket,objectPath);
  let lastStatus=0;

  for(let i=0;i<attempts;i++){
    try{
      const response=await fetch(url,{
        method:'HEAD',
        cache:'no-store'
      });
      lastStatus=response.status;
      if(response.ok) return {ok:true,status:response.status,url};
    }catch{}

    if(i<attempts-1) await sleep(250*(i+1));
  }

  return {ok:false,status:lastStatus,url};
}

function safeDiagnostic(err){
  return {
    status:Number(err?.status)||0,
    operation:String(err?.operation||''),
    detail:String(err?.detail||err?.message||'').slice(0,700),
    keyType:String(err?.keyType||'')
  };
}

module.exports={
  StorageHttpError,
  supabaseUrl,
  availableKeys,
  keyType,
  getBucket,
  createSignedUploadUrl,
  publicObjectUrl,
  verifyPublicObject,
  safeDiagnostic,
  urlWasNormalised
};
