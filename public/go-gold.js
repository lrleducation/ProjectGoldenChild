(() => {
  const form = document.querySelector('#go-gold-form');
  if (!form) return;
  const error = document.querySelector('#gold-error');
  const show = (msg, ok=false) => { error.hidden=false; error.textContent=msg; error.classList.toggle('success-box',ok); };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      website: fd.get('website') || '',
      organisation_name: fd.get('organisation_name') || '',
      organisation_type: fd.get('organisation_type') || '',
      contact_name: fd.get('contact_name') || '',
      contact_email: fd.get('contact_email') || '',
      postcode: fd.get('postcode') || '',
      notes: fd.get('notes') || '',
      updates: fd.get('updates') === 'on'
    };
    const btn=form.querySelector('button[type="submit"]'); if(btn)btn.disabled=true;
    try{const data=await window.PGCSubmission.post('/api/go-gold',payload,{retries:1});form.reset();show('Thank you. We have recorded your interest in Go Gold.',true);}catch(err){show(err.message||'Could not save your registration.');}finally{if(btn)btn.disabled=false;}
  });
})();
