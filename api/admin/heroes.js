import { json,requireAdmin } from '../../lib/http.mjs';
import { bodyObject,queryObject } from '../../lib/request.mjs';
import { listHeroes,updateHeroStatus,audit } from '../../lib/db.mjs';
const statuses=new Set(['active','remembered','paused','archived']);
export default async function handler(req,res){
  const s=requireAdmin(req,res);if(!s)return;
  try{
    if(req.method==='GET'){const heroes=await listHeroes();await audit(s.email,'heroes_list_viewed','heroes','',{count:heroes.length});return json(res,200,{ok:true,heroes});}
    if(req.method==='PATCH'){const q=queryObject(req),b=bodyObject(req);if(!q.id)return json(res,400,{ok:false,error:'Missing Hero id'});if(!statuses.has(String(b.status||'')))return json(res,422,{ok:false,error:'Invalid Hero status'});const hero=await updateHeroStatus(q.id,b.status);await audit(s.email,'hero_status_changed','hero',q.id,{status:b.status});return json(res,200,{ok:true,hero});}
    return json(res,405,{ok:false,error:'Method not allowed'});
  }catch(e){console.error('Hero admin error',e?.message);return json(res,500,{ok:false,error:'Could not update Harper\'s Heroes.'});}
}
