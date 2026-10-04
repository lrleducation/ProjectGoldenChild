const { json } = require('../lib/http');
const store = require('../lib/store');
const { scheduleAppointmentReminders } = require('../lib/appointments');

module.exports=async function(req,res){
  const secret=String(process.env.CRON_SECRET||'').trim();
  if(!secret)return json(res,503,{message:'CRON_SECRET is not configured.'});
  if(String(req.headers.authorization||'')!==`Bearer ${secret}`)return json(res,401,{message:'Unauthorised.'});
  try{
    const now=new Date(),horizon=new Date(now.getTime()+31*24*60*60*1000);
    const rows=await store.list('appointments',{order:'start_at.asc',limit:500});
    const upcoming=rows.filter(x=>x.status==='scheduled' && new Date(x.start_at)>now && new Date(x.start_at)<=horizon);
    const summaries=[];
    for(const item of upcoming){
      try{summaries.push({appointment_id:item.id,...await scheduleAppointmentReminders(item,now)});}
      catch(err){summaries.push({appointment_id:item.id,error:String(err.message||err)});}
    }
    return json(res,200,{ok:true,checked:upcoming.length,summaries});
  }catch(err){console.error('Appointment reminder cron failed',err);return json(res,500,{message:'Reminder staging failed.'});}
};
