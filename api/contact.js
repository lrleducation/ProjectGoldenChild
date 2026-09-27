const crypto=require('node:crypto');
const {json,readBody,getIp,cleanText,isEmail}=require('../lib/http'); const {rateLimit}=require('../lib/rate-limit'); const store=require('../lib/store'); const {sendEmail}=require('../lib/email'); const {audit}=require('../lib/audit');
const validId=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''));
module.exports=async function(req,res){
 if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});
 if(!rateLimit(`contact:${getIp(req)}`,{limit:12}).ok) return json(res,429,{message:'Too many messages. Please try again later.'});
 const requestId=crypto.randomUUID().slice(0,8).toUpperCase();
 try{const b=await readBody(req); if(b.website) return json(res,200,{ok:true}); if(!cleanText(b.name)||!isEmail(b.email)||!cleanText(b.subject)||!cleanText(b.message)) return json(res,400,{message:'Please complete all required fields.'});
  const id=validId(b.submission_id)?String(b.submission_id):null; if(id){const existing=await store.get('contacts',id);if(existing)return json(res,200,{ok:true,duplicate:true});}
  const row={...(id?{id}:{}),name:cleanText(b.name,120),email:cleanText(b.email,180),subject:cleanText(b.subject,160),message:cleanText(b.message,3500),status:'new'}; const record=await store.insert('contacts',row); audit(null,'create','contact',record.id).catch(()=>{});
  sendEmail({subject:`Project Golden Child enquiry — ${row.subject}`,text:`Name: ${row.name}\nEmail: ${row.email}\nSubject: ${row.subject}\n\n${row.message}\n\nReference: ${record.id}`,replyTo:row.email}).catch(err=>console.error('Contact email failed',err.message));
  return json(res,201,{ok:true});
 }catch(err){console.error(`[CONTACT ${requestId}]`,err); return json(res,503,{message:`${store.publicFailure(err,'We could not send your message just now. Please try again later.')} Support reference: ${requestId}`});}
};
