import { json,clearSessionCookie,requireAdmin } from '../../lib/http.mjs';
import { audit } from '../../lib/db.mjs';
export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false});
  const session=requireAdmin(req,res); if(!session) return;
  clearSessionCookie(res); await audit(session.email,'admin_logout','session','',{}); return json(res,200,{ok:true});
}
