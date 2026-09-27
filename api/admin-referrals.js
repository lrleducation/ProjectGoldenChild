const { json, readBody, cleanText } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');
const { audit } = require('../lib/audit');

module.exports = async function(req,res){
  const user = requireAdmin(req,res);
  if(!user) return;

  try {
    if(req.method === 'GET') {
      return json(res,200,{
        items:await store.list('referrals',{order:'created_at.desc'})
      });
    }

    if(req.method === 'POST') {
      const b = await readBody(req);
      const id = cleanText(b.id,80);

      if(!id) return json(res,400,{message:'Missing referral id.'});

      if(b.action === 'update') {
        const patch = {};

        if(b.status !== undefined) patch.status = cleanText(b.status,40);
        if(b.admin_notes !== undefined) patch.admin_notes = cleanText(b.admin_notes,4000);
        if(b.contacted_at !== undefined) patch.contacted_at = cleanText(b.contacted_at,80) || null;

        const row = await store.update('referrals',id,patch);
        if(!row) return json(res,404,{message:'Referral not found.'});

        await audit(user,'update','referral',id,patch);
        return json(res,200,{item:row});
      }

      if(b.action === 'promote') {
        const ref = await store.get('referrals',id);
        if(!ref) return json(res,404,{message:'Referral not found.'});

        if(ref.route !== 'parent' || !ref.consent_heroes || !ref.consent_health) {
          return json(res,400,{
            message:'Only a consented parent/carer registration can be promoted directly.'
          });
        }

        const existing = (await store.list('heroes',{
          filters:{referral_id:id},
          limit:1
        }))[0];

        if(existing) return json(res,200,{item:existing});

        const hero = await store.insert('heroes',{
          referral_id:id,
          child_name:ref.child_name,
          preferred_name:ref.preferred_name,
          date_of_birth:ref.date_of_birth,
          postcode_prefix:ref.postcode_prefix,
          life_status:ref.life_status,
          cancer_type:ref.cancer_type,
          diagnosis_date_text:ref.diagnosis_date_text,
          journey_notes:ref.journey_notes,
          interests:ref.interests,
          primary_contact_name:ref.submitter_name,
          primary_contact_email:ref.submitter_email,
          primary_contact_phone:ref.submitter_phone,
          consent_recognition:Boolean(ref.consent_recognition),
          consent_events:Boolean(ref.consent_events),
          consent_updates:Boolean(ref.consent_updates),
          consent_media_interest:Boolean(ref.consent_media_interest),
          status:ref.life_status === 'The child has died' ? 'remembrance' : 'active'
        });

        await store.update('referrals',id,{status:'promoted'});
        await audit(user,'promote','referral',id,{hero_id:hero.id});

        return json(res,201,{item:hero});
      }

      return json(res,400,{message:'Unknown action.'});
    }

    return json(res,405,{message:'Method not allowed.'});
  } catch(err) {
    console.error('Admin referrals error',err);
    return json(res,503,{message:'Referral data is unavailable.'});
  }
};
