const crypto=require('node:crypto');
const {json,readBody,getIp,cleanText,bool,isEmail}=require('../lib/http');
const {rateLimit}=require('../lib/rate-limit'); const store=require('../lib/store'); const {sendEmail}=require('../lib/email'); const {audit}=require('../lib/audit');
const validId=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''));
module.exports=async function(req,res){
 if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});
 if(!rateLimit(`gold:${getIp(req)}`,{limit:10}).ok) return json(res,429,{message:'Too many submissions. Please try again later.'});
 const requestId=crypto.randomUUID().slice(0,8).toUpperCase();
 try{ const b=await readBody(req); if(b.website) return json(res,200,{ok:true});
  if(!cleanText(b.organisation_name)||!cleanText(b.organisation_type)||!cleanText(b.contact_name)||!isEmail(b.contact_email)) return json(res,400,{message:'Please complete all required fields.'});
  const id=validId(b.submission_id)?String(b.submission_id):null; if(id){const existing=await store.get('go_gold_registrations',id);if(existing)return json(res,200,{ok:true,duplicate:true});}
  const row={...(id?{id}:{}),organisation_name:cleanText(b.organisation_name,180),organisation_type:cleanText(b.organisation_type,120),contact_name:cleanText(b.contact_name,120),contact_email:cleanText(b.contact_email,180),postcode:cleanText(b.postcode,20).toUpperCase(),notes:cleanText(b.notes,2000),updates:bool(b.updates),status:'new'};
  const record=await store.insert('go_gold_registrations',row); audit(null,'create','go_gold_registration',record.id).catch(()=>{});
  sendEmail({subject:`New Go Gold registration — ${row.organisation_name}`,text:`A new Go Gold registration has been received.\nReference: ${record.id}\nOrganisation: ${row.organisation_name}\nReview it in the secure admin area.`,replyTo:row.contact_email}).catch(err=>console.error('Go Gold email failed',err.message));
  return json(res,201,{ok:true});
 }catch(err){console.error(`[GO-GOLD ${requestId}]`,err); return json(res,503,{message:`${store.publicFailure(err,'We could not save your registration just now. Please try again later.')} Support reference: ${requestId}`});}
};
