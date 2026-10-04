const { json, readBody, cleanText, bool } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');
const { audit } = require('../lib/audit');

module.exports = async function(req,res){
  const user = requireAdmin(req,res);
  if(!user) return;

  try {
    if(req.method === 'GET') {
      const [items,actions] = await Promise.all([
        store.list('heroes',{order:'created_at.desc'}),
        store.list('hero_actions',{order:'created_at.desc'})
      ]);
      return json(res,200,{
        items:items.map(hero => ({
          ...hero,
          actions:actions.filter(action => action.hero_id === hero.id)
        }))
      });
    }

    if(req.method === 'POST') {
      const b = await readBody(req);

      if(b.action === 'add-action') {
        const hero = await store.get('heroes',cleanText(b.hero_id,80));
        if(!hero) return json(res,404,{message:'Hero not found.'});

        const item = await store.insert('hero_actions',{
          hero_id:hero.id,
          action_type:cleanText(b.action_type || 'Recognition',100),
          title:cleanText(b.title,240),
          due_date:cleanText(b.due_date,30) || null,
          status:'open',
          notes:cleanText(b.notes,2000),
          value_gbp:Number(b.value_gbp || 0)
        });

        await audit(user,'create','hero_action',item.id,{hero_id:hero.id});
        return json(res,201,{item});
      }

      if(b.action === 'complete-action') {
        const id = cleanText(b.id,80);
        const item = await store.update('hero_actions',id,{
          status:'completed',
          completed_at:new Date().toISOString()
        });
        if(!item) return json(res,404,{message:'Action not found.'});
        await audit(user,'complete','hero_action',id);
        return json(res,200,{item});
      }

      if(b.action === 'update-hero') {
        const id = cleanText(b.id,80);
        const patch = {};
        for(const key of ['status','admin_notes','primary_contact_name','primary_contact_email','primary_contact_phone','address_line_1','address_line_2','town_city','county','postcode']) {
          if(b[key] !== undefined) {
            patch[key] = cleanText(b[key],key === 'admin_notes' ? 4000 : 180);
          }
        }
        for(const key of ['consent_recognition','consent_events','consent_updates','consent_media_interest']) {
          if(b[key] !== undefined) patch[key] = bool(b[key]);
        }
        const item = await store.update('heroes',id,patch);
        if(!item) return json(res,404,{message:'Hero not found.'});
        await audit(user,'update','hero',id,patch);
        return json(res,200,{item});
      }

      return json(res,400,{message:'Unknown action.'});
    }

    if(req.method === 'DELETE') {
      const url = new URL(req.url,'http://local');
      const kind = cleanText(url.searchParams.get('kind'),30) || 'hero';
      const id = cleanText(url.searchParams.get('id'),80);
      if(!id) return json(res,400,{message:'Missing id.'});

      if(kind === 'action') {
        const existing = await store.get('hero_actions',id);
        if(!existing) return json(res,404,{message:'Recognition action not found.'});
        await audit(user,'delete','hero_action',id,{title:existing.title,hero_id:existing.hero_id});
        await store.remove('hero_actions',id);
        return json(res,200,{ok:true});
      }

      const hero = await store.get('heroes',id);
      if(!hero) return json(res,404,{message:'Hero not found.'});
      await audit(user,'delete','hero',id,{child_name:hero.child_name});
      await store.remove('heroes',id);
      return json(res,200,{ok:true});
    }

    return json(res,405,{message:'Method not allowed.'});
  } catch(err) {
    console.error(err);
    return json(res,503,{message:'Harper’s Heroes data is unavailable.'});
  }
};
