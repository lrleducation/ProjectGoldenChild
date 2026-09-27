import { json } from '../lib/http.mjs';
import { bodyObject } from '../lib/request.mjs';
import { createContactMessage } from '../lib/db.mjs';
import { notifyContactMessage } from '../lib/email.mjs';
import { isProduction, productionReady } from '../lib/config.mjs';
const clean=(v,n)=>String(v||'').trim().slice(0,n);
export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false});
  if(isProduction&&!productionReady())return json(res,503,{ok:false,error:'Contact is temporarily unavailable.'});
  const b=bodyObject(req);if(b.website)return json(res,200,{ok:true});
  const data={name:clean(b.name,120),email:clean(b.email,180).toLowerCase(),subject:clean(b.subject,160),message:clean(b.message,4000)};
  const errors=[];if(!data.name)errors.push('Your name is required.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))errors.push('A valid email is required.');if(data.message.length<10)errors.push('Please add a little more detail.');
  if(errors.length)return json(res,422,{ok:false,error:'Please check the form.',errors});
  try{const row=await createContactMessage(data);await Promise.allSettled([notifyContactMessage(row)]);return json(res,201,{ok:true,reference:row.id});}catch(e){console.error('Contact save failed',e?.message);return json(res,500,{ok:false,error:'We could not send your message.'});}
}
