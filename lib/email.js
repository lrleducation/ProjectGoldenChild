function normaliseRecipients(value) {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  return [...new Set(list.map(x => String(x || '').trim().toLowerCase()).filter(x => /^\S+@\S+\.\S+$/.test(x)))];
}


function normaliseAttachments(value){
  const list=Array.isArray(value)?value:[];
  return list.slice(0,5).map(item=>{
    const filename=String(item?.filename || '').trim().slice(0,180);
    const path=String(item?.path || '').trim();
    const content=String(item?.content || '').trim();
    const contentType=String(item?.contentType || item?.content_type || '').trim().slice(0,120);
    if(!filename || (!path && !content)) return null;
    return {
      filename,
      ...(path?{path}:{}),
      ...(content?{content}:{}),
      ...(contentType?{content_type:contentType}:{})
    };
  }).filter(Boolean);
}

function configured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
}

async function resendRequest(path, { method='POST', body }={}) {
  const apiKey = process.env.RESEND_API_KEY;
  if(!apiKey) return { ok:false, reason:'not-configured' };
  const response = await fetch(`https://api.resend.com${path}`, {
    method,
    headers:{
      Authorization:`Bearer ${apiKey}`,
      ...(body !== undefined ? {'Content-Type':'application/json'} : {})
    },
    ...(body !== undefined ? { body:JSON.stringify(body) } : {})
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message:raw }; }
  if(!response.ok) {
    const message = data?.message || data?.error || raw || `HTTP ${response.status}`;
    throw new Error(`EMAIL_${response.status}_${String(message).slice(0,500)}`);
  }
  return { ok:true, data };
}

async function sendEmail({ to, subject, text, html, replyTo, scheduledAt, tags, attachments }={}) {
  const from = process.env.FROM_EMAIL;
  const recipients = normaliseRecipients(to && (Array.isArray(to) ? to.length : String(to).trim()) ? to : process.env.NOTIFICATION_EMAIL);
  if(!configured() || !from || !recipients.length) return { sent:false, reason:'not-configured' };

  const payload = {
    from,
    to:recipients,
    subject:String(subject || '').slice(0,300),
    ...(html ? { html:String(html) } : {}),
    ...(text ? { text:String(text) } : {}),
    ...(replyTo ? { reply_to:String(replyTo) } : {}),
    ...(scheduledAt ? { scheduled_at:String(scheduledAt) } : {}),
    ...(Array.isArray(tags) && tags.length ? { tags } : {}),
    ...(normaliseAttachments(attachments).length ? { attachments:normaliseAttachments(attachments) } : {})
  };

  if(!payload.text && !payload.html) payload.text = '';
  const result = await resendRequest('/emails',{body:payload});
  return { sent:true, id:result.data?.id || null, scheduled:Boolean(scheduledAt), recipients };
}

async function sendBatchEmails(messages=[]) {
  if(!configured()) return { sent:false, reason:'not-configured', data:[] };
  const from = process.env.FROM_EMAIL;
  const payload = messages.slice(0,100).map(message => ({
    from,
    to:normaliseRecipients(message.to),
    subject:String(message.subject || '').slice(0,300),
    ...(message.html ? { html:String(message.html) } : {}),
    ...(message.text ? { text:String(message.text) } : {}),
    ...(message.replyTo ? { reply_to:String(message.replyTo) } : {}),
    ...(Array.isArray(message.tags) && message.tags.length ? { tags:message.tags } : {}),
    ...(normaliseAttachments(message.attachments).length ? { attachments:normaliseAttachments(message.attachments) } : {})
  })).filter(message => message.to.length && (message.text || message.html));
  if(!payload.length) return { sent:false, reason:'no-recipients', data:[] };
  const result = await resendRequest('/emails/batch',{body:payload});
  return { sent:true, data:Array.isArray(result.data?.data) ? result.data.data : (Array.isArray(result.data) ? result.data : []) };
}

async function cancelScheduledEmail(id) {
  const emailId = String(id || '').trim();
  if(!configured() || !emailId) return { cancelled:false, reason:'not-configured' };
  await resendRequest(`/emails/${encodeURIComponent(emailId)}/cancel`,{method:'POST'});
  return { cancelled:true };
}

module.exports = { sendEmail, sendBatchEmails, cancelScheduledEmail, configured, normaliseRecipients, normaliseAttachments };
