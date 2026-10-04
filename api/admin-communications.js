const crypto = require('node:crypto');
const { json, readBody, cleanText, isEmail, bool } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');
const { sendEmail, sendBatchEmails, configured:emailConfigured, normaliseRecipients } = require('../lib/email');
const { createSignedDownloadUrl } = require('../lib/supabase-storage');
const { audit } = require('../lib/audit');

const ATTACHMENT_BUCKET='communication-attachments';
const MAX_ATTACHMENT_BYTES=10*1024*1024;
const ALLOWED_ATTACHMENT_TYPES=new Set(['image/jpeg','image/png','image/webp','application/pdf']);

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

function attachmentMeta(body={}){
  const path=cleanText(body.attachment_path,500);
  if(!path) return null;
  if(!/^communications\/[a-zA-Z0-9._\/-]+$/.test(path)) throw new Error('INVALID_ATTACHMENT_PATH');
  const name=cleanText(body.attachment_name,180) || 'Project-Golden-Child-poster';
  const mime=cleanText(body.attachment_mime_type,120).toLowerCase();
  const size=Number(body.attachment_size || 0);
  if(!ALLOWED_ATTACHMENT_TYPES.has(mime)) throw new Error('INVALID_ATTACHMENT_TYPE');
  if(!Number.isFinite(size) || size<=0 || size>MAX_ATTACHMENT_BYTES) throw new Error('INVALID_ATTACHMENT_SIZE');
  return {path,name,mime,size};
}

async function resendAttachment(meta){
  if(!meta) return [];
  const signed=await createSignedDownloadUrl(ATTACHMENT_BUCKET,meta.path,{expiresIn:3600});
  return [{filename:meta.name,path:signed.signedUrl,contentType:meta.mime}];
}

function communicationHtml(notes,footer=''){
  const escape=value=>String(value||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const paragraphs=String(notes||'').split(/\n{2,}/).map(p=>`<p>${escape(p).replace(/\n/g,'<br>')}</p>`).join('');
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#30261d;line-height:1.6"><div style="max-width:680px;margin:0 auto;padding:24px"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a06a08;margin-bottom:14px">Project Golden Child</div>${paragraphs}${footer?`<p style="margin-top:28px;color:#776b61;font-size:12px">${escape(footer)}</p>`:''}<p style="${footer?'':'margin-top:28px;'}color:#776b61;font-size:12px">Project Golden Child · Awareness · Recognition · Community</p></div></body></html>`;
}

async function createLog(user,b,{sendStatus='logged',providerMessageId=null,errorText=null,sentAt=null,batchId=null,attachment=null}={}){
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
    follow_up_completed_at:null,
    attachment_name:attachment?.name || null,
    attachment_path:attachment?.path || null,
    attachment_mime_type:attachment?.mime || null,
    attachment_size:attachment?.size || null
  });
}

function purposeConfig(value){
  const purpose=cleanText(value,40);
  const configs={
    updates:{consent:'consent_updates',label:'Project Golden Child updates',footer:'You are receiving this because your family chose to receive Project Golden Child updates.'},
    events:{consent:'consent_events',label:'event invitations',footer:'You are receiving this because your family chose to receive Project Golden Child event invitations.'},
    recognition:{consent:'consent_recognition',label:'Harper’s Heroes recognition',footer:'You are receiving this as part of Harper’s Heroes recognition and support.'},
    service:{consent:null,label:'essential family/service communication',footer:'This is an administrative or family-support communication from Project Golden Child.'}
  };
  return configs[purpose] ? {key:purpose,...configs[purpose]} : null;
}

