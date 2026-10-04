const { json } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');

async function loadSummaryTable(table, { optional=false }={}) {
  try {
    return { ok:true, items:await store.list(table) };
  } catch(err) {
    console.error(`Dashboard summary could not load ${table}`,err);
    if(!optional) throw err;
    return { ok:false, items:[] };
  }
}

module.exports = async function(req,res){
  if(req.method !== 'GET') return json(res,405,{message:'Method not allowed.'});
  if(!requireAdmin(req,res)) return;

  try {
    // Core counts must continue to work even if a newer optional module has
    // not yet been migrated or is temporarily unavailable. Previously a
    // failure in communications/appointments caused the whole dashboard
    // summary to fail.
    const [heroesResult,refsResult,eventsResult,goldResult,actionsResult] = await Promise.all([
      loadSummaryTable('heroes'),
      loadSummaryTable('referrals'),
      loadSummaryTable('events'),
      loadSummaryTable('go_gold_registrations'),
      loadSummaryTable('hero_actions')
    ]);

    const [communicationsResult,appointmentsResult] = await Promise.all([
      loadSummaryTable('communications',{optional:true}),
      loadSummaryTable('appointments',{optional:true})
    ]);

    const heroes = heroesResult.items;
    const refs = refsResult.items;
    const events = eventsResult.items;
    const gold = goldResult.items;
    const actions = actionsResult.items;
    const communications = communicationsResult.items;
    const appointments = appointmentsResult.items;

    const now = Date.now();
    const todayParts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB',{
        timeZone:'Europe/London',
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
      }).formatToParts(new Date())
        .filter(p => p.type !== 'literal')
        .map(p => [p.type,p.value])
    );
    const todayLondon = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;

    const activeHeroes = heroes.filter(x => x.status !== 'archived');
    const newReferrals = refs.filter(x => !x.status || x.status === 'new');

    return json(res,200,{
      // 'referrals' is deliberately the total number held on the system.
      // A promoted referral remains part of the referral history and should
      // not disappear from the dashboard count.
      heroes:activeHeroes.length,
      referrals:refs.length,
      newReferrals:newReferrals.length,
      events:events.filter(x =>
        x.status === 'published' &&
        (!x.start_at || new Date(x.start_at).getTime() >= now)
      ).length,
      gold:gold.length,
      actions:actions.filter(x => !['completed','cancelled'].includes(x.status)).length,
      communications:communications.length,
      appointments:appointments.filter(x => x.status === 'scheduled' && new Date(x.start_at).getTime() >= now).length,
      followups:communications.filter(x =>
        x.follow_up_date &&
        !x.follow_up_completed_at &&
        String(x.follow_up_date).slice(0,10) <= todayLondon
      ).length,
      partial:!communicationsResult.ok || !appointmentsResult.ok
    });
  } catch(err) {
    console.error(err);
    return json(res,503,{message:'Dashboard data is unavailable.'});
  }
};
