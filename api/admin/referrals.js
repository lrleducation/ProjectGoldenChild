import { json,requireAdmin } from '../../lib/http.mjs';
import { bodyObject,queryObject } from '../../lib/request.mjs';
import { listReferrals,updateReferral,promoteReferralToHero,audit } from '../../lib/db.mjs';
const statuses=new Set(['new','contacted','awaiting-family','approved','declined','closed']);
export default async function handler(req,res){
  const s=requireAdmin(req,res); if(!s)return;
  try{
    if(req.method==='GET') return json(res,200,{ok:true,referrals:await listReferrals()});
    if(req.method==='PATCH'){
      const q=queryObject(req),body=bodyObject(req); if(!q.id)return json(res,400,{ok:false,error:'Missing referral id'});
      if(body.action==='promote'){
        const hero=await promoteReferralToHero(q.id); await audit(s.email,'referral_promoted','referral',q.id,{heroId:hero.id}); return json(res,200,{ok:true,hero});
      }
      if(!statuses.has(body.status))return json(res,422,{ok:false,error:'Invalid status'});
      const row=await updateReferral(q.id,{status:body.status}); await audit(s.email,'referral_status_changed','referral',q.id,{status:body.status}); return json(res,200,{ok:true,referral:row});
    }
    return json(res,405,{ok:false,error:'Method not allowed'});
  }catch(e){console.error('Admin referrals error',e?.message);return json(res,500,{ok:false,error:e?.message||'Could not update referral.'});}
}