function heroName(hero){
  return hero.preferred_name || hero.child_name || 'Child';
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

      if(b.action === 'attachment-url') {
        const id=cleanText(b.id,80);
        if(!id) return json(res,400,{message:'Missing communication id.'});
        const existing=await store.get('communications',id);
        if(!existing || !existing.attachment_path) return json(res,404,{message:'Attachment not found.'});
        const signed=await createSignedDownloadUrl(ATTACHMENT_BUCKET,existing.attachment_path,{expiresIn:600});
        await audit(user,'view_attachment','communication',id,{attachment_name:existing.attachment_name});
        return json(res,200,{url:signed.signedUrl,name:existing.attachment_name || 'attachment'});
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

        let attachment;
        try{ attachment=attachmentMeta(b); }
        catch{ return json(res,400,{message:'The selected poster attachment is invalid. Remove it and upload it again.'}); }
        const attachments=await resendAttachment(attachment);
        const draft=await createLog(user,{...b,direction:'outbound',method:'Email',contact_email:email},{sendStatus:'sending',attachment});
        try{
          const sent=await sendEmail({
            to:email,
            subject,
            text:notes,
            html:communicationHtml(notes),
            replyTo:process.env.REPLY_TO_EMAIL || process.env.NOTIFICATION_EMAIL,
            tags:[{name:'category',value:'pgc_communication'}],
            attachments
          });
          const item=await store.update('communications',draft.id,{send_status:'sent',provider_message_id:sent.id||null,sent_at:new Date().toISOString(),error_text:null,occurred_at:new Date().toISOString()});
          await audit(user,'send','communication',draft.id,{to:email,hero_id:draft.hero_id,referral_id:draft.referral_id,attachment:Boolean(attachment)});
          return json(res,200,{item});
        }catch(err){
          const item=await store.update('communications',draft.id,{send_status:'failed',error_text:String(err.message||err).slice(0,1000)});
          await audit(user,'send_failed','communication',draft.id,{to:email,error:String(err.message||err).slice(0,500)});
          return json(res,502,{message:'The email could not be sent. The failed attempt has been retained in the communication history.',item});
        }
      }

      if(b.action === 'send-bulk') {
        if(!bool(b.recipient_verified) || !bool(b.sharing_necessary)) return json(res,400,{message:'Confirm the audience and information-sharing checks before sending.'});
        if(!emailConfigured()) return json(res,503,{message:'Email sending is not configured. Add RESEND_API_KEY and FROM_EMAIL in Vercel.'});
        const purpose=purposeConfig(b.purpose || b.audience);
        if(!purpose) return json(res,400,{message:'Choose a valid communication purpose.'});
        if(purpose.key==='service' && !bool(b.service_message_confirmed)) return json(res,400,{message:'Confirm that an essential/service communication is not being used for promotional or event marketing.'});

        const subject=cleanText(b.subject,300),notes=cleanText(b.notes,20000);
        if(!subject || !notes) return json(res,400,{message:'Subject and message are required.'});

        let attachment;
        try{ attachment=attachmentMeta(b); }
        catch{ return json(res,400,{message:'The selected poster attachment is invalid. Remove it and upload it again.'}); }
        const attachments=await resendAttachment(attachment);

        const rawIds=Array.isArray(b.hero_ids)?b.hero_ids:[];
        const selectedIds=new Set(rawIds.map(id=>cleanText(id,80)).filter(Boolean));
        if(!selectedIds.size) return json(res,400,{message:'Select at least one child before sending.'});

        const heroes=await store.list('heroes',{order:'created_at.asc'});
        const selected=[];
        const skipped=[];
        for(const hero of heroes){
          if(!selectedIds.has(hero.id)) continue;
          if(hero.status==='archived') { skipped.push({id:hero.id,name:heroName(hero),reason:'archived'}); continue; }
          if(purpose.consent && !hero[purpose.consent]) { skipped.push({id:hero.id,name:heroName(hero),reason:'consent'}); continue; }
          const email=normaliseRecipients(hero.primary_contact_email)[0];
          if(!email) { skipped.push({id:hero.id,name:heroName(hero),reason:'email'}); continue; }
          selected.push({hero,email});
        }
        if(!selected.length) return json(res,400,{message:'None of the selected children currently have an eligible family email for this communication purpose.'});

        const byEmail=new Map();
        for(const row of selected){
          if(!byEmail.has(row.email)) byEmail.set(row.email,[]);
          byEmail.get(row.email).push(row.hero);
        }
        if(byEmail.size>100) return json(res,400,{message:'This selection contains more than 100 family email addresses. Split the send into smaller groups before continuing.'});

        const batchId=crypto.randomUUID();
        const preferenceFooter=purpose.footer + ' If you would like us to change your communication preferences, reply to this email or contact Project Golden Child.';
        const deliveries=[...byEmail.entries()].map(([email])=>({
          to:email,
          subject,
          text:`${notes}\n\n${preferenceFooter}`,
          html:communicationHtml(notes,preferenceFooter),
          replyTo:process.env.REPLY_TO_EMAIL || process.env.NOTIFICATION_EMAIL,
          tags:[{name:'category',value:'pgc_group'}],
          attachments
        }));

        const now=new Date().toISOString();
        let result;
        try{
          result=await sendBatchEmails(deliveries);
        }catch(err){
          const errorText=String(err.message||err).slice(0,1000);
          for(const {hero,email} of selected){
            await createLog(user,{hero_id:hero.id,direction:'outbound',method:'Email',contact_name:hero.primary_contact_name,contact_email:email,subject,notes,outcome:`Group ${purpose.label} communication`,occurred_at:now},{sendStatus:'failed',errorText,batchId,attachment});
          }
          await audit(user,'send_bulk_failed','communication_batch',batchId,{purpose:purpose.key,children:selected.length,recipients:byEmail.size,error:errorText.slice(0,500)});
          return json(res,502,{message:'The group email could not be sent. Failed attempts have been retained in the communication history.'});
        }

        const providerRows=Array.isArray(result.data)?result.data:[];
        const providerByEmail=new Map();
        [...byEmail.keys()].forEach((email,index)=>providerByEmail.set(email,providerRows[index]?.id||null));
        const logs=[];
        for(const {hero,email} of selected){
          logs.push(await createLog(user,{hero_id:hero.id,direction:'outbound',method:'Email',contact_name:hero.primary_contact_name,contact_email:email,subject,notes,outcome:`Group ${purpose.label} communication`,occurred_at:now},{sendStatus:'sent',providerMessageId:providerByEmail.get(email),sentAt:now,batchId,attachment}));
        }
        await audit(user,'send_bulk','communication_batch',batchId,{purpose:purpose.key,children:logs.length,recipients:byEmail.size,skipped:skipped.length,attachment:Boolean(attachment)});
        return json(res,200,{ok:true,count:byEmail.size,childCount:logs.length,skipped,batchId});
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
