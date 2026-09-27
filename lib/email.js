async function sendEmail({ subject, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  const to = process.env.NOTIFICATION_EMAIL;
  if (!apiKey || !from || !to) return { sent:false, reason:'not-configured' };
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ from, to:[to], subject, text, ...(replyTo ? {reply_to:replyTo} : {}) })
  });
  if (!response.ok) throw new Error(`EMAIL_${response.status}_${await response.text()}`);
  return { sent:true };
}
module.exports = { sendEmail };
