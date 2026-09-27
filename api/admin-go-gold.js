const { json, readBody, cleanText } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');
const { audit } = require('../lib/audit');

module.exports = async function(req,res){
  const user = requireAdmin(req,res);
  if(!user) return;

  try {
    if(req.method === 'GET') {
      return json(res,200,{items:await store.list('go_gold_registrations',{order:'created_at.desc'})});
    }

    if(req.method === 'POST') {
      const b = await readBody(req);
      const item = await store.update('go_gold_registrations',cleanText(b.id,80),{
        status:cleanText(b.status,40),
        admin_notes:cleanText(b.admin_notes,2500)
      });
      if(!item) return json(res,404,{message:'Registration not found.'});
      await audit(user,'update','go_gold_registration',b.id);
      return json(res,200,{item});
    }

    if(req.method === 'DELETE') {
      const url = new URL(req.url,'http://local');
      const id = cleanText(url.searchParams.get('id'),80);
      const existing = await store.get('go_gold_registrations',id);
      if(!existing) return json(res,404,{message:'Registration not found.'});
      await audit(user,'delete','go_gold_registration',id,{organisation_name:existing.organisation_name});
      await store.remove('go_gold_registrations',id);
      return json(res,200,{ok:true});
    }

    return json(res,405,{message:'Method not allowed.'});
  } catch(err) {
    console.error(err);
    return json(res,503,{message:'Go Gold data is unavailable.'});
  }
};
