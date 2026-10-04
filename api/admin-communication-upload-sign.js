const crypto=require('node:crypto');
const path=require('node:path');
const {json,readBody,cleanText}=require('../lib/http');
const {requireAdmin}=require('../lib/security');
const {createSignedUploadUrl,safeDiagnostic}=require('../lib/supabase-storage');

const BUCKET='communication-attachments';
const MAX_BYTES=10*1024*1024;
const allowed={
  'image/jpeg':'jpg',
  'image/png':'png',
  'image/webp':'webp',
  'application/pdf':'pdf'
};

function safeName(value){
  return String(value || 'attachment')
    .replace(/[^a-zA-Z0-9._-]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,100) || 'attachment';
}

module.exports=async function(req,res){
  if(!requireAdmin(req,res)) return;
  if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});

  try{
    const body=await readBody(req,256*1024);
    const mimeType=cleanText(body.mime_type,100).split(';')[0].toLowerCase();
    const fileSize=Number(body.file_size || 0);
    const ext=allowed[mimeType];

    if(!ext) return json(res,400,{message:'Attach a PNG, JPEG, WebP or PDF poster.'});
    if(!Number.isFinite(fileSize) || fileSize<=0) return json(res,400,{message:'The selected attachment could not be read.'});
    if(fileSize>MAX_BYTES) return json(res,400,{message:'Attachments must be under 10 MB.'});

    const original=safeName(cleanText(body.file_name,180));
    const stem=path.basename(original,path.extname(original)).slice(0,60) || 'poster';
    const now=new Date();
    const folder=`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
    const objectPath=`communications/${folder}/${Date.now()}-${crypto.randomUUID()}-${stem}.${ext}`;
    const signed=await createSignedUploadUrl(BUCKET,objectPath);

    return json(res,200,{
      signedUrl:signed.signedUrl,
      path:objectPath,
      fileName:original,
      mimeType,
      fileSize,
      maxBytes:MAX_BYTES,
      storageAuth:signed.keyType
    });
  }catch(err){
    console.error('Communication attachment signing error',safeDiagnostic(err));
    return json(res,503,{message:'The poster attachment could not be prepared for upload. Check System Health and try again.'});
  }
};
