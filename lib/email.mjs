import { resendApiKey, fromEmail, notificationEmail } from './config.mjs';

async function send(payload){
  if(!resendApiKey) return {sent:false,reason:'email_not_configured'};
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendApiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!r.ok) throw new Error(`Email failed: ${r.status}`);
  return {sent:true};
}

export async function sendReferralReceipt(referral){
  const to=referral.route==='parent'?referral.submitter_email:referral.submitter_email;
  const name=referral.submitter_name || 'there';
  return send({from:fromEmail,to:[to],subject:"We've received your Project Golden Child submission",html:`<p>Hi ${escapeHtml(name)},</p><p>Thank you. We have received your ${referral.route==='parent'?"Harper's Heroes registration":"family referral"}. We will review it carefully and contact you if we need anything else.</p><p>We do not publish a child's information because they have been registered. Any future photography or story sharing is handled separately.</p><p>Project Golden Child</p>`});
}

export async function notifyNewReferral(referral){
  if(!notificationEmail) return {sent:false,reason:'notification_email_not_configured'};
  return send({from:fromEmail,to:[notificationEmail],subject:`New ${referral.route==='parent'?'Harper\'s Heroes registration':'family referral'}`,html:`<p>A new submission has been received.</p><p>Reference: ${escapeHtml(referral.id)}</p><p>Review it in the secure admin area. Sensitive details are not included in this email.</p>`});
}

export function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

export async function notifyContactMessage(message){
  if(!notificationEmail) return {sent:false,reason:'notification_email_not_configured'};
  return send({from:fromEmail,to:[notificationEmail],reply_to:message.email,subject:`Project Golden Child contact: ${escapeHtml(message.subject||'Website enquiry')}`,html:`<p><strong>From:</strong> ${escapeHtml(message.name)} (${escapeHtml(message.email)})</p><p>${escapeHtml(message.message).replace(/\n/g,'<br>')}</p><p>Reference: ${escapeHtml(message.id)}</p>`});
}
