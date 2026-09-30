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
    const events=await store.list('events',{
      filters:{status:'published'},
      order:'created_at.desc',
      limit:150
    });

    const safe=events.map(event=>({
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
      display_section:sectionFor(event)
    }));

    return json(res,200,{events:safe});
  }catch(err){
    console.error('Public events error',err);
    return json(res,200,{events:[]});
  }
};
