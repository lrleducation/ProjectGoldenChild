const form=document.querySelector('#hero-referral');
if(form){
  const state={step:1,route:'parent'};
  const sections=[...form.querySelectorAll('.form-section')];
  const progress=[...document.querySelectorAll('.progress-item')];
  const next=document.querySelector('#next-step'),back=document.querySelector('#back-step'),submit=document.querySelector('#submit-referral');
  const errorBox=document.querySelector('#form-errors');
  document.querySelector('#form-started-at').value=String(Date.now());
  const toggleRoute=route=>{
    state.route=route;document.querySelector('#route-value').value=route;
    form.querySelectorAll('.route-card').forEach(c=>c.classList.toggle('selected',c.dataset.route===route));
    form.querySelectorAll('[data-parent-only]').forEach(el=>el.hidden=route!=='parent');
    form.querySelectorAll('[data-referrer-only]').forEach(el=>el.hidden=route!=='referrer');
    const parentMap=[['submitter_name',true],['submitter_relationship',true],['submitter_email',true],['child_name',true],['date_of_birth',true],['life_status',true],['cancer_type',true]];
    parentMap.forEach(([id,required])=>{const el=document.getElementById(id);if(el)el.required=route==='parent'&&required});
    ['ref_name','ref_relationship','ref_email','ref_child_name','family_contact_name'].forEach(id=>{const el=document.getElementById(id);if(el)el.required=route==='referrer'});
  };
  form.querySelectorAll('.route-card').forEach(c=>c.addEventListener('click',()=>toggleRoute(c.dataset.route)));
  const update=()=>{
    sections.forEach((s,i)=>s.classList.toggle('active',i===state.step-1));
    progress.forEach((p,i)=>p.classList.toggle('active',i<=state.step-1));
    back.style.visibility=state.step===1?'hidden':'visible';
    next.hidden=state.step===4;submit.hidden=state.step!==4;
    errorBox.hidden=true;
    if(state.step>1) document.querySelector('.form-card').scrollIntoView({behavior:'smooth',block:'start'});
  };
  const stepValid=()=>{
    const visible=sections[state.step-1];
    const controls=[...visible.querySelectorAll('input,select,textarea')].filter(el=>!el.closest('[hidden]')&&!el.disabled);
    for(const el of controls){if(!el.checkValidity()){el.reportValidity();return false}}
    if(state.route==='referrer'&&state.step===3&&!document.querySelector('#family_aware').checked){document.querySelector('#family_aware').reportValidity();return false}
    return true;
  };
  next.addEventListener('click',()=>{if(stepValid()&&state.step<4){state.step++;update()}});
  back.addEventListener('click',()=>{if(state.step>1){state.step--;update()}});
  const val=id=>document.getElementById(id)?.value?.trim()||'';
  const buildPayload=()=>{
    if(state.route==='parent')return {route:'parent',form_started_at:Number(val('form-started-at')),website:form.elements.website.value,submitter_name:val('submitter_name'),submitter_relationship:val('submitter_relationship'),submitter_email:val('submitter_email'),submitter_phone:val('submitter_phone'),child_name:val('child_name'),preferred_name:val('preferred_name'),date_of_birth:val('date_of_birth'),postcode_prefix:val('postcode_prefix'),life_status:val('life_status'),cancer_type:val('cancer_type'),diagnosis_date_text:val('diagnosis_date_text'),journey_notes:val('journey_notes'),interests:val('interests'),privacy_accepted:form.elements.privacy_accepted.checked,consents:{heroes:form.elements.consent_heroes.checked,health:form.elements.consent_health.checked,recognition:form.elements.consent_recognition.checked,events:form.elements.consent_events.checked,updates:form.elements.consent_updates.checked,media_interest:form.elements.consent_media_interest.checked}};
    return {route:'referrer',form_started_at:Number(val('form-started-at')),website:form.elements.website.value,submitter_name:document.querySelector('[data-ref-name]').value.trim(),submitter_relationship:document.querySelector('[data-ref-relationship]').value.trim(),submitter_email:document.querySelector('[data-ref-email]').value.trim(),submitter_phone:document.querySelector('[data-ref-phone]').value.trim(),child_name:document.querySelector('[data-ref-child-name]').value.trim(),family_contact_name:val('family_contact_name'),family_contact_email:val('family_contact_email'),family_contact_phone:val('family_contact_phone'),family_aware:form.elements.family_aware.checked,referral_reason:val('referral_reason'),privacy_accepted:form.elements.privacy_accepted.checked};
  };
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!stepValid())return;submit.disabled=true;submit.textContent='Sending…';errorBox.hidden=true;
    try{
      const r=await fetch('/api/referrals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(buildPayload())});const data=await r.json();
      if(!r.ok)throw new Error((data.errors||[data.error]).filter(Boolean).join(' '));
      form.innerHTML=`<div class="success-box"><div class="success-mark">✓</div><span class="eyebrow">Received safely</span><h2 style="margin-top:10px">Thank you.</h2><p class="lead" style="margin:18px auto 0">${state.route==='parent'?"We have received this Harper's Heroes registration. We will review it carefully and contact you if we need anything else.":"We have received the referral. We will contact the family using the details provided and let them decide whether they want to register."}</p><p class="small" style="margin-top:18px">Reference: <strong>${data.reference}</strong></p><a class="btn btn-primary" href="/harpers-heroes" style="margin-top:28px">Back to Harper's Heroes</a></div>`;
    }catch(err){errorBox.textContent=err.message||'We could not send this safely. Please try again.';errorBox.hidden=false;submit.disabled=false;submit.textContent='Send securely';errorBox.scrollIntoView({behavior:'smooth',block:'center'});}
  });
  fetch('/api/health').then(r=>r.json()).then(data=>{if(data.environment==='production'&&!data.productionReady){const m=document.querySelector('#service-message');m.hidden=false;m.textContent='Harper\'s Heroes registrations are not open just yet. We are finishing the secure service before we collect family information.';submit.disabled=true;}}).catch(()=>{});
  toggleRoute('parent');update();
}
