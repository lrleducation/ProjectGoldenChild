const { json } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');

module.exports = async function(req,res){
  if(req.method !== 'GET') return json(res,405,{message:'Method not allowed.'});
  if(!requireAdmin(req,res)) return;

  try {
    const [heroes,refs,events,gold,actions,communications] = await Promise.all([
      store.list('heroes'),
      store.list('referrals'),
      store.list('events'),
      store.list('go_gold_registrations'),
      store.list('hero_actions'),
      store.list('communications')
    ]);

    const now = Date.now();

    return json(res,200,{
      heroes:heroes.filter(x => x.status !== 'archived').length,
      referrals:refs.filter(x => x.status === 'new').length,
      events:events.filter(x =>
        x.status === 'published' &&
        (!x.start_at || new Date(x.start_at).getTime() >= now)
      ).length,
      gold:gold.length,
      actions:actions.filter(x => !['completed','cancelled'].includes(x.status)).length,
      communications:communications.length
    });
  } catch(err) {
    console.error(err);
    return json(res,503,{message:'Dashboard data is unavailable.'});
  }
};
