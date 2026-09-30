const crypto=require('node:crypto');
const path=require('node:path');
const {json,readBody,cleanText,bool}=require('../lib/http');
const {requireAdmin}=require('../lib/security');
const store=require('../lib/store');
const {getSupabaseAdmin,publicObjectUrl}=require('../lib/supabase-admin');

const allowed={
  'image/jpeg':'jpg',
  'image/png':'png',
  'image/webp':'webp'
};

function safeName(value){
  return String(value || 'image')
    .replace(/[^a-zA-Z0-9._-]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,90) || 'image';
}

module.exports=async function(req,res){
  const user=requireAdmin(req,res);
  if(!user) return;
  if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});

  try{
    const body=await readBody(req,256*1024);
    const eventId=cleanText(body.event_id,80);
    const kind=body.kind==='gallery'?'gallery':'poster';
    const mimeType=cleanText(body.mime_type,100).split(';')[0].toLowerCase();
    const fileSize=Number(body.file_size || 0);
    const ext=allowed[mimeType];

    if(!eventId){
      return json(res,400,{message:'Save the event before uploading images.'});
    }

    if(!ext){
      return json(res,400,{message:'Use a PNG, JPEG or WebP image.'});
    }

    if(!Number.isFinite(fileSize) || fileSize<=0){
      return json(res,400,{message:'The selected image could not be read.'});
    }

    if(fileSize > 15*1024*1024){
      return json(res,400,{message:'Images must be under 15 MB.'});
    }

    const event=await store.get('events',eventId);
    if(!event){
      return json(res,404,{message:'Event not found.'});
    }

    if(kind==='gallery'){
      const confirmed=
        Boolean(event.photo_consent_confirmed) ||
        bool(body.photo_consent_confirmed);

      if(!confirmed){
        return json(res,400,{
          message:'Confirm that publication permission is recorded before uploading event photographs.'
        });
      }
    }

    const original=safeName(cleanText(body.file_name,160));
    const stem=path.basename(original,path.extname(original)).slice(0,55) || kind;
    const objectPath=`events/${eventId}/${kind}/${Date.now()}-${crypto.randomUUID()}-${stem}.${ext}`;

    const supabase=getSupabaseAdmin();
    const {data,error}=await supabase.storage
      .from('event-public')
      .createSignedUploadUrl(objectPath,{upsert:false});

    if(error || !data?.signedUrl){
      console.error('Create signed upload URL failed',error);
      return json(res,503,{
        message:'The image store could not prepare an upload. Check Storage in System Health.',
        diagnostic:error?.message || 'No signed upload URL was returned.'
      });
    }

    return json(res,200,{
      signedUrl:data.signedUrl,
      path:objectPath,
      publicUrl:publicObjectUrl(objectPath),
      contentType:mimeType,
      maxBytes:15*1024*1024
    });
  }catch(err){
    console.error('Upload signing error',err);
    const message=
      err.message==='SUPABASE_STORAGE_NOT_CONFIGURED'
        ? 'Supabase Storage is not configured on the server.'
        : 'The image upload could not be prepared.';
    return json(res,503,{message});
  }
};
