-- =====================================================================
-- PROJECT GOLDEN CHILD — v2.4.2
-- Family postal / delivery address
--
-- Safe to run repeatedly. Existing records are retained.
-- =====================================================================

alter table public.pgc_referrals
  add column if not exists address_line_1 text;

alter table public.pgc_referrals
  add column if not exists address_line_2 text;

alter table public.pgc_referrals
  add column if not exists town_city text;

alter table public.pgc_referrals
  add column if not exists county text;

alter table public.pgc_referrals
  add column if not exists address_postcode text;

alter table public.pgc_referrals
  add column if not exists address_country text default 'United Kingdom';

alter table public.pgc_heroes
  add column if not exists address_line_1 text;

alter table public.pgc_heroes
  add column if not exists address_line_2 text;

alter table public.pgc_heroes
  add column if not exists town_city text;

alter table public.pgc_heroes
  add column if not exists county text;

alter table public.pgc_heroes
  add column if not exists address_postcode text;

alter table public.pgc_heroes
  add column if not exists address_country text default 'United Kingdom';

-- Where older records already contain a full postcode in postcode_prefix,
-- copy it into the new address_postcode field rather than losing it.
update public.pgc_referrals
set address_postcode=postcode_prefix
where coalesce(address_postcode,'')=''
  and coalesce(postcode_prefix,'')<>'';

update public.pgc_heroes
set address_postcode=postcode_prefix
where coalesce(address_postcode,'')=''
  and coalesce(postcode_prefix,'')<>'';

insert into public.pgc_schema_meta(version,applied_at)
values ('2.4.2',clock_timestamp())
on conflict (version) do update
set applied_at=excluded.applied_at;

notify pgrst, 'reload schema';

-- FINAL CHECK — expected result: ZERO ROWS.
with required(table_name,column_name) as (
  values
    ('pgc_referrals','address_line_1'),
    ('pgc_referrals','address_line_2'),
    ('pgc_referrals','town_city'),
    ('pgc_referrals','county'),
    ('pgc_referrals','address_postcode'),
    ('pgc_referrals','address_country'),
    ('pgc_heroes','address_line_1'),
    ('pgc_heroes','address_line_2'),
    ('pgc_heroes','town_city'),
    ('pgc_heroes','county'),
    ('pgc_heroes','address_postcode'),
    ('pgc_heroes','address_country')
)
select
  required.table_name,
  required.column_name as missing_column
from required
left join information_schema.columns actual
  on actual.table_schema='public'
 and actual.table_name=required.table_name
 and actual.column_name=required.column_name
where actual.column_name is null
order by required.table_name,required.column_name;
