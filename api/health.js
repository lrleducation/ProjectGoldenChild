import { json } from '../lib/http.mjs';
import { productionReady, isProduction } from '../lib/config.mjs';
export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false});
  return json(res,200,{ok:true,environment:isProduction?'production':'development',productionReady:productionReady()});
}
