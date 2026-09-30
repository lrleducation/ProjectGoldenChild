const { json } = require('../lib/http');
const { requireAdmin } = require('../lib/security');
const store = require('../lib/store');
const {getSupabaseAdmin}=require('../lib/supabase-admin');

const REQUIRED_COLUMNS = {
  referrals: [
    'id','route','status','submitter_name','submitter_relationship','submitter_email','submitter_phone',
    'referrer_name','referrer_relationship','referrer_email','referrer_phone','child_name','preferred_name',
    'date_of_birth','postcode_prefix','life_status','family_contact_name','family_contact_email',
    'family_contact_phone','family_aware','referral_reason','cancer_type','diagnosis_date_text',
    'journey_notes','interests','consent_heroes','consent_health','consent_recognition','consent_events',
    'consent_updates','consent_media_interest','privacy_accepted','contacted_at','admin_notes',
    'created_at','updated_at'
  ],
  heroes: [
    'id','referral_id','child_name','preferred_name','date_of_birth','postcode_prefix','life_status',
    'cancer_type','diagnosis_date_text','journey_notes','interests','primary_contact_name',
    'primary_contact_email','primary_contact_phone','consent_recognition','consent_events',
    'consent_updates','consent_media_interest','status','admin_notes','created_at','updated_at'
  ],
  hero_actions: [
    'id','hero_id','action_type','title','due_date','status','notes','value_gbp','completed_at',
    'created_at','updated_at'
  ],
  events: [
    'id','title','start_at','end_at','location','category','status','max_places','summary','body',
    'public_image_url','poster_alt','display_section','booking_url',
    'children_attending','people_attending','families_attending','volunteers_attending',
    'family_reach','value_support','published_at',
    'photo_consent_confirmed','photo_consent_note','photo_consent_confirmed_at','photo_consent_confirmed_by',
    'review_status','review_title','review_summary','review_body','review_voice_transcript',
    'review_ai_generated_at','review_published_at',
    'created_at','updated_at'
  ],
  event_gallery: ['id','event_id','image_url','alt_text','caption','include_in_review','sort_order','created_at','updated_at'],
  go_gold_registrations: [
    'id','organisation_name','organisation_type','contact_name','contact_email','postcode','notes',
    'updates','status','admin_notes','created_at','updated_at'
  ],
  contacts: ['id','name','email','subject','message','status','admin_notes','created_at','updated_at'],
  audit_log: ['id','actor_email','action','entity_type','entity_id','detail','created_at','updated_at'],
  communications: [
    'id','hero_id','referral_id','direction','method','contact_name','contact_email','contact_phone',
    'subject','notes','outcome','occurred_at','follow_up_date','created_by','created_at','updated_at'
  ]
};

module.exports = async function(req,res){
  if(req.method !== 'GET') return json(res,405,{message:'Method not allowed.'});
  if(!requireAdmin(req,res)) return;

  const checks = {};

  for (const [table,columns] of Object.entries(REQUIRED_COLUMNS)) {
    checks[table] = await store.probe(table,columns);
  }

  const write = await store.writeProbe();
  const version = await store.schemaVersion();
  const tableReadOk = Object.values(checks).every(result => result.ok);
  let storage={ok:false,detail:''};
  try{
    const supabase=getSupabaseAdmin();
    const {data,error}=await supabase.storage.getBucket('event-public');
    if(error) throw error;
    storage={
      ok:Boolean(data?.id === 'event-public'),
      public:Boolean(data?.public),
      fileSizeLimit:Number(data?.file_size_limit || 0),
      allowedMimeTypes:data?.allowed_mime_types || []
    };
  }catch(err){
    storage={
      ok:false,
      detail:err?.message || String(err)
    };
  }

  const ok = tableReadOk && write.ok && storage.ok && version === '2.3.1';

  return json(res,200,{
    ok,
    schemaVersion:version,
    checks,
    write,
    storage,
    physicalTables:store.TABLE_MAP,
    configuration:{
      databaseConfigured:store.configured(),
      keyType:String(process.env.SUPABASE_SECRET_KEY || '').trim().startsWith('sb_secret_')
        ? 'secret'
        : 'legacy-or-missing',
      emailConfigured:Boolean(
        process.env.RESEND_API_KEY &&
        process.env.FROM_EMAIL &&
        process.env.NOTIFICATION_EMAIL
      ),
      aiConfigured:Boolean(process.env.OPENAI_API_KEY),
      aiReviewModel:String(process.env.OPENAI_REVIEW_MODEL || 'gpt-5.6-luna'),
      aiTranscribeModel:String(process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe')
    }
  });
};
