const {json,readBody,cleanText,bool}=require('../lib/http');
const {requireAdmin}=require('../lib/security');
const store=require('../lib/store');
const {audit}=require('../lib/audit');
const {generateEventReview,configured}=require('../lib/openai');

module.exports=async function(req,res){
  const user=requireAdmin(req,res);
  if(!user) return;
  if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});

  try{
    if(!configured()){
      return json(res,503,{
        message:'AI review drafting is not configured yet. Add OPENAI_API_KEY to Vercel first.'
      });
    }

    const body=await readBody(req,2*1024*1024);
    const eventId=cleanText(body.event_id,80);
    if(!eventId) return json(res,400,{message:'Save the event before generating a review.'});

    const event=await store.get('events',eventId);
    if(!event) return json(res,404,{message:'Event not found.'});

    const gallery=await store.list('event_gallery',{
      filters:{event_id:eventId},
      order:'sort_order.asc',
      limit:30
    });

    const includePhotos=bool(body.include_photos);

    if(includePhotos){
      if(!event.photo_consent_confirmed){
        return json(res,400,{
          message:'Confirm and save the event photography permission before using event photos with AI.'
        });
      }
      if(!bool(body.ai_photo_permission)){
        return json(res,400,{
          message:'Confirm that the selected photographs may be processed by the AI provider before continuing.'
        });
      }
    }

    const result=await generateEventReview({
      event:{
        ...event,
        title:cleanText(body.title,180) || event.title,
        category:cleanText(body.category,100) || event.category,
        start_at:cleanText(body.start_at,50) || event.start_at,
        location:cleanText(body.location,180) || event.location
      },
      aim:cleanText(body.aim,2000),
      notes:cleanText(body.notes,8000),
      transcript:cleanText(body.transcript,12000),
      gallery,
      includePhotos,
      metrics:{
        people_attending:Number(body.people_attending||0),
        children_attending:Number(body.children_attending||0),
        families_attending:Number(body.families_attending||0),
        volunteers_attending:Number(body.volunteers_attending||0),
        family_reach:Number(body.family_reach||0),
        value_support:Number(body.value_support||0)
      }
    });

    await audit(user,'ai_draft','event_review',eventId,{
      model:result.model,
      used_photos:includePhotos,
      photo_count:includePhotos ? Math.min(gallery.length,4) : 0
    });

    return json(res,200,{
      review_title:result.review_title,
      review_summary:result.review_summary,
      review_body:result.review_body,
      model:result.model,
      generated_at:new Date().toISOString()
    });
  }catch(err){
    console.error('AI event review error',err.detail || err);
    const message=
      err.message==='OPENAI_NOT_CONFIGURED'
        ? 'AI review drafting is not configured yet.'
        : err.message==='OPENAI_REVIEW_FAILED'
          ? 'The AI service could not create the review just now. Please try again.'
          : 'The review draft could not be created.';
    return json(res,503,{message});
  }
};
