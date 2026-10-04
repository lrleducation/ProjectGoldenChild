const crypto = require('node:crypto');
const { json, readBody, cleanText, isEmail, bool } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');
const { sendEmail, sendBatchEmails, configured:emailConfigured, normaliseRecipients } = require('../lib/email');
const { audit } = require('../lib/audit');

function validDirection(value) {
  return ['inbound','outbound'].includes(value) ? value : 'outbound';
}

function decorate(items,heroes,referrals){
  const heroMap = new Map(heroes.map(x => [x.id,x]));
  const referralMap = new Map(referrals.map(x => [x.id,x]));
  return items.map(item => {
    const hero = item.hero_id ? heroMap.get(item.hero_id) : null;
    const referral = item.referral_id ? referralMap.get(item.referral_id) : null;
    return {
      ...item,
      linked_name: hero?.preferred_name || hero?.child_name || referral?.child_name || '',
      linked_type: hero ? 'Harper’s Hero' : (referral ? 'Referral' : '')
    };
  });
}

async function createLog(user,b,{sendStatus='logged',providerMessageId=null,errorText=null,sentAt=null,batchId=null}={}){
  return store.insert('communications',{
    hero_id:cleanText(b.hero_id,80) || null,
    referral_id:cleanText(b.referral_id,80) || null,
    direction:validDirection(cleanText(b.direction,20)),
    method:cleanText(b.method,60) || 'Email',
    contact_name:cleanText(b.contact_name,180),
    contact_email:cleanText(b.contact_email,180),
    contact_phone:cleanText(b.contact_phone,80),
    subject:cleanText(b.subject,300),
    notes:cleanText(b.notes,20000),
    outcome:cleanText(b.outcome,2000),
    occurred_at:cleanText(b.occurred_at,80) || new Date().toISOString(),
    follow_up_date:cleanText(b.follow_up_date,30) || null,
    created_by:user.email,
    send_status:sendStatus,
    provider_message_id:providerMessageId,
    error_text:errorText,
    sent_at:sentAt,
    send_batch_id:batchId,
    follow_up_completed_at:null
  });
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
      return json(res,200,{items:decorate(items,heroes,referrals),heroes,referrals,emailConfigured:emailConfigured()});
    }

    if(req.method === 'POST') {
      const b = await readBody(req);

      if(b.action === 'complete-follow-up') {
        const id = cleanText(b.id,80);
        if(!id) return json(res,400,{message:'Missing communication id.'});
        const existing = await store.get('communications',id);
        if(!existing) return json(res,404,{message:'Communication entry not found.'});
        const completedAt = new Date().toISOString();
        const item = await store.update('communications',id,{follow_up_completed_at:completedAt});
        await audit(user,'complete_follow_up','communication',id,{follow_up_date:existing.follow_up_date});
        return json(res,200,{item});
      }

      if(b.action === 'update') {
        const id = cleanText(b.id,80);
        if(!id) return json(res,400,{message:'Missing communication id.'});
        const patch = {};
        for(const key of ['subject','notes','outcome','contact_name','contact_email','contact_phone']) {
          if(b[key] !== undefined) patch[key] = cleanText(b[key], key === 'notes' ? 20000 : 500);
        }
        if(b.follow_up_date !== undefined) patch.follow_up_date = cleanText(b.follow_up_date,30) || null;
        const item = await store.update('communications',id,patch);
        if(!item) return json(res,404,{message:'Communication entry not found.'});
        await audit(user,'update','communication',id,patch);
        return json(res,200,{item});
      }

      if(b.action === 'send-email') {
        const email=cleanText(b.contact_email,180).toLowerCase();
        const subject=cleanText(b.subject,300);
        const notes=cleanText(b.notes,20000);
        if(!isEmail(email) || !subject || !notes) return json(res,400,{message:'A valid recipient email, subject and message are required.'});
        if(!bool(b.recipient_verified) || !bool(b.sharing_necessary)) return json(res,400,{message:'Confirm the recipient and information-sharing checks before sending.'});
        if(!emailConfigured()) return json(res,503,{message:'Email sending is not configured. Add RESEND_API_KEY and FROM_EMAIL in Vercel.'});

        const draft=await createLog(user,{...b,direction:'outbound',method:'Email',contact_email:email},{sendStatus:'sending'});
        try{
          const sent=await sendEmail({
            to:email,
            subject,
            text:notes,
            html:`<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#30261d;line-height:1.6"><div style="max-width:680px;margin:0 auto;padding:24px"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a06a08;margin-bottom:14px">Project Golden Child</div>${notes.split(/\n{2,}/).map(p=>`<p>${p.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])).replace(/\n/g,'<br>')}</p>`).join('')}<p style="margin-top:28px;color:#776b61;font-size:12px">Project Golden Child · Awareness · Recognition · Community</p></div></body></html>`,
            replyTo:process.env.REPLY_TO_EMAIL || process.env.NOTIFICATION_EMAIL,
            tags:[{name:'category',value:'pgc_communication'}]
          });
          const item=await store.update('communications',draft.id,{send_status:'sent',provider_message_id:sent.id||null,sent_at:new Date().toISOString(),error_text:null,occurred_at:new Date().toISOString()});
          await audit(user,'send','communication',draft.id,{to:email,hero_id:draft.hero_id,referral_id:draft.referral_id});
          return json(res,200,{item});
        }catch(err){
          const item=await store.update('communications',draft.id,{send_status:'failed',error_text:String(err.message||err).slice(0,1000)});
          await audit(user,'send_failed','communication',draft.id,{to:email,error:String(err.message||err).slice(0,500)});
          return json(res,502,{message:'The email could not be sent. The failed attempt has been retained in the communication history.',item});
        }
      }

      if(b.action === 'send-bulk') {
        if(!bool(b.recipient_verified) || !bool(b.sharing_necessary)) return json(res,400,{message:'Confirm the recipient and information-sharing checks before sending.'});
        if(!emailConfigured()) return json(res,503,{message:'Email sending is not configured. Add RESEND_API_KEY and FROM_EMAIL in Vercel.'});
        const audience=cleanText(b.audience,30);
        if(!['updates','events'].includes(audience)) return json(res,400,{message:'Choose a valid consented audience.'});
        const subject=cleanText(b.subject,300),notes=cleanText(b.notes,20000);
        if(!subject || !notes) return json(res,400,{message:'Subject and message are required.'});

        const heroes=await store.list('heroes',{order:'created_at.asc'});
        const consentKey=audience==='events'?'consent_events':'consent_updates';
        const selected=heroes.filter(h=>h.status!=='archived' && h[consentKey] && normaliseRecipients(h.primary_contact_email).length);
        const unique=[]; const seen=new Set();
        for(const hero of selected){
          const email=normaliseRecipients(hero.primary_contact_email)[0];
          const key=`${hero.id}:${email}`;
          if(seen.has(key)) continue; seen.add(key); unique.push({hero,email});
        }
        if(!unique.length) return json(res,400,{message:'No active Harper’s Heroes records have both this consent and a valid email address.'});
        if(unique.length>100) return json(res,400,{message:'This audience is larger than 100 recipients. Split the send into smaller groups before continuing.'});

        const batchId=crypto.randomUUID();
        const preferenceText=audience==='events'?'event invitations':'Project Golden Child updates';
        const footer=`You are receiving this because your family chose to receive ${preferenceText}. If you would like us to change this preference, reply to this email or contact Project Golden Child.`;
        const messages=unique.map(({email})=>({to:email,subject,text:`${notes}\n\n${footer}`,html:`<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#30261d;line-height:1.6"><div style="max-width:680px;margin:0 auto;padding:24px"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a06a08;margin-bottom:14px">Project Golden Child</div>${notes.split(/\n{2,}/).map(p=>`<p>${p.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])).replace(/\n/g,'<br>')}</p>`).join('')}<p style="margin-top:28px;color:#776b61;font-size:12px">${footer}</p><p style="color:#776b61;font-size:12px">Project Golden Child · Awareness · Recognition · Community</p></div></body></html>`,replyTo:process.env.REPLY_TO_EMAIL || process.env.NOTIFICATION_EMAIL,tags:[{name:'category',value:'pgc_bulk'}]}));
        const result=await sendBatchEmails(messages);
        const providerRows=Array.isArray(result.data)?result.data:[];
        const now=new Date().toISOString();
        const logs=[];
        for(let i=0;i<unique.length;i++){
          const {hero,email}=unique[i];
          logs.push(await createLog(user,{hero_id:hero.id,direction:'outbound',method:'Email',contact_name:hero.primary_contact_name,contact_email:email,subject,notes,outcome:`Bulk ${audience} communication`,occurred_at:now},{sendStatus:'sent',providerMessageId:providerRows[i]?.id||null,sentAt:now,batchId}));
        }
        await audit(user,'send_bulk','communication_batch',batchId,{audience,count:logs.length});
        return json(res,200,{ok:true,count:logs.length,batchId});
      }

      const method = cleanText(b.method,60);
      const subject = cleanText(b.subject,300);
      const notes = cleanText(b.notes,20000);
      if(!method || !subject || !notes) return json(res,400,{message:'Method, subject and notes are required.'});
      const item = await createLog(user,b);
      await audit(user,'create','communication',item.id,{hero_id:item.hero_id,referral_id:item.referral_id,method:item.method});
      return json(res,201,{item});
    }

    if(req.method === 'DELETE') {
      const url = new URL(req.url,'http://local');
      const id = cleanText(url.searchParams.get('id'),80);
      if(!id) return json(res,400,{message:'Missing communication id.'});
      const existing = await store.get('communications',id);
      if(!existing) return json(res,404,{message:'Communication entry not found.'});
      await audit(user,'delete','communication',id,{subject:existing.subject,hero_id:existing.hero_id,referral_id:existing.referral_id});
      await store.remove('communications',id);
      return json(res,200,{ok:true});
    }

    return json(res,405,{message:'Method not allowed.'});
  } catch(err) {
    console.error('Admin communications error',err);
    return json(res,503,{message:'Communications are unavailable.'});
  }
};
