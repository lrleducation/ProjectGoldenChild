import { json,requireAdmin } from '../../lib/http.mjs';
export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false});
  const s=requireAdmin(req,res); if(!s)return; return json(res,200,{ok:true,user:{email:s.email,name:s.name,role:s.role}});
}
