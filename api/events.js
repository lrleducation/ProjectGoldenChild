const {json}=require('../lib/http');
const store=require('../lib/store');

function sectionFor(event){
  if(event.display_section==='past' || event.display_section==='future'){
    return event.display_section;
  }
  if(event.start_at){
    const time=new Date(event.start_at).getTime();
    if(Number.isFinite(time) && time<Date.now()) return 'past';
  }
  return 'future';
}

module.exports=async function(req,res){
  if(req.method!=='GET') return json(res,405,{message:'Method not allowed.'});

  try{
    const [events,gallery]=await Promise.all([
      store.list('events',{
        filters:{status:'published'},
        order:'created_at.desc',
        limit:150
      }),
      store.list('event_gallery',{
        order:'sort_order.asc',
        limit:1000
      })
    ]);

    const safe=events.map(event=>{
      const reviewPublished=
        sectionFor(event)==='past' &&
        event.review_status==='published';

      const publicGallery=
        reviewPublished && event.photo_consent_confirmed
          ? gallery
              .filter(image=>image.event_id===event.id && image.include_in_review!==false)
              .map(image=>({
                id:image.id,
                image_url:image.image_url,
                alt_text:image.alt_text || `${event.title || 'Project Golden Child event'} photograph`,
                caption:image.caption || ''
              }))
          : [];

      return {
        id:event.id,
        title:event.title,
        start_at:event.start_at,
        end_at:event.end_at,
        location:event.location,
        category:event.category,
        summary:event.summary,
        body:event.body,
        public_image_url:event.public_image_url,
        poster_alt:event.poster_alt || `${event.title || 'Project Golden Child event'} poster`,
        booking_url:event.booking_url,
        display_section:sectionFor(event),

        review_published:reviewPublished,
        review_title:reviewPublished ? event.review_title : '',
        review_summary:reviewPublished ? event.review_summary : '',
        review_body:reviewPublished ? event.review_body : '',

        people_attending:reviewPublished ? Number(event.people_attending||0) : 0,
        children_attending:reviewPublished ? Number(event.children_attending||0) : 0,
        families_attending:reviewPublished ? Number(event.families_attending||0) : 0,
        volunteers_attending:reviewPublished ? Number(event.volunteers_attending||0) : 0,
        value_support:reviewPublished ? Number(event.value_support||0) : 0,

        gallery:publicGallery
      };
    });

    return json(res,200,{events:safe});
  }catch(err){
    console.error('Public events error',err);
    return json(res,200,{events:[]});
  }
};
