import { json,requireAdmin } from '../../lib/http.mjs';
import { getSummary } from '../../lib/db.mjs';
export default async function handler(req,res){if(req.method!=='GET')return json(res,405,{ok:false});const s=requireAdmin(req,res);if(!s)return;try{return json(res,200,{ok:true,summary:await getSummary()})}catch(e){console.error(e?.message);return json(res,500,{ok:false,error:'Could not load dashboard.'})}}
