const crypto = require('node:crypto');
const { json, readBody, getIp, cleanText, bool, isEmail } = require('../lib/http');
const { rateLimit } = require('../lib/rate-limit');
const store = require('../lib/store');
const { sendEmail } = require('../lib/email');
const { audit } = require('../lib/audit');

const validId = value =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || ''));

module.exports = async function handler(req,res){
  if(req.method !== 'POST') return json(res,405,{message:'Method not allowed.'});

  const requestId = crypto.randomUUID().slice(0,8).toUpperCase();

  try {
    const b = await readBody(req);

    // Honeypot: bots get a quiet success without writing data.
    if(b.website) return json(res,200,{ok:true});

    const started = Number(b.form_started_at || 0);
    if(started && Date.now() - started < 1800) {
      return json(res,400,{message:'Please check the form and try again.'});
    }

    const route = b.route === 'referrer' ? 'referrer' : 'parent';

    if(!bool(b.privacy_accepted)) {
      return json(res,400,{message:'Please confirm that you have read the privacy information.'});
    }

    let row = {
      id: validId(b.submission_id) ? String(b.submission_id) : crypto.randomUUID(),
      route,
      status:'new',
      privacy_accepted:true
    };

    // If this is a retry of an already completed request, return success.
    const existing = await store.get('referrals',row.id);
    if(existing) {
      return json(res,200,{
        ok:true,
        reference:existing.id.slice(0,8).toUpperCase(),
        duplicate:true
      });
    }

    if(route === 'parent') {
      const required = [
        'submitter_name','submitter_relationship','submitter_email',
        'child_name','date_of_birth','life_status','cancer_type'
      ];

      for(const key of required) {
        if(!cleanText(b[key])) return json(res,400,{message:'Please complete all required fields.'});
      }

      if(!isEmail(b.submitter_email)) {
        return json(res,400,{message:'Please enter a valid email address.'});
      }

      if(!bool(b.consent_heroes) || !bool(b.consent_health)) {
        return json(res,400,{
          message:'The Harper’s Heroes and health-information consent boxes are required for a direct registration.'
        });
      }

      row = {
        ...row,
        submitter_name:cleanText(b.submitter_name,120),
        submitter_relationship:cleanText(b.submitter_relationship,120),
        submitter_email:cleanText(b.submitter_email,180),
        submitter_phone:cleanText(b.submitter_phone,60),
        child_name:cleanText(b.child_name,160),
        preferred_name:cleanText(b.preferred_name,100),
        date_of_birth:cleanText(b.date_of_birth,20) || null,
        postcode_prefix:cleanText(b.postcode_prefix,16).toUpperCase(),
        life_status:cleanText(b.life_status,120),
        cancer_type:cleanText(b.cancer_type,180),
        diagnosis_date_text:cleanText(b.diagnosis_date_text,100),
        journey_notes:cleanText(b.journey_notes,4000),
        interests:cleanText(b.interests,2500),
        consent_heroes:true,
        consent_health:true,
        consent_recognition:bool(b.consent_recognition),
        consent_events:bool(b.consent_events),
        consent_updates:bool(b.consent_updates),
        consent_media_interest:bool(b.consent_media_interest)
      };
    } else {
      const required = [
        'referrer_name','referrer_relationship','referrer_email',
        'child_name','family_contact_name'
      ];

      for(const key of required) {
        if(!cleanText(b[key])) {
          return json(res,400,{message:'Please complete all required referral fields.'});
        }
      }

      if(!isEmail(b.referrer_email)) {
        return json(res,400,{message:'Please enter a valid referrer email address.'});
      }

      if(!bool(b.family_aware)) {
        return json(res,400,{message:'Please confirm that the family knows about the referral.'});
      }

      if(cleanText(b.family_contact_email) && !isEmail(b.family_contact_email)) {
        return json(res,400,{message:'Please enter a valid family contact email address or leave it blank.'});
      }

      row = {
        ...row,
        referrer_name:cleanText(b.referrer_name,120),
        referrer_relationship:cleanText(b.referrer_relationship,160),
        referrer_email:cleanText(b.referrer_email,180),
        referrer_phone:cleanText(b.referrer_phone,60),
        child_name:cleanText(b.child_name,160),
        family_contact_name:cleanText(b.family_contact_name,160),
        family_contact_email:cleanText(b.family_contact_email,180),
        family_contact_phone:cleanText(b.family_contact_phone,60),
        family_aware:true,
        referral_reason:cleanText(b.referral_reason,1500)
      };
    }

    // Deliberately generous. This is only a backstop; the honeypot,
    // validation and idempotent submission ID are the primary controls.
    const rl = rateLimit(`referral:${route}:${getIp(req)}`,{
      limit:60,
      windowMs:15*60*1000
    });

    if(!rl.ok) {
      res.setHeader('Retry-After',String(rl.retryAfter || 60));
      return json(res,429,{
        message:'We have received an unusually high number of submissions from this connection. Please wait a few minutes and try again.',
        retryAfter:rl.retryAfter || 60
      });
    }

    const record = await store.insert('referrals',row);

    // Verify that the record can immediately be read back before telling
    // the family it was received.
    const verified = await store.get('referrals',record.id);
    if(!verified) throw new Error('REFERRAL_VERIFY_FAILED');

    audit(null,'create','referral',record.id,{route}).catch(err =>
      console.error(`[AUDIT ${requestId}]`,err.message)
    );

    sendEmail({
      subject:`New Project Golden Child ${route === 'parent' ? 'registration' : 'referral'} — ${record.id.slice(0,8)}`,
      text:`A new ${route} submission has been received.\nReference: ${record.id}\nPlease sign in to the secure admin area to review it.`,
      replyTo:route === 'parent' ? row.submitter_email : row.referrer_email
    }).catch(err => console.error(`[EMAIL ${requestId}]`,err.message));

    return json(res,201,{
      ok:true,
      reference:record.id.slice(0,8).toUpperCase()
    });
  } catch(err) {
    console.error(`[REFERRAL ${requestId}]`,err);
    return json(res,503,{
      message:`${store.publicFailure(err)} Support reference: ${requestId}`
    });
  }
};
