(() => {
  const upcoming = document.querySelector('#upcoming-events');
  const past = document.querySelector('#past-events');
  if(!upcoming || !past) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  const formatDate = iso => {
    if(!iso) return '';
    return new Intl.DateTimeFormat('en-GB',{
      day:'numeric',
      month:'long',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit'
    }).format(new Date(iso));
  };

  const posterCard = (event,{pastEvent=false}={}) => {
    const date = formatDate(event.start_at);
    const meta = [date,event.location].filter(Boolean).join(' · ');
    const image = event.public_image_url
      ? `<a class="event-poster-link" href="${esc(event.public_image_url)}" target="_blank" rel="noopener" aria-label="Open ${esc(event.title)} poster">
           <img class="event-poster-image" src="${esc(event.public_image_url)}" alt="${esc(event.poster_alt || `${event.title} poster`)}" loading="lazy">
         </a>`
      : `<div class="event-poster-placeholder">Poster coming soon</div>`;

    return `
      <article class="poster-event-card${pastEvent?' poster-event-past':''}">
        ${image}
        <div class="poster-event-meta">
          <span class="eyebrow">${esc(event.category || 'Project Golden Child')}</span>
          <h3>${esc(event.title)}</h3>
          ${meta?`<p class="small"><strong>${esc(meta)}</strong></p>`:''}
          ${event.summary?`<p>${esc(event.summary)}</p>`:''}
          <div class="poster-event-actions">
            ${event.public_image_url?`<a class="btn btn-outline" href="${esc(event.public_image_url)}" target="_blank" rel="noopener">View full poster</a>`:''}
            ${event.booking_url?`<a class="btn btn-gold" href="${esc(event.booking_url)}" target="_blank" rel="noopener">Booking / information</a>`:''}
          </div>
        </div>
      </article>
    `;
  };

  fetch('/api/events')
    .then(response => response.json())
    .then(({events=[]}) => {
      const futureEvents = events
        .filter(event => event.display_section !== 'past')
        .sort((a,b) => {
          if(a.start_at && b.start_at) return new Date(a.start_at)-new Date(b.start_at);
          if(a.start_at) return -1;
          if(b.start_at) return 1;
          return String(a.title).localeCompare(String(b.title));
        });

      const pastEvents = events
        .filter(event => event.display_section === 'past')
        .sort((a,b) => {
          if(a.start_at && b.start_at) return new Date(b.start_at)-new Date(a.start_at);
          return String(a.title).localeCompare(String(b.title));
        });

      upcoming.innerHTML = futureEvents.length
        ? futureEvents.map(event => posterCard(event)).join('')
        : '<div class="loading-card">No upcoming events are live at the moment. New posters will appear here as soon as they are published.</div>';

      past.innerHTML = pastEvents.length
        ? pastEvents.map(event => posterCard(event,{pastEvent:true})).join('')
        : '<div class="loading-card">No past event posters have been published yet.</div>';
    })
    .catch(() => {
      upcoming.innerHTML='<div class="loading-card">Event information is temporarily unavailable.</div>';
      past.innerHTML='<div class="loading-card">Event information is temporarily unavailable.</div>';
    });
})();
