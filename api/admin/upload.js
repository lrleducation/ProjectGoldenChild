import { json,requireAdmin } from '../../lib/http.mjs';
import { bodyObject } from '../../lib/request.mjs';
import { uploadPublicEventImage,audit } from '../../lib/db.mjs';
export default async function handler(req,res){
  const s=requireAdmin(req,res);if(!s)return;if(req.method!=='POST')return json(res,405,{ok:false});
  try{
    const b=bodyObject(req);const m=String(b.data_url||'').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if(!m)return json(res,422,{ok:false,error:'Upload a JPG, PNG or WebP image.'});
    const bytes=Buffer.from(m[2],'base64');if(bytes.length>5*1024*1024)return json(res,413,{ok:false,error:'Images must be 5 MB or smaller.'});
    const url=await uploadPublicEventImage({bytes,filename:String(b.filename||'event-image.jpg'),contentType:m[1]});await audit(s.email,'event_image_uploaded','media','',{url});return json(res,201,{ok:true,url});
  }catch(e){console.error('upload failed',e?.message);return json(res,500,{ok:false,error:e?.message||'Upload failed.'});}
}
