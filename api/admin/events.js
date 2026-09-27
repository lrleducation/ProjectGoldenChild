import { json,requireAdmin } from '../../lib/http.mjs';
import { bodyObject,queryObject } from '../../lib/request.mjs';
import { listAdminEvents,saveEvent,audit } from '../../lib/db.mjs';
import { validateEvent } from '../../lib/validation.mjs';
export default async function handler(req,res){
  const s=requireAdmin(req,res);if(!s)return;
  try{
    if(req.method==='GET')return json(res,200,{ok:true,events:await listAdminEvents()});
    if(req.method==='POST' || req.method==='PATCH'){
      const q=queryObject(req),checked=validateEvent(bodyObject(req));if(!checked.ok)return json(res,422,{ok:false,error:'Please check the event.',errors:checked.errors});
      const row=await saveEvent(checked.data,req.method==='PATCH'?q.id:'');await audit(s.email,req.method==='POST'?'event_created':'event_updated','event',row.id,{status:row.status});return json(res,200,{ok:true,event:row});
    }
    return json(res,405,{ok:false});
  }catch(e){console.error('Admin event error',e?.message);return json(res,500,{ok:false,error:e?.message||'Could not save event.'});}
}
