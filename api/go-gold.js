import { json } from '../lib/http.mjs';
import { bodyObject } from '../lib/request.mjs';
import { validateGoGold } from '../lib/validation.mjs';
import { createGoGoldPledge } from '../lib/db.mjs';
import { isProduction, productionReady } from '../lib/config.mjs';
export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
  if(isProduction && !productionReady()) return json(res,503,{ok:false,error:'Registrations are not open yet.'});
  const input=bodyObject(req); if(input.website) return json(res,200,{ok:true});
  const checked=validateGoGold(input); if(!checked.ok) return json(res,422,{ok:false,errors:checked.errors,error:'Please check the form.'});
  try{const row=await createGoGoldPledge(checked.data); return json(res,201,{ok:true,reference:row.id});}
  catch(err){console.error('Go Gold save failed',err?.message); return json(res,500,{ok:false,error:'We could not save your registration.'});}
}
