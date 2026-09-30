const {json,readBody,cleanText,bool}=require('../lib/http');
const {requireAdmin}=require('../lib/security');
const store=require('../lib/store');
const {audit}=require('../lib/audit');

function validStatus(value){
  return ['draft','published','archived','cancelled'].includes(value) ? value : 'draft';
}

function validSection(value,startAt){
  if(value==='past' || value==='future') return value;
  if(startAt){
    const time=new Date(startAt).getTime();
    if(Number.isFinite(time) && time<Date.now()) return 'past';
  }
  return 'future';
}

function validReviewStatus(value){
  return value==='published' ? 'published' : 'draft';
}

module.exports=async function(req,res){
  const user=requireAdmin(req,res);
  if(!user) return;

  try{
    if(req.method==='GET'){
      const items=await store.list('events',{order:'updated_at.desc'});
      const gallery=await store.list('event_gallery',{order:'sort_order.asc'});
      return json(res,200,{
        items:items.map(event=>({
          ...event,
          display_section:validSection(event.display_section,event.start_at),
          review_status:validReviewStatus(event.review_status),
          gallery:gallery.filter(image=>image.event_id===event.id)
        }))
      });
    }

    if(req.method==='POST'){
      const body=await readBody(req,3*1024*1024);
      const id=cleanText(body.id,80);
      const existing=id ? await store.get('events',id) : null;

      const startAt=cleanText(body.start_at,40)||null;
      const status=validStatus(cleanText(body.status,30));
      const reviewStatus=validReviewStatus(cleanText(body.review_status,30));
      const publicImageUrl=cleanText(
        body.public_image_url !== undefined ? body.public_image_url : existing?.public_image_url,
        1000
      );

      const photoConsent=bool(body.photo_consent_confirmed);
      const patch={
        title:cleanText(body.title,180),
        start_at:startAt,
        end_at:cleanText(body.end_at,40)||null,
        location:cleanText(body.location,180),
        category:cleanText(body.category,100)||'Community',
        status,
        display_section:validSection(cleanText(body.display_section,20),startAt),
        poster_alt:cleanText(body.poster_alt,300),
        max_places:Number(body.max_places||0)||null,
        summary:cleanText(body.summary,650),
        body:cleanText(body.body,12000),
        children_attending:Number(body.children_attending||0),
        people_attending:Number(body.people_attending||0),
        families_attending:Number(body.families_attending||0),
        volunteers_attending:Number(body.volunteers_attending||0),
        family_reach:Number(body.family_reach||0),
        value_support:Number(body.value_support||0),
        booking_url:cleanText(body.booking_url,500),
        public_image_url:publicImageUrl,
        photo_consent_confirmed:photoConsent,
        photo_consent_note:cleanText(body.photo_consent_note,1200),
        review_status:reviewStatus,
        review_title:cleanText(body.review_title,220),
        review_summary:cleanText(body.review_summary,1200),
        review_body:cleanText(body.review_body,16000),
        review_voice_transcript:cleanText(body.review_voice_transcript,16000),
        review_ai_generated_at:cleanText(body.review_ai_generated_at,80)||null
      };

      if(photoConsent && !(existing?.photo_consent_confirmed)){
        patch.photo_consent_confirmed_at=new Date().toISOString();
        patch.photo_consent_confirmed_by=user.email;
      }

      if(!photoConsent){
        patch.photo_consent_confirmed_at=null;
        patch.photo_consent_confirmed_by=null;
      }

      if(!patch.title){
        return json(res,400,{message:'Event title is required.'});
      }

      if(status==='published' && !publicImageUrl){
        return json(res,400,{
          message:'Upload a poster before making this event live on the website.'
        });
      }

      if(reviewStatus==='published'){
        if(validSection(patch.display_section,startAt)!=='past'){
          return json(res,400,{
            message:'An event review can only be made public when the event is in Past events.'
          });
        }
        if(!patch.review_title || !patch.review_body){
          return json(res,400,{
            message:'Add a review title and review before publishing the event review.'
          });
        }
        if(!(existing?.review_published_at)){
          patch.review_published_at=new Date().toISOString();
        }
      }

      if(status==='published' && !(existing?.published_at)){
        patch.published_at=new Date().toISOString();
      }

      const item=id
        ? await store.update('events',id,patch)
        : await store.insert('events',patch);

      await audit(user,id?'update':'create','event',item.id,{
        status:item.status,
        display_section:item.display_section,
        review_status:item.review_status
      });

      return json(res,id?200:201,{item});
    }

    if(req.method==='DELETE'){
      const url=new URL(req.url,'http://local');
      const galleryId=cleanText(url.searchParams.get('gallery_id'),80);

      if(galleryId){
        const image=await store.get('event_gallery',galleryId);
        if(!image) return json(res,404,{message:'Gallery image not found.'});
        await audit(user,'delete','event_gallery',galleryId,{event_id:image.event_id});
        await store.remove('event_gallery',galleryId);
        return json(res,200,{ok:true});
      }

      const id=cleanText(url.searchParams.get('id'),80);
      const event=await store.get('events',id);
      if(!event) return json(res,404,{message:'Event not found.'});

      await audit(user,'delete','event',id,{title:event.title});
      await store.remove('events',id);
      return json(res,200,{ok:true});
    }

    return json(res,405,{message:'Method not allowed.'});
  }catch(err){
    console.error('Admin events error',err);
    return json(res,503,{message:'Event data is unavailable.'});
  }
};
