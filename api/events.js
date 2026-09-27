const {json}=require('../lib/http'); const store=require('../lib/store');
module.exports=async function(req,res){
 if(req.method!=='GET') return json(res,405,{message:'Method not allowed.'});
 try{
  const events=(await store.list('events',{filters:{status:'published'},order:'start_at.asc',limit:100}));
  const galleries=await store.list('event_gallery',{order:'sort_order.asc',limit:500});
  const safe=events.map(e=>({id:e.id,title:e.title,start_at:e.start_at,end_at:e.end_at,location:e.location,category:e.category,summary:e.summary,body:e.body,public_image_url:e.public_image_url,booking_url:e.booking_url,gallery:galleries.filter(g=>g.event_id===e.id).map(g=>({image_url:g.image_url,alt_text:g.alt_text||''}))}));
  return json(res,200,{events:safe});
 }catch(err){console.error(err); return json(res,200,{events:[]});}
};
