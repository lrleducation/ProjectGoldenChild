window.PGCSubmission = (() => {
  const makeId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function post(url, payload, { retries=1 }={}) {
    payload.submission_id = payload.submission_id || makeId();
    let lastError;
    for (let attempt=0; attempt<=retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(),12000);
        const r = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
        clearTimeout(timer);
        let data={};
        const text=await r.text();
        if(text){try{data=JSON.parse(text);}catch{data={message:text};}}
        if(r.ok) return data;
        const err=new Error(data.message||`Request failed (${r.status}).`); err.status=r.status; lastError=err;
        // Retry only genuinely transient transport/server failures.
        // Never auto-retry HTTP 429: retrying immediately only extends the
        // rate-limit problem and can create a poor experience for families.
        if(![408,425,500,502,503,504].includes(r.status) || attempt===retries) throw err;
      } catch(err) {
        lastError=err;
        if(attempt===retries) throw err;
      }
      await sleep(700);
    }
    throw lastError || new Error('Submission failed.');
  }
  return { post, makeId };
})();
