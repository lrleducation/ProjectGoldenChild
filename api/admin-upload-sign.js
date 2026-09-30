const crypto=require('node:crypto');
const path=require('node:path');
const {json,readBody,cleanText,bool}=require('../lib/http');
const {requireAdmin}=require('../lib/security');
const store=require('../lib/store');
const {
  createSignedUploadUrl,
  publicObjectUrl,
  safeDiagnostic
}=require('../lib/supabase-storage');

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

function friendlyStorageMessage(err){
  const status=Number(err?.status)||0;

  if(status===401){
    return 'Supabase rejected the Storage server key. Check SUPABASE_SECRET_KEY in Vercel and redeploy.';
  }
  if(status===403){
    return 'Supabase accepted the project but refused Storage upload permission. Run System Health for the exact Storage response.';
  }
  if(status===404){
    return 'The event-public Storage bucket could not be found.';
  }

  return 'The image store could not prepare the upload. Run System Health for the exact Storage response.';
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
    if(!event) return json(res,404,{message:'Event not found.'});

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

    const signed=await createSignedUploadUrl('event-public',objectPath);

    return json(res,200,{
      signedUrl:signed.signedUrl,
      path:objectPath,
      publicUrl:publicObjectUrl('event-public',objectPath),
      contentType:mimeType,
      maxBytes:15*1024*1024,
      storageAuth:signed.keyType
    });
  }catch(err){
    const diagnostic=safeDiagnostic(err);
    console.error('Upload signing error',diagnostic);

    const message=
      err.message==='SUPABASE_STORAGE_NOT_CONFIGURED'
        ? 'Supabase Storage is not configured on the server.'
        : friendlyStorageMessage(err);

    return json(res,503,{
      message,
      diagnostic
    });
  }
};
