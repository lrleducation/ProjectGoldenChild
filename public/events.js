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

  const paragraphs = text =>
    esc(text || '')
      .split(/\n{2,}/)
      .filter(Boolean)
      .map(part => `<p>${part.replace(/\n/g,'<br>')}</p>`)
      .join('');

  const posterCard = event => {
    const date = formatDate(event.start_at);
    const meta = [date,event.location].filter(Boolean).join(' · ');
    const image = event.public_image_url
      ? `<a class="event-poster-link" href="${esc(event.public_image_url)}" target="_blank" rel="noopener" aria-label="Open ${esc(event.title)} poster">
           <img class="event-poster-image" src="${esc(event.public_image_url)}" alt="${esc(event.poster_alt || `${event.title} poster`)}" loading="lazy">
         </a>`
      : `<div class="event-poster-placeholder">Poster coming soon</div>`;

    return `
      <article class="poster-event-card">
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

  const metric = (value,label) => Number(value||0)>0
    ? `<div class="review-metric"><strong>${Number(value).toLocaleString('en-GB')}</strong><span>${esc(label)}</span></div>`
    : '';

  const reviewCard = event => {
    const date=formatDate(event.start_at);
    const meta=[date,event.location].filter(Boolean).join(' · ');
    const gallery=(event.gallery || []).map(image=>`
      <figure class="event-review-photo">
        <a href="${esc(image.image_url)}" target="_blank" rel="noopener">
          <img src="${esc(image.image_url)}" alt="${esc(image.alt_text || `${event.title} event photograph`)}" loading="lazy">
        </a>
        ${image.caption?`<figcaption>${esc(image.caption)}</figcaption>`:''}
      </figure>
    `).join('');

    return `
      <article class="event-review-card">
        <div class="event-review-lead">
          <div class="event-review-poster">
            ${event.public_image_url
              ? `<img src="${esc(event.public_image_url)}" alt="${esc(event.poster_alt || `${event.title} poster`)}" loading="lazy">`
              : ''}
          </div>
          <div class="event-review-copy">
            <span class="eyebrow">${event.review_published?'Event review':'Past event'}</span>
            <h3>${esc(event.review_published ? (event.review_title || event.title) : event.title)}</h3>
            ${meta?`<p class="small"><strong>${esc(meta)}</strong></p>`:''}
            ${event.review_published && event.review_summary
              ? `<p class="event-review-summary">${esc(event.review_summary)}</p>`
              : event.summary
                ? `<p>${esc(event.summary)}</p>`
                : ''}
            ${event.review_published ? `
              <div class="review-metrics">
                ${metric(event.people_attending,'people attended')}
                ${metric(event.children_attending,'children')}
                ${metric(event.families_attending,'families')}
                ${metric(event.volunteers_attending,'volunteers / helpers')}
                ${event.value_support>0?`<div class="review-metric"><strong>£${Number(event.value_support).toLocaleString('en-GB',{maximumFractionDigits:0})}</strong><span>value of support</span></div>`:''}
              </div>
              <div class="event-review-body">${paragraphs(event.review_body)}</div>
            ` : `<p class="small">A public review has not been added for this event.</p>`}
          </div>
        </div>
        ${gallery ? `<div class="event-review-gallery">${gallery}</div>` : ''}
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
        ? futureEvents.map(posterCard).join('')
        : '<div class="loading-card">No upcoming events are live at the moment. New posters will appear here as soon as they are published.</div>';

      past.innerHTML = pastEvents.length
        ? pastEvents.map(reviewCard).join('')
        : '<div class="loading-card">No past events have been published yet.</div>';
    })
    .catch(() => {
      upcoming.innerHTML='<div class="loading-card">Event information is temporarily unavailable.</div>';
      past.innerHTML='<div class="loading-card">Event information is temporarily unavailable.</div>';
    });
})();
