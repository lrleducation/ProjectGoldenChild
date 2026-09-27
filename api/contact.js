const {json,readBody,getIp,cleanText,isEmail}=require('../lib/http'); const {rateLimit}=require('../lib/rate-limit'); const store=require('../lib/store'); const {sendEmail}=require('../lib/email'); const {audit}=require('../lib/audit');
module.exports=async function(req,res){
 if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});
 if(!rateLimit(`contact:${getIp(req)}`,{limit:12}).ok) return json(res,429,{message:'Too many messages. Please try again later.'});
 try{const b=await readBody(req); if(b.website) return json(res,200,{ok:true}); if(!cleanText(b.name)||!isEmail(b.email)||!cleanText(b.subject)||!cleanText(b.message)) return json(res,400,{message:'Please complete all required fields.'});
  const row={name:cleanText(b.name,120),email:cleanText(b.email,180),subject:cleanText(b.subject,160),message:cleanText(b.message,3500),status:'new'}; const record=await store.insert('contacts',row); await audit(null,'create','contact',record.id);
  sendEmail({subject:`Project Golden Child enquiry — ${row.subject}`,text:`Name: ${row.name}\nEmail: ${row.email}\nSubject: ${row.subject}\n\n${row.message}\n\nReference: ${record.id}`,replyTo:row.email}).catch(console.error);
  return json(res,201,{ok:true});
 }catch(err){console.error(err); return json(res,503,{message:'We could not send your message just now. Please try again later.'});}
};
