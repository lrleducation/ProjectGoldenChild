const { json, readBody, cleanText } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');
const { audit } = require('../lib/audit');

function validDirection(value) {
  return ['inbound','outbound'].includes(value) ? value : 'outbound';
}

module.exports = async function(req,res){
  const user = requireAdmin(req,res);
  if(!user) return;

  try {
    if(req.method === 'GET') {
      const [items,heroes,referrals] = await Promise.all([
        store.list('communications',{order:'occurred_at.desc'}),
        store.list('heroes',{order:'created_at.desc'}),
        store.list('referrals',{order:'created_at.desc'})
      ]);

      const heroMap = new Map(heroes.map(x => [x.id,x]));
      const referralMap = new Map(referrals.map(x => [x.id,x]));

      const decorated = items.map(item => {
        const hero = item.hero_id ? heroMap.get(item.hero_id) : null;
        const referral = item.referral_id ? referralMap.get(item.referral_id) : null;
        return {
          ...item,
          linked_name:
            hero?.preferred_name ||
            hero?.child_name ||
            referral?.child_name ||
            '',
          linked_type: hero ? 'Harper’s Hero' : (referral ? 'Referral' : '')
        };
      });

      return json(res,200,{items:decorated,heroes,referrals});
    }

    if(req.method === 'POST') {
      const b = await readBody(req);

      if(b.action === 'update') {
        const id = cleanText(b.id,80);
        if(!id) return json(res,400,{message:'Missing communication id.'});

        const patch = {};
        for(const key of ['subject','notes','outcome','contact_name','contact_email','contact_phone']) {
          if(b[key] !== undefined) patch[key] = cleanText(b[key], key === 'notes' ? 5000 : 500);
        }
        if(b.follow_up_date !== undefined) patch.follow_up_date = cleanText(b.follow_up_date,30) || null;

        const item = await store.update('communications',id,patch);
        if(!item) return json(res,404,{message:'Communication entry not found.'});
        await audit(user,'update','communication',id,patch);
        return json(res,200,{item});
      }

      const method = cleanText(b.method,60);
      const subject = cleanText(b.subject,300);
      const notes = cleanText(b.notes,5000);

      if(!method || !subject || !notes) {
        return json(res,400,{message:'Method, subject and notes are required.'});
      }

      const item = await store.insert('communications',{
        hero_id:cleanText(b.hero_id,80) || null,
        referral_id:cleanText(b.referral_id,80) || null,
        direction:validDirection(cleanText(b.direction,20)),
        method,
        contact_name:cleanText(b.contact_name,180),
        contact_email:cleanText(b.contact_email,180),
        contact_phone:cleanText(b.contact_phone,80),
        subject,
        notes,
        outcome:cleanText(b.outcome,2000),
        occurred_at:cleanText(b.occurred_at,80) || new Date().toISOString(),
        follow_up_date:cleanText(b.follow_up_date,30) || null,
        created_by:user.email
      });

      await audit(user,'create','communication',item.id,{
        hero_id:item.hero_id,
        referral_id:item.referral_id,
        method:item.method
      });

      return json(res,201,{item});
    }

    if(req.method === 'DELETE') {
      const url = new URL(req.url,'http://local');
      const id = cleanText(url.searchParams.get('id'),80);
      if(!id) return json(res,400,{message:'Missing communication id.'});

      const existing = await store.get('communications',id);
      if(!existing) return json(res,404,{message:'Communication entry not found.'});

      await audit(user,'delete','communication',id,{
        subject:existing.subject,
        hero_id:existing.hero_id,
        referral_id:existing.referral_id
      });
      await store.remove('communications',id);
      return json(res,200,{ok:true});
    }

    return json(res,405,{message:'Method not allowed.'});
  } catch(err) {
    console.error('Admin communications error',err);
    return json(res,503,{message:'Communications are unavailable.'});
  }
};
