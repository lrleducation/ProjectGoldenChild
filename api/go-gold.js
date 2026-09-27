const {json,readBody,getIp,cleanText,bool,isEmail}=require('../lib/http');
const {rateLimit}=require('../lib/rate-limit'); const store=require('../lib/store'); const {sendEmail}=require('../lib/email'); const {audit}=require('../lib/audit');
module.exports=async function(req,res){
 if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});
 if(!rateLimit(`gold:${getIp(req)}`,{limit:10}).ok) return json(res,429,{message:'Too many submissions. Please try again later.'});
 try{ const b=await readBody(req); if(b.website) return json(res,200,{ok:true});
  if(!cleanText(b.organisation_name)||!cleanText(b.organisation_type)||!cleanText(b.contact_name)||!isEmail(b.contact_email)) return json(res,400,{message:'Please complete all required fields.'});
  const row={organisation_name:cleanText(b.organisation_name,180),organisation_type:cleanText(b.organisation_type,120),contact_name:cleanText(b.contact_name,120),contact_email:cleanText(b.contact_email,180),postcode:cleanText(b.postcode,20).toUpperCase(),notes:cleanText(b.notes,2000),updates:bool(b.updates),status:'new'};
  const record=await store.insert('go_gold_registrations',row); await audit(null,'create','go_gold_registration',record.id);
  sendEmail({subject:`New Go Gold registration — ${row.organisation_name}`,text:`A new Go Gold registration has been received.\nReference: ${record.id}\nOrganisation: ${row.organisation_name}\nReview it in the secure admin area.`,replyTo:row.contact_email}).catch(console.error);
  return json(res,201,{ok:true});
 }catch(err){console.error(err); return json(res,503,{message:'We could not save your registration just now. Please try again later.'});}
};
