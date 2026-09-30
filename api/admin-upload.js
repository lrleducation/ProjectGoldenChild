const {json,readBody,cleanText}=require('../lib/http');
const {requireAdmin}=require('../lib/security');
const {uploadPublicImage}=require('../lib/storage');
const store=require('../lib/store');
const {audit}=require('../lib/audit');

module.exports=async function(req,res){
  const user=requireAdmin(req,res);
  if(!user) return;
  if(req.method!=='POST') return json(res,405,{message:'Method not allowed.'});

  try{
    // Base64 adds overhead, so allow enough request body for an 8 MB image.
    const body=await readBody(req,12*1024*1024);
    const eventId=cleanText(body.event_id,80);
    const kind=body.kind==='gallery'?'gallery':'poster';

    if(!eventId){
      return json(res,400,{message:'Save the event before uploading images.'});
    }

    const event=await store.get('events',eventId);
    if(!event) return json(res,404,{message:'Event not found.'});

    const imageUrl=await uploadPublicImage({
      base64:body.base64,
      mimeType:cleanText(body.mime_type,80),
      prefix:`events/${eventId}/${kind}`
    });

    if(kind==='gallery'){
      const item=await store.insert('event_gallery',{
        event_id:eventId,
        image_url:imageUrl,
        alt_text:cleanText(body.alt_text,250),
        sort_order:Number(body.sort_order||0)
      });
      await audit(user,'upload','event_gallery',item.id,{event_id:eventId});
      return json(res,201,{url:imageUrl,item});
    }

    await store.update('events',eventId,{
      public_image_url:imageUrl,
      poster_alt:cleanText(body.alt_text,300)
    });
    await audit(user,'upload','event_poster',eventId);
    return json(res,201,{url:imageUrl});
  }catch(err){
    console.error('Event upload error',err);
    const message=
      err.message==='IMAGE_SIZE'
        ? 'Poster images must be under 8 MB.'
        : err.message==='UNSUPPORTED_IMAGE_TYPE'
          ? 'Use a PNG, JPEG or WebP image.'
          : 'Image upload failed.';
    return json(res,400,{message});
  }
};
