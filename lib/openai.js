const crypto = require('node:crypto');

function apiKey(){
  return String(process.env.OPENAI_API_KEY || '').trim();
}

function configured(){
  return Boolean(apiKey());
}

function reviewModel(){
  return String(process.env.OPENAI_REVIEW_MODEL || 'gpt-5.6-luna').trim();
}

function transcribeModel(){
  return String(process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe').trim();
}

function extractResponseText(data){
  if(data && typeof data.output_text === 'string' && data.output_text.trim()){
    return data.output_text.trim();
  }

  const parts=[];
  for(const item of (data?.output || [])){
    for(const content of (item?.content || [])){
      if(content?.type === 'output_text' && typeof content.text === 'string'){
        parts.push(content.text);
      }
    }
  }
  return parts.join('\n').trim();
}

function cleanJsonText(value){
  return String(value || '')
    .trim()
    .replace(/^```(?:json)?\s*/i,'')
    .replace(/\s*```$/,'')
    .trim();
}

async function generateEventReview({
  event,
  notes,
  aim,
  transcript,
  gallery=[],
  includePhotos=false,
  metrics={}
}){
  if(!configured()) throw new Error('OPENAI_NOT_CONFIGURED');

  const photoUrls = includePhotos
    ? gallery.map(x => x.image_url).filter(Boolean).slice(0,4)
    : [];

  const facts = {
    event_title:event?.title || '',
    category:event?.category || '',
    event_date:event?.start_at || '',
    location:event?.location || '',
    people_attending:Number(metrics.people_attending || 0),
    children_attending:Number(metrics.children_attending || 0),
    families_attending:Number(metrics.families_attending || 0),
    volunteers_attending:Number(metrics.volunteers_attending || 0),
    family_reach:Number(metrics.family_reach || 0),
    value_support:Number(metrics.value_support || 0),
    aim:String(aim || ''),
    organiser_notes:String(notes || ''),
    voice_transcript:String(transcript || '')
  };

  const instructions = [
    'You are writing a public event review for Project Golden Child, a UK charitable project supporting children and families affected by childhood cancer.',
    'Write in warm, clear UK English. The tone should be human, positive, grounded and straightforward, not corporate, sentimental or obviously AI-generated.',
    'Do not invent facts, numbers, quotations, names, diagnoses, outcomes, emotions or experiences.',
    'Do not infer attendance numbers from photographs. Use only the supplied figures.',
    'Do not identify any person in a photograph or infer health conditions, disability, ethnicity, religion or other sensitive information from appearance.',
    'Photographs, if supplied, may only be used to understand broad non-sensitive visible context such as the type of activity, setting or group participation.',
    'Do not describe an individual child in a way that could identify them.',
    'Avoid phrases such as "incredible journey", "warriors", "battle", "brave little fighters" or other language that could feel imposed on families.',
    'Emphasise what happened, why it mattered, participation, community and positive experiences.',
    'Return JSON only with exactly these keys: review_title, review_summary, review_body.',
    'review_title: a natural event-review headline, maximum 90 characters.',
    'review_summary: one or two sentences, maximum 350 characters.',
    'review_body: 3 to 5 short paragraphs suitable for the public website, maximum 1800 words.',
  ].join('\n');

  const prompt = [
    instructions,
    '',
    'FACTS PROVIDED BY THE PROJECT TEAM:',
    JSON.stringify(facts,null,2),
    '',
    photoUrls.length
      ? `You have also been given ${photoUrls.length} approved event photograph(s) as optional visual context.`
      : 'No photographs are being supplied to the AI for this draft.'
  ].join('\n');

  const content=[{type:'input_text',text:prompt}];

  for(const imageUrl of photoUrls){
    content.push({
      type:'input_image',
      image_url:imageUrl,
      detail:'low'
    });
  }

  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{
      Authorization:`Bearer ${apiKey()}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({
      model:reviewModel(),
      input:[{
        role:'user',
        content
      }],
      max_output_tokens:1800
    })
  });

  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{};}catch{data={raw};}

  if(!response.ok){
    const message=data?.error?.message || data?.message || raw || `OpenAI request failed (${response.status})`;
    const err=new Error('OPENAI_REVIEW_FAILED');
    err.detail=message;
    err.status=response.status;
    throw err;
  }

  const text=extractResponseText(data);
  if(!text) throw new Error('OPENAI_EMPTY_RESPONSE');

  let parsed;
  try{
    parsed=JSON.parse(cleanJsonText(text));
  }catch{
    // Robust fallback: keep the generated prose rather than losing it.
    parsed={
      review_title:event?.title ? `${event.title} — event review` : 'Event review',
      review_summary:'',
      review_body:text
    };
  }

  return {
    review_title:String(parsed.review_title || '').trim().slice(0,180),
    review_summary:String(parsed.review_summary || '').trim().slice(0,800),
    review_body:String(parsed.review_body || '').trim().slice(0,16000),
    model:reviewModel(),
    request_id:data?.id || crypto.randomUUID()
  };
}

function audioExtension(mimeType){
  const mime=String(mimeType || '').split(';')[0].trim().toLowerCase();
  return ({
    'audio/webm':'webm',
    'audio/mp4':'m4a',
    'audio/mpeg':'mp3',
    'audio/mp3':'mp3',
    'audio/wav':'wav',
    'audio/x-wav':'wav',
    'audio/ogg':'ogg'
  })[mime] || null;
}

async function transcribeAudio({base64,mimeType}){
  if(!configured()) throw new Error('OPENAI_NOT_CONFIGURED');

  const ext=audioExtension(mimeType);
  if(!ext) throw new Error('UNSUPPORTED_AUDIO_TYPE');

  const buffer=Buffer.from(
    String(base64 || '').replace(/^data:[^;]+;base64,/,''),
    'base64'
  );

  if(!buffer.length || buffer.length > 20*1024*1024){
    throw new Error('AUDIO_SIZE');
  }

  const form=new FormData();
  const blob=new Blob([buffer],{type:String(mimeType || 'audio/webm').split(';')[0]});
  form.append('file',blob,`event-voice-note.${ext}`);
  form.append('model',transcribeModel());
  form.append('response_format','json');

  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey()}`},
    body:form
  });

  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{};}catch{data={raw};}

  if(!response.ok){
    const message=data?.error?.message || data?.message || raw || `OpenAI transcription failed (${response.status})`;
    const err=new Error('OPENAI_TRANSCRIBE_FAILED');
    err.detail=message;
    err.status=response.status;
    throw err;
  }

  const text=String(data?.text || '').trim();
  if(!text) throw new Error('OPENAI_EMPTY_TRANSCRIPT');

  return {
    text,
    model:transcribeModel()
  };
}

module.exports={
  configured,
  reviewModel,
  transcribeModel,
  generateEventReview,
  transcribeAudio
};
