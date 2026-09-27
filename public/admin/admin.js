(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = iso => iso ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)) : '—';
  const api = async (url, options={}) => {
    const opts={credentials:'same-origin',...options};
    if(opts.body && !(opts.body instanceof FormData) && typeof opts.body!=='string'){opts.headers={...(opts.headers||{}),'Content-Type':'application/json'};opts.body=JSON.stringify(opts.body);}
    const r=await fetch(url,opts); let data={}; try{data=await r.json();}catch{}
    if(r.status===401){
      // A 401 from the login endpoint means the credentials were rejected.
      // Do not mislabel that as an expired session.
      if(url==='/api/admin-login'){
        throw new Error(data.message||'Email, password or authenticator code is incorrect.');
      }
      showLogin();
      throw new Error(data.message||'Your session has ended. Please sign in again.');
    }
    if(!r.ok) throw new Error(data.message||`Request failed (${r.status})`); return data;
  };
  const showLogin=()=>{$('#admin-login').hidden=false;$('#admin-app').hidden=true;};
  const showApp=user=>{$('#admin-login').hidden=true;$('#admin-app').hidden=false;$('#admin-user').textContent=`${user.name} · ${user.role}`;loadSummary();loadDiagnostics();};
  const message=(el,msg)=>{el.hidden=false;el.textContent=msg;};

  async function boot(){
    try{const s=await api('/api/admin-session'); $('#local-login-note').hidden=!s.local; if(s.authenticated) showApp(s.user); else showLogin();}catch{showLogin();}
  }

  $('#login-form')?.addEventListener('submit',async e=>{
    e.preventDefault(); $('#login-error').hidden=true;
    try{const d=await api('/api/admin-login',{method:'POST',body:{email:$('#admin-email').value,password:$('#admin-password').value,otp:$('#admin-otp').value}});showApp(d.user);}catch(err){message($('#login-error'),err.message);}
  });
  $('#logout')?.addEventListener('click',async()=>{try{await api('/api/admin-logout',{method:'POST'});}finally{showLogin();}});

  $$('.admin-menu [data-admin-section]').forEach(btn=>btn.addEventListener('click',()=>{
    $$('.admin-menu [data-admin-section]').forEach(b=>b.classList.toggle('active',b===btn));
    $$('.admin-section').forEach(s=>s.classList.toggle('active',s.dataset.section===btn.dataset.adminSection));
    const key=btn.dataset.adminSection; if(key==='dashboard')loadSummary(); if(key==='referrals')loadReferrals(); if(key==='heroes')loadHeroes(); if(key==='events')loadEvents(); if(key==='go-gold')loadGoGold(); if(key==='contacts')loadContacts();
  }));
  $$('[data-refresh]').forEach(b=>b.addEventListener('click',()=>({referrals:loadReferrals,heroes:loadHeroes,events:loadEvents,'go-gold':loadGoGold,contacts:loadContacts}[b.dataset.refresh]?.())));


  async function loadDiagnostics(){
    const text=$('#system-health-text'), detail=$('#system-health-detail');
    if(!text)return;
    text.textContent='Checking database access…'; if(detail)detail.textContent='';
    try{
      const d=await api('/api/admin-diagnostics');
      text.textContent=d.ok?'All submission tables and required fields are ready.':'One or more database fields need attention before public submissions can be accepted.';
      text.style.color=d.ok?'#17633b':'#9d1d12';
      if(detail){
        const checks=Object.entries(d.checks||{}).map(([k,v])=>`${k}: ${v.ok?'OK':`${v.code||v.status||'error'} ${v.detail||''}`}`);
        checks.push(`email alerts: ${d.configuration?.emailConfigured?'configured':'not configured (database submissions still work)'}`);
        detail.textContent=checks.join(' · ');
      }
    }catch(err){text.textContent='Database check failed.';text.style.color='#9d1d12';if(detail)detail.textContent=err.message;}
  }
  $('#check-system-health')?.addEventListener('click',loadDiagnostics);

  async function loadSummary(){
    try{const d=await api('/api/admin-summary'); $('#sum-heroes').textContent=d.heroes;$('#sum-referrals').textContent=d.referrals;$('#sum-events').textContent=d.events;$('#sum-gold').textContent=d.gold;$('#sum-actions').textContent=d.actions;$('#ref-count').textContent=d.referrals?`(${d.referrals})`:'';}catch(err){console.error(err);}
  }

  async function loadReferrals(){
    const list=$('#referrals-list'); list.innerHTML='<div class="loading-card">Loading…</div>';
    try{const {items}=await api('/api/admin-referrals'); list.innerHTML=items.length?items.map(r=>`<article class="admin-item"><div class="admin-item-head"><div><strong>${esc(r.child_name||'Child')}</strong><div class="small">${esc(r.route==='parent'?'Parent/carer registration':'Third-party referral')} · ${esc(fmt(r.created_at))}</div></div><span class="status-pill">${esc(r.status||'new')}</span></div><div class="admin-item-grid"><div><b>Contact</b><br>${esc(r.submitter_name||r.family_contact_name||'—')}<br>${esc(r.submitter_email||r.family_contact_email||'')}</div><div><b>Situation</b><br>${esc(r.life_status||'Family referral')}<br>${esc(r.cancer_type||'')}</div></div>${r.route==='parent'?`<details><summary>View sensitive registration details</summary><p><b>Diagnosis timing:</b> ${esc(r.diagnosis_date_text||'—')}</p><p><b>Journey notes:</b> ${esc(r.journey_notes||'—')}</p><p><b>Interests:</b> ${esc(r.interests||'—')}</p><p><b>Consents:</b> recognition ${r.consent_recognition?'Yes':'No'}, events ${r.consent_events?'Yes':'No'}, updates ${r.consent_updates?'Yes':'No'}, media interest ${r.consent_media_interest?'Yes':'No'}</p></details>`:`<p><b>Referrer:</b> ${esc(r.referrer_name||'—')} (${esc(r.referrer_relationship||'')})</p><p><b>Reason:</b> ${esc(r.referral_reason||'—')}</p>`}<div class="admin-item-actions"><button class="btn btn-outline" data-ref-contact="${r.id}">Mark contacted</button>${r.route==='parent'&&r.consent_heroes&&r.consent_health&&r.status!=='promoted'?`<button class="btn btn-primary" data-ref-promote="${r.id}">Promote to Harper's Heroes</button>`:''}</div></article>`).join(''):'<div class="loading-card">No referrals yet.</div>';
      $$('[data-ref-contact]').forEach(b=>b.addEventListener('click',async()=>{await api('/api/admin-referrals',{method:'POST',body:{action:'update',id:b.dataset.refContact,status:'contacted',contacted_at:new Date().toISOString()}});loadReferrals();loadSummary();}));
      $$('[data-ref-promote]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Add this consented registration to the private Harper\'s Heroes register?'))return;await api('/api/admin-referrals',{method:'POST',body:{action:'promote',id:b.dataset.refPromote}});loadReferrals();loadSummary();}));
    }catch(err){list.innerHTML=`<div class="error-box">${esc(err.message)}</div>`;}
  }

  async function loadHeroes(){
    const list=$('#heroes-list'); list.innerHTML='<div class="loading-card">Loading…</div>';
    try{const {items}=await api('/api/admin-heroes'); list.innerHTML=items.length?items.map(h=>`<article class="admin-item"><div class="admin-item-head"><div><strong>${esc(h.preferred_name||h.child_name)}</strong><div class="small">${esc(h.life_status||'')} · added ${esc(fmt(h.created_at))}</div></div><span class="status-pill">${esc(h.status||'active')}</span></div><div class="admin-item-grid"><div><b>Primary contact</b><br>${esc(h.primary_contact_name||'—')}<br>${esc(h.primary_contact_email||'')}</div><div><b>Recognition preferences</b><br>Events: ${h.consent_events?'Yes':'No'} · Updates: ${h.consent_updates?'Yes':'No'}</div></div><details><summary>Private details</summary><p><b>Cancer type:</b> ${esc(h.cancer_type||'—')}</p><p><b>Interests:</b> ${esc(h.interests||'—')}</p></details><div class="hero-actions-list">${(h.actions||[]).map(a=>`<div class="action-row"><div><strong>${esc(a.title)}</strong><div class="small">${esc(a.action_type||'Recognition')} · ${a.due_date?`due ${esc(a.due_date)}`:'no due date'} · ${esc(a.status)}</div></div>${a.status!=='completed'?`<button class="link-button" data-complete-action="${a.id}">Complete</button>`:''}</div>`).join('')||'<div class="small">No recognition actions recorded.</div>'}</div><div class="admin-item-actions"><button class="btn btn-outline" data-add-action="${h.id}">Add recognition action</button></div></article>`).join(''):'<div class="loading-card">No Harper\'s Heroes records yet.</div>';
      $$('[data-add-action]').forEach(b=>b.addEventListener('click',async()=>{const title=prompt('What action do you want to add?');if(!title)return;const due=prompt('Due date (YYYY-MM-DD), or leave blank:')||'';await api('/api/admin-heroes',{method:'POST',body:{action:'add-action',hero_id:b.dataset.addAction,title,due_date:due,action_type:'Recognition'}});loadHeroes();loadSummary();}));
      $$('[data-complete-action]').forEach(b=>b.addEventListener('click',async()=>{await api('/api/admin-heroes',{method:'POST',body:{action:'complete-action',id:b.dataset.completeAction}});loadHeroes();loadSummary();}));
    }catch(err){list.innerHTML=`<div class="error-box">${esc(err.message)}</div>`;}
  }

  let eventCache=[];
  async function loadEvents(){
    const list=$('#events-list'); list.innerHTML='<div class="loading-card">Loading…</div>';
    try{const {items}=await api('/api/admin-events'); eventCache=items; list.innerHTML=items.length?items.map(e=>`<button class="admin-list-button" data-edit-event="${e.id}"><strong>${esc(e.title)}</strong><span>${esc(e.status)} · ${esc(fmt(e.start_at))}</span></button>`).join(''):'<div class="loading-card">No events yet.</div>'; $$('[data-edit-event]').forEach(b=>b.addEventListener('click',()=>openEvent(eventCache.find(e=>e.id===b.dataset.editEvent))));}catch(err){list.innerHTML=`<div class="error-box">${esc(err.message)}</div>`;}
  }
  const fields={id:'#event-id',title:'#event-title',start_at:'#event-start',end_at:'#event-end',location:'#event-location',category:'#event-category',status:'#event-status',max_places:'#event-max',summary:'#event-summary',body:'#event-body',children_attending:'#event-children',family_reach:'#event-family',value_support:'#event-value',booking_url:'#event-booking',public_image_url:'#event-image-url'};
  function openEvent(e={}){ $('#event-editor').hidden=false; $('#event-editor-title').textContent=e.id?'Edit event':'New event'; for(const [k,s] of Object.entries(fields)){const el=$(s);let v=e[k]??'';if((k==='start_at'||k==='end_at')&&v)v=String(v).slice(0,16);el.value=v;} $('#image-preview').innerHTML=e.public_image_url?`<img src="${esc(e.public_image_url)}" alt="">`:''; $('#gallery-preview').innerHTML=(e.gallery||[]).map(g=>`<img src="${esc(g.image_url)}" alt="">`).join(''); }
  $('#new-event')?.addEventListener('click',()=>openEvent({status:'draft',category:'Family experience',children_attending:0,family_reach:0,value_support:0}));
  $('#close-event-editor')?.addEventListener('click',()=>{$('#event-editor').hidden=true;});
  $('#event-editor')?.addEventListener('submit',async e=>{e.preventDefault();$('#event-error').hidden=true;const payload={};for(const[k,s]of Object.entries(fields))payload[k]=$(s).value;try{const d=await api('/api/admin-events',{method:'POST',body:payload});openEvent(d.item);await loadEvents();loadSummary();}catch(err){message($('#event-error'),err.message);}});
  const fileToBase64=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});
  $('#upload-event-image')?.addEventListener('click',async()=>{const f=$('#event-image-file').files[0],id=$('#event-id').value;if(!f||!id)return alert('Save the event first, then choose an image.');try{const d=await api('/api/admin-upload',{method:'POST',body:{event_id:id,kind:'hero',mime_type:f.type,base64:await fileToBase64(f)}});$('#event-image-url').value=d.url;$('#image-preview').innerHTML=`<img src="${esc(d.url)}" alt="">`;await loadEvents();}catch(err){alert(err.message);}});
  $('#upload-gallery')?.addEventListener('click',async()=>{const files=[...$('#event-gallery-files').files],id=$('#event-id').value;if(!files.length||!id)return alert('Save the event first, then choose photos.');for(const f of files){try{await api('/api/admin-upload',{method:'POST',body:{event_id:id,kind:'gallery',mime_type:f.type,base64:await fileToBase64(f)}});}catch(err){alert(`${f.name}: ${err.message}`);}}await loadEvents();openEvent(eventCache.find(e=>e.id===id)||{});});
  $('#generate-story')?.addEventListener('click',async()=>{try{const d=await api('/api/admin-event-draft',{method:'POST',body:{attendees:$('#ai-attendees').value,aim:$('#ai-aim').value,notes:$('#ai-notes').value}});$('#event-body').value=d.draft;}catch(err){message($('#event-error'),err.message);}});
  $('#dictate-notes')?.addEventListener('click',()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return alert('Dictation is not supported in this browser.');const r=new SR();r.lang='en-GB';r.interimResults=false;r.onstart=()=>{$('#dictation-state').textContent='Listening…';};r.onresult=e=>{$('#ai-notes').value+=($('#ai-notes').value?' ':'')+e.results[0][0].transcript;};r.onend=()=>{$('#dictation-state').textContent='';};r.start();});

  async function loadGoGold(){const list=$('#go-gold-list');list.innerHTML='<div class="loading-card">Loading…</div>';try{const{items}=await api('/api/admin-go-gold');list.innerHTML=items.length?items.map(x=>`<article class="admin-item"><div class="admin-item-head"><div><strong>${esc(x.organisation_name)}</strong><div class="small">${esc(x.organisation_type)} · ${esc(fmt(x.created_at))}</div></div><span class="status-pill">${esc(x.status||'new')}</span></div><p>${esc(x.contact_name)} · ${esc(x.contact_email)} · ${esc(x.postcode||'')}</p><p>${esc(x.notes||'')}</p></article>`).join(''):'<div class="loading-card">No registrations yet.</div>';}catch(err){list.innerHTML=`<div class="error-box">${esc(err.message)}</div>`;}}
  async function loadContacts(){const list=$('#contacts-list');list.innerHTML='<div class="loading-card">Loading…</div>';try{const{items}=await api('/api/admin-contacts');list.innerHTML=items.length?items.map(x=>`<article class="admin-item"><div class="admin-item-head"><div><strong>${esc(x.subject)}</strong><div class="small">${esc(x.name)} · ${esc(x.email)} · ${esc(fmt(x.created_at))}</div></div><span class="status-pill">${esc(x.status||'new')}</span></div><p>${esc(x.message)}</p><div class="admin-item-actions"><a class="btn btn-outline" href="mailto:${encodeURIComponent(x.email)}?subject=${encodeURIComponent(`Re: ${x.subject}`)}">Reply by email</a></div></article>`).join(''):'<div class="loading-card">No messages yet.</div>';}catch(err){list.innerHTML=`<div class="error-box">${esc(err.message)}</div>`;}}

  boot();
})();
