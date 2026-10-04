const { json, readBody, cleanText, bool } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');
const { audit } = require('../lib/audit');
const { londonLocalToUtc, validDate, validTime, validEmail, scheduleAppointmentReminders, cancelAppointmentReminders } = require('../lib/appointments');

function validStatus(value){return ['scheduled','completed','cancelled'].includes(value)?value:'scheduled';}
function validType(value){const v=cleanText(value,80);return v || 'Family contact';}

async function decorateAppointments(items,heroes,referrals,reminders){
  const heroMap=new Map(heroes.map(x=>[x.id,x]));
  const refMap=new Map(referrals.map(x=>[x.id,x]));
  return items.map(item=>{
    const hero=item.hero_id?heroMap.get(item.hero_id):null;
    const referral=item.referral_id?refMap.get(item.referral_id):null;
    return {...item,linked_name:hero?.preferred_name||hero?.child_name||referral?.child_name||'',linked_type:hero?'Harper’s Hero':(referral?'Referral':''),reminders:reminders.filter(r=>r.appointment_id===item.id)};
  });
}

module.exports=async function(req,res){
  const user=requireAdmin(req,res); if(!user)return;
  try{
    if(req.method==='GET'){
      const [items,heroes,referrals,reminders]=await Promise.all([
        store.list('appointments',{order:'start_at.asc'}),
        store.list('heroes',{order:'created_at.desc'}),
        store.list('referrals',{order:'created_at.desc'}),
        store.list('appointment_reminders',{order:'scheduled_for.asc'})
      ]);
      return json(res,200,{items:await decorateAppointments(items,heroes,referrals,reminders),heroes,referrals,adminReminderEmail:process.env.APPOINTMENT_ADMIN_EMAIL||process.env.NOTIFICATION_EMAIL||''});
    }

    if(req.method==='POST'){
      const b=await readBody(req);
      const action=cleanText(b.action,30)||'create';
      if(action==='complete'){
        const id=cleanText(b.id,80); const existing=await store.get('appointments',id);
        if(!existing)return json(res,404,{message:'Appointment not found.'});
        await cancelAppointmentReminders(id);
        const item=await store.update('appointments',id,{status:'completed'});
        await audit(user,'complete','appointment',id);
        return json(res,200,{item});
      }

      const date=validDate(b.date),time=validTime(b.time);
      const title=cleanText(b.title,240),meetingWith=cleanText(b.meeting_with,240),location=cleanText(b.location,500);
      if(!date||!time||!title||!meetingWith||!location)return json(res,400,{message:'Complete the appointment title, who it is with, date, time and location.'});
      const start=londonLocalToUtc(date,time);
      let endAt=null;
      if(validTime(b.end_time)){
        endAt=londonLocalToUtc(date,validTime(b.end_time));
        if(endAt<=start) return json(res,400,{message:'The appointment end time must be after the start time.'});
      }
      const heroId=cleanText(b.hero_id,80)||null,referralId=cleanText(b.referral_id,80)||null;
      if(heroId && !await store.get('heroes',heroId))return json(res,404,{message:'The linked Harper’s Hero record was not found.'});
      if(referralId && !await store.get('referrals',referralId))return json(res,404,{message:'The linked referral record was not found.'});
      const contactEmail=cleanText(b.contact_email,180);
      if(contactEmail && !validEmail(contactEmail))return json(res,400,{message:'Enter a valid family/contact email address or leave it blank.'});

      const patch={
        hero_id:heroId,referral_id:referralId,appointment_type:validType(b.appointment_type),title,meeting_with:meetingWith,
        contact_email:contactEmail,location,start_at:start.toISOString(),end_at:endAt?endAt.toISOString():null,
        notes:cleanText(b.notes,5000),status:validStatus(b.status),reminder_admin:bool(b.reminder_admin),reminder_family:bool(b.reminder_family),
        reminder_24h:bool(b.reminder_24h),reminder_morning:bool(b.reminder_morning),reminder_30m:bool(b.reminder_30m),updated_by:user.email
      };
      let item;
      if(action==='update'){
        const id=cleanText(b.id,80); const existing=await store.get('appointments',id);
        if(!existing)return json(res,404,{message:'Appointment not found.'});
        await cancelAppointmentReminders(id);
        item=await store.update('appointments',id,patch);
        const old=await store.list('appointment_reminders',{filters:{appointment_id:id}});
        for(const reminder of old) if(reminder.status!=='sent') await store.remove('appointment_reminders',reminder.id);
        await audit(user,'update','appointment',id,{title,start_at:patch.start_at});
      }else{
        item=await store.insert('appointments',{...patch,created_by:user.email});
        await audit(user,'create','appointment',item.id,{title,start_at:item.start_at});
      }
      const reminders=patch.status==='scheduled' ? await scheduleAppointmentReminders(item) : {scheduled:0,deferred:0,failed:0,results:[]};
      return json(res,action==='update'?200:201,{item,reminders});
    }

    if(req.method==='DELETE'){
      const url=new URL(req.url,'http://local'); const id=cleanText(url.searchParams.get('id'),80);
      if(!id)return json(res,400,{message:'Missing appointment id.'});
      const existing=await store.get('appointments',id); if(!existing)return json(res,404,{message:'Appointment not found.'});
      await cancelAppointmentReminders(id);
      const reminders=await store.list('appointment_reminders',{filters:{appointment_id:id}});
      for(const row of reminders) await store.remove('appointment_reminders',row.id);
      await audit(user,'delete','appointment',id,{title:existing.title,start_at:existing.start_at});
      await store.remove('appointments',id);
      return json(res,200,{ok:true});
    }
    return json(res,405,{message:'Method not allowed.'});
  }catch(err){console.error('Admin appointments error',err);return json(res,503,{message:'Appointments are unavailable.'});}
};
