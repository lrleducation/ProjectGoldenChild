const crypto = require('node:crypto');
const { json, readBody, getIp, cleanText, isEmail } = require('../lib/http');
const { rateLimit } = require('../lib/rate-limit');
const store = require('../lib/store');
const { sendEmail } = require('../lib/email');
const { audit } = require('../lib/audit');

const validId = value =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || ''));

module.exports = async function(req,res){
  if(req.method !== 'POST') return json(res,405,{message:'Method not allowed.'});

  const requestId = crypto.randomUUID().slice(0,8).toUpperCase();

  try {
    const b = await readBody(req);
    if(b.website) return json(res,200,{ok:true});

    if(!cleanText(b.name) || !isEmail(b.email) || !cleanText(b.subject) || !cleanText(b.message)) {
      return json(res,400,{message:'Please complete all required fields.'});
    }

    const id = validId(b.submission_id) ? String(b.submission_id) : crypto.randomUUID();
    const existing = await store.get('contacts',id);

    if(existing) {
      return json(res,200,{ok:true,reference:existing.id.slice(0,8).toUpperCase(),duplicate:true});
    }

    const rl = rateLimit(`contact:${getIp(req)}`,{limit:60,windowMs:15*60*1000});
    if(!rl.ok) {
      res.setHeader('Retry-After',String(rl.retryAfter || 60));
      return json(res,429,{
        message:'We have received an unusually high number of messages from this connection. Please wait a few minutes and try again.',
        retryAfter:rl.retryAfter || 60
      });
    }

    const row = {
      id,
      name:cleanText(b.name,120),
      email:cleanText(b.email,180),
      subject:cleanText(b.subject,160),
      message:cleanText(b.message,3500),
      status:'new'
    };

    const record = await store.insert('contacts',row);
    const verified = await store.get('contacts',record.id);
    if(!verified) throw new Error('CONTACT_VERIFY_FAILED');

    audit(null,'create','contact',record.id).catch(err =>
      console.error(`[AUDIT ${requestId}]`,err.message)
    );

    sendEmail({
      subject:`Project Golden Child enquiry — ${row.subject}`,
      text:`A new website message has been received.\nReference: ${record.id}\nName: ${row.name}\nEmail: ${row.email}\n\n${row.message}`,
      replyTo:row.email
    }).catch(err => console.error(`[EMAIL ${requestId}]`,err.message));

    return json(res,201,{ok:true,reference:record.id.slice(0,8).toUpperCase()});
  } catch(err) {
    console.error(`[CONTACT ${requestId}]`,err);
    return json(res,503,{
      message:`${store.publicFailure(err,'We could not send your message just now. Please try again later.')} Support reference: ${requestId}`
    });
  }
};
