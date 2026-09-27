import { openAiApiKey, openAiModel } from './config.mjs';

export async function generateEventStory(input){
  const facts={title:String(input.title||'').trim(),date:String(input.date||'').trim(),location:String(input.location||'').trim(),attendees:String(input.attendees||'').trim(),aim:String(input.aim||'').trim(),notes:String(input.notes||'').trim()};
  if(!openAiApiKey){
    const opening=facts.title?`${facts.title} was about giving children and families a chance to enjoy time together without the day being defined by cancer.`:`This event was about giving children and families a chance to enjoy time together without the day being defined by cancer.`;
    const details=[facts.location&&`We met at ${facts.location}.`,facts.attendees&&`${facts.attendees} attended.`,facts.aim&&facts.aim,facts.notes&&facts.notes].filter(Boolean).join(' ');
    return {mode:'structured_fallback',headline:facts.title||'A good day together',summary:`${opening} ${details}`.trim().slice(0,650),body:`${opening}\n\n${details}\n\nFor us, the point is simple: create good days, make families feel welcome and keep learning from what they tell us matters.`.trim()};
  }
  const prompt=`You are drafting a Project Golden Child event story for families affected by childhood cancer in the UK. Write in plain, warm UK English. Do not use sentimental clichés, heroic-war language, exaggerated claims, marketing jargon, em dashes, or phrases such as 'journey of resilience'. Keep the child first and cancer second. Never imply that attendance or photos were compulsory. Return strict JSON with keys headline, summary, body. Summary max 90 words. Body 250-450 words. Facts:\n${JSON.stringify(facts)}`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${openAiApiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:openAiModel,input:prompt})});
  if(!r.ok) throw new Error(`AI generation failed: ${r.status} ${await r.text()}`);
  const data=await r.json();
  const text=data.output_text || data.output?.flatMap(o=>o.content||[]).map(c=>c.text||'').join('') || '';
  const match=text.match(/\{[\s\S]*\}/);
  if(!match) throw new Error('AI response did not contain JSON');
  return {mode:'ai',...JSON.parse(match[0])};
}
