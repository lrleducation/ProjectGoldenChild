import { json,requireAdmin } from '../../lib/http.mjs';
import { bodyObject,queryObject } from '../../lib/request.mjs';
import { listHeroActions,createHeroAction,updateHeroAction,audit } from '../../lib/db.mjs';
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const types=new Set(['welcome_pack','recognition','gift','meal','family_contact','event','other']);
export default async function handler(req,res){
  const s=requireAdmin(req,res);if(!s)return;const q=queryObject(req);
  try{
    if(req.method==='GET') return json(res,200,{ok:true,actions:await listHeroActions(clean(q.hero_id,120))});
    if(req.method==='POST'){
      const b=bodyObject(req);const data={hero_id:clean(b.hero_id,120),action_type:clean(b.action_type,40),title:clean(b.title,180),due_date:clean(b.due_date,20),notes:clean(b.notes,1500),value_provided:Math.max(0,Number(b.value_provided||0))};
      const errors=[];if(!data.hero_id)errors.push('Hero is required.');if(!types.has(data.action_type))errors.push('Choose a valid action type.');if(!data.title)errors.push('Add a short title for the action.');if(data.due_date&&!/^\d{4}-\d{2}-\d{2}$/.test(data.due_date))errors.push('Check the due date.');if(!Number.isFinite(data.value_provided))errors.push('Check the value provided.');
      if(errors.length)return json(res,422,{ok:false,error:'Please check the action.',errors});
      const row=await createHeroAction(data);await audit(s.email,'hero_action_created','hero',data.hero_id,{actionId:row.id,type:data.action_type,dueDate:data.due_date});return json(res,201,{ok:true,action:row});
    }
    if(req.method==='PATCH'){
      if(!q.id)return json(res,400,{ok:false,error:'Missing action id'});const b=bodyObject(req);const row=await updateHeroAction(q.id,{status:clean(b.status,20)});await audit(s.email,'hero_action_status_changed','hero_action',q.id,{status:row?.status||b.status});return json(res,200,{ok:true,action:row});
    }
    return json(res,405,{ok:false,error:'Method not allowed'});
  }catch(e){console.error('Hero action error',e?.message);return json(res,500,{ok:false,error:'Could not update the recognition record.'});}
}
