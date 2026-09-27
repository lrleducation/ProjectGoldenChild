const {json}=require('../lib/http'); const {requireAdmin}=require('../lib/security'); const store=require('../lib/store');
module.exports=async function(req,res){
 if(req.method!=='GET') return json(res,405,{message:'Method not allowed.'});
 if(!requireAdmin(req,res)) return;
 const tables=['referrals','heroes','hero_actions','events','event_gallery','go_gold_registrations','contacts','audit_log'];
 const checks={}; for(const table of tables) checks[table]=await store.probe(table);
 const ok=Object.values(checks).every(x=>x.ok);
 return json(res,ok?200:503,{ok,checks,configuration:{databaseConfigured:store.configured(),keyType:String(process.env.SUPABASE_SECRET_KEY||'').trim().startsWith('sb_secret_')?'secret':'legacy-or-missing',emailConfigured:Boolean(process.env.RESEND_API_KEY&&process.env.FROM_EMAIL&&process.env.NOTIFICATION_EMAIL)}});
};
