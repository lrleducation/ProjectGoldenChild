import { json,getClientIp,verifyTurnstile } from '../lib/http.mjs';
import { bodyObject } from '../lib/request.mjs';
import { validateReferral } from '../lib/validation.mjs';
import { createReferral } from '../lib/db.mjs';
import { hashIp } from '../lib/security.mjs';
import { turnstileSecret, requireTurnstile, isProduction, productionReady } from '../lib/config.mjs';
import { sendReferralReceipt, notifyNewReferral } from '../lib/email.mjs';

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
  if(isProduction && !productionReady()) return json(res,503,{ok:false,error:'Registrations are temporarily unavailable while secure services are being configured.'});
  const input=bodyObject(req);
  if(input.website) return json(res,200,{ok:true,reference:'received'}); // honeypot
  const started=Number(input.form_started_at||0);
  if(started && Date.now()-started<2500) return json(res,400,{ok:false,error:'Please check the form and try again.'});
  const ip=getClientIp(req);
  if(requireTurnstile){
    const pass=await verifyTurnstile(input.turnstile_token,ip,turnstileSecret);
    if(!pass) return json(res,400,{ok:false,error:'We could not verify this submission. Please refresh and try again.'});
  }
  const checked=validateReferral(input);
  if(!checked.ok) return json(res,422,{ok:false,error:'Please check the highlighted information.',errors:checked.errors});
  try{
    const referral=await createReferral(checked.data,hashIp(ip));
    await Promise.allSettled([sendReferralReceipt(referral),notifyNewReferral(referral)]);
    return json(res,201,{ok:true,reference:referral.id});
  }catch(err){
    console.error('Referral save failed:',err?.message); // never log submitted data
    return json(res,500,{ok:false,error:'We could not save this submission safely. Nothing further has been sent. Please try again later.'});
  }
}
