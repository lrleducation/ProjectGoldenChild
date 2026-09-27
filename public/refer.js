(() => {
  const form = document.querySelector('#hero-referral');
  if (!form) return;
  const sections = [...form.querySelectorAll('.form-section')];
  const progress = [...document.querySelectorAll('.progress-item')];
  const routeInput = document.querySelector('#route-value');
  const started = document.querySelector('#form-started-at');
  const next = document.querySelector('#next-step');
  const back = document.querySelector('#back-step');
  const submit = document.querySelector('#submit-referral');
  const errors = document.querySelector('#form-errors');
  const service = document.querySelector('#service-message');
  let step = 1;
  if (started) started.value = String(Date.now());

  const setRequired = () => {
    const route = routeInput.value;
    form.querySelectorAll('[data-parent-only] input, [data-parent-only] select, [data-parent-only] textarea').forEach(el => {
      if (el.dataset.originalRequired === undefined) el.dataset.originalRequired = el.required ? '1' : '0';
      el.required = route === 'parent' && el.dataset.originalRequired === '1';
    });
    form.querySelectorAll('[data-referrer-only] input, [data-referrer-only] select, [data-referrer-only] textarea').forEach(el => {
      if (el.dataset.originalRequired === undefined) el.dataset.originalRequired = el.required ? '1' : '0';
      el.required = route === 'referrer' && el.dataset.originalRequired === '1';
    });
  };

  const applyRoute = route => {
    routeInput.value = route;
    document.querySelectorAll('.route-card').forEach(b => b.classList.toggle('selected', b.dataset.route === route));
    document.querySelectorAll('[data-parent-only]').forEach(el => { el.hidden = route !== 'parent'; });
    document.querySelectorAll('[data-referrer-only]').forEach(el => { el.hidden = route !== 'referrer'; });
    setRequired();
  };

  document.querySelectorAll('.route-card').forEach(btn => btn.addEventListener('click', () => applyRoute(btn.dataset.route)));

  const showStep = n => {
    step = Math.max(1, Math.min(4, n));
    sections.forEach(s => s.classList.toggle('active', Number(s.dataset.step) === step));
    progress.forEach((p,i) => p.classList.toggle('active', i + 1 <= step));
    back.hidden = step === 1;
    next.hidden = step === 4;
    submit.hidden = step !== 4;
    errors.hidden = true;
    sections.find(s => Number(s.dataset.step) === step)?.scrollIntoView({behavior:'smooth',block:'start'});
  };

  const validateCurrent = () => {
    const current = sections.find(s => Number(s.dataset.step) === step);
    const visibleControls = [...current.querySelectorAll('input,select,textarea')].filter(el => !el.closest('[hidden]'));
    for (const el of visibleControls) {
      if (!el.checkValidity()) { el.reportValidity(); return false; }
    }
    return true;
  };

  next.addEventListener('click', () => { if (validateCurrent()) showStep(step + 1); });
  back.addEventListener('click', () => showStep(step - 1));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateCurrent()) return;
    const fd = new FormData(form);
    const route = routeInput.value;
    const payload = Object.fromEntries(fd.entries());
    payload.route = route;
    payload.form_started_at = started.value;
    payload.website = fd.get('website') || '';
    ['consent_heroes','consent_health','consent_recognition','consent_events','consent_updates','consent_media_interest','privacy_accepted','family_aware'].forEach(k => payload[k] = fd.get(k) === 'on');
    if (route === 'referrer') {
      payload.referrer_name = document.querySelector('#ref_name').value;
      payload.referrer_relationship = document.querySelector('#ref_relationship').value;
      payload.referrer_email = document.querySelector('#ref_email').value;
      payload.referrer_phone = document.querySelector('#ref_phone').value;
      payload.child_name = document.querySelector('#ref_child_name').value;
    }
    submit.disabled = true;
    try {
      const data = await window.PGCSubmission.post('/api/referrals', payload, {retries:2,submissionKey:`referral:${route}`});
      sections.forEach(s => s.hidden = true);
      form.querySelector('.form-actions').hidden = true;
      service.hidden = false;
      service.innerHTML = `<strong>Thank you.</strong><br>Your submission has been received securely. Reference: <strong>${data.reference || ''}</strong>`;
      form.scrollIntoView({behavior:'smooth',block:'start'});
    } catch (err) {
      errors.hidden = false; errors.textContent = err.message || 'We could not save the registration.';
    } finally { submit.disabled = false; }
  });

  applyRoute('parent'); showStep(1);
})();
