(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const fmt = iso => iso
    ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))
    : '—';

  const postalAddress = record => [
    record?.address_line_1,
    record?.address_line_2,
    record?.town_city,
    record?.county,
    record?.address_postcode,
    record?.address_country
  ].filter(Boolean).join(', ') || '—';
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
              <p><b>Postal / delivery address:</b><br>${esc(postalAddress(r))}</p>
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
            <p><b>Postal / delivery address:</b><br>${esc(postalAddress(h))}</p>
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
            <button class="btn btn-outline" data-edit-address="${h.id}">Update postal address</button>
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

      $$('[data-edit-address]').forEach(button => button.addEventListener('click',async() => {
        const hero=items.find(item => item.id===button.dataset.editAddress);
        if(!hero) return;

        const line1=prompt('Address line 1:',hero.address_line_1 || '');
        if(line1===null) return;
        const line2=prompt('Address line 2 (optional):',hero.address_line_2 || '');
        if(line2===null) return;
        const town=prompt('Town or city:',hero.town_city || '');
        if(town===null) return;
        const county=prompt('County (optional):',hero.county || '');
        if(county===null) return;
        const postcode=prompt('Postcode:',hero.address_postcode || hero.postcode_prefix || '');
        if(postcode===null) return;
        const country=prompt('Country:',hero.address_country || 'United Kingdom');
        if(country===null) return;

        if(!line1.trim() || !town.trim() || !postcode.trim() || !country.trim()){
          return alert('Address line 1, town/city, postcode and country are required.');
        }

        await api('/api/admin-heroes',{
          method:'POST',
          body:{
            action:'update-hero',
            id:hero.id,
            address_line_1:line1,
            address_line_2:line2,
            town_city:town,
            county,
            address_postcode:postcode,
            address_country:country
          }
        });

        loadHeroes();
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
  // Events — poster promotion + photographs + AI review
  // ------------------------------------------------------------
  let eventCache = [];
  let mediaRecorder = null;
  let recordedChunks = [];

  const eventVisibilityLabel = status => ({
    draft:'Not live',
    published:'Live',
    archived:'Archived',
    cancelled:'Cancelled'
  }[status] || status || 'Not live');

  const eventSectionLabel = section =>
    section === 'past' ? 'Past events' : 'Upcoming';

  async function loadEvents() {
    const list = $('#events-list');
    list.innerHTML = '<div class="loading-card">Loading…</div>';

    try {
      const {items} = await api('/api/admin-events');
      eventCache = items;

      const order = {published:0,draft:1,archived:2,cancelled:3};
      const sorted = [...items].sort((a,b) => {
        const statusDiff=(order[a.status] ?? 9)-(order[b.status] ?? 9);
        if(statusDiff) return statusDiff;
        return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
      });

      list.innerHTML = sorted.length ? sorted.map(event => `
        <article class="event-poster-admin-card">
          ${event.public_image_url
            ? `<button class="event-poster-admin-thumb" data-edit-event="${event.id}" aria-label="Edit ${esc(event.title)}">
                 <img src="${esc(event.public_image_url)}" alt="">
               </button>`
            : `<button class="event-poster-admin-thumb poster-missing" data-edit-event="${event.id}">
                 <span>No poster</span>
               </button>`}
          <div class="event-poster-admin-copy">
            <strong>${esc(event.title)}</strong>
            <div class="event-admin-badges">
              <span class="status-pill ${event.status==='published'?'status-live':''}">${esc(eventVisibilityLabel(event.status))}</span>
              <span class="status-pill">${esc(eventSectionLabel(event.display_section))}</span>
              ${event.review_status==='published'
                ? '<span class="status-pill status-review-live">Review live</span>'
                : event.display_section==='past'
                  ? '<span class="status-pill">Review draft</span>'
                  : ''}
              ${(event.gallery || []).length
                ? `<span class="status-pill">${event.gallery.length} photo${event.gallery.length===1?'':'s'}</span>`
                : ''}
            </div>
            <div class="small">${event.start_at ? esc(fmt(event.start_at)) : 'No event date set'}${event.location ? ` · ${esc(event.location)}` : ''}</div>
            <div class="admin-item-actions">
              <button class="btn btn-outline" data-edit-event="${event.id}">Edit</button>
              <button class="btn btn-danger" data-delete-event-list="${event.id}" data-delete-name="${esc(event.title)}">Delete</button>
            </div>
          </div>
        </article>
      `).join('') : '<div class="loading-card">No event posters yet. Click “Add event poster” to create one.</div>';

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
    display_section:'#event-section',
    status:'#event-status',
    start_at:'#event-start',
    end_at:'#event-end',
    location:'#event-location',
    category:'#event-category',
    poster_alt:'#event-poster-alt',
    max_places:'#event-max',
    summary:'#event-summary',
    body:'#event-body',
    children_attending:'#event-children',
    people_attending:'#event-people',
    families_attending:'#event-families',
    volunteers_attending:'#event-volunteers',
    family_reach:'#event-family',
    value_support:'#event-value',
    booking_url:'#event-booking',
    public_image_url:'#event-image-url',
    photo_consent_note:'#event-photo-consent-note',
    review_status:'#event-review-status',
    review_title:'#event-review-title',
    review_summary:'#event-review-summary',
    review_body:'#event-review-body',
    review_voice_transcript:'#event-review-transcript'
  };

  function renderPosterPreview(url,alt='') {
    const preview=$('#image-preview');
    if(!preview) return;
    preview.innerHTML=url
      ? `<img src="${esc(url)}" alt="${esc(alt)}">`
      : '<div class="poster-preview-empty">Choose a poster file. It will upload when you save.</div>';
  }

  function renderGallery(event) {
    const gallery=$('#gallery-preview');
    if(!gallery) return;

    gallery.innerHTML=(event.gallery || []).map(image => `
      <div class="review-gallery-item">
        <img src="${esc(image.image_url)}" alt="${esc(image.alt_text || '')}">
        ${image.caption ? `<div class="small">${esc(image.caption)}</div>` : ''}
        <button class="gallery-remove" type="button" data-delete-gallery="${image.id}">Remove</button>
      </div>
    `).join('');

    $$('[data-delete-gallery]').forEach(button => button.addEventListener('click',async() => {
      if(!confirm('Remove this photograph from the event?')) return;
      await api(`/api/admin-events?gallery_id=${encodeURIComponent(button.dataset.deleteGallery)}`,{method:'DELETE'});
      await loadEvents();
      const refreshed=eventCache.find(item => item.id === $('#event-id').value);
      if(refreshed) openEvent(refreshed);
    }));
  }

  function openEvent(event={}) {
    $('#event-editor').hidden = false;
    $('#event-editor-title').textContent = event.id ? 'Edit event' : 'Add event';

    const defaults = {
      display_section:'future',
      status:'draft',
      category:'Community',
      review_status:'draft',
      children_attending:0,
      people_attending:0,
      families_attending:0,
      volunteers_attending:0,
      family_reach:0,
      value_support:0,
      ...event
    };

    for(const [key,selector] of Object.entries(eventFields)) {
      const element=$(selector);
      if(!element) continue;
      let value=defaults[key] ?? '';
      if((key==='start_at' || key==='end_at') && value) value=String(value).slice(0,16);
      element.value=value;
    }

    $('#event-photo-consent').checked=Boolean(event.photo_consent_confirmed);
    $('#event-image-file').value='';
    $('#event-gallery-files').value='';
    $('#event-save-state').textContent='';
    $('#event-error').hidden=true;
    $('#delete-event').hidden=!event.id;

    renderPosterPreview(event.public_image_url,event.poster_alt);
    renderGallery(event);

    if(event.review_ai_generated_at){
      $('#ai-review-state').textContent=`Last AI draft: ${fmt(event.review_ai_generated_at)}`;
    }else{
      $('#ai-review-state').textContent='';
    }

    $('#event-editor').scrollIntoView({behavior:'smooth',block:'start'});
  }

  $('#new-event')?.addEventListener('click',() => openEvent());

  $('#close-event-editor')?.addEventListener('click',() => {
    $('#event-editor').hidden=true;
  });

  $('#event-image-file')?.addEventListener('change',event => {
    const file=event.target.files?.[0];
    if(!file) return;
    const localUrl=URL.createObjectURL(file);
    renderPosterPreview(localUrl,$('#event-poster-alt').value);
  });

  async function uploadFileDirect({eventId,file,kind,altText='',caption=''}) {
    if(!file) throw new Error('Choose an image first.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
      throw new Error('Use a PNG, JPEG or WebP image.');
    }
    if(file.size > 15*1024*1024){
      throw new Error('Images must be under 15 MB.');
    }

    const sign=await api('/api/admin-upload-sign',{
      method:'POST',
      body:{
        event_id:eventId,
        kind,
        file_name:file.name,
        file_size:file.size,
        mime_type:file.type,
        photo_consent_confirmed:kind==='gallery' && $('#event-photo-consent').checked
      }
    });

    // Supabase's signed-upload endpoint expects PUT. For Blob/File uploads
    // its own storage client uses FormData, so PGC now mirrors that wire
    // format exactly. The browser sets the multipart boundary automatically.
    const form=new FormData();
    form.append('cacheControl','3600');
    form.append('',file,file.name || 'image');

    const uploadResponse=await fetch(sign.signedUrl,{
      method:'PUT',
      headers:{
        'x-upsert':'false'
      },
      body:form
    });

    if(!uploadResponse.ok){
      const detail=await uploadResponse.text().catch(()=> '');
      console.error('Direct storage upload failed',uploadResponse.status,detail);

      let readable=detail;
      try{
        const parsed=JSON.parse(detail);
        readable=parsed.message || parsed.error || detail;
      }catch{}

      throw new Error(
        `Storage upload failed (${uploadResponse.status}). ${readable || 'Please try again.'}`
      );
    }

    return await api('/api/admin-upload-complete',{
      method:'POST',
      body:{
        event_id:eventId,
        kind,
        path:sign.path,
        alt_text:altText,
        caption,
        photo_consent_confirmed:kind==='gallery' && $('#event-photo-consent').checked,
        photo_consent_note:kind==='gallery' ? $('#event-photo-consent-note').value : ''
      }
    });
  }

  async function uploadEventPoster(eventId,file) {
    const upload=await uploadFileDirect({
      eventId,
      file,
      kind:'poster',
      altText:$('#event-poster-alt').value
    });
    return upload.url;
  }

  function collectEventPayload(){
    const payload={};
    for(const [key,selector] of Object.entries(eventFields)) {
      const element=$(selector);
      if(element) payload[key]=element.value;
    }
    payload.photo_consent_confirmed=$('#event-photo-consent').checked;
    payload.review_ai_generated_at=$('#event-review-body').dataset.generatedAt || '';
    return payload;
  }

  $('#event-editor')?.addEventListener('submit',async event => {
    event.preventDefault();
    $('#event-error').hidden=true;

    const selectedFile=$('#event-image-file').files?.[0] || null;
    const intendedStatus=$('#event-status').value;
    let payload=collectEventPayload();

    if(!payload.title.trim()){
      return showMessage($('#event-error'),'Add an event title.');
    }

    const hasExistingPoster=Boolean(payload.public_image_url);
    if(intendedStatus==='published' && !hasExistingPoster && !selectedFile){
      return showMessage($('#event-error'),'Choose a poster before making the event live.');
    }

    if(payload.review_status==='published' && payload.display_section!=='past'){
      return showMessage($('#event-error'),'Move the event to Past events before publishing its review.');
    }

    const state=$('#event-save-state');

    try {
      state.textContent='Saving…';

      if(!payload.id){
        const createPayload={...payload};
        if(selectedFile && intendedStatus==='published'){
          createPayload.status='draft';
        }

        const created=await api('/api/admin-events',{
          method:'POST',
          body:createPayload
        });

        payload.id=created.item.id;
        $('#event-id').value=payload.id;
        payload.public_image_url=created.item.public_image_url || '';
      }

      if(selectedFile){
        state.textContent='Uploading poster…';
        payload.public_image_url=await uploadEventPoster(payload.id,selectedFile);
        $('#event-image-url').value=payload.public_image_url;
      }

      state.textContent=intendedStatus==='published' ? 'Publishing…' : 'Saving…';
      payload.status=intendedStatus;

      const saved=await api('/api/admin-events',{
        method:'POST',
        body:payload
      });

      state.textContent=saved.item.status==='published'
        ? `Live in ${eventSectionLabel(saved.item.display_section)}`
        : 'Saved';

      await loadEvents();
      loadSummary();

      const refreshed=eventCache.find(item => item.id === saved.item.id) || saved.item;
      openEvent(refreshed);
      $('#event-save-state').textContent=saved.item.status==='published'
        ? `Live in ${eventSectionLabel(saved.item.display_section)}`
        : 'Saved';
    } catch(err) {
      state.textContent='';
      showMessage($('#event-error'),err.message);
    }
  });

  $('#delete-event')?.addEventListener('click',() => {
    const id=$('#event-id').value;
    if(!id) return;
    deleteRecord({
      url:`/api/admin-events?id=${encodeURIComponent(id)}`,
      label:`the event “${$('#event-title').value || 'this event'}”`,
      after:async() => {
        $('#event-editor').hidden=true;
        await loadEvents();
      }
    });
  });

  $('#upload-gallery')?.addEventListener('click',async() => {
    const files=[...$('#event-gallery-files').files];
    const id=$('#event-id').value;

    if(!id) return alert('Save the event first, then upload photographs.');
    if(!files.length) return alert('Choose one or more photographs.');
    if(!$('#event-photo-consent').checked){
      return alert('Confirm that publication permission is recorded before uploading photographs.');
    }

    const state=$('#event-save-state');
    state.textContent='Uploading photographs…';

    let completed=0;
    for(const file of files){
      try{
        state.textContent=`Uploading photograph ${completed+1} of ${files.length}…`;
        await uploadFileDirect({
          eventId:id,
          file,
          kind:'gallery',
          altText:`${$('#event-title').value || 'Project Golden Child event'} photograph`
        });
        completed++;
      }catch(err){
        console.error('Gallery upload failed',err);
        alert(`${file.name}: ${err.message}`);
      }
    }

    state.textContent=`${completed} photograph${completed===1?'':'s'} uploaded`;
    await loadEvents();
    const refreshed=eventCache.find(item => item.id===id);
    if(refreshed) openEvent(refreshed);
  });

  $('#copy-poster-prompt')?.addEventListener('click',async() => {
    const text=$('#poster-prompt-template').value;
    const state=$('#copy-prompt-state');
    try{
      await navigator.clipboard.writeText(text);
      state.textContent='Copied.';
      setTimeout(() => { state.textContent=''; },2000);
    }catch{
      $('#poster-prompt-template').select();
      document.execCommand('copy');
      state.textContent='Copied.';
      setTimeout(() => { state.textContent=''; },2000);
    }
  });

  $('#ai-use-photos')?.addEventListener('change',event => {
    $('#ai-photo-confirmation').hidden=!event.target.checked;
    if(!event.target.checked) $('#ai-photo-permission').checked=false;
  });

  async function updateAiConfigState(){
    const el=$('#ai-config-state');
    if(!el) return;
    try{
      const d=await api('/api/admin-diagnostics');
      if(d.configuration?.aiConfigured){
        el.textContent='AI ready';
        el.classList.add('status-live');
      }else{
        el.textContent='AI not configured';
        el.classList.remove('status-live');
      }
    }catch{
      el.textContent='AI status unavailable';
    }
  }

  $('#generate-ai-review')?.addEventListener('click',async() => {
    const id=$('#event-id').value;
    if(!id) return alert('Save the event before generating its review.');

    const includePhotos=$('#ai-use-photos').checked;
    if(includePhotos && !$('#event-photo-consent').checked){
      return alert('Confirm the event photography permission first.');
    }
    if(includePhotos && !$('#ai-photo-permission').checked){
      return alert('Confirm that the approved photographs may be processed by the AI provider.');
    }

    const state=$('#ai-review-state');
    state.textContent='Generating review…';

    try{
      const data=await api('/api/admin-event-review-ai',{
        method:'POST',
        body:{
          event_id:id,
          title:$('#event-title').value,
          start_at:$('#event-start').value,
          location:$('#event-location').value,
          category:$('#event-category').value,
          aim:$('#ai-aim').value,
          notes:$('#ai-notes').value,
          transcript:$('#event-review-transcript').value,
          people_attending:$('#event-people').value,
          children_attending:$('#event-children').value,
          families_attending:$('#event-families').value,
          volunteers_attending:$('#event-volunteers').value,
          family_reach:$('#event-family').value,
          value_support:$('#event-value').value,
          include_photos:includePhotos,
          ai_photo_permission:includePhotos && $('#ai-photo-permission').checked
        }
      });

      $('#event-review-title').value=data.review_title || '';
      $('#event-review-summary').value=data.review_summary || '';
      $('#event-review-body').value=data.review_body || '';
      $('#event-review-body').dataset.generatedAt=data.generated_at || new Date().toISOString();
      state.textContent='Draft created. Review and edit it before publishing.';
    }catch(err){
      state.textContent='';
      showMessage($('#event-error'),err.message);
    }
  });

  async function blobToBase64(blob){
    return await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
  }

  $('#record-voice-note')?.addEventListener('click',async() => {
    if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
      return alert('Voice recording is not supported in this browser. You can type into the transcript box instead.');
    }

    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      recordedChunks=[];
      mediaRecorder=new MediaRecorder(stream);

      mediaRecorder.ondataavailable=event => {
        if(event.data?.size) recordedChunks.push(event.data);
      };

      mediaRecorder.onstop=async() => {
        stream.getTracks().forEach(track=>track.stop());
        const blob=new Blob(recordedChunks,{
          type:mediaRecorder.mimeType || 'audio/webm'
        });

        const state=$('#voice-note-state');
        state.textContent='Transcribing…';

        try{
          const data=await api('/api/admin-event-transcribe',{
            method:'POST',
            body:{
              event_id:$('#event-id').value,
              mime_type:blob.type || 'audio/webm',
              base64:await blobToBase64(blob)
            }
          });

          const current=$('#event-review-transcript').value.trim();
          $('#event-review-transcript').value=
            current ? `${current}

${data.transcript}` : data.transcript;
          state.textContent='Voice note transcribed. You can edit the text before generating the review.';
        }catch(err){
          state.textContent='';
          showMessage($('#event-error'),err.message);
        }

        $('#record-voice-note').hidden=false;
        $('#stop-voice-note').hidden=true;
      };

      mediaRecorder.start();
      $('#record-voice-note').hidden=true;
      $('#stop-voice-note').hidden=false;
      $('#voice-note-state').textContent='Recording…';
    }catch{
      alert('Microphone access was not available. You can type your notes instead.');
    }
  });

  $('#stop-voice-note')?.addEventListener('click',() => {
    if(mediaRecorder && mediaRecorder.state!=='inactive'){
      $('#voice-note-state').textContent='Finishing recording…';
      mediaRecorder.stop();
    }
  });

  updateAiConfigState();

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
