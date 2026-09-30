const {json,readBody,cleanText,bool}=require('../lib/http');
const {requireAdmin}=require('../lib/security');
const store=require('../lib/store');
const {audit}=require('../lib/audit');
const {
  publicObjectUrl,
  verifyPublicObject
}=require('../lib/supabase-storage');

function pathBelongsToEvent(objectPath,eventId,kind){
  const expected=`events/${eventId}/${kind}/`;
  return String(objectPath || '').startsWith(expected);
}

module.exports=async function(req,res){
  const user=requireAdmin(req,res);
  if(!user) return;
  if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});

  try{
    const body=await readBody(req,256*1024);
    const eventId=cleanText(body.event_id,80);
    const kind=body.kind==='gallery'?'gallery':'poster';
    const objectPath=cleanText(body.path,1000);

    if(!eventId || !objectPath){
      return json(res,400,{message:'Upload details are incomplete.'});
    }

    if(!pathBelongsToEvent(objectPath,eventId,kind)){
      return json(res,400,{message:'The uploaded file does not belong to this event.'});
    }

    const event=await store.get('events',eventId);
    if(!event) return json(res,404,{message:'Event not found.'});

    if(kind==='gallery'){
      const confirmed=
        Boolean(event.photo_consent_confirmed) ||
        bool(body.photo_consent_confirmed);

      if(!confirmed){
        return json(res,400,{
          message:'Confirm that publication permission is recorded before adding event photographs.'
        });
      }

      if(!event.photo_consent_confirmed && bool(body.photo_consent_confirmed)){
        await store.update('events',eventId,{
          photo_consent_confirmed:true,
          photo_consent_note:cleanText(body.photo_consent_note,1200),
          photo_consent_confirmed_at:new Date().toISOString(),
          photo_consent_confirmed_by:user.email
        });
      }
    }

    const verified=await verifyPublicObject('event-public',objectPath,{attempts:6});
    if(!verified.ok){
      return json(res,409,{
        message:`The file upload finished but the image is not readable from Storage yet (HTTP ${verified.status || 'unknown'}). Please try the upload again.`
      });
    }

    const imageUrl=publicObjectUrl('event-public',objectPath);

    if(kind==='gallery'){
      const item=await store.insert('event_gallery',{
        event_id:eventId,
        image_url:imageUrl,
        alt_text:cleanText(body.alt_text,250) || `${event.title} event photograph`,
        caption:cleanText(body.caption,500),
        include_in_review:true,
        sort_order:Number(body.sort_order||0)
      });

      await audit(user,'upload','event_gallery',item.id,{
        event_id:eventId,
        storage_path:objectPath
      });

      return json(res,201,{url:imageUrl,item});
    }

    const updated=await store.update('events',eventId,{
      public_image_url:imageUrl,
      poster_alt:cleanText(body.alt_text,300)
    });

    await audit(user,'upload','event_poster',eventId,{
      storage_path:objectPath
    });

    return json(res,201,{url:imageUrl,item:updated});
  }catch(err){
    console.error('Upload completion error',err);
    return json(res,503,{
      message:'The image uploaded but could not be attached to the event. Please try again.'
    });
  }
};
