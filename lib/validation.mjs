const clean = (value, max=1000) => String(value ?? '').trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,max);
const emailOk = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const phoneOk = value => !value || /^[+()\d\s-]{7,25}$/.test(value);
const postcodeOk = value => !value || /^[A-Z]{1,2}\d[A-Z\d]?\s?\d?[A-Z]{0,2}$/i.test(value);
const httpUrlOk = value => { if(!value) return true; try { const u=new URL(value); return u.protocol==='https:' || (u.protocol==='http:' && ['localhost','127.0.0.1'].includes(u.hostname)); } catch { return false; } };

export function validateReferral(input) {
  const route = input?.route === 'referrer' ? 'referrer' : 'parent';
  const errors=[];
  const out={ route };
  if (route === 'parent') {
    out.submitter_name=clean(input.submitter_name,120);
    out.submitter_relationship=clean(input.submitter_relationship,80);
    out.submitter_email=clean(input.submitter_email,180).toLowerCase();
    out.submitter_phone=clean(input.submitter_phone,30);
    out.child_name=clean(input.child_name,160);
    out.preferred_name=clean(input.preferred_name,100);
    out.date_of_birth=clean(input.date_of_birth,20);
    out.postcode_prefix=clean(input.postcode_prefix,8).toUpperCase();
    out.life_status=clean(input.life_status,60);
    out.cancer_type=clean(input.cancer_type,140);
    out.diagnosis_date_text=clean(input.diagnosis_date_text,80);
    out.journey_notes=clean(input.journey_notes,2500);
    out.interests=clean(input.interests,1800);
    out.family_contact_name=out.submitter_name;
    out.family_contact_email=out.submitter_email;
    out.family_contact_phone=out.submitter_phone;
    out.family_aware=true;
    out.consents={
      heroes: Boolean(input?.consents?.heroes),
      health: Boolean(input?.consents?.health),
      recognition: Boolean(input?.consents?.recognition),
      events: Boolean(input?.consents?.events),
      updates: Boolean(input?.consents?.updates),
      media_interest: Boolean(input?.consents?.media_interest),
      captured_at: new Date().toISOString(),
      privacy_version: '2026-09-27-v1'
    };
    out.privacy_accepted=Boolean(input.privacy_accepted);
    if(!out.submitter_name) errors.push('Your name is required.');
    if(!out.submitter_relationship) errors.push('Your relationship to the child is required.');
    if(!emailOk(out.submitter_email)) errors.push('A valid email address is required.');
    if(!phoneOk(out.submitter_phone)) errors.push('Please check the phone number.');
    if(!out.child_name) errors.push("The child's name is required.");
    if(!out.date_of_birth) errors.push('Date of birth is required.');
    if(!postcodeOk(out.postcode_prefix)) errors.push('Please check the postcode.');
    if(!out.life_status) errors.push('Please tell us their current situation.');
    if(!out.cancer_type) errors.push('Cancer type is required so we can plan appropriate recognition.');
    if(!out.consents.heroes) errors.push("Harper's Heroes membership consent is required to register a child.");
    if(!out.consents.health) errors.push('Explicit consent to use the health information provided is required for this registration.');
    if(!out.privacy_accepted) errors.push('Please confirm you have read the privacy information.');
  } else {
    out.submitter_name=clean(input.submitter_name,120);
    out.submitter_relationship=clean(input.submitter_relationship,120);
    out.submitter_email=clean(input.submitter_email,180).toLowerCase();
    out.submitter_phone=clean(input.submitter_phone,30);
    out.child_name=clean(input.child_name,160);
    out.family_contact_name=clean(input.family_contact_name,140);
    out.family_contact_email=clean(input.family_contact_email,180).toLowerCase();
    out.family_contact_phone=clean(input.family_contact_phone,30);
    out.family_aware=Boolean(input.family_aware);
    out.referral_reason=clean(input.referral_reason,1800);
    out.consents={};
    out.privacy_accepted=Boolean(input.privacy_accepted);
    if(!out.submitter_name) errors.push('Your name is required.');
    if(!out.submitter_relationship) errors.push('Your relationship or role is required.');
    if(!emailOk(out.submitter_email)) errors.push('A valid referrer email is required.');
    if(!out.child_name) errors.push("The child's name is required.");
    if(!out.family_contact_name) errors.push('A parent or carer contact name is required.');
    if(!emailOk(out.family_contact_email) && !(out.family_contact_phone && phoneOk(out.family_contact_phone))) errors.push('Please provide a valid parent/carer email or phone number.');
    if(!out.family_aware) errors.push('The family must know about the referral before we can contact them.');
    if(!out.privacy_accepted) errors.push('Please confirm the referral privacy information.');
  }
  return { ok: errors.length===0, errors, data:out };
}

export function validateGoGold(input){
  const data={
    organisation_name:clean(input.organisation_name,180), organisation_type:clean(input.organisation_type,80),
    contact_name:clean(input.contact_name,120), contact_email:clean(input.contact_email,180).toLowerCase(),
    postcode:clean(input.postcode,12).toUpperCase(), notes:clean(input.notes,1200), updates: Boolean(input.updates)
  };
  const errors=[];
  if(!data.organisation_name) errors.push('Organisation name is required.');
  if(!data.organisation_type) errors.push('Organisation type is required.');
  if(!data.contact_name) errors.push('Contact name is required.');
  if(!emailOk(data.contact_email)) errors.push('A valid email is required.');
  return {ok:!errors.length,errors,data};
}

export function validateEvent(input){
  const data={
    title:clean(input.title,180), slug:clean(input.slug,180).toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,''),
    summary:clean(input.summary,650), body:clean(input.body,10000), start_at:clean(input.start_at,40), end_at:clean(input.end_at,40),
    location:clean(input.location,220), category:clean(input.category,80), status:clean(input.status,40), hero_image_url:clean(input.hero_image_url,1000),
    max_places: Number.isFinite(Number(input.max_places)) ? Number(input.max_places) : null,
    booking_url:clean(input.booking_url,1000), attendance_children:Number(input.attendance_children||0), attendance_family:Number(input.attendance_family||0), value_provided:Number(input.value_provided||0)
  };
  if(!data.slug && data.title) data.slug=data.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,180);
  const errors=[];
  if(!data.title) errors.push('Event title is required.');
  if(!['draft','published','completed','archived','cancelled'].includes(data.status)) errors.push('Choose a valid event status.');
  if(data.status==='published' && !data.start_at) errors.push('Published events need a date/time.');
  if(!httpUrlOk(data.booking_url)) errors.push('Booking/info URL must use https.');
  if(!httpUrlOk(data.hero_image_url) && !data.hero_image_url.startsWith('/uploads/')) errors.push('Event image URL is not valid.');
  return {ok:!errors.length,errors,data};
}
