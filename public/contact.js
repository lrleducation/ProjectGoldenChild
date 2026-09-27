(() => {
  const form = document.querySelector('#contact-form') || document.querySelector('form');
  if (!form) return;
  const error = document.querySelector('#contact-error') || document.querySelector('.error-box');
  const show = (msg, ok=false) => {
    if (!error) return;
    error.hidden = false;
    error.textContent = msg;
    error.classList.toggle('success-box', ok);
  };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      website: fd.get('website') || '',
      name: fd.get('name') || document.querySelector('#contact_name')?.value || '',
      email: fd.get('email') || document.querySelector('#contact_email')?.value || '',
      subject: fd.get('subject') || document.querySelector('#contact_subject')?.value || '',
      message: fd.get('message') || document.querySelector('#contact_message')?.value || ''
    };
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const data = await window.PGCSubmission.post('/api/contact', payload, {retries:1});
      form.reset(); show('Thank you. Your message has been sent to Project Golden Child.', true);
    } catch (err) { show(err.message || 'Could not send your message.'); }
    finally { if (button) button.disabled = false; }
  });
})();
