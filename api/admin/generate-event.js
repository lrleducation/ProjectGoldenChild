import { json,requireAdmin } from '../../lib/http.mjs';
import { bodyObject } from '../../lib/request.mjs';
import { generateEventStory } from '../../lib/ai.mjs';
import { audit } from '../../lib/db.mjs';
export default async function handler(req,res){const s=requireAdmin(req,res);if(!s)return;if(req.method!=='POST')return json(res,405,{ok:false});try{const story=await generateEventStory(bodyObject(req));await audit(s.email,'event_story_generated','event','',{mode:story.mode});return json(res,200,{ok:true,story});}catch(e){console.error(e?.message);return json(res,500,{ok:false,error:'Could not generate the draft.'})}}
