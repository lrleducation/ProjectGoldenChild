(() => {
  const upcoming = document.querySelector('#upcoming-events');
  const past = document.querySelector('#past-events');
  if (!upcoming || !past) return;
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatDate = iso => iso ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)) : 'Date to be confirmed';
  const card = e => `<article class="event-card public-event-card">${e.public_image_url?`<img class="event-public-image" src="${esc(e.public_image_url)}" alt="">`:''}<div class="event-card-body"><span class="eyebrow">${esc(e.category||'Project Golden Child')}</span><h3>${esc(e.title)}</h3><p class="small"><strong>${esc(formatDate(e.start_at))}</strong>${e.location?` · ${esc(e.location)}`:''}</p><p>${esc(e.summary||'More information will be added soon.')}</p>${e.booking_url?`<a class="btn btn-outline" href="${esc(e.booking_url)}" rel="noopener" target="_blank">More information</a>`:''}</div></article>`;
  fetch('/api/events').then(r=>r.json()).then(({events=[]})=>{
    const now=Date.now(); const up=events.filter(e=>!e.start_at||new Date(e.start_at).getTime()>=now); const old=events.filter(e=>e.start_at&&new Date(e.start_at).getTime()<now).sort((a,b)=>new Date(b.start_at)-new Date(a.start_at));
    upcoming.innerHTML=up.length?up.map(card).join(''):'<div class="loading-card">No public events are listed yet. We will add them here when dates are confirmed.</div>';
    past.innerHTML=old.length?old.map(e=>`<article class="timeline-item"><div><strong>${esc(e.title)}</strong><div class="small">${esc(formatDate(e.start_at))}${e.location?` · ${esc(e.location)}`:''}</div><p>${esc(e.summary||'')}</p></div></article>`).join(''):'<div class="loading-card">No past events have been published yet.</div>';
  }).catch(()=>{upcoming.innerHTML='<div class="loading-card">Event information is temporarily unavailable.</div>';past.innerHTML='<div class="loading-card">Event information is temporarily unavailable.</div>';});
})();
