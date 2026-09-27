const store = require('./store');
async function audit(user, action, entityType, entityId, detail={}) {
  try {
    await store.insert('audit_log', {
      actor_email:user?.email || 'public', action, entity_type:entityType,
      entity_id:entityId || null, detail
    });
  } catch (err) { console.error('Audit log failed', err.message); }
}
module.exports = { audit };
