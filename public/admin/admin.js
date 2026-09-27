(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const fmt = iso => iso
    ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))
    : '—';
  const localDateTime = iso => {
    const d = iso ? new Date(iso) : new Date();
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const api = async (url, options={}) => {
    const opts = { credentials:'same-origin', ...options };
    if(opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
      opts.headers = { ...(opts.headers || {}), 'Content-Type':'application/json' };
      opts.body = JSON.stringify(opts.body);
    }
    const response = await fetch(url,opts);
    let data = {};
    try { data = await response.json(); } catch {}

    if(response.status === 401) {
      if(url === '/api/admin-login') {
        throw new Error(data.message || 'Email, password or authenticator code is incorrect.');
      }
      showLogin();
      throw new Error(data.message || 'Your session has ended. Please sign in again.');
    }

    if(!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  };

  const showLogin = () => {
    $('#admin-login').hidden = false;
    $('#admin-app').hidden = true;
  };

  const showApp = user => {
    $('#admin-login').hidden = true;
    $('#admin-app').hidden = false;
    $('#admin-user').textContent = `${user.name} · ${user.role}`;
    loadSummary();
    loadDiagnostics();
  };

  const showMessage = (el,msg) => {
    if(!el) return;
    el.hidden = false;
    el.textContent = msg;
  };

  async function boot() {
    try {
      const session = await api('/api/admin-session');
      $('#local-login-note').hidden = !session.local;
      if(session.authenticated) showApp(session.user);
      else showLogin();
    } catch {
      showLogin();
    }
  }

  $('#login-form')?.addEventListener('submit',async event => {
    event.preventDefault();
    $('#login-error').hidden = true;
    try {
      const data = await api('/api/admin-login',{
        method:'POST',
        body:{
          email:$('#admin-email').value,
          password:$('#admin-password').value,
          otp:$('#admin-otp').value
        }
      });
      showApp(data.user);
    } catch(err) {
      showMessage($('#login-error'),err.message);
    }
  });

  $('#logout')?.addEventListener('click',async() => {
    try { await api('/api/admin-logout',{method:'POST'}); }
    finally { showLogin(); }
  });

  const loaders = {
    dashboard:loadSummary,
    referrals:loadReferrals,
    heroes:loadHeroes,
    communications:loadCommunications,
    events:loadEvents,
    'go-gold':loadGoGold,
    contacts:loadContacts
  };

  function activateSection(name) {
    const button = $(`.admin-menu [data-admin-section="${name}"]`);
    $$('.admin-menu [data-admin-section]').forEach(b => b.classList.toggle('active',b === button));
    $$('.admin-section').forEach(section => section.classList.toggle('active',section.dataset.section === name));
    loaders[name]?.();
  }

  $$('.admin-menu [data-admin-section]').forEach(button => {
    button.addEventListener('click',() => activateSection(button.dataset.adminSection));
  });

  $$('[data-refresh]').forEach(button => {
    button.addEventListener('click',() => loaders[button.dataset.refresh]?.());
  });

  async function loadDiagnostics() {
    const text = $('#system-health-text');
    const detail = $('#system-health-detail');
    if(!text) return;

    text.textContent = 'Checking database access…';
    if(detail) detail.textContent = '';

    try {
      const d = await api('/api/admin-diagnostics');
      text.textContent = d.ok
        ? `Database ready — schema ${d.schemaVersion}. Read and write checks passed.`
        : 'Database setup is incomplete. Public submissions should not be opened until every check passes.';
      text.style.color = d.ok ? '#17633b' : '#9d1d12';

      if(detail) {
        const checks = Object.entries(d.checks || {}).map(([key,value]) =>
          `${key}: ${value.ok ? 'OK' : `${value.code || value.status || 'error'} ${value.detail || ''}`}`
        );
        checks.push(`write test: ${d.write?.ok ? 'OK' : `${d.write?.code || d.write?.status || 'error'} ${d.write?.detail || ''}`}`);
        checks.push(`email alerts: ${d.configuration?.emailConfigured ? 'configured' : 'not configured (database submissions still save)'}`);
        detail.textContent = checks.join(' · ');
      }
    } catch(err) {
      text.textContent = 'Database check failed.';
      text.style.color = '#9d1d12';
      if(detail) detail.textContent = err.message;
    }
  }

  $('#check-system-health')?.addEventListener('click',loadDiagnostics);

  async function loadSummary() {
    try {
      const d = await api('/api/admin-summary');
      $('#sum-heroes').textContent = d.heroes;
      $('#sum-referrals').textContent = d.referrals;
      $('#sum-events').textContent = d.events;
      $('#sum-gold').textContent = d.gold;
      $('#sum-actions').textContent = d.actions;
      $('#sum-comms').textContent = d.communications;
      $('#ref-count').textContent = d.referrals ? `(${d.referrals})` : '';
    } catch(err) {
      console.error(err);
    }
  }

  async function deleteRecord({url,label,after}) {
    if(!confirm(`Delete ${label}? This permanently removes the entry from the active database.`)) return;
    if(!confirm('This cannot be undone from the website. Delete it now?')) return;
    try {
      await api(url,{method:'DELETE'});
      await after?.();
      loadSummary();
    } catch(err) {
      alert(err.message);
    }
  }

  // ------------------------------------------------------------
  // Referrals
  // ------------------------------------------------------------
  async function loadReferrals() {
    const list = $('#referrals-list');
    list.innerHTML = '<div class="loading-card">Loading…</div>';

    try {
      const {items} = await api('/api/admin-referrals');
      list.innerHTML = items.length ? items.map(r => `
        <article class="admin-item">
          <div class="admin-item-head">
            <div>
              <strong>${esc(r.child_name || 'Child')}</strong>
              <div class="small">${esc(r.route === 'parent' ? 'Parent/carer registration' : 'Third-party referral')} · ${esc(fmt(r.created_at))}</div>
            </div>
            <span class="status-pill">${esc(r.status || 'new')}</span>
          </div>
          <div class="admin-item-grid">
            <div><b>Contact</b><br>${esc(r.submitter_name || r.family_contact_name || '—')}<br>${esc(r.submitter_email || r.family_contact_email || '')}</div>
            <div><b>Situation</b><br>${esc(r.life_status || 'Family referral')}<br>${esc(r.cancer_type || '')}</div>
          </div>
          ${r.route === 'parent' ? `
            <details>
              <summary>View sensitive registration details</summary>
              <p><b>Diagnosis timing:</b> ${esc(r.diagnosis_date_text || '—')}</p>
              <p><b>Journey notes:</b> ${esc(r.journey_notes || '—')}</p>
              <p><b>Interests:</b> ${esc(r.interests || '—')}</p>
              <p><b>Consents:</b> recognition ${r.consent_recognition ? 'Yes' : 'No'}, events ${r.consent_events ? 'Yes' : 'No'}, updates ${r.consent_updates ? 'Yes' : 'No'}, media interest ${r.consent_media_interest ? 'Yes' : 'No'}</p>
            </details>
          ` : `
            <p><b>Referrer:</b> ${esc(r.referrer_name || '—')} (${esc(r.referrer_relationship || '')})</p>
            <p><b>Reason:</b> ${esc(r.referral_reason || '—')}</p>
          `}
          <div class="admin-item-actions">
            <button class="btn btn-outline" data-ref-contact="${r.id}">Mark contacted</button>
            <button class="btn btn-outline" data-log-ref="${r.id}">Log communication</button>
            ${r.route === 'parent' && r.consent_heroes && r.consent_health && r.status !== 'promoted'
              ? `<button class="btn btn-primary" data-ref-promote="${r.id}">Promote to Harper's Heroes</button>`
              : ''}
            <button class="btn btn-danger" data-delete-ref="${r.id}" data-delete-name="${esc(r.child_name || 'this referral')}">Delete</button>
          </div>
        </article>
      `).join('') : '<div class="loading-card">No referrals yet.</div>';

      $$('[data-ref-contact]').forEach(button => button.addEventListener('click',async() => {
        await api('/api/admin-referrals',{
          method:'POST',
          body:{
            action:'update',
            id:button.dataset.refContact,
            status:'contacted',
            contacted_at:new Date().toISOString()
          }
        });
        loadReferrals();
        loadSummary();
      }));

      $$('[data-ref-promote]').forEach(button => button.addEventListener('click',async() => {
        if(!confirm('Add this consented registration to the private Harper’s Heroes register?')) return;
        await api('/api/admin-referrals',{
          method:'POST',
          body:{action:'promote',id:button.dataset.refPromote}
        });
        loadReferrals();
        loadSummary();
      }));

      $$('[data-delete-ref]').forEach(button => button.addEventListener('click',() => {
        deleteRecord({
          url:`/api/admin-referrals?id=${encodeURIComponent(button.dataset.deleteRef)}`,
          label:`the referral for ${button.dataset.deleteName}`,
          after:loadReferrals
        });
      }));

      $$('[data-log-ref]').forEach(button => button.addEventListener('click',() => {
        activateSection('communications');
        setTimeout(() => prefillCommunication(`referral:${button.dataset.logRef}`),100);
      }));
    } catch(err) {
      list.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  }

  // ------------------------------------------------------------
  // Harper's Heroes
  // ------------------------------------------------------------
  async function loadHeroes() {
    const list = $('#heroes-list');
    list.innerHTML = '<div class="loading-card">Loading…</div>';

    try {
      const {items} = await api('/api/admin-heroes');

      list.innerHTML = items.length ? items.map(h => `
        <article class="admin-item">
          <div class="admin-item-head">
            <div>
              <strong>${esc(h.preferred_name || h.child_name)}</strong>
              <div class="small">${esc(h.life_status || '')} · added ${esc(fmt(h.created_at))}</div>
            </div>
            <span class="status-pill">${esc(h.status || 'active')}</span>
          </div>
          <div class="admin-item-grid">
            <div><b>Primary contact</b><br>${esc(h.primary_contact_name || '—')}<br>${esc(h.primary_contact_email || '')}</div>
            <div><b>Recognition preferences</b><br>Events: ${h.consent_events ? 'Yes' : 'No'} · Updates: ${h.consent_updates ? 'Yes' : 'No'}</div>
          </div>
          <details>
            <summary>Private details</summary>
            <p><b>Cancer type:</b> ${esc(h.cancer_type || '—')}</p>
            <p><b>Journey notes:</b> ${esc(h.journey_notes || '—')}</p>
            <p><b>Interests:</b> ${esc(h.interests || '—')}</p>
          </details>
          <div class="hero-actions-list">
            ${(h.actions || []).map(a => `
              <div class="action-row">
                <div>
                  <strong>${esc(a.title)}</strong>
                  <div class="small">${esc(a.action_type || 'Recognition')} · ${a.due_date ? `due ${esc(a.due_date)}` : 'no due date'} · ${esc(a.status)}</div>
                </div>
                <div class="inline-actions">
                  ${a.status !== 'completed' ? `<button class="link-button" data-complete-action="${a.id}">Complete</button>` : ''}
                  <button class="link-button danger-link" data-delete-action="${a.id}">Delete</button>
                </div>
              </div>
            `).join('') || '<div class="small">No recognition actions recorded.</div>'}
          </div>
          <div class="admin-item-actions">
            <button class="btn btn-outline" data-add-action="${h.id}">Add recognition action</button>
            <button class="btn btn-outline" data-log-hero="${h.id}">Log communication</button>
            <button class="btn btn-danger" data-delete-hero="${h.id}" data-delete-name="${esc(h.preferred_name || h.child_name)}">Delete Hero record</button>
          </div>
        </article>
      `).join('') : '<div class="loading-card">No Harper’s Heroes records yet.</div>';

      $$('[data-add-action]').forEach(button => button.addEventListener('click',async() => {
        const title = prompt('What action do you want to add?');
        if(!title) return;
        const due = prompt('Due date (YYYY-MM-DD), or leave blank:') || '';
        await api('/api/admin-heroes',{
          method:'POST',
          body:{
            action:'add-action',
            hero_id:button.dataset.addAction,
            title,
            due_date:due,
            action_type:'Recognition'
          }
        });
        loadHeroes();
        loadSummary();
      }));

      $$('[data-complete-action]').forEach(button => button.addEventListener('click',async() => {
        await api('/api/admin-heroes',{
          method:'POST',
          body:{action:'complete-action',id:button.dataset.completeAction}
        });
        loadHeroes();
        loadSummary();
      }));

      $$('[data-delete-action]').forEach(button => button.addEventListener('click',() => {
        deleteRecord({
          url:`/api/admin-heroes?kind=action&id=${encodeURIComponent(button.dataset.deleteAction)}`,
          label:'this recognition action',
          after:loadHeroes
        });
      }));

      $$('[data-delete-hero]').forEach(button => button.addEventListener('click',() => {
        deleteRecord({
          url:`/api/admin-heroes?kind=hero&id=${encodeURIComponent(button.dataset.deleteHero)}`,
          label:`the Harper’s Heroes record for ${button.dataset.deleteName}`,
          after:loadHeroes
        });
      }));

      $$('[data-log-hero]').forEach(button => button.addEventListener('click',() => {
        activateSection('communications');
        setTimeout(() => prefillCommunication(`hero:${button.dataset.logHero}`),100);
      }));
    } catch(err) {
      list.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  }

  // ------------------------------------------------------------
  // Communications
  // ------------------------------------------------------------
  let communicationsCache = {items:[],heroes:[],referrals:[]};

  function clearCommunicationForm() {
    $('#comm-id').value = '';
    $('#comm-link').value = '';
    $('#comm-direction').value = 'outbound';
    $('#comm-method').value = 'Email';
    $('#comm-occurred').value = localDateTime();
    $('#comm-follow-up').value = '';
    $('#comm-contact-name').value = '';
    $('#comm-contact-email').value = '';
    $('#comm-contact-phone').value = '';
    $('#comm-subject').value = '';
    $('#comm-notes').value = '';
    $('#comm-outcome').value = '';
    $('#comm-error').hidden = true;
  }

  function populateCommunicationLinks() {
    const select = $('#comm-link');
    if(!select) return;

    const current = select.value;
    const heroOptions = communicationsCache.heroes.map(h =>
      `<option value="hero:${h.id}">Harper’s Hero — ${esc(h.preferred_name || h.child_name || 'Child')}</option>`
    ).join('');
    const referralOptions = communicationsCache.referrals.map(r =>
      `<option value="referral:${r.id}">Referral — ${esc(r.child_name || 'Child')}</option>`
    ).join('');

    select.innerHTML = `<option value="">Not linked to a record</option>${heroOptions}${referralOptions}`;
    if([...select.options].some(option => option.value === current)) select.value = current;
  }

  function prefillCommunication(value) {
    populateCommunicationLinks();
    $('#comm-link').value = value;
    const [type,id] = String(value || '').split(':');

    if(type === 'hero') {
      const hero = communicationsCache.heroes.find(x => x.id === id);
      if(hero) {
        $('#comm-contact-name').value = hero.primary_contact_name || '';
        $('#comm-contact-email').value = hero.primary_contact_email || '';
        $('#comm-contact-phone').value = hero.primary_contact_phone || '';
      }
    }

    if(type === 'referral') {
      const ref = communicationsCache.referrals.find(x => x.id === id);
      if(ref) {
        $('#comm-contact-name').value = ref.submitter_name || ref.family_contact_name || '';
        $('#comm-contact-email').value = ref.submitter_email || ref.family_contact_email || '';
        $('#comm-contact-phone').value = ref.submitter_phone || ref.family_contact_phone || '';
      }
    }

    $('#comm-subject').focus();
  }

  $('#comm-link')?.addEventListener('change',event => prefillCommunication(event.target.value));
  $('#new-communication')?.addEventListener('click',clearCommunicationForm);
  $('#clear-communication')?.addEventListener('click',clearCommunicationForm);

  $('#communication-editor')?.addEventListener('submit',async event => {
    event.preventDefault();
    $('#comm-error').hidden = true;

    const link = $('#comm-link').value;
    const [type,id] = link ? link.split(':') : ['',''];

    const body = {
      hero_id:type === 'hero' ? id : '',
      referral_id:type === 'referral' ? id : '',
      direction:$('#comm-direction').value,
      method:$('#comm-method').value,
      occurred_at:$('#comm-occurred').value,
      follow_up_date:$('#comm-follow-up').value,
      contact_name:$('#comm-contact-name').value,
      contact_email:$('#comm-contact-email').value,
      contact_phone:$('#comm-contact-phone').value,
      subject:$('#comm-subject').value,
      notes:$('#comm-notes').value,
      outcome:$('#comm-outcome').value
    };

    try {
      await api('/api/admin-communications',{method:'POST',body});
      clearCommunicationForm();
      await loadCommunications();
      loadSummary();
    } catch(err) {
      showMessage($('#comm-error'),err.message);
    }
  });

  async function loadCommunications() {
    const list = $('#communications-list');
    if(!list) return;
    list.innerHTML = '<div class="loading-card">Loading…</div>';

    try {
      communicationsCache = await api('/api/admin-communications');
      populateCommunicationLinks();

      list.innerHTML = communicationsCache.items.length ? communicationsCache.items.map(item => `
        <article class="admin-item communication-item">
          <div class="admin-item-head">
            <div>
              <strong>${esc(item.subject)}</strong>
              <div class="small">${esc(item.method)} · ${esc(item.direction)} · ${esc(fmt(item.occurred_at))}</div>
            </div>
            ${item.follow_up_date ? `<span class="status-pill">Follow up ${esc(item.follow_up_date)}</span>` : ''}
          </div>
          ${item.linked_name ? `<p><b>${esc(item.linked_type)}:</b> ${esc(item.linked_name)}</p>` : ''}
          <p><b>Contact:</b> ${esc(item.contact_name || '—')} ${item.contact_email ? `· ${esc(item.contact_email)}` : ''} ${item.contact_phone ? `· ${esc(item.contact_phone)}` : ''}</p>
          <details>
            <summary>View communication notes</summary>
            <p><b>Notes:</b> ${esc(item.notes || '—')}</p>
            <p><b>Outcome / next step:</b> ${esc(item.outcome || '—')}</p>
            <p><b>Logged by:</b> ${esc(item.created_by || '—')}</p>
          </details>
          <div class="admin-item-actions">
            ${item.contact_email ? `<a class="btn btn-outline" href="mailto:${encodeURIComponent(item.contact_email)}?subject=${encodeURIComponent(item.subject)}">Email</a>` : ''}
            <button class="btn btn-danger" data-delete-comm="${item.id}">Delete</button>
          </div>
        </article>
      `).join('') : '<div class="loading-card">No communications logged yet.</div>';

      $$('[data-delete-comm]').forEach(button => button.addEventListener('click',() => {
        deleteRecord({
          url:`/api/admin-communications?id=${encodeURIComponent(button.dataset.deleteComm)}`,
          label:'this communication record',
          after:loadCommunications
        });
      }));
    } catch(err) {
      list.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  }

  // ------------------------------------------------------------
  // Events
  // ------------------------------------------------------------
  let eventCache = [];

  async function loadEvents() {
    const list = $('#events-list');
    list.innerHTML = '<div class="loading-card">Loading…</div>';

    try {
      const {items} = await api('/api/admin-events');
      eventCache = items;
      list.innerHTML = items.length ? items.map(event => `
        <div class="event-admin-list-row">
          <button class="admin-list-button" data-edit-event="${event.id}">
            <strong>${esc(event.title)}</strong>
            <span>${esc(event.status)} · ${esc(fmt(event.start_at))}</span>
          </button>
          <button class="btn btn-danger compact-delete" data-delete-event-list="${event.id}" data-delete-name="${esc(event.title)}">Delete</button>
        </div>
      `).join('') : '<div class="loading-card">No events yet.</div>';

      $$('[data-edit-event]').forEach(button => button.addEventListener('click',() => {
        openEvent(eventCache.find(event => event.id === button.dataset.editEvent));
      }));

      $$('[data-delete-event-list]').forEach(button => button.addEventListener('click',() => {
        deleteRecord({
          url:`/api/admin-events?id=${encodeURIComponent(button.dataset.deleteEventList)}`,
          label:`the event “${button.dataset.deleteName}”`,
          after:async() => {
            $('#event-editor').hidden = true;
            await loadEvents();
          }
        });
      }));
    } catch(err) {
      list.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  }

  const eventFields = {
    id:'#event-id',
    title:'#event-title',
    start_at:'#event-start',
    end_at:'#event-end',
    location:'#event-location',
    category:'#event-category',
    status:'#event-status',
    max_places:'#event-max',
    summary:'#event-summary',
    body:'#event-body',
    children_attending:'#event-children',
    family_reach:'#event-family',
    value_support:'#event-value',
    booking_url:'#event-booking',
    public_image_url:'#event-image-url'
  };

  function openEvent(event={}) {
    $('#event-editor').hidden = false;
    $('#event-editor-title').textContent = event.id ? 'Edit event' : 'New event';

    for(const [key,selector] of Object.entries(eventFields)) {
      const el = $(selector);
      let value = event[key] ?? '';
      if((key === 'start_at' || key === 'end_at') && value) value = String(value).slice(0,16);
      el.value = value;
    }

    $('#delete-event').hidden = !event.id;
    $('#image-preview').innerHTML = event.public_image_url
      ? `<img src="${esc(event.public_image_url)}" alt="">`
      : '';

    $('#gallery-preview').innerHTML = (event.gallery || []).map(image => `
      <div class="gallery-thumb">
        <img src="${esc(image.image_url)}" alt="">
        <button class="gallery-remove" type="button" data-delete-gallery="${image.id}">Remove</button>
      </div>
    `).join('');

    $$('[data-delete-gallery]').forEach(button => button.addEventListener('click',async() => {
      if(!confirm('Remove this image from the event gallery?')) return;
      await api(`/api/admin-events?gallery_id=${encodeURIComponent(button.dataset.deleteGallery)}`,{method:'DELETE'});
      await loadEvents();
      const refreshed = eventCache.find(x => x.id === $('#event-id').value);
      if(refreshed) openEvent(refreshed);
    }));
  }

  $('#new-event')?.addEventListener('click',() => openEvent({
    status:'draft',
    category:'Family experience',
    children_attending:0,
    family_reach:0,
    value_support:0
  }));

  $('#close-event-editor')?.addEventListener('click',() => {
    $('#event-editor').hidden = true;
  });

  $('#event-editor')?.addEventListener('submit',async event => {
    event.preventDefault();
    $('#event-error').hidden = true;

    const payload = {};
    for(const [key,selector] of Object.entries(eventFields)) payload[key] = $(selector).value;

    try {
      const data = await api('/api/admin-events',{method:'POST',body:payload});
      openEvent(data.item);
      await loadEvents();
      loadSummary();
    } catch(err) {
      showMessage($('#event-error'),err.message);
    }
  });

  $('#delete-event')?.addEventListener('click',() => {
    const id = $('#event-id').value;
    if(!id) return;
    deleteRecord({
      url:`/api/admin-events?id=${encodeURIComponent(id)}`,
      label:`the event “${$('#event-title').value || 'this event'}”`,
      after:async() => {
        $('#event-editor').hidden = true;
        await loadEvents();
      }
    });
  });

  const fileToBase64 = file => new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  $('#upload-event-image')?.addEventListener('click',async() => {
    const file = $('#event-image-file').files[0];
    const id = $('#event-id').value;
    if(!file || !id) return alert('Save the event first, then choose an image.');

    try {
      const data = await api('/api/admin-upload',{
        method:'POST',
        body:{
          event_id:id,
          kind:'hero',
          mime_type:file.type,
          base64:await fileToBase64(file)
        }
      });
      $('#event-image-url').value = data.url;
      $('#image-preview').innerHTML = `<img src="${esc(data.url)}" alt="">`;
      await loadEvents();
    } catch(err) {
      alert(err.message);
    }
  });

  $('#upload-gallery')?.addEventListener('click',async() => {
    const files = [...$('#event-gallery-files').files];
    const id = $('#event-id').value;
    if(!files.length || !id) return alert('Save the event first, then choose photos.');

    for(const file of files) {
      try {
        await api('/api/admin-upload',{
          method:'POST',
          body:{
            event_id:id,
            kind:'gallery',
            mime_type:file.type,
            base64:await fileToBase64(file)
          }
        });
      } catch(err) {
        alert(`${file.name}: ${err.message}`);
      }
    }

    await loadEvents();
    openEvent(eventCache.find(event => event.id === id) || {});
  });

  $('#generate-story')?.addEventListener('click',async() => {
    try {
      const data = await api('/api/admin-event-draft',{
        method:'POST',
        body:{
          attendees:$('#ai-attendees').value,
          aim:$('#ai-aim').value,
          notes:$('#ai-notes').value
        }
      });
      $('#event-body').value = data.draft;
    } catch(err) {
      showMessage($('#event-error'),err.message);
    }
  });

  $('#dictate-notes')?.addEventListener('click',() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!Recognition) return alert('Dictation is not supported in this browser.');

    const recognition = new Recognition();
    recognition.lang = 'en-GB';
    recognition.interimResults = false;
    recognition.onstart = () => { $('#dictation-state').textContent = 'Listening…'; };
    recognition.onresult = event => {
      $('#ai-notes').value += ($('#ai-notes').value ? ' ' : '') + event.results[0][0].transcript;
    };
    recognition.onend = () => { $('#dictation-state').textContent = ''; };
    recognition.start();
  });

  // ------------------------------------------------------------
  // Go Gold
  // ------------------------------------------------------------
  async function loadGoGold() {
    const list = $('#go-gold-list');
    list.innerHTML = '<div class="loading-card">Loading…</div>';

    try {
      const {items} = await api('/api/admin-go-gold');
      list.innerHTML = items.length ? items.map(item => `
        <article class="admin-item">
          <div class="admin-item-head">
            <div>
              <strong>${esc(item.organisation_name)}</strong>
              <div class="small">${esc(item.organisation_type)} · ${esc(fmt(item.created_at))}</div>
            </div>
            <span class="status-pill">${esc(item.status || 'new')}</span>
          </div>
          <p>${esc(item.contact_name)} · ${esc(item.contact_email)} · ${esc(item.postcode || '')}</p>
          <p>${esc(item.notes || '')}</p>
          <div class="admin-item-actions">
            <a class="btn btn-outline" href="mailto:${encodeURIComponent(item.contact_email)}">Email</a>
            <button class="btn btn-danger" data-delete-gold="${item.id}" data-delete-name="${esc(item.organisation_name)}">Delete</button>
          </div>
        </article>
      `).join('') : '<div class="loading-card">No registrations yet.</div>';

      $$('[data-delete-gold]').forEach(button => button.addEventListener('click',() => {
        deleteRecord({
          url:`/api/admin-go-gold?id=${encodeURIComponent(button.dataset.deleteGold)}`,
          label:`the Go Gold registration for ${button.dataset.deleteName}`,
          after:loadGoGold
        });
      }));
    } catch(err) {
      list.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  }

  // ------------------------------------------------------------
  // Messages
  // ------------------------------------------------------------
  async function loadContacts() {
    const list = $('#contacts-list');
    list.innerHTML = '<div class="loading-card">Loading…</div>';

    try {
      const {items} = await api('/api/admin-contacts');
      list.innerHTML = items.length ? items.map(item => `
        <article class="admin-item">
          <div class="admin-item-head">
            <div>
              <strong>${esc(item.subject)}</strong>
              <div class="small">${esc(item.name)} · ${esc(item.email)} · ${esc(fmt(item.created_at))}</div>
            </div>
            <span class="status-pill">${esc(item.status || 'new')}</span>
          </div>
          <p>${esc(item.message)}</p>
          <div class="admin-item-actions">
            <a class="btn btn-outline" href="mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(`Re: ${item.subject}`)}">Reply by email</a>
            <button class="btn btn-danger" data-delete-contact="${item.id}">Delete</button>
          </div>
        </article>
      `).join('') : '<div class="loading-card">No messages yet.</div>';

      $$('[data-delete-contact]').forEach(button => button.addEventListener('click',() => {
        deleteRecord({
          url:`/api/admin-contacts?id=${encodeURIComponent(button.dataset.deleteContact)}`,
          label:'this website message',
          after:loadContacts
        });
      }));
    } catch(err) {
      list.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  }

  clearCommunicationForm();
  boot();
})();
