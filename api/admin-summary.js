const { json } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');

module.exports = async function(req,res){
  if(req.method !== 'GET') return json(res,405,{message:'Method not allowed.'});
  if(!requireAdmin(req,res)) return;

  try {
    const [heroes,refs,events,gold,actions,communications,appointments] = await Promise.all([
      store.list('heroes'),
      store.list('referrals'),
      store.list('events'),
      store.list('go_gold_registrations'),
      store.list('hero_actions'),
      store.list('communications'),
      store.list('appointments')
    ]);

    const now = Date.now();
    const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    const todayLondon = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;

    return json(res,200,{
      heroes:heroes.filter(x => x.status !== 'archived').length,
      referrals:refs.filter(x => x.status === 'new').length,
      events:events.filter(x =>
        x.status === 'published' &&
        (!x.start_at || new Date(x.start_at).getTime() >= now)
      ).length,
      gold:gold.length,
      actions:actions.filter(x => !['completed','cancelled'].includes(x.status)).length,
      communications:communications.length,
      appointments:appointments.filter(x => x.status === 'scheduled' && new Date(x.start_at).getTime() >= now).length,
      followups:communications.filter(x => x.follow_up_date && !x.follow_up_completed_at && String(x.follow_up_date).slice(0,10) <= todayLondon).length
    });
  } catch(err) {
    console.error(err);
    return json(res,503,{message:'Dashboard data is unavailable.'});
  }
};
