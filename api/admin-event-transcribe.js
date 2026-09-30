const {json,readBody,cleanText}=require('../lib/http');
const {requireAdmin}=require('../lib/security');
const {audit}=require('../lib/audit');
const {transcribeAudio,configured}=require('../lib/openai');

module.exports=async function(req,res){
  const user=requireAdmin(req,res);
  if(!user) return;
  if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});

  try{
    if(!configured()){
      return json(res,503,{
        message:'Voice transcription is not configured yet. Add OPENAI_API_KEY to Vercel first.'
      });
    }

    const body=await readBody(req,28*1024*1024);
    const eventId=cleanText(body.event_id,80);
    const result=await transcribeAudio({
      base64:body.base64,
      mimeType:cleanText(body.mime_type,120)
    });

    await audit(user,'ai_transcribe','event_review',eventId || 'unsaved',{
      model:result.model
    });

    return json(res,200,{
      transcript:result.text,
      model:result.model
    });
  }catch(err){
    console.error('Event voice transcription error',err.detail || err);
    const message=
      err.message==='UNSUPPORTED_AUDIO_TYPE'
        ? 'This audio format is not supported.'
        : err.message==='AUDIO_SIZE'
          ? 'Voice notes must be under 20 MB.'
          : err.message==='OPENAI_NOT_CONFIGURED'
            ? 'Voice transcription is not configured yet.'
            : 'The voice note could not be transcribed just now.';
    return json(res,400,{message});
  }
};
