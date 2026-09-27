window.PGCSubmission = (() => {
  const makeId = () =>
    (globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);

  const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));

  function storageKey(url, submissionKey='') {
    return `pgc:submission:${submissionKey || url}`;
  }

  function getSubmissionId(url, submissionKey='') {
    const key = storageKey(url,submissionKey);
    try {
      const existing = sessionStorage.getItem(key);
      if(existing) return existing;
      const id = makeId();
      sessionStorage.setItem(key,id);
      return id;
    } catch {
      return makeId();
    }
  }

  function clearSubmissionId(url, submissionKey='') {
    try { sessionStorage.removeItem(storageKey(url,submissionKey)); } catch {}
  }

  async function post(url,payload,{retries=2,submissionKey=''}={}) {
    payload.submission_id = payload.submission_id || getSubmissionId(url,submissionKey);

    let lastError;

    for(let attempt=0; attempt<=retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(),15000);

        const response = await fetch(url,{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            Accept:'application/json'
          },
          body:JSON.stringify(payload),
          signal:controller.signal
        });

        clearTimeout(timer);

        const raw = await response.text();
        let data = {};

        if(raw) {
          try { data = JSON.parse(raw); }
          catch { data = { message:raw }; }
        }

        if(response.ok) {
          clearSubmissionId(url,submissionKey);
          return data;
        }

        const err = new Error(data.message || `Request failed (${response.status}).`);
        err.status = response.status;
        lastError = err;

        // Do not immediately retry validation, authentication or rate-limit
        // responses. Only retry genuinely transient server/network failures.
        if(![408,425,500,502,503,504].includes(response.status) || attempt === retries) {
          throw err;
        }
      } catch(err) {
        lastError = err;
        if(attempt === retries) throw err;
      }

      await sleep(800 * (attempt + 1));
    }

    throw lastError || new Error('Submission failed.');
  }

  return { post, makeId };
})();
