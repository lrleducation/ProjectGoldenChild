import { json } from '../lib/http.mjs';
import { queryObject } from '../lib/request.mjs';
import { listPublicEvents } from '../lib/db.mjs';
export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,error:'Method not allowed'});
  try{
    const q=queryObject(req); const scope=['upcoming','past','all'].includes(q.scope)?q.scope:'all';
    const events=await listPublicEvents(scope);
    return json(res,200,{ok:true,events});
  }catch(err){ console.error('Events failed',err?.message); return json(res,500,{ok:false,error:'Events are temporarily unavailable.'}); }
}
